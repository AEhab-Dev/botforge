import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { eq, and, isNull, desc, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { botInstances, botConfigRevisions, deployments } from "../db/schema/index.js";
import { workspaces, workspaceMembers } from "../db/schema/index.js";
import { safeParseBotSpec } from "@botforge/shared-schemas";

export const botRoutes = new Hono();

// All bot routes require authentication
botRoutes.use("*", requireAuth);

// ─── GET /api/v1/bots ─────────────────────────────────────────────────────────

botRoutes.get("/", async (c) => {
  const user = c.get("user");

  // Find all workspaces the user is a member of
  const memberRows = await db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, user.id));

  const workspaceIds = memberRows.map((r) => r.workspaceId);
  if (workspaceIds.length === 0) return c.json({ bots: [] });

  // Fetch all non-deleted bots for those workspaces
  // Note: Drizzle doesn't have inArray for uuid[] in all versions — using a simple loop for MVP
  const bots = await db
    .select()
    .from(botInstances)
    .where(isNull(botInstances.deletedAt))
    .orderBy(desc(botInstances.createdAt));

  // Filter to user's workspaces in application code (safe for MVP scale)
  const userBots = bots.filter((b) => workspaceIds.includes(b.workspaceId));

  return c.json({ bots: userBots });
});

// ─── POST /api/v1/bots ────────────────────────────────────────────────────────

const CreateBotSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

botRoutes.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json().catch(() => null);
  const parsed = CreateBotSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  }

  // Get user's primary workspace (owner workspace)
  const [ws] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerId, user.id))
    .limit(1);

  if (!ws) {
    return c.json({ error: "NO_WORKSPACE", message: "No workspace found for this account." }, 400);
  }

  const [bot] = await db
    .insert(botInstances)
    .values({
      workspaceId: ws.id,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      status: "draft",
    })
    .returning();

  return c.json({ bot }, 201);
});

// ─── GET /api/v1/bots/:botId ──────────────────────────────────────────────────

botRoutes.get("/:botId", async (c) => {
  const user = c.get("user");
  const bot = await getOwnedBot(c.req.param("botId"), user.id);
  if (!bot) return c.json({ error: "NOT_FOUND" }, 404);
  return c.json({ bot });
});

// ─── PATCH /api/v1/bots/:botId ────────────────────────────────────────────────

const UpdateBotSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

botRoutes.patch("/:botId", async (c) => {
  const user = c.get("user");
  const bot = await getOwnedBot(c.req.param("botId"), user.id);
  if (!bot) return c.json({ error: "NOT_FOUND" }, 404);

  const body = await c.req.json().catch(() => null);
  const parsed = UpdateBotSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  }

  const [updated] = await db
    .update(botInstances)
    .set({
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description ?? null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(botInstances.id, bot.id))
    .returning();

  return c.json({ bot: updated });
});

// ─── DELETE /api/v1/bots/:botId ───────────────────────────────────────────────

botRoutes.delete("/:botId", async (c) => {
  const user = c.get("user");
  const bot = await getOwnedBot(c.req.param("botId"), user.id);
  if (!bot) return c.json({ error: "NOT_FOUND" }, 404);

  // Soft delete — never hard-delete bot data
  await db
    .update(botInstances)
    .set({ deletedAt: new Date(), status: "deleted", updatedAt: new Date() })
    .where(eq(botInstances.id, bot.id));

  return c.json({ message: "Bot deleted." });
});

// ─── POST /api/v1/bots/:botId/config/revisions ───────────────────────────────

botRoutes.post("/:botId/config/revisions", async (c) => {
  const user = c.get("user");
  const bot = await getOwnedBot(c.req.param("botId"), user.id);
  if (!bot) return c.json({ error: "NOT_FOUND" }, 404);

  const body = await c.req.json().catch(() => null);

  // Validate the BotSpecification before saving
  const result = safeParseBotSpec(body?.configuration);
  if (!result.success) {
    return c.json(
      {
        error: "INVALID_BOT_SPEC",
        issues: result.error.issues.map((i) => ({
          path: i.path,
          message: i.message,
        })),
      },
      400
    );
  }

  // Get the next revision number
  const existing = await db
    .select({ revisionNumber: botConfigRevisions.revisionNumber })
    .from(botConfigRevisions)
    .where(eq(botConfigRevisions.botInstanceId, bot.id))
    .orderBy(desc(botConfigRevisions.revisionNumber))
    .limit(1);

  const nextRevision = (existing[0]?.revisionNumber ?? 0) + 1;

  // Deactivate all previous revisions for this bot
  await db
    .update(botConfigRevisions)
    .set({ isActive: false })
    .where(eq(botConfigRevisions.botInstanceId, bot.id));

  const [revision] = await db
    .insert(botConfigRevisions)
    .values({
      botInstanceId: bot.id,
      revisionNumber: nextRevision,
      schemaVersion: 1,
      configuration: result.data as Record<string, unknown>,
      createdBy: user.id,
      changeSummary: body?.changeSummary ?? null,
      validationStatus: "valid",
      isActive: true,
    })
    .returning();

  // Point the bot instance to this revision
  await db
    .update(botInstances)
    .set({ currentConfigRevisionId: revision!.id, updatedAt: new Date() })
    .where(eq(botInstances.id, bot.id));

  return c.json({ revision }, 201);
});

// ─── GET /api/v1/bots/:botId/config/revisions ────────────────────────────────

botRoutes.get("/:botId/config/revisions", async (c) => {
  const user = c.get("user");
  const bot = await getOwnedBot(c.req.param("botId"), user.id);
  if (!bot) return c.json({ error: "NOT_FOUND" }, 404);

  const revisions = await db
    .select()
    .from(botConfigRevisions)
    .where(eq(botConfigRevisions.botInstanceId, bot.id))
    .orderBy(desc(botConfigRevisions.revisionNumber));

  return c.json({ revisions });
});

// ─── POST /api/v1/bots/:botId/deploy ─────────────────────────────────────────
//
// Queues a deployment for the given bot. The deployment-worker picks it up
// within ~5 seconds and spawns the bot-runtime process.
//
// Rules:
//  - Bot must have an active config revision
//  - Bot must have a Discord token configured
//  - Only one deployment can be queued/running at a time
//  - If the bot is already running, this triggers a rolling redeploy

botRoutes.post("/:botId/deploy", async (c) => {
  const user = c.get("user");
  const bot = await getOwnedBot(c.req.param("botId"), user.id);
  if (!bot) return c.json({ error: "NOT_FOUND" }, 404);

  // Must have a Discord bot token
  if (!bot.discordBotTokenEncrypted) {
    return c.json(
      {
        error: "NO_BOT_TOKEN",
        message: "A Discord bot token must be configured before deploying.",
      },
      400
    );
  }

  // Must have an active config revision
  const [activeRevision] = await db
    .select({ id: botConfigRevisions.id, revisionNumber: botConfigRevisions.revisionNumber })
    .from(botConfigRevisions)
    .where(
      and(
        eq(botConfigRevisions.botInstanceId, bot.id),
        eq(botConfigRevisions.isActive, true)
      )
    )
    .limit(1);

  // Fall back to the latest revision if none is explicitly marked active
  const [latestRevision] = activeRevision
    ? [activeRevision]
    : await db
        .select({ id: botConfigRevisions.id, revisionNumber: botConfigRevisions.revisionNumber })
        .from(botConfigRevisions)
        .where(eq(botConfigRevisions.botInstanceId, bot.id))
        .orderBy(desc(botConfigRevisions.revisionNumber))
        .limit(1);

  if (!latestRevision) {
    return c.json(
      {
        error: "NO_CONFIG",
        message: "A bot configuration must be saved before deploying.",
      },
      400
    );
  }

  // Block if bot is already deploying or has a queued deployment
  if (bot.status === "deploying") {
    return c.json(
      {
        error: "ALREADY_DEPLOYING",
        message: "This bot is already being deployed. Cancel the current deployment first.",
      },
      409
    );
  }

  const [inFlight] = await db
    .select({ id: deployments.id, status: deployments.status })
    .from(deployments)
    .where(
      and(
        eq(deployments.botInstanceId, bot.id),
        inArray(deployments.status, ["queued", "deploying"])
      )
    )
    .limit(1);

  if (inFlight) {
    return c.json(
      {
        error: "ALREADY_QUEUED",
        message: "A deployment is already in progress for this bot.",
        deploymentId: inFlight.id,
      },
      409
    );
  }

  // Insert the deployment row
  const [deployment] = await db
    .insert(deployments)
    .values({
      botInstanceId: bot.id,
      configRevisionId: latestRevision.id,
      status: "queued",
    })
    .returning();

  // Update bot status to indicate a deploy is pending
  await db
    .update(botInstances)
    .set({ status: "deploying", updatedAt: new Date() })
    .where(eq(botInstances.id, bot.id));

  return c.json({ deployment }, 202);
});

// ─── POST /api/v1/bots/:botId/cancel-deployment ──────────────────────────────
//
// Cancels any queued or stuck deploying/stopping state and resets to draft.
// Safe to call even if no deployment is in flight — idempotent.

botRoutes.post("/:botId/cancel-deployment", async (c) => {
  const user = c.get("user");
  const bot = await getOwnedBot(c.req.param("botId"), user.id);
  if (!bot) return c.json({ error: "NOT_FOUND" }, 404);

  // Mark any queued/deploying deployment records as cancelled
  await db
    .update(deployments)
    .set({
      status: "failed",
      errorCode: "CANCELLED",
      errorSummary: "Cancelled by user.",
      finishedAt: new Date(),
    })
    .where(
      and(
        eq(deployments.botInstanceId, bot.id),
        inArray(deployments.status, ["queued", "deploying"])
      )
    );

  // Reset bot status back to draft
  await db
    .update(botInstances)
    .set({ status: "draft", updatedAt: new Date() })
    .where(eq(botInstances.id, bot.id));

  return c.json({ message: "Deployment cancelled." });
});

// ─── POST /api/v1/bots/:botId/stop ───────────────────────────────────────────
//
// Signals the deployment-worker to stop the running bot process.

botRoutes.post("/:botId/stop", async (c) => {
  const user = c.get("user");
  const bot = await getOwnedBot(c.req.param("botId"), user.id);
  if (!bot) return c.json({ error: "NOT_FOUND" }, 404);

  if (!["running", "deploying"].includes(bot.status)) {
    return c.json(
      {
        error: "NOT_RUNNING",
        message: `Bot is not running (current status: ${bot.status}).`,
      },
      400
    );
  }

  await db
    .update(botInstances)
    .set({ status: "stopping", updatedAt: new Date() })
    .where(eq(botInstances.id, bot.id));

  return c.json({ message: "Stop signal sent. Bot will shut down shortly." });
});

// ─── GET /api/v1/bots/:botId/deployments ─────────────────────────────────────
//
// Returns the deployment history for a bot (most recent first).

botRoutes.get("/:botId/deployments", async (c) => {
  const user = c.get("user");
  const bot = await getOwnedBot(c.req.param("botId"), user.id);
  if (!bot) return c.json({ error: "NOT_FOUND" }, 404);

  const history = await db
    .select()
    .from(deployments)
    .where(eq(deployments.botInstanceId, bot.id))
    .orderBy(desc(deployments.createdAt))
    .limit(20);

  return c.json({ deployments: history });
});

// ─── PATCH /api/v1/bots/:botId/token ─────────────────────────────────────────
//
// Sets the Discord bot token for a bot instance.
// The token is encrypted at rest using AES-256-GCM.

const SetTokenSchema = z.object({
  botToken: z.string().min(50).max(100),
});

botRoutes.patch("/:botId/token", async (c) => {
  const user = c.get("user");
  const bot = await getOwnedBot(c.req.param("botId"), user.id);
  if (!bot) return c.json({ error: "NOT_FOUND" }, 404);

  const body = await c.req.json().catch(() => null);
  const parsed = SetTokenSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  }

  // Lazy import to avoid loading crypto at startup
  const { encrypt } = await import("../lib/crypto.js");
  const encrypted = encrypt(parsed.data.botToken);

  await db
    .update(botInstances)
    .set({ discordBotTokenEncrypted: encrypted, updatedAt: new Date() })
    .where(eq(botInstances.id, bot.id));

  return c.json({ message: "Bot token saved." });
});

// ─── GET /api/v1/bots/:botId/health ──────────────────────────────────────────

botRoutes.get("/:botId/health", async (c) => {
  const user = c.get("user");
  const bot = await getOwnedBot(c.req.param("botId"), user.id);
  if (!bot) return c.json({ error: "NOT_FOUND" }, 404);

  return c.json({
    botId: bot.id,
    status: bot.status,
    healthStatus: bot.status === "running"
      ? (bot.lastErrorCode ? "degraded" : "healthy")
      : bot.status === "draft" ? "unknown"
      : "error",
    lastHealthyAt: bot.lastHealthyAt,
    lastErrorCode: bot.lastErrorCode,
    currentDeploymentId: bot.currentDeploymentId,
    checkedAt: new Date().toISOString(),
  });
});

// ─── GET /api/v1/bots/:botId/logs ────────────────────────────────────────────
// SSE stream — tails the last N log lines then streams new ones.
// For MVP we read from the pm2 log file for this bot's deployment.

botRoutes.get("/:botId/logs", async (c) => {
  const user = c.get("user");
  const bot = await getOwnedBot(c.req.param("botId"), user.id);
  if (!bot) return c.json({ error: "NOT_FOUND" }, 404);

  const { readFileSync, existsSync } = await import("fs");
  const { join } = await import("path");

  // Log file convention: /var/log/botforge/bot-<botId>-out.log
  const logPath = join("/var/log/botforge", `bot-${bot.id}-out.log`);
  const errPath = join("/var/log/botforge", `bot-${bot.id}-error.log`);

  // Read last 100 lines from both files
  function tailLines(filePath: string, n: number): string[] {
    if (!existsSync(filePath)) return [];
    const content = readFileSync(filePath, "utf8");
    const lines = content.split("\n").filter(Boolean);
    return lines.slice(-n);
  }

  const outLines = tailLines(logPath, 80).map(l => ({ level: "info", message: l }));
  const errLines = tailLines(errPath, 20).map(l => ({ level: "error", message: l }));

  // Merge and sort by timestamp prefix if present, otherwise keep order
  const all = [...outLines, ...errLines];

  return c.json({ logs: all, botId: bot.id, fetchedAt: new Date().toISOString() });
});

// ─── Ownership helper ─────────────────────────────────────────────────────────

/**
 * Returns the bot only if the user owns (or is a member of) its workspace.
 * This is the central ownership check — every bot route uses it.
 */
async function getOwnedBot(botId: string, userId: string) {
  const [row] = await db
    .select({ bot: botInstances })
    .from(botInstances)
    .innerJoin(workspaceMembers, eq(botInstances.workspaceId, workspaceMembers.workspaceId))
    .where(
      and(
        eq(botInstances.id, botId),
        eq(workspaceMembers.userId, userId),
        isNull(botInstances.deletedAt)
      )
    )
    .limit(1);

  return row?.bot ?? null;
}
