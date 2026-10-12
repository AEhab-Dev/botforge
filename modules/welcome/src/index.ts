import {
  Events,
  type GuildMember,
  type TextChannel,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import type {
  BotModule,
  ModuleContext,
  ModuleHealthReport,
  ModuleState,
} from "@botforge/module-sdk";
import type { WelcomeConfig } from "@botforge/shared-schemas";

/**
 * WelcomeModule — sends a configurable message when a new member joins.
 *
 * Responsibilities:
 * - Send a welcome message to a configured channel
 * - Optionally assign an auto-role
 * - Handle missing channels and roles gracefully (warn, don't crash)
 * - Track error count to report DEGRADED health if things keep failing
 */
export class WelcomeModule implements BotModule<WelcomeConfig> {
  readonly key = "welcome" as const;
  readonly version = "1.0.0";
  readonly displayName = "Welcome Messages";
  readonly description = "Sends a customizable message when a new member joins the server.";
  readonly minimumPlan = "free" as const;
  readonly requiredPermissions = ["SendMessages", "ViewChannel"];
  readonly requiredIntents = ["GuildMembers"];

  private errorCount = 0;
  private lastSuccessAt?: Date;
  private initialized = false;

  private listener: ((member: GuildMember) => Promise<void>) | undefined;

  // ─── Validation ───────────────────────────────────────────────────────────

  validateConfig(config: WelcomeConfig): string[] {
    const errors: string[] = [];

    if (!config.channel_id) {
      errors.push("Welcome channel must be configured before the bot can be deployed.");
    }

    if (!config.message_template || config.message_template.trim().length === 0) {
      errors.push("Welcome message template cannot be empty.");
    }

    if (config.message_template && config.message_template.length > 2000) {
      errors.push("Welcome message template must be 2000 characters or fewer.");
    }

    if (config.delete_after_seconds !== null && config.delete_after_seconds !== undefined) {
      if (config.delete_after_seconds < 1 || config.delete_after_seconds > 86400) {
        errors.push("Delete after must be between 1 and 86400 seconds (24 hours).");
      }
    }

    return errors;
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  async initialize(ctx: ModuleContext): Promise<{ ok: boolean; error?: string }> {
    // Guard against double-initialization (e.g. on config reload)
    if (this.initialized && this.listener) {
      ctx.client.off(Events.GuildMemberAdd, this.listener);
      this.initialized = false;
    }

    const config = ctx.getConfig<WelcomeConfig>();

    // Validate before registering listener
    const validationErrors = this.validateConfig(config);
    if (validationErrors.length > 0) {
      return { ok: false, error: validationErrors[0] ?? "Invalid configuration" };
    }

    // Build the listener closure — captures config at initialization time
    this.listener = async (member: GuildMember) => {
      await this.handleMemberJoin(member, config, ctx);
    };

    ctx.client.on(Events.GuildMemberAdd, this.listener);
    this.initialized = true;

    ctx.logger.info("Welcome module initialized", {
      channel_id: config.channel_id,
      auto_role_id: config.auto_role_id,
    });

    return { ok: true };
  }

  async shutdown(ctx: ModuleContext): Promise<void> {
    if (this.listener) {
      ctx.client.off(Events.GuildMemberAdd, this.listener);
      this.listener = undefined;
    }
    this.initialized = false;
    ctx.logger.info("Welcome module shut down.");
  }

  getHealth(): ModuleHealthReport {
    let state: ModuleState = "RUNNING";

    if (!this.initialized) {
      state = "DISABLED";
    } else if (this.errorCount > 5) {
      state = "DEGRADED";
    }

    const health: ModuleHealthReport = {
      state,
      lastSuccessAt: this.lastSuccessAt,
      errorCount: this.errorCount,
    };
    if (this.errorCount > 5) {
      health.message = `${this.errorCount} consecutive errors — check channel permissions`;
    }
    return health;
  }

  // ─── Event handler ────────────────────────────────────────────────────────

  private async handleMemberJoin(
    member: GuildMember,
    config: WelcomeConfig,
    ctx: ModuleContext
  ): Promise<void> {
    try {
      // Resolve the welcome channel
      const channel = member.guild.channels.cache.get(config.channel_id!);

      if (!channel) {
        ctx.logger.warn("Welcome channel not found — was it deleted?", {
          channel_id: config.channel_id,
          guild_id: member.guild.id,
        });
        this.errorCount++;
        return;
      }

      if (!channel.isTextBased()) {
        ctx.logger.warn("Welcome channel is not a text channel.", {
          channel_id: config.channel_id,
          channel_type: channel.type,
        });
        this.errorCount++;
        return;
      }

      // Check the bot has permission to send messages
      const botMember = member.guild.members.me;
      if (!botMember) {
        ctx.logger.error("Bot member not found in guild cache.");
        this.errorCount++;
        return;
      }

      const textChannel = channel as TextChannel;
      const perms = textChannel.permissionsFor(botMember);
      if (!perms?.has(PermissionFlagsBits.SendMessages)) {
        ctx.logger.warn("Bot lacks SendMessages permission in welcome channel.", {
          channel_id: config.channel_id,
        });
        this.errorCount++;
        return;
      }

      // Render the message template
      const message = renderTemplate(config.message_template, member);

      // Send message — plain text or embed
      let sentMessage;
      if (config.use_embed) {
        const embed = new EmbedBuilder()
          .setDescription(message)
          .setColor(0x5865f2) // Discord blurple
          .setThumbnail(member.user.displayAvatarURL())
          .setTimestamp();

        sentMessage = await textChannel.send({ embeds: [embed] });
      } else {
        sentMessage = await textChannel.send(message);
      }

      // Auto-delete if configured
      if (config.delete_after_seconds && config.delete_after_seconds > 0) {
        setTimeout(() => {
          sentMessage.delete().catch(() => {
            // Message may have already been deleted — ignore
          });
        }, config.delete_after_seconds * 1000);
      }

      // Assign auto-role if configured
      if (config.auto_role_id) {
        await this.assignRole(member, config.auto_role_id, ctx);
      }

      // Success
      this.lastSuccessAt = new Date();
      this.errorCount = 0;

      ctx.logger.info("Welcome message sent.", {
        user_id: member.id,
        guild_id: member.guild.id,
        channel_id: config.channel_id,
      });
    } catch (err) {
      this.errorCount++;
      ctx.logger.error("Failed to send welcome message.", {
        error: err instanceof Error ? err.message : String(err),
        user_id: member.id,
        guild_id: member.guild.id,
      });
    }
  }

  private async assignRole(
    member: GuildMember,
    roleId: string,
    ctx: ModuleContext
  ): Promise<void> {
    const role = member.guild.roles.cache.get(roleId);

    if (!role) {
      ctx.logger.warn("Auto-role not found — was it deleted?", { role_id: roleId });
      return;
    }

    const botMember = member.guild.members.me;
    if (!botMember) return;

    // Check role hierarchy — bot cannot assign roles above its own highest role
    if (role.position >= botMember.roles.highest.position) {
      ctx.logger.warn(
        "Cannot assign auto-role — role is at or above the bot's highest role. Move the bot's role higher.",
        {
          role_id: roleId,
          role_position: role.position,
          bot_highest_position: botMember.roles.highest.position,
        }
      );
      return;
    }

    try {
      await member.roles.add(role, "BotForge auto-role on join");
      ctx.logger.info("Auto-role assigned.", {
        user_id: member.id,
        role_id: roleId,
      });
    } catch (err) {
      ctx.logger.error("Failed to assign auto-role.", {
        error: err instanceof Error ? err.message : String(err),
        role_id: roleId,
        user_id: member.id,
      });
    }
  }
}

// ─── Template renderer ────────────────────────────────────────────────────────

/**
 * Replaces supported template variables in a message string.
 * Only known variables are substituted — unknown ones are left as-is.
 */
function renderTemplate(template: string, member: GuildMember): string {
  return template
    .replace(/\{user\}/g, member.displayName)
    .replace(/\{user\.mention\}/g, member.toString())
    .replace(/\{server\}/g, member.guild.name)
    .replace(/\{member_count\}/g, String(member.guild.memberCount))
    .replace(/\{date\}/g, new Date().toLocaleDateString("en-US", { timeZone: "UTC" }));
}

// Default export so the runtime can do: new (await import(...)).default()
export default WelcomeModule;
