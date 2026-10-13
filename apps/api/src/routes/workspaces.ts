import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { workspaces, workspaceMembers } from "../db/schema/index.js";
import { users } from "../db/schema/index.js";

export const workspaceRoutes = new Hono();

workspaceRoutes.use("*", requireAuth);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Get the workspace the user owns, or returns null */
async function getOwnedWorkspace(userId: string) {
  const [ws] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerId, userId))
    .limit(1);
  return ws ?? null;
}

/** Verify caller is an owner or admin of a workspace */
async function getMemberRole(workspaceId: string, userId: string) {
  const [row] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId)
      )
    )
    .limit(1);
  return row?.role ?? null;
}

// ─── GET /api/v1/workspace ────────────────────────────────────────────────────
// Returns the user's workspace with member list

workspaceRoutes.get("/", async (c) => {
  const user = c.get("user");
  const ws = await getOwnedWorkspace(user.id);
  if (!ws) return c.json({ error: "NOT_FOUND" }, 404);

  const memberRows = await db
    .select({
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      createdAt: workspaceMembers.createdAt,
      email: users.email,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, ws.id));

  return c.json({ workspace: ws, members: memberRows });
});

// ─── PATCH /api/v1/workspace ──────────────────────────────────────────────────
// Rename workspace

const UpdateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).trim(),
});

workspaceRoutes.patch("/", async (c) => {
  const user = c.get("user");
  const ws = await getOwnedWorkspace(user.id);
  if (!ws) return c.json({ error: "NOT_FOUND" }, 404);

  const body = await c.req.json().catch(() => null);
  const parsed = UpdateWorkspaceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  }

  const [updated] = await db
    .update(workspaces)
    .set({ name: parsed.data.name, updatedAt: new Date() })
    .where(eq(workspaces.id, ws.id))
    .returning();

  return c.json({ workspace: updated });
});

// ─── POST /api/v1/workspace/members ──────────────────────────────────────────
// Invite a user to the workspace by email

const InviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["member", "admin"]).default("member"),
});

workspaceRoutes.post("/members", async (c) => {
  const user = c.get("user");
  const ws = await getOwnedWorkspace(user.id);
  if (!ws) return c.json({ error: "NOT_FOUND" }, 404);

  const body = await c.req.json().catch(() => null);
  const parsed = InviteMemberSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  }

  // Find the target user by email
  const [target] = await db
    .select()
    .from(users)
    .where(eq(users.email, parsed.data.email.toLowerCase()))
    .limit(1);

  if (!target) {
    return c.json({
      error: "USER_NOT_FOUND",
      message: "No account found with that email address. They need to sign up first.",
    }, 404);
  }

  if (target.id === user.id) {
    return c.json({ error: "CANNOT_INVITE_SELF", message: "You're already in this workspace." }, 400);
  }

  // Check if already a member
  const existing = await getMemberRole(ws.id, target.id);
  if (existing) {
    return c.json({ error: "ALREADY_MEMBER", message: "This user is already in the workspace." }, 409);
  }

  const [member] = await db
    .insert(workspaceMembers)
    .values({ workspaceId: ws.id, userId: target.id, role: parsed.data.role })
    .returning();

  return c.json({
    member: {
      ...member,
      email: target.email,
      displayName: target.displayName,
      avatarUrl: target.avatarUrl,
    },
  }, 201);
});

// ─── PATCH /api/v1/workspace/members/:userId ─────────────────────────────────
// Change a member's role

const UpdateRoleSchema = z.object({
  role: z.enum(["member", "admin"]),
});

workspaceRoutes.patch("/members/:userId", async (c) => {
  const user = c.get("user");
  const ws = await getOwnedWorkspace(user.id);
  if (!ws) return c.json({ error: "NOT_FOUND" }, 404);

  const targetId = c.req.param("userId");
  if (targetId === user.id) {
    return c.json({ error: "CANNOT_CHANGE_OWN_ROLE" }, 400);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = UpdateRoleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  }

  const [updated] = await db
    .update(workspaceMembers)
    .set({ role: parsed.data.role })
    .where(
      and(
        eq(workspaceMembers.workspaceId, ws.id),
        eq(workspaceMembers.userId, targetId)
      )
    )
    .returning();

  if (!updated) return c.json({ error: "NOT_FOUND" }, 404);

  return c.json({ member: updated });
});

// ─── DELETE /api/v1/workspace/members/:userId ─────────────────────────────────
// Remove a member

workspaceRoutes.delete("/members/:userId", async (c) => {
  const user = c.get("user");
  const ws = await getOwnedWorkspace(user.id);
  if (!ws) return c.json({ error: "NOT_FOUND" }, 404);

  const targetId = c.req.param("userId");
  if (targetId === user.id) {
    return c.json({ error: "CANNOT_REMOVE_SELF", message: "You cannot remove yourself as the owner." }, 400);
  }

  await db
    .delete(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, ws.id),
        eq(workspaceMembers.userId, targetId)
      )
    );

  return c.json({ ok: true });
});
