import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { eq, and, gt } from "drizzle-orm";
import { db } from "../db/client.js";
import { users, sessions, emailVerifications, passwordResets } from "../db/schema/index.js";
import { workspaces, workspaceMembers } from "../db/schema/index.js";
import type { User } from "../db/schema/users.js";

const BCRYPT_ROUNDS = 12;
const SESSION_TTL_MS = parseInt(process.env["SESSION_TTL_SECONDS"] ?? "604800", 10) * 1000;
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;        // 1 hour

// ─── Token helpers ────────────────────────────────────────────────────────────

/** Generate a cryptographically random token and return both the raw value and its hash */
function generateToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

// ─── Auth service ─────────────────────────────────────────────────────────────

export const authService = {
  async register(input: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<{ user: User; verificationToken: string }> {
    const email = input.email.toLowerCase().trim();

    // Check for existing account
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      throw new AuthError("EMAIL_ALREADY_EXISTS", "An account with this email already exists.");
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    // Create user + workspace in a transaction
    const user = await db.transaction(async (tx) => {
      const [newUser] = await tx
        .insert(users)
        .values({
          email,
          displayName: input.displayName.trim(),
          passwordHash,
          authProvider: "email",
        })
        .returning();

      if (!newUser) throw new Error("Failed to create user");

      // Every user gets their own workspace automatically
      const [ws] = await tx
        .insert(workspaces)
        .values({ name: `${newUser.displayName}'s Workspace`, ownerId: newUser.id })
        .returning();

      if (!ws) throw new Error("Failed to create workspace");

      await tx.insert(workspaceMembers).values({
        workspaceId: ws.id,
        userId: newUser.id,
        role: "owner",
      });

      return newUser;
    });

    // Create email verification token
    const { raw, hash } = generateToken();
    await db.insert(emailVerifications).values({
      userId: user.id,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
    });

    return { user, verificationToken: raw };
  },

  async login(input: {
    email: string;
    password: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ user: User; sessionToken: string }> {
    const email = input.email.toLowerCase().trim();

    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), eq(users.accountStatus, "active")))
      .limit(1);

    // Always run bcrypt to prevent user enumeration via timing
    const hashToCheck = user?.passwordHash ?? "$2b$12$invalidhashfortimingprotection00000000000000";
    const valid = await bcrypt.compare(input.password, hashToCheck);

    if (!user || !valid) {
      throw new AuthError("INVALID_CREDENTIALS", "Email or password is incorrect.");
    }

    const { raw, hash } = generateToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await db.insert(sessions).values({
      userId: user.id,
      tokenHash: hash,
      expiresAt,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });

    await db
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, user.id));

    return { user, sessionToken: raw };
  },

  async validateSession(rawToken: string): Promise<User | null> {
    const hash = hashToken(rawToken);
    const now = new Date();

    const result = await db
      .select({ user: users, session: sessions })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(
        and(
          eq(sessions.tokenHash, hash),
          gt(sessions.expiresAt, now),
          eq(users.accountStatus, "active")
        )
      )
      .limit(1);

    if (result.length === 0) return null;

    const row = result[0];
    if (!row) return null;

    // Update last_seen_at without blocking the request
    db.update(sessions)
      .set({ lastSeenAt: now })
      .where(eq(sessions.tokenHash, hash))
      .catch(console.error);

    return row.user;
  },

  async logout(rawToken: string): Promise<void> {
    const hash = hashToken(rawToken);
    await db.delete(sessions).where(eq(sessions.tokenHash, hash));
  },

  async verifyEmail(rawToken: string): Promise<void> {
    const hash = hashToken(rawToken);
    const now = new Date();

    const [verification] = await db
      .select()
      .from(emailVerifications)
      .where(
        and(
          eq(emailVerifications.tokenHash, hash),
          gt(emailVerifications.expiresAt, now)
        )
      )
      .limit(1);

    if (!verification || verification.usedAt) {
      throw new AuthError("INVALID_TOKEN", "This verification link is invalid or has expired.");
    }

    await db.transaction(async (tx) => {
      await tx
        .update(emailVerifications)
        .set({ usedAt: now })
        .where(eq(emailVerifications.id, verification.id));

      await tx
        .update(users)
        .set({ emailVerifiedAt: now, updatedAt: now })
        .where(eq(users.id, verification.userId));
    });
  },

  async initiatePasswordReset(email: string): Promise<string | null> {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email.toLowerCase().trim()), eq(users.accountStatus, "active")))
      .limit(1);

    // Return null if user not found — caller must NOT reveal this to the client
    if (!user) return null;

    const { raw, hash } = generateToken();
    await db.insert(passwordResets).values({
      userId: user.id,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    });

    return raw;
  },

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const hash = hashToken(rawToken);
    const now = new Date();

    const [reset] = await db
      .select()
      .from(passwordResets)
      .where(
        and(
          eq(passwordResets.tokenHash, hash),
          gt(passwordResets.expiresAt, now)
        )
      )
      .limit(1);

    if (!reset || reset.usedAt) {
      throw new AuthError("INVALID_TOKEN", "This reset link is invalid or has expired.");
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await db.transaction(async (tx) => {
      await tx
        .update(passwordResets)
        .set({ usedAt: now })
        .where(eq(passwordResets.id, reset.id));

      await tx
        .update(users)
        .set({ passwordHash, updatedAt: now })
        .where(eq(users.id, reset.userId));

      // Invalidate all existing sessions on password reset
      await tx.delete(sessions).where(eq(sessions.userId, reset.userId));
    });
  },
};

// ─── Auth error ───────────────────────────────────────────────────────────────

export class AuthError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "AuthError";
  }
}
