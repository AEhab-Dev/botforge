import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./workspaces.js";
import { users } from "./users.js";

export const botInstances = pgTable("bot_instances", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  name: text("name").notNull(),
  description: text("description"),
  platform: text("platform").notNull().default("discord"),
  discordGuildId: text("discord_guild_id"),
  discordBotTokenEncrypted: text("discord_bot_token_encrypted"),
  status: text("status").notNull().default("draft"),
  // FK to revisions/deployments added below as nullable to avoid circular deps
  currentConfigRevisionId: uuid("current_config_revision_id"),
  currentDeploymentId: uuid("current_deployment_id"),
  lastHealthyAt: timestamp("last_healthy_at", { withTimezone: true }),
  lastErrorCode: text("last_error_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const botConfigRevisions = pgTable("bot_config_revisions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  botInstanceId: uuid("bot_instance_id")
    .notNull()
    .references(() => botInstances.id, { onDelete: "cascade" }),
  revisionNumber: integer("revision_number").notNull(),
  schemaVersion: integer("schema_version").notNull().default(1),
  configuration: jsonb("configuration").notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  changeSummary: text("change_summary"),
  validationStatus: text("validation_status").notNull().default("valid"),
  isActive: boolean("is_active").notNull().default(false),
});

export const deployments = pgTable("deployments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  botInstanceId: uuid("bot_instance_id")
    .notNull()
    .references(() => botInstances.id),
  configRevisionId: uuid("config_revision_id")
    .notNull()
    .references(() => botConfigRevisions.id),
  status: text("status").notNull().default("queued"),
  runtimeVersion: text("runtime_version"),
  healthStatus: text("health_status"),
  errorCode: text("error_code"),
  errorSummary: text("error_summary"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

export type BotInstance = typeof botInstances.$inferSelect;
export type NewBotInstance = typeof botInstances.$inferInsert;
export type BotConfigRevision = typeof botConfigRevisions.$inferSelect;
export type NewBotConfigRevision = typeof botConfigRevisions.$inferInsert;
export type Deployment = typeof deployments.$inferSelect;
export type NewDeployment = typeof deployments.$inferInsert;
