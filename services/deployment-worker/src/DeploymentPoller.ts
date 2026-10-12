import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq, and, inArray } from "drizzle-orm";
import { ProcessManager } from "./ProcessManager.js";
import { decrypt } from "./crypto.js";

// ─── Minimal inline schema (mirrors apps/api/src/db/schema) ──────────────────
// We inline just the columns we need rather than importing the full API schema
// to keep the deployment-worker self-contained.

import {
  pgTable, uuid, text, timestamp, integer, boolean, jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const botInstances = pgTable("bot_instances", {
  id: uuid("id").primaryKey(),
  workspaceId: uuid("workspace_id").notNull(),
  name: text("name").notNull(),
  discordBotTokenEncrypted: text("discord_bot_token_encrypted"),
  status: text("status").notNull(),
  currentDeploymentId: uuid("current_deployment_id"),
  lastErrorCode: text("last_error_code"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
});

const deployments = pgTable("deployments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  botInstanceId: uuid("bot_instance_id").notNull(),
  configRevisionId: uuid("config_revision_id").notNull(),
  status: text("status").notNull().default("queued"),
  runtimeVersion: text("runtime_version"),
  healthStatus: text("health_status"),
  errorCode: text("error_code"),
  errorSummary: text("error_summary"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

const botConfigRevisions = pgTable("bot_config_revisions", {
  id: uuid("id").primaryKey(),
  botInstanceId: uuid("bot_instance_id").notNull(),
  configuration: jsonb("configuration").notNull(),
  isActive: boolean("is_active").notNull().default(false),
});

// ─── DeploymentPoller ────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 5_000; // check for new jobs every 5 seconds
const RUNTIME_VERSION = "1.0.0";

export class DeploymentPoller {
  private db: ReturnType<typeof drizzle>;
  private pool: pg.Pool;
  private manager: ProcessManager;
  private timer: ReturnType<typeof setInterval> | null = null;
  private stopping = false;

  constructor(manager: ProcessManager) {
    this.pool = new pg.Pool({
      connectionString: process.env["DATABASE_URL"],
      max: 5,
    });
    this.db = drizzle(this.pool);
    this.manager = manager;

    // Wire up the exit callback so process exits update the DB
    this.manager.onExit = async (botInstanceId, deploymentId, code, willRestart) => {
      await this.handleProcessExit(botInstanceId, deploymentId, code, willRestart);
    };
  }

  async start(): Promise<void> {
    console.log("[worker] Deployment poller starting...");

    // On startup: recover any deployments that were left in "deploying" state
    // (e.g. from a previous worker crash). Reset them to "queued" so they retry.
    await this.recoverStuckDeployments();

    // Poll immediately, then on interval
    await this.poll();
    this.timer = setInterval(() => {
      if (!this.stopping) this.poll().catch(console.error);
    }, POLL_INTERVAL_MS);

    console.log(`[worker] Polling for deploy jobs every ${POLL_INTERVAL_MS / 1000}s`);
  }

  async stop(): Promise<void> {
    this.stopping = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.manager.stopAll();
    await this.pool.end();
    console.log("[worker] Deployment poller stopped.");
  }

  // ─── Core poll loop ────────────────────────────────────────────────────────

  private async poll(): Promise<void> {
    try {
      // Find queued deployments
      const queued = await this.db
        .select({
          deploymentId: deployments.id,
          botInstanceId: deployments.botInstanceId,
          configRevisionId: deployments.configRevisionId,
        })
        .from(deployments)
        .where(eq(deployments.status, "queued"))
        .limit(10); // process up to 10 at once

      for (const job of queued) {
        await this.processDeployJob(job.deploymentId, job.botInstanceId, job.configRevisionId);
      }

      // Find stop-requested bots (status = "stopping")
      const stopping = await this.db
        .select({ id: botInstances.id, currentDeploymentId: botInstances.currentDeploymentId })
        .from(botInstances)
        .where(eq(botInstances.status, "stopping"));

      for (const bot of stopping) {
        if (this.manager.isRunning(bot.id)) {
          console.log(`[worker] Stopping bot ${bot.id.slice(0, 8)}...`);
          await this.manager.stop(bot.id);
          await this.db
            .update(botInstances)
            .set({ status: "stopped" })
            .where(eq(botInstances.id, bot.id));

          if (bot.currentDeploymentId) {
            await this.db
              .update(deployments)
              .set({ status: "stopped", finishedAt: new Date() })
              .where(eq(deployments.id, bot.currentDeploymentId));
          }
          console.log(`[worker] Bot ${bot.id.slice(0, 8)} stopped.`);
        }
      }
    } catch (err) {
      console.error("[worker] Poll error:", err);
    }
  }

  // ─── Deploy a single bot ───────────────────────────────────────────────────

  private async processDeployJob(
    deploymentId: string,
    botInstanceId: string,
    configRevisionId: string
  ): Promise<void> {
    console.log(
      `[worker] Processing deploy job — bot=${botInstanceId.slice(0, 8)} ` +
      `deployment=${deploymentId.slice(0, 8)}`
    );

    // Mark as deploying (prevents other worker instances from picking it up)
    await this.db
      .update(deployments)
      .set({ status: "deploying", startedAt: new Date(), runtimeVersion: RUNTIME_VERSION })
      .where(and(eq(deployments.id, deploymentId), eq(deployments.status, "queued")));

    try {
      // Load bot token
      const [bot] = await this.db
        .select({
          discordBotTokenEncrypted: botInstances.discordBotTokenEncrypted,
        })
        .from(botInstances)
        .where(eq(botInstances.id, botInstanceId))
        .limit(1);

      if (!bot?.discordBotTokenEncrypted) {
        throw new Error("Bot has no Discord token configured.");
      }

      const botToken = decrypt(bot.discordBotTokenEncrypted);

      // Stop any currently running process for this bot
      if (this.manager.isRunning(botInstanceId)) {
        await this.manager.stop(botInstanceId);
      }

      // Spawn the runtime process
      await this.manager.start(botInstanceId, deploymentId, {
        DATABASE_URL: process.env["DATABASE_URL"] ?? "",
        ENCRYPTION_KEY: process.env["ENCRYPTION_KEY"] ?? "",
        DISCORD_BOT_TOKEN: botToken,
        ACTIVE_BOT_INSTANCE_ID: botInstanceId,
        ACTIVE_CONFIG_REVISION_ID: configRevisionId,
        NODE_ENV: process.env["NODE_ENV"] ?? "production",
      });

      // Update bot and deployment status to running
      await this.db
        .update(deployments)
        .set({ status: "running", healthStatus: "healthy" })
        .where(eq(deployments.id, deploymentId));

      await this.db
        .update(botInstances)
        .set({ status: "running", currentDeploymentId: deploymentId, updatedAt: new Date() })
        .where(eq(botInstances.id, botInstanceId));

      console.log(
        `[worker] Bot ${botInstanceId.slice(0, 8)} deployed successfully.`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[worker] Deploy failed for bot ${botInstanceId.slice(0, 8)}:`, message);

      await this.db
        .update(deployments)
        .set({
          status: "failed",
          errorCode: "DEPLOY_FAILED",
          errorSummary: message,
          finishedAt: new Date(),
        })
        .where(eq(deployments.id, deploymentId));

      await this.db
        .update(botInstances)
        .set({ status: "error", lastErrorCode: "DEPLOY_FAILED", updatedAt: new Date() })
        .where(eq(botInstances.id, botInstanceId));
    }
  }

  // ─── Handle runtime process exit ──────────────────────────────────────────

  private async handleProcessExit(
    botInstanceId: string,
    deploymentId: string,
    code: number | null,
    willRestart: boolean
  ): Promise<void> {
    const cleanExit = code === 0;

    await this.db
      .update(deployments)
      .set({
        status: cleanExit ? "stopped" : willRestart ? "deploying" : "failed",
        healthStatus: cleanExit ? "stopped" : willRestart ? "restarting" : "crashed",
        errorCode: cleanExit || willRestart ? null : "RUNTIME_CRASH",
        errorSummary: cleanExit || willRestart ? null : `Process exited with code ${code}`,
        finishedAt: cleanExit || !willRestart ? new Date() : null,
      })
      .where(eq(deployments.id, deploymentId));

    // Don't flip the bot status if the worker is auto-restarting it
    if (!willRestart) {
      await this.db
        .update(botInstances)
        .set({
          status: cleanExit ? "stopped" : "error",
          lastErrorCode: cleanExit ? null : "RUNTIME_CRASH",
          updatedAt: new Date(),
        })
        .where(eq(botInstances.id, botInstanceId));
    }
  }

  // ─── Startup recovery ─────────────────────────────────────────────────────

  private async recoverStuckDeployments(): Promise<void> {
    // Any deployment stuck in "deploying" means the worker crashed mid-deploy.
    // Reset to "queued" so they get retried.
    const stuck = await this.db
      .select({ id: deployments.id, botInstanceId: deployments.botInstanceId })
      .from(deployments)
      .where(inArray(deployments.status, ["deploying"]));

    if (stuck.length === 0) return;

    console.log(`[worker] Recovering ${stuck.length} stuck deployment(s)...`);

    for (const d of stuck) {
      await this.db
        .update(deployments)
        .set({ status: "queued", startedAt: null })
        .where(eq(deployments.id, d.id));

      await this.db
        .update(botInstances)
        .set({ status: "draft", updatedAt: new Date() })
        .where(eq(botInstances.id, d.botInstanceId));
    }

    console.log("[worker] Recovery complete.");
  }
}
