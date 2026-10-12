# BotForge — Module Development Guide

## What Is a Module?

A module is a self-contained feature unit that runs inside the bot-runtime process.
Each module declares what it needs (permissions, intents, config schema) and what it does
(event handlers, slash commands, scheduled jobs).

Modules never communicate with each other directly. They share only the ModuleContext
(Discord client, DB connection, logger) provided by the runtime.

---

## Module Interface

```typescript
// packages/module-sdk/src/types.ts

import type { Client, Guild } from "discord.js";
import type { BotLogger } from "@botforge/observability";
import type { Database } from "@botforge/shared-schemas";

export type ModuleState =
  | "DISABLED"
  | "PENDING_CONFIGURATION"
  | "READY"
  | "STARTING"
  | "RUNNING"
  | "DEGRADED"
  | "FAILED"
  | "STOPPING";

export interface ModuleContext {
  botInstanceId: string;
  guildId: string;
  client: Client;
  db: Database;
  logger: BotLogger;
  /** Read the module's own config from the active revision */
  getConfig<T>(): T;
}

export interface ModuleHealthReport {
  state: ModuleState;
  message?: string;
  lastSuccessAt?: Date;
  errorCount: number;
}

export interface BotModule<TConfig = unknown> {
  /** Unique stable key — must match MODULE_CONFIGS key in shared-schemas */
  readonly key: string;
  readonly version: string;
  readonly displayName: string;
  readonly description: string;

  /** Minimum subscription plan required */
  readonly minimumPlan: "free" | "starter" | "pro";

  /** Discord permissions this module requires (discord.js PermissionFlagsBits names) */
  readonly requiredPermissions: string[];

  /** Discord Gateway intents this module requires */
  readonly requiredIntents: string[];

  /**
   * Validate the module's config. Called before deployment.
   * Return an array of human-readable error strings, or [] if valid.
   */
  validateConfig(config: TConfig): string[];

  /**
   * Initialize the module. Register event listeners, slash commands, jobs.
   * Called once when the bot starts or when config is reloaded.
   * Must not throw — catch errors internally and return them.
   */
  initialize(context: ModuleContext): Promise<{ ok: boolean; error?: string }>;

  /** Called when the bot is stopping or the module is being disabled. Clean up listeners. */
  shutdown(context: ModuleContext): Promise<void>;

  /** Return current health. Called by the runtime every 60 seconds. */
  getHealth(): ModuleHealthReport;
}
```

---

## Module Lifecycle

```
                  initialize() called
                        │
               ┌────────▼────────┐
               │    STARTING     │
               └────────┬────────┘
                        │
             ┌──────────┴──────────┐
             │ ok                  │ error
    ┌────────▼────────┐   ┌────────▼────────┐
    │     RUNNING     │   │     FAILED      │
    └────────┬────────┘   └─────────────────┘
             │
    (periodic health check)
             │
    ┌────────▼────────┐
    │   DEGRADED      │   ← module still running but reporting issues
    └────────┬────────┘
             │ shutdown() called
    ┌────────▼────────┐
    │    STOPPING     │
    └────────┬────────┘
             │
    ┌────────▼────────┐
    │    DISABLED     │
    └─────────────────┘
```

State transitions are managed by the runtime, not the module itself.
A module calls `context.logger.error()` to report problems — it does not set its own state.

---

## Example Module: Welcome

```typescript
// modules/welcome/src/index.ts

import { Events, type GuildMember, PermissionFlagsBits } from "discord.js";
import type { BotModule, ModuleContext, ModuleHealthReport } from "@botforge/module-sdk";
import type { WelcomeConfig } from "@botforge/shared-schemas";

export class WelcomeModule implements BotModule<WelcomeConfig> {
  readonly key = "welcome";
  readonly version = "1.0.0";
  readonly displayName = "Welcome Messages";
  readonly description = "Sends a message when a new member joins the server.";
  readonly minimumPlan = "free" as const;
  readonly requiredPermissions = ["SendMessages", "ViewChannel"];
  readonly requiredIntents = ["GuildMembers"];

  private errorCount = 0;
  private lastSuccessAt?: Date;
  private listener?: (member: GuildMember) => void;

  validateConfig(config: WelcomeConfig): string[] {
    const errors: string[] = [];
    if (!config.channel_id) errors.push("Welcome channel must be set before deployment.");
    if (config.message_template.length === 0) errors.push("Message template cannot be empty.");
    return errors;
  }

  async initialize(ctx: ModuleContext): Promise<{ ok: boolean; error?: string }> {
    const config = ctx.getConfig<WelcomeConfig>();

    this.listener = async (member: GuildMember) => {
      try {
        const channel = member.guild.channels.cache.get(config.channel_id!);
        if (!channel?.isTextBased()) {
          ctx.logger.warn("welcome: channel not found or not text-based", { channel_id: config.channel_id });
          return;
        }

        const message = config.message_template
          .replace("{user}", member.displayName)
          .replace("{user.mention}", member.toString())
          .replace("{server}", member.guild.name)
          .replace("{member_count}", String(member.guild.memberCount));

        await channel.send(message);

        // Assign role if configured
        if (config.auto_role_id) {
          const role = member.guild.roles.cache.get(config.auto_role_id);
          if (role && role.position < member.guild.members.me!.roles.highest.position) {
            await member.roles.add(role);
          } else {
            ctx.logger.warn("welcome: cannot assign role — missing or above bot's highest role", {
              role_id: config.auto_role_id,
            });
          }
        }

        this.lastSuccessAt = new Date();
        this.errorCount = 0;
      } catch (err) {
        this.errorCount++;
        ctx.logger.error("welcome: failed to send welcome message", { error: err });
      }
    };

    ctx.client.on(Events.GuildMemberAdd, this.listener);
    ctx.logger.info("welcome: module initialized");
    return { ok: true };
  }

  async shutdown(ctx: ModuleContext): Promise<void> {
    if (this.listener) {
      ctx.client.off(Events.GuildMemberAdd, this.listener);
      this.listener = undefined;
    }
  }

  getHealth(): ModuleHealthReport {
    return {
      state: this.errorCount > 5 ? "DEGRADED" : "RUNNING",
      lastSuccessAt: this.lastSuccessAt,
      errorCount: this.errorCount,
    };
  }
}
```

---

## Adding a New Module — Checklist

1. **Create the module directory**
   ```
   modules/<your-module>/
   ├── src/
   │   └── index.ts        ← implements BotModule<YourConfig>
   ├── tests/
   │   └── index.test.ts
   └── package.json
   ```

2. **Add the config schema to `packages/shared-schemas/src/bot-spec.ts`**
   - Use Zod
   - Set safe defaults for every optional field
   - Keep max lengths on all string fields
   - Keep max items on all array fields

3. **Add the module key to `MODULE_CONFIGS`** in `bot-spec.ts`

4. **Add the module to `ModuleInstanceSchema`** discriminated union

5. **Register the module in `services/bot-runtime/src/registry.ts`**

6. **Add it to the module catalogue seed** in `apps/api/src/db/seeds/modules.ts`

7. **Write tests covering:**
   - `validateConfig()` — valid and invalid configs
   - `initialize()` — happy path, missing channel, missing role, permission errors
   - `shutdown()` — verifies listeners are removed
   - `getHealth()` — RUNNING vs DEGRADED transitions

8. **Document required Discord permissions** in the module's README

---

## Required Discord Permissions Reference

| Module              | Permissions Required                              | Intents Required         |
|---------------------|---------------------------------------------------|--------------------------|
| welcome             | SendMessages, ViewChannel                         | GuildMembers             |
| auto_role           | ManageRoles                                       | GuildMembers             |
| custom_commands     | SendMessages, ViewChannel                         | (none beyond default)    |
| moderation          | ModerateMembers, KickMembers, BanMembers, ManageRoles | GuildMembers, GuildModeration |
| twitch_notifications| SendMessages, ViewChannel, EmbedLinks             | (none — uses polling)    |

---

## Module Constraints

- Modules MUST NOT store secrets in memory beyond the lifetime of a single operation.
- Modules MUST NOT make outbound HTTP requests except to explicitly approved external APIs
  (Discord API via discord.js, Twitch API, YouTube API).
- Modules MUST NOT access the database directly — use the helpers provided by `ModuleContext`.
- Modules MUST remove all event listeners in `shutdown()`.
- Modules MUST be idempotent — initializing twice should not register duplicate listeners.
  Check if a listener is already registered before adding it.
- Modules MUST NOT throw from `initialize()` — return `{ ok: false, error: "..." }` instead.

---

## Testing a Module Locally

```bash
# From the repo root
pnpm --filter @botforge/bot-runtime dev

# The runtime reads ACTIVE_BOT_INSTANCE_ID from env and loads that bot's config.
# Set up a test bot instance in the DB using the seed scripts.
```

See `docs/DEPLOYMENT.md` for how to create a local test bot instance.
