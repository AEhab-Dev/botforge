import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { modules, moduleVersions } from "../schema/index.js";
import { eq } from "drizzle-orm";

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env["DATABASE_URL"] });
const db = drizzle(pool);

const MODULE_CATALOGUE = [
  {
    moduleKey: "welcome",
    name: "Welcome Messages",
    description: "Sends a customizable message when a new member joins your server.",
    currentVersion: "1.0.0",
    status: "active",
    minimumPlan: "free",
    sortOrder: 1,
    permissions: ["SendMessages", "ViewChannel"],
    intents: ["GuildMembers"],
    defaultConfig: {
      channel_id: null,
      message_template: "Welcome {user} to {server}!",
      auto_role_id: null,
      delete_after_seconds: null,
      use_embed: false,
    },
  },
  {
    moduleKey: "auto_role",
    name: "Automatic Roles",
    description: "Assigns one or more roles to members when they join the server.",
    currentVersion: "1.0.0",
    status: "active",
    minimumPlan: "free",
    sortOrder: 2,
    permissions: ["ManageRoles"],
    intents: ["GuildMembers"],
    defaultConfig: { role_ids: [] },
  },
  {
    moduleKey: "custom_commands",
    name: "Custom Commands",
    description: "Create custom slash commands with text, embed, or link responses.",
    currentVersion: "1.0.0",
    status: "active",
    minimumPlan: "free",
    sortOrder: 3,
    permissions: ["SendMessages", "ViewChannel"],
    intents: [],
    defaultConfig: { commands: [] },
  },
  {
    moduleKey: "moderation",
    name: "Moderation",
    description: "Warn, timeout, kick, and ban members. Logs all moderation actions.",
    currentVersion: "1.0.0",
    status: "active",
    minimumPlan: "starter",
    sortOrder: 4,
    permissions: ["ModerateMembers", "KickMembers", "BanMembers"],
    intents: ["GuildMembers", "GuildModeration"],
    defaultConfig: {
      log_channel_id: null,
      warning_limit: 3,
      warning_action: "timeout",
      timeout_duration_minutes: 60,
      anti_spam: true,
      anti_spam_threshold: 5,
    },
  },
  {
    moduleKey: "twitch_notifications",
    name: "Twitch Notifications",
    description: "Announces when Twitch streamers go live. Supports up to 10 streamers.",
    currentVersion: "1.0.0",
    status: "active",
    minimumPlan: "starter",
    sortOrder: 5,
    permissions: ["SendMessages", "ViewChannel", "EmbedLinks"],
    intents: [],
    defaultConfig: { notification_channel_id: null, streamers: [] },
  },
];

async function seed() {
  console.log("Seeding module catalogue...");

  for (const entry of MODULE_CATALOGUE) {
    // Upsert module
    const existing = await db
      .select({ id: modules.id })
      .from(modules)
      .where(eq(modules.moduleKey, entry.moduleKey))
      .limit(1);

    let moduleId: string;

    if (existing.length > 0 && existing[0]) {
      moduleId = existing[0].id;
      await db
        .update(modules)
        .set({
          name: entry.name,
          description: entry.description,
          currentVersion: entry.currentVersion,
          status: entry.status,
          minimumPlan: entry.minimumPlan,
          sortOrder: entry.sortOrder,
          updatedAt: new Date(),
        })
        .where(eq(modules.moduleKey, entry.moduleKey));
      console.log(`  Updated: ${entry.moduleKey}`);
    } else {
      const [mod] = await db
        .insert(modules)
        .values({
          moduleKey: entry.moduleKey,
          name: entry.name,
          description: entry.description,
          currentVersion: entry.currentVersion,
          status: entry.status,
          minimumPlan: entry.minimumPlan,
          sortOrder: entry.sortOrder,
        })
        .returning({ id: modules.id });
      moduleId = mod!.id;
      console.log(`  Inserted: ${entry.moduleKey}`);
    }

    // Upsert module version
    const existingVersion = await db
      .select({ id: moduleVersions.id })
      .from(moduleVersions)
      .where(eq(moduleVersions.moduleId, moduleId))
      .limit(1);

    if (existingVersion.length === 0) {
      await db.insert(moduleVersions).values({
        moduleId,
        version: entry.currentVersion,
        configSchema: {},       // TODO: derive from Zod schema
        defaultConfig: entry.defaultConfig,
        requiredPermissions: entry.permissions,
        requiredIntents: entry.intents,
        releaseStatus: "stable",
      });
    }
  }

  console.log("Module seed complete.");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
