import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const modules = pgTable("modules", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  moduleKey: text("module_key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  currentVersion: text("current_version").notNull(),
  status: text("status").notNull().default("active"),
  minimumPlan: text("minimum_plan").notNull().default("free"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
});

export const moduleVersions = pgTable("module_versions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  moduleId: uuid("module_id")
    .notNull()
    .references(() => modules.id),
  version: text("version").notNull(),
  configSchema: jsonb("config_schema").notNull(),
  defaultConfig: jsonb("default_config").notNull(),
  requiredPermissions: text("required_permissions").array().notNull().default(sql`'{}'`),
  requiredIntents: text("required_intents").array().notNull().default(sql`'{}'`),
  releaseStatus: text("release_status").notNull().default("stable"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

export type Module = typeof modules.$inferSelect;
export type ModuleVersion = typeof moduleVersions.$inferSelect;
