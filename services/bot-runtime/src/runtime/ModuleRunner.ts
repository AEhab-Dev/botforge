import { Client, GatewayIntentBits, Events } from "discord.js";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq, and } from "drizzle-orm";
import type { BotModule, ModuleContext, ModuleRegistration, ModuleState } from "@botforge/module-sdk";
import { parseBotSpec, type BotSpecification, type ModuleKey } from "@botforge/shared-schemas";

// Inline schema refs — the runtime shares the same DB as the API
// In a full build, import from a shared db package; for now define the minimal shape here.
// These match the Drizzle schema in apps/api exactly.

const { Pool } = pg;

/**
 * ModuleRunner — the core of the bot runtime.
 *
 * Responsibilities:
 * 1. Connect to the DB and load the active config revision for this bot instance
 * 2. Create the Discord client with the required intents for enabled modules
 * 3. Initialize each enabled module
 * 4. Run the health check loop and write results to the DB
 * 5. Gracefully shut down modules when stopped
 */
export class ModuleRunner {
  private botInstanceId: string;
  private client: Client | null = null;
  private registrations: Map<string, ModuleRegistration> = new Map();
  private spec: BotSpecification | null = null;
  private healthInterval: ReturnType<typeof setInterval> | null = null;
  private db: ReturnType<typeof drizzle> | null = null;
  private pool: pg.Pool | null = null;

  constructor(botInstanceId: string) {
    this.botInstanceId = botInstanceId;
  }

  async start(): Promise<void> {
    // 1. Connect to DB
    this.pool = new pg.Pool({ connectionString: process.env["DATABASE_URL"], max: 5 });
    this.db = drizzle(this.pool);

    // 2. Load config from DB
    const config = await this.loadActiveConfig();
    if (!config) {
      console.error(`[runtime:${this.botInstanceId}] No active config revision found. Cannot start.`);
      await this.writeStatus("failed", "No active configuration revision found.");
      return;
    }
    this.spec = config;
    console.log(`[runtime:${this.botInstanceId}] Loaded config: "${config.name}" (schema v${config.schema_version})`);

    // 3. Resolve required intents from enabled modules
    const intents = this.resolveIntents(config);

    // 4. Create Discord client
    this.client = new Client({ intents });

    // 5. Load module implementations
    const modules = await this.loadModules(config);

    // 6. Connect to Discord
    const token = await this.loadBotToken();
    if (!token) {
      await this.writeStatus("failed", "Bot token not found.");
      return;
    }

    await this.writeStatus("deploying");

    this.client.once(Events.ClientReady, async (readyClient) => {
      console.log(`[runtime:${this.botInstanceId}] Connected to Discord as ${readyClient.user.tag}`);

      // 7. Initialize modules
      for (const mod of modules) {
        await this.initializeModule(mod, readyClient.guilds.cache.first()?.id ?? "");
      }

      await this.writeStatus("running");
      console.log(`[runtime:${this.botInstanceId}] All modules initialized. Bot is running.`);

      // 8. Start health check loop
      this.healthInterval = setInterval(() => this.runHealthCheck(), 60_000);
    });

    await this.client.login(token);
  }

  async stop(): Promise<void> {
    console.log(`[runtime:${this.botInstanceId}] Stopping...`);

    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = null;
    }

    // Shut down each module
    for (const [key, reg] of this.registrations) {
      try {
        if (this.client) {
          const ctx = this.makeContext(key as ModuleKey, reg.module);
          await reg.module.shutdown(ctx);
        }
        reg.state = "DISABLED";
      } catch (err) {
        console.error(`[runtime:${this.botInstanceId}] Error shutting down module ${key}:`, err);
      }
    }

    this.client?.destroy();
    await this.writeStatus("stopped");
    await this.pool?.end();
    console.log(`[runtime:${this.botInstanceId}] Stopped.`);
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async loadActiveConfig(): Promise<BotSpecification | null> {
    if (!this.db) return null;

    // Raw SQL via pg for the minimal query — avoids importing the full schema
    const result = await this.pool!.query(
      `SELECT bcr.configuration
       FROM bot_config_revisions bcr
       WHERE bcr.bot_instance_id = $1
         AND bcr.is_active = true
         AND bcr.validation_status = 'valid'
       LIMIT 1`,
      [this.botInstanceId]
    );

    const row = result.rows[0];
    if (!row) return null;

    try {
      return parseBotSpec(row.configuration);
    } catch (err) {
      console.error(`[runtime:${this.botInstanceId}] Config revision failed schema validation:`, err);
      return null;
    }
  }

  private async loadBotToken(): Promise<string | null> {
    // For MVP: use the shared platform token from env
    // In production: decrypt the per-instance token stored in bot_instances
    return process.env["DISCORD_BOT_TOKEN"] ?? null;
  }

  private resolveIntents(spec: BotSpecification): GatewayIntentBits[] {
    const intents = new Set<GatewayIntentBits>([
      GatewayIntentBits.Guilds,
    ]);

    for (const mod of spec.modules) {
      if (!mod.enabled) continue;
      // Map module intent requirements to discord.js intent bits
      const intentMap: Record<string, GatewayIntentBits> = {
        GuildMembers: GatewayIntentBits.GuildMembers,
        GuildMessages: GatewayIntentBits.GuildMessages,
        MessageContent: GatewayIntentBits.MessageContent,
        GuildModeration: GatewayIntentBits.GuildModeration,
      };

      // Module intent requirements are defined in the module catalogue
      // For now, add common intents based on module type
      if (mod.module_key === "welcome" || mod.module_key === "auto_role") {
        intents.add(GatewayIntentBits.GuildMembers);
      }
      if (mod.module_key === "moderation") {
        intents.add(GatewayIntentBits.GuildMembers);
        intents.add(GatewayIntentBits.GuildModeration);
      }
    }

    return Array.from(intents);
  }

  private async loadModules(spec: BotSpecification): Promise<BotModule[]> {
    // Dynamically import enabled modules from the modules/ directory
    // This is where the module registry lives — modules self-register
    const loaded: BotModule[] = [];

    for (const modInstance of spec.modules) {
      if (!modInstance.enabled) continue;
      try {
        // Dynamic import based on module key
        // Each module exports a default class that implements BotModule
        const modPath = `../../../modules/${modInstance.module_key}/src/index.js`;
        const imported = await import(modPath).catch(() => null);
        if (!imported?.default) {
          console.warn(`[runtime:${this.botInstanceId}] Module "${modInstance.module_key}" not found — skipping.`);
          continue;
        }
        const mod: BotModule = new imported.default();
        loaded.push(mod);
      } catch (err) {
        console.error(`[runtime:${this.botInstanceId}] Failed to load module "${modInstance.module_key}":`, err);
      }
    }

    return loaded;
  }

  private async initializeModule(mod: BotModule, guildId: string): Promise<void> {
    const ctx = this.makeContext(mod.key, mod);
    const reg: ModuleRegistration = { module: mod, state: "STARTING" };
    this.registrations.set(mod.key, reg);

    const result = await mod.initialize(ctx);

    if (result.ok) {
      reg.state = "RUNNING";
      console.log(`[runtime:${this.botInstanceId}] Module "${mod.key}" initialized (v${mod.version})`);
    } else {
      reg.state = "FAILED";
      console.error(`[runtime:${this.botInstanceId}] Module "${mod.key}" failed to initialize: ${result.error}`);
    }
  }

  private makeContext(moduleKey: ModuleKey, mod: BotModule): ModuleContext {
    const spec = this.spec!;
    const pool = this.pool!;

    return {
      botInstanceId: this.botInstanceId,
      guildId: spec.settings.timezone, // TODO: load guildId from bot_instances row
      client: this.client!,
      logger: {
        info: (msg, meta) => console.log(`[${moduleKey}] INFO: ${msg}`, meta ?? ""),
        warn: (msg, meta) => console.warn(`[${moduleKey}] WARN: ${msg}`, meta ?? ""),
        error: (msg, meta) => console.error(`[${moduleKey}] ERROR: ${msg}`, meta ?? ""),
        debug: (msg, meta) => process.env["LOG_LEVEL"] === "debug" && console.debug(`[${moduleKey}] DEBUG: ${msg}`, meta ?? ""),
      },
      db: {
        async logModerationAction(payload) {
          await pool.query(
            `INSERT INTO audit_logs (workspace_id, action, resource_type, metadata, created_at)
             VALUES ((SELECT workspace_id FROM bot_instances WHERE id = $1), $2, 'moderation_action', $3, now())`,
            [payload.guildId, payload.action, JSON.stringify(payload)]
          );
        },
        async getState(key) {
          // TODO: implement module state KV store table
          return null;
        },
        async setState(key, value) {
          // TODO: implement module state KV store table
        },
        async deleteState(key) {
          // TODO: implement module state KV store table
        },
      },
      getConfig<T>(): T {
        const modInstance = spec.modules.find((m) => m.module_key === moduleKey);
        return (modInstance as any)?.config as T;
      },
    };
  }

  private async runHealthCheck(): Promise<void> {
    let allRunning = true;
    for (const [key, reg] of this.registrations) {
      const health = reg.module.getHealth();
      reg.state = health.state;
      if (health.state === "FAILED" || health.state === "DEGRADED") {
        allRunning = false;
        console.warn(`[runtime:${this.botInstanceId}] Module "${key}" health: ${health.state} — ${health.message ?? ""}`);
      }
    }

    const status = allRunning ? "running" : "degraded";
    await this.writeStatus(status);
  }

  private async writeStatus(status: string, errorSummary?: string): Promise<void> {
    try {
      await this.pool?.query(
        `UPDATE bot_instances
         SET status = $1,
             last_healthy_at = CASE WHEN $1 = 'running' THEN now() ELSE last_healthy_at END,
             last_error_code = $3,
             updated_at = now()
         WHERE id = $2`,
        [status, this.botInstanceId, errorSummary ?? null]
      );
    } catch (err) {
      console.error(`[runtime:${this.botInstanceId}] Failed to write status:`, err);
    }
  }
}
