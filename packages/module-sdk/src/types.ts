import type { Client } from "discord.js";
import type { ModuleKey } from "@botforge/shared-schemas";

// ─── Module health ────────────────────────────────────────────────────────────

export type ModuleState =
  | "DISABLED"
  | "PENDING_CONFIGURATION"
  | "READY"
  | "STARTING"
  | "RUNNING"
  | "DEGRADED"
  | "FAILED"
  | "STOPPING";

export interface ModuleHealthReport {
  state: ModuleState;
  message?: string | undefined;
  lastSuccessAt?: Date | undefined;
  errorCount: number;
}

// ─── Logger interface (injected by runtime) ───────────────────────────────────

export interface ModuleLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

// ─── DB access helpers (injected by runtime — modules never use raw SQL) ──────

export interface ModuleDB {
  /**
   * Record a moderation action in the audit log.
   * Only available to modules that declare 'moderation' capability.
   */
  logModerationAction(payload: {
    guildId: string;
    actorDiscordId: string;
    targetDiscordId: string;
    action: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;

  /**
   * Get/set simple key-value state for this module instance.
   * Persisted across restarts. Scoped to (botInstanceId, moduleKey).
   */
  getState(key: string): Promise<string | null>;
  setState(key: string, value: string): Promise<void>;
  deleteState(key: string): Promise<void>;
}

// ─── Module context (provided by the runtime to each module) ──────────────────

export interface ModuleContext {
  /** The bot instance ID from the platform database */
  botInstanceId: string;

  /** The Discord guild (server) ID this bot is installed in */
  guildId: string;

  /** The discord.js client — already logged in and ready */
  client: Client;

  /** Structured logger — always use this, never console.log */
  logger: ModuleLogger;

  /** Safe DB helpers — modules never touch the DB directly */
  db: ModuleDB;

  /**
   * Read this module's validated config from the active revision.
   * Type parameter T should match the module's config schema type.
   */
  getConfig<T>(): T;
}

// ─── Core module interface ────────────────────────────────────────────────────

export interface BotModule<TConfig = unknown> {
  /** Stable unique key — must match a key in MODULE_CONFIGS from shared-schemas */
  readonly key: ModuleKey;

  /** Semver string e.g. "1.0.0" */
  readonly version: string;

  /** Human-readable name shown in the dashboard */
  readonly displayName: string;

  /** One-sentence description shown in the module catalogue */
  readonly description: string;

  /** Minimum plan required to enable this module */
  readonly minimumPlan: "free" | "starter" | "pro";

  /** discord.js PermissionFlagsBits key names e.g. ["SendMessages", "ManageRoles"] */
  readonly requiredPermissions: string[];

  /** Discord Gateway intent names e.g. ["GuildMembers"] */
  readonly requiredIntents: string[];

  /**
   * Validate the module's config before deployment.
   * Return an array of human-readable error strings (empty = valid).
   * Called by the API before saving a revision and before deployment.
   */
  validateConfig(config: TConfig): string[];

  /**
   * Initialize the module. Register event listeners, slash commands, etc.
   * MUST NOT throw — catch all errors and return { ok: false, error: "..." }.
   * MUST be idempotent — safe to call again after a config reload.
   */
  initialize(context: ModuleContext): Promise<{ ok: boolean; error?: string }>;

  /**
   * Gracefully shut down the module.
   * Remove all event listeners registered in initialize().
   * Called before a config reload, a bot stop, or a deployment update.
   */
  shutdown(context: ModuleContext): Promise<void>;

  /**
   * Return the current health of the module.
   * Called by the runtime every 60 seconds and written to the DB.
   */
  getHealth(): ModuleHealthReport;
}

// ─── Module registration ──────────────────────────────────────────────────────

export interface ModuleRegistration {
  module: BotModule;
  /** Set by the runtime after initialize() completes successfully */
  state: ModuleState;
  /** Set by the runtime — timestamp of last successful health check */
  lastHealthyAt?: Date;
}
