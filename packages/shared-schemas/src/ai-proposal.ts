import { z } from "zod";
import { BotSpecificationSchema } from "./bot-spec.js";

// ─── AI Proposal ─────────────────────────────────────────────────────────────
// What the AI service returns after interpreting a user's description.
// This is NOT the final spec — it goes through the review UI before saving.

export const MissingFieldSchema = z.object({
  module_key: z.string(),
  field: z.string(),
  reason: z.string(),
});

export const AIBotProposalSchema = z.object({
  /** Partial spec — channel/role IDs may be null until user fills them in */
  proposed_spec: BotSpecificationSchema,

  /** Fields required before deployment that the user must provide */
  missing_fields: z.array(MissingFieldSchema).default([]),

  /** Questions the AI needs answered to improve the spec (max 5) */
  clarifying_questions: z.array(z.string()).max(5).default([]),

  /** Requests the user made that aren't supported — explain what we can do instead */
  unsupported_requests: z.array(z.string()).default([]),

  /** How confident the AI is in this proposal */
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
});
export type AIBotProposal = z.infer<typeof AIBotProposalSchema>;

// ─── Builder session message ──────────────────────────────────────────────────

export const BuilderMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
  created_at: z.string().datetime(),
});
export type BuilderMessage = z.infer<typeof BuilderMessageSchema>;

// ─── Builder session state ────────────────────────────────────────────────────

export const BuilderSessionSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  messages: z.array(BuilderMessageSchema).default([]),
  current_proposal: AIBotProposalSchema.nullable().default(null),
  status: z.enum(["active", "saved", "expired"]).default("active"),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type BuilderSession = z.infer<typeof BuilderSessionSchema>;
