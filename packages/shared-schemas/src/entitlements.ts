import { z } from "zod";

// ─── Subscription plans ───────────────────────────────────────────────────────

export const PLANS = ["free", "starter", "pro"] as const;
export type Plan = (typeof PLANS)[number];

export const PlanLimitsSchema = z.object({
  max_bots: z.number().int(),
  max_ai_requests_per_month: z.number().int(),
  log_retention_days: z.number().int(),
  max_custom_commands: z.number().int(),
  max_twitch_streamers: z.number().int(),
  max_scheduled_announcements: z.number().int(),
});
export type PlanLimits = z.infer<typeof PlanLimitsSchema>;

export const PlanFeaturesSchema = z.object({
  welcome: z.boolean(),
  auto_role: z.boolean(),
  custom_commands: z.boolean(),
  moderation: z.boolean(),
  twitch_notifications: z.boolean(),
  youtube_notifications: z.boolean(),
  scheduled_announcements: z.boolean(),
  tickets: z.boolean(),
  giveaways: z.boolean(),
  ai_chatbot: z.boolean(),
  config_history: z.boolean(),
  priority_support: z.boolean(),
});

// ─── Plan definitions (source of truth for entitlement checks) ────────────────

export const PLAN_CONFIG: Record<Plan, { limits: PlanLimits; features: z.infer<typeof PlanFeaturesSchema> }> = {
  free: {
    limits: {
      max_bots: 1,
      max_ai_requests_per_month: 10,
      log_retention_days: 3,
      max_custom_commands: 3,
      max_twitch_streamers: 0,
      max_scheduled_announcements: 0,
    },
    features: {
      welcome: true,
      auto_role: true,
      custom_commands: true,
      moderation: false,
      twitch_notifications: false,
      youtube_notifications: false,
      scheduled_announcements: false,
      tickets: false,
      giveaways: false,
      ai_chatbot: false,
      config_history: false,
      priority_support: false,
    },
  },
  starter: {
    limits: {
      max_bots: 2,
      max_ai_requests_per_month: 100,
      log_retention_days: 7,
      max_custom_commands: 25,
      max_twitch_streamers: 3,
      max_scheduled_announcements: 5,
    },
    features: {
      welcome: true,
      auto_role: true,
      custom_commands: true,
      moderation: true,
      twitch_notifications: true,
      youtube_notifications: false,
      scheduled_announcements: true,
      tickets: false,
      giveaways: false,
      ai_chatbot: false,
      config_history: true,
      priority_support: false,
    },
  },
  pro: {
    limits: {
      max_bots: 5,
      max_ai_requests_per_month: 500,
      log_retention_days: 30,
      max_custom_commands: 25,
      max_twitch_streamers: 10,
      max_scheduled_announcements: 20,
    },
    features: {
      welcome: true,
      auto_role: true,
      custom_commands: true,
      moderation: true,
      twitch_notifications: true,
      youtube_notifications: true,
      scheduled_announcements: true,
      tickets: true,
      giveaways: true,
      ai_chatbot: true,
      config_history: true,
      priority_support: true,
    },
  },
};

// ─── Entitlement check helpers ────────────────────────────────────────────────

export function getPlanConfig(plan: Plan) {
  return PLAN_CONFIG[plan];
}

export function canUseModule(plan: Plan, moduleKey: string): boolean {
  const features = PLAN_CONFIG[plan]?.features;
  if (!features) return false;
  return (features as Record<string, boolean>)[moduleKey] ?? false;
}

export function getPlanLimit(plan: Plan, limit: keyof PlanLimits): number {
  return PLAN_CONFIG[plan]?.limits[limit] ?? 0;
}
