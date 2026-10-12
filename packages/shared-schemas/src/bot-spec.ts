import { z } from "zod";

// ─── Module config schemas ────────────────────────────────────────────────────

export const WelcomeConfigSchema = z.object({
  channel_id: z.string().nullable().default(null),
  message_template: z
    .string()
    .min(1)
    .max(2000)
    .default("Welcome {user} to {server}!"),
  auto_role_id: z.string().nullable().default(null),
  delete_after_seconds: z.number().int().min(0).nullable().default(null),
  use_embed: z.boolean().default(false),
});
export type WelcomeConfig = z.infer<typeof WelcomeConfigSchema>;

export const AutoRoleConfigSchema = z.object({
  role_ids: z.array(z.string()).max(5).default([]),
});
export type AutoRoleConfig = z.infer<typeof AutoRoleConfigSchema>;

export const CustomCommandsConfigSchema = z.object({
  commands: z
    .array(
      z.object({
        name: z
          .string()
          .min(1)
          .max(32)
          .regex(/^[\w-]+$/, "Command name must be alphanumeric with dashes/underscores only"),
        description: z.string().max(100),
        response_type: z.enum(["text", "embed", "link"]),
        response_content: z.string().min(1).max(2000),
        required_role_id: z.string().nullable().default(null),
      })
    )
    .max(25)
    .default([]),
});
export type CustomCommandsConfig = z.infer<typeof CustomCommandsConfigSchema>;

export const ModerationConfigSchema = z.object({
  log_channel_id: z.string().nullable().default(null),
  warning_limit: z.number().int().min(1).max(10).default(3),
  warning_action: z.enum(["none", "timeout", "kick", "ban"]).default("timeout"),
  timeout_duration_minutes: z.number().int().min(1).max(40320).default(60),
  anti_spam: z.boolean().default(true),
  anti_spam_threshold: z.number().int().min(2).max(20).default(5),
});
export type ModerationConfig = z.infer<typeof ModerationConfigSchema>;

export const TwitchNotificationsConfigSchema = z.object({
  notification_channel_id: z.string().nullable().default(null),
  streamers: z
    .array(
      z.object({
        twitch_username: z.string().min(1).max(25),
        enabled: z.boolean().default(true),
        custom_message: z.string().max(500).nullable().default(null),
        delete_when_offline: z.boolean().default(false),
      })
    )
    .max(10)
    .default([]),
});
export type TwitchNotificationsConfig = z.infer<typeof TwitchNotificationsConfigSchema>;

// ─── Module registry ──────────────────────────────────────────────────────────

export const MODULE_CONFIGS = {
  welcome: WelcomeConfigSchema,
  auto_role: AutoRoleConfigSchema,
  custom_commands: CustomCommandsConfigSchema,
  moderation: ModerationConfigSchema,
  twitch_notifications: TwitchNotificationsConfigSchema,
} as const;

export type ModuleKey = keyof typeof MODULE_CONFIGS;

export const MODULE_KEYS = Object.keys(MODULE_CONFIGS) as ModuleKey[];

// ─── Module instance (discriminated union for type safety) ────────────────────

export const ModuleInstanceSchema = z.discriminatedUnion("module_key", [
  z.object({
    module_key: z.literal("welcome"),
    enabled: z.boolean().default(true),
    config: WelcomeConfigSchema,
  }),
  z.object({
    module_key: z.literal("auto_role"),
    enabled: z.boolean().default(true),
    config: AutoRoleConfigSchema,
  }),
  z.object({
    module_key: z.literal("custom_commands"),
    enabled: z.boolean().default(true),
    config: CustomCommandsConfigSchema,
  }),
  z.object({
    module_key: z.literal("moderation"),
    enabled: z.boolean().default(true),
    config: ModerationConfigSchema,
  }),
  z.object({
    module_key: z.literal("twitch_notifications"),
    enabled: z.boolean().default(true),
    config: TwitchNotificationsConfigSchema,
  }),
]);
export type ModuleInstance = z.infer<typeof ModuleInstanceSchema>;

// ─── Top-level BotSpecification ───────────────────────────────────────────────

export const BotSpecificationSchema = z.object({
  schema_version: z.literal(1),
  name: z.string().min(1).max(100),
  description: z.string().max(500).default(""),
  target_platform: z.literal("discord"),
  settings: z
    .object({
      timezone: z.string().default("UTC"),
      language: z.string().default("en"),
      command_prefix: z.string().max(5).default("/"),
    })
    .default({}),
  modules: z.array(ModuleInstanceSchema).max(20).default([]),
});
export type BotSpecification = z.infer<typeof BotSpecificationSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Get a specific module instance from a spec by key, or undefined if not present.
 */
export function getModule<K extends ModuleKey>(
  spec: BotSpecification,
  key: K
): Extract<ModuleInstance, { module_key: K }> | undefined {
  return spec.modules.find(
    (m): m is Extract<ModuleInstance, { module_key: K }> => m.module_key === key
  );
}

/**
 * Parse and validate a BotSpecification from unknown JSON.
 * Throws a ZodError with structured issues if invalid.
 */
export function parseBotSpec(raw: unknown): BotSpecification {
  return BotSpecificationSchema.parse(raw);
}

/**
 * Safe parse — returns { success, data } or { success: false, error }.
 */
export const safeParseBotSpec = (raw: unknown) =>
  BotSpecificationSchema.safeParse(raw);
