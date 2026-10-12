# BotForge — Bot Specification Schema

## Purpose

Every bot is described by a **BotSpecification** document. This is the canonical contract between:
- The AI builder (produces it)
- The dashboard (displays and edits it)
- The backend API (validates and stores it)
- The bot runtime (executes it)

The AI may suggest a spec; the backend always validates it independently.

---

## Schema Version

Every spec carries a `schema_version` integer. When the shape changes in a breaking way,
we increment the version and write a migration. Old saved revisions are migrated on read,
never silently broken.

Current version: **1**

---

## Full BotSpecification (TypeScript + Zod)

```typescript
// packages/shared-schemas/src/bot-spec.ts

import { z } from "zod";

// ─── Module config schemas (one per module) ──────────────────────────────────

export const WelcomeConfigSchema = z.object({
  channel_id: z.string().nullable(),          // Discord channel snowflake or null (pending)
  message_template: z.string().max(2000).default("Welcome {user} to {server}!"),
  auto_role_id: z.string().nullable().default(null),
  delete_after_seconds: z.number().int().min(0).nullable().default(null),
  use_embed: z.boolean().default(false),
});

export const AutoRoleConfigSchema = z.object({
  role_ids: z.array(z.string()).max(5),       // Discord role snowflakes
});

export const CustomCommandsConfigSchema = z.object({
  commands: z.array(z.object({
    name: z.string().min(1).max(32).regex(/^[\w-]+$/),
    description: z.string().max(100),
    response_type: z.enum(["text", "embed", "link"]),
    response_content: z.string().max(2000),
    required_role_id: z.string().nullable().default(null),
  })).max(25),
});

export const ModerationConfigSchema = z.object({
  log_channel_id: z.string().nullable(),
  warning_limit: z.number().int().min(1).max(10).default(3),
  warning_action: z.enum(["none", "timeout", "kick", "ban"]).default("timeout"),
  timeout_duration_minutes: z.number().int().min(1).max(40320).default(60),
  anti_spam: z.boolean().default(true),
  anti_spam_threshold: z.number().int().min(2).max(20).default(5),
});

export const TwitchNotificationsConfigSchema = z.object({
  notification_channel_id: z.string().nullable(),
  streamers: z.array(z.object({
    twitch_username: z.string().min(1).max(25),
    enabled: z.boolean().default(true),
    custom_message: z.string().max(500).nullable().default(null),
    delete_when_offline: z.boolean().default(false),
  })).max(10),
});

// ─── Module instance ─────────────────────────────────────────────────────────

// Map of module_key → its config schema
export const MODULE_CONFIGS = {
  welcome: WelcomeConfigSchema,
  auto_role: AutoRoleConfigSchema,
  custom_commands: CustomCommandsConfigSchema,
  moderation: ModerationConfigSchema,
  twitch_notifications: TwitchNotificationsConfigSchema,
} as const;

export type ModuleKey = keyof typeof MODULE_CONFIGS;

export const ModuleInstanceSchema = z.discriminatedUnion("module_key", [
  z.object({ module_key: z.literal("welcome"),              enabled: z.boolean(), config: WelcomeConfigSchema }),
  z.object({ module_key: z.literal("auto_role"),            enabled: z.boolean(), config: AutoRoleConfigSchema }),
  z.object({ module_key: z.literal("custom_commands"),      enabled: z.boolean(), config: CustomCommandsConfigSchema }),
  z.object({ module_key: z.literal("moderation"),           enabled: z.boolean(), config: ModerationConfigSchema }),
  z.object({ module_key: z.literal("twitch_notifications"), enabled: z.boolean(), config: TwitchNotificationsConfigSchema }),
]);

// ─── Top-level BotSpecification ──────────────────────────────────────────────

export const BotSpecificationSchema = z.object({
  schema_version: z.literal(1),
  name: z.string().min(1).max(100),
  description: z.string().max(500).default(""),
  target_platform: z.literal("discord"),
  settings: z.object({
    timezone: z.string().default("UTC"),
    language: z.string().default("en"),
    command_prefix: z.string().max(5).default("/"),
  }),
  modules: z.array(ModuleInstanceSchema).max(20),
});

export type BotSpecification = z.infer<typeof BotSpecificationSchema>;
```

---

## AI Output Schema

The AI does not return a full BotSpecification directly.
It returns an **AIBotProposal** that includes:
- A partial specification (may have null channel/role IDs — user fills those in)
- A list of missing required fields
- A list of clarifying questions if needed
- Warnings about unsupported requests

```typescript
// packages/shared-schemas/src/ai-proposal.ts

export const AIBotProposalSchema = z.object({
  proposed_spec: BotSpecificationSchema.partial({ modules: true }).extend({
    schema_version: z.literal(1),
  }),
  missing_fields: z.array(z.object({
    module_key: z.string(),
    field: z.string(),
    reason: z.string(),
  })),
  clarifying_questions: z.array(z.string()).max(5),
  unsupported_requests: z.array(z.string()),
  confidence: z.enum(["high", "medium", "low"]),
});
```

The backend validates the `proposed_spec` through `BotSpecificationSchema` before saving.
If validation fails, the AI output is rejected — the error is never silently swallowed.

---

## Config Revision Storage

A saved revision stores the JSON of a `BotSpecification` plus metadata:

```sql
-- Simplified — see full schema in docs/DATABASE_SCHEMA.md
bot_config_revisions (
  id              uuid PRIMARY KEY,
  bot_instance_id uuid REFERENCES bot_instances(id),
  revision_number integer NOT NULL,         -- monotonically increasing per bot
  schema_version  integer NOT NULL,
  configuration   jsonb NOT NULL,           -- validated BotSpecification JSON
  created_by      uuid REFERENCES users(id),
  created_at      timestamptz DEFAULT now(),
  change_summary  text,
  is_active       boolean DEFAULT false     -- true only for currently-deployed revision
)
```

Rules:
- Revisions are **immutable** after creation
- To change config: create a new revision, deploy it, then mark it active
- The previous active revision is preserved for rollback
- `configuration` must pass `BotSpecificationSchema.parse()` before insert

---

## Template Variables

Available in message templates:

| Variable       | Resolves to                        |
|----------------|------------------------------------|
| `{user}`       | Display name of the Discord member |
| `{user.mention}` | @mention of the member           |
| `{server}`     | Server name                        |
| `{member_count}` | Current member count             |
| `{date}`       | Current date (server timezone)     |

No other template expressions are supported. The runtime sanitizes unknown variables before sending.

---

## Schema Migration Policy

When a breaking change is needed:

1. Increment `CURRENT_SCHEMA_VERSION` in `packages/shared-schemas/src/version.ts`
2. Write a migration function:
   ```typescript
   // packages/shared-schemas/src/migrations/v1-to-v2.ts
   export function migrateV1toV2(spec: BotSpecV1): BotSpecV2 { ... }
   ```
3. Add it to the migration chain in `packages/shared-schemas/src/migrate.ts`
4. The API runs migrations on read before returning a config to the client
5. Old revisions in the DB are NOT mutated — migration happens in application memory

---

## Validation Errors

When the API rejects a spec, it returns structured errors mapped to fields:

```json
{
  "error": "INVALID_BOT_SPEC",
  "issues": [
    {
      "path": ["modules", 0, "config", "channel_id"],
      "message": "Expected string, received null — channel must be set before deployment"
    }
  ]
}
```

The dashboard maps these back to the form fields so users see inline errors.
