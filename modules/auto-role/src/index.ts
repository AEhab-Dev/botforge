import { Events, type GuildMember } from "discord.js";
import type {
  BotModule,
  ModuleContext,
  ModuleHealthReport,
  ModuleState,
} from "@botforge/module-sdk";
import type { AutoRoleConfig } from "@botforge/shared-schemas";

/**
 * AutoRoleModule — assigns one or more roles when a member joins.
 *
 * Important Discord constraint: the bot can only assign roles that are
 * positioned BELOW its own highest role in the server hierarchy.
 * We check this before attempting the assignment and log a clear warning
 * rather than failing silently or throwing.
 */
export class AutoRoleModule implements BotModule<AutoRoleConfig> {
  readonly key = "auto_role" as const;
  readonly version = "1.0.0";
  readonly displayName = "Automatic Roles";
  readonly description = "Assigns one or more roles to members when they join the server.";
  readonly minimumPlan = "free" as const;
  readonly requiredPermissions = ["ManageRoles"];
  readonly requiredIntents = ["GuildMembers"];

  private errorCount = 0;
  private lastSuccessAt: Date | undefined;
  private initialized = false;
  private listener: ((member: GuildMember) => Promise<void>) | undefined;

  // ─── Validation ──────────────────────────────────────────────────────────

  validateConfig(config: AutoRoleConfig): string[] {
    const errors: string[] = [];

    if (!config.role_ids || config.role_ids.length === 0) {
      errors.push("At least one role must be configured for the auto-role module.");
    }

    if (config.role_ids && config.role_ids.length > 5) {
      errors.push("A maximum of 5 auto-roles are supported.");
    }

    return errors;
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  async initialize(ctx: ModuleContext): Promise<{ ok: boolean; error?: string }> {
    // Remove existing listener if re-initializing
    if (this.initialized && this.listener) {
      ctx.client.off(Events.GuildMemberAdd, this.listener);
      this.initialized = false;
    }

    const config = ctx.getConfig<AutoRoleConfig>();

    const validationErrors = this.validateConfig(config);
    if (validationErrors.length > 0) {
      return { ok: false, error: validationErrors[0] ?? "Invalid configuration" };
    }

    this.listener = async (member: GuildMember) => {
      await this.handleMemberJoin(member, config, ctx);
    };

    ctx.client.on(Events.GuildMemberAdd, this.listener);
    this.initialized = true;

    ctx.logger.info("Auto-role module initialized", { role_ids: config.role_ids });
    return { ok: true };
  }

  async shutdown(ctx: ModuleContext): Promise<void> {
    if (this.listener) {
      ctx.client.off(Events.GuildMemberAdd, this.listener);
      this.listener = undefined;
    }
    this.initialized = false;
    ctx.logger.info("Auto-role module shut down.");
  }

  getHealth(): ModuleHealthReport {
    let state: ModuleState = "RUNNING";
    if (!this.initialized) state = "DISABLED";
    else if (this.errorCount > 5) state = "DEGRADED";

    const report: ModuleHealthReport = {
      state,
      errorCount: this.errorCount,
    };
    if (this.lastSuccessAt) report.lastSuccessAt = this.lastSuccessAt;
    if (this.errorCount > 5) {
      report.message = `${this.errorCount} consecutive errors — check role hierarchy and bot permissions`;
    }
    return report;
  }

  // ─── Event handler ───────────────────────────────────────────────────────

  private async handleMemberJoin(
    member: GuildMember,
    config: AutoRoleConfig,
    ctx: ModuleContext
  ): Promise<void> {
    const botMember = member.guild.members.me;
    if (!botMember) {
      ctx.logger.error("Bot member not found in guild cache.");
      this.errorCount++;
      return;
    }

    let anySuccess = false;

    for (const roleId of config.role_ids) {
      const role = member.guild.roles.cache.get(roleId);

      if (!role) {
        ctx.logger.warn("Auto-role not found — was it deleted?", { role_id: roleId });
        continue;
      }

      // Discord role hierarchy check — bot cannot assign roles at or above its own highest
      if (role.position >= botMember.roles.highest.position) {
        ctx.logger.warn(
          "Skipping auto-role — role is at or above the bot's highest role. " +
          "Move the BotForge role above this role in Server Settings → Roles.",
          {
            role_id: roleId,
            role_name: role.name,
            role_position: role.position,
            bot_highest_position: botMember.roles.highest.position,
          }
        );
        continue;
      }

      try {
        await member.roles.add(role, "BotForge auto-role on join");
        ctx.logger.info("Auto-role assigned.", {
          user_id: member.id,
          role_id: roleId,
          role_name: role.name,
        });
        anySuccess = true;
      } catch (err) {
        this.errorCount++;
        ctx.logger.error("Failed to assign auto-role.", {
          error: err instanceof Error ? err.message : String(err),
          role_id: roleId,
          user_id: member.id,
        });
      }
    }

    if (anySuccess) {
      this.lastSuccessAt = new Date();
      this.errorCount = 0;
    }
  }
}

export default AutoRoleModule;
