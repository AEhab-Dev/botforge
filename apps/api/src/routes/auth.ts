import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { z } from "zod";
import { authService, AuthError } from "../services/auth.service.js";
import { emailService } from "../services/email.service.js";

export const authRoutes = new Hono();

const COOKIE_NAME = "bf_session";
const IS_PROD = process.env["APP_ENV"] === "production";

// ─── Input schemas ────────────────────────────────────────────────────────────

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(50).trim(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

const EmailSchema = z.object({ email: z.string().email() });
const TokenSchema = z.object({ token: z.string().min(1) });
const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

// ─── Cookie helper ────────────────────────────────────────────────────────────

function setSessionCookie(c: any, token: string) {
  const ttlSeconds = parseInt(process.env["SESSION_TTL_SECONDS"] ?? "604800", 10);
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "Lax",
    maxAge: ttlSeconds,
    path: "/",
  });
}

// ─── POST /api/v1/auth/register ───────────────────────────────────────────────

authRoutes.post("/register", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  }

  try {
    const { user, verificationToken } = await authService.register(parsed.data);

    // Send verification email (non-blocking — don't fail registration if email fails)
    emailService.sendVerificationEmail(user.email, user.displayName, verificationToken)
      .catch((err) => console.error("[auth] Failed to send verification email:", err));

    // In dev, return the token directly so you can verify without email setup
    const devToken = IS_PROD ? undefined : verificationToken;

    return c.json(
      {
        message: "Account created. Please verify your email.",
        user: { id: user.id, email: user.email, displayName: user.displayName },
        ...(devToken ? { dev_verification_token: devToken } : {}),
      },
      201
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return c.json({ error: err.code, message: err.message }, 409);
    }
    throw err;
  }
});

// ─── POST /api/v1/auth/login ──────────────────────────────────────────────────

authRoutes.post("/login", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  }

  try {
    const ip = c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip");
    const ua = c.req.header("user-agent");

    const { user, sessionToken } = await authService.login({
      email: parsed.data.email,
      password: parsed.data.password,
      ...(ip ? { ipAddress: ip } : {}),
      ...(ua ? { userAgent: ua } : {}),
    });

    setSessionCookie(c, sessionToken);

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        emailVerifiedAt: user.emailVerifiedAt,
      },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      // Always 401 for login failures — don't distinguish "wrong password" from "no account"
      return c.json({ error: "INVALID_CREDENTIALS", message: "Email or password is incorrect." }, 401);
    }
    throw err;
  }
});

// ─── POST /api/v1/auth/logout ─────────────────────────────────────────────────

authRoutes.post("/logout", async (c) => {
  const token = getCookie(c, COOKIE_NAME);
  if (token) {
    await authService.logout(token);
  }
  deleteCookie(c, COOKIE_NAME, { path: "/" });
  return c.json({ message: "Logged out." });
});

// ─── GET /api/v1/auth/me ──────────────────────────────────────────────────────

authRoutes.get("/me", async (c) => {
  const token = getCookie(c, COOKIE_NAME);
  if (!token) {
    return c.json({ error: "UNAUTHENTICATED", message: "No session." }, 401);
  }

  const user = await authService.validateSession(token);
  if (!user) {
    deleteCookie(c, COOKIE_NAME, { path: "/" });
    return c.json({ error: "UNAUTHENTICATED", message: "Session expired." }, 401);
  }

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      emailVerifiedAt: user.emailVerifiedAt,
      accountStatus: user.accountStatus,
    },
  });
});

// ─── POST /api/v1/auth/verify-email ──────────────────────────────────────────

authRoutes.post("/verify-email", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = TokenSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  }

  try {
    await authService.verifyEmail(parsed.data.token);
    return c.json({ message: "Email verified successfully." });
  } catch (err) {
    if (err instanceof AuthError) {
      return c.json({ error: err.code, message: err.message }, 400);
    }
    throw err;
  }
});

// ─── POST /api/v1/auth/forgot-password ───────────────────────────────────────

authRoutes.post("/forgot-password", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = EmailSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  }

  // Always return 200 — never reveal whether an account exists
  const rawToken = await authService.initiatePasswordReset(parsed.data.email);

  if (rawToken) {
    // TODO: send password reset email
    // await emailService.sendPasswordReset(parsed.data.email, rawToken);

    // In dev, return the token directly
    if (!IS_PROD) {
      return c.json({ message: "Reset email sent.", dev_reset_token: rawToken });
    }
  }

  return c.json({ message: "If an account with that email exists, a reset link has been sent." });
});

// ─── POST /api/v1/auth/reset-password ────────────────────────────────────────

authRoutes.post("/reset-password", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = ResetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  }

  try {
    await authService.resetPassword(parsed.data.token, parsed.data.password);
    return c.json({ message: "Password reset successfully. Please log in." });
  } catch (err) {
    if (err instanceof AuthError) {
      return c.json({ error: err.code, message: err.message }, 400);
    }
    throw err;
  }
});
