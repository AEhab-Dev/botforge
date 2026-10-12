import {
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  type Interaction,
  type ChatInputCommandInteraction,
  type TextChannel,
  type Message,
  type GuildMember,
} from "discord.js";
import type {
  BotModule,
  ModuleContext,
  ModuleHealthReport,
  ModuleState,
} from "@botforge/module-sdk";
import type { ModerationConfig } from "@botforge/shared-schemas";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SpamEntry {
  timestamps: number[];
}

// ─── Command definitions ──────────────────────────────────────────────────────

const COMMANDS = [
  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a member")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("The user to warn").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("reason").setDescription("Reason for the warning").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout a member")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("The user to timeout").setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt
        .setName("duration_minutes")
        .setDescription("Timeout duration in minutes (1–40320)")
        .setMinValue(1)
        .setMaxValue(40320)
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt.setName("reason").setDescription("Reason for the timeout").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a member from the server")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("The user to kick").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("reason").setDescription("Reason for the kick").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a member from the server")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("The user to ban").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("reason").setDescription("Reason for the ban").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("Check warning count for a user")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("The user to check").setRequired(true)
    ),
].map((cmd) => cmd.toJSON());

// ─── ModerationModule ─────────────────────────────────────────────────────────

export class ModerationModule implements BotModule<ModerationConfig> {
  readonly key = "moderation" as const;
  readonly version = "1.0.0";
  readonly displayName = "Moderation";
  readonly description = "Slash-command moderation tools with anti-spam and warning tracking.";
  readonly minimumPlan = "starter" as const;
  readonly requiredPermissions = [
    "KickMembers",
    "BanMembers",
    "ModerateMembers",
    "SendMessages",
    "ViewChannel",
    "EmbedLinks",
  ];
  readonly requiredIntents = ["Guilds", "GuildMessages", "GuildMembers", "MessageContent"];

  // In-memory state
  private warnings = new Map<string, number>(); // userId -> count
  private spamMap = new Map<string, SpamEntry>(); // userId -> timestamps

  // Lifecycle state
  private initialized = false;
  private errorCount = 0;
  private lastSuccessAt: Date | undefined;

  // Saved listeners for cleanup
  private interactionListener: ((interaction: Interaction) => Promise<void>) | undefined;
  private messageListener: ((message: Message) => Promise<void>) | undefined;

  // ─── Validation ─────────────────────────────────────────────────────────────

  validateConfig(config: ModerationConfig): string[] {
    const errors: string[] = [];

    if (config.warning_limit < 1 || config.warning_limit > 10) {
      errors.push("warning_limit must be between 1 and 10.");
    }

    if (config.timeout_duration_minutes < 1 || config.timeout_duration_minutes > 40320) {
      errors.push("timeout_duration_minutes must be between 1 and 40320 (28 days).");
    }

    if (config.anti_spam_threshold < 2 || config.anti_spam_threshold > 20) {
      errors.push("anti_spam_threshold must be between 2 and 20.");
    }

    return errors;
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  async initialize(ctx: ModuleContext): Promise<{ ok: boolean; error?: string }> {
    // Idempotent: tear down before re-registering
    if (this.initialized) {
      this.removeListeners(ctx);
    }

    const config = ctx.getConfig<ModerationConfig>();

    const validationErrors = this.validateConfig(config);
    if (validationErrors.length > 0) {
      return { ok: false, error: validationErrors[0] ?? "Invalid configuration" };
    }

    // Register slash commands via REST
    try {
      await this.registerCommands(ctx);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.logger.warn("Failed to register moderation slash commands — continuing without them.", {
        error: msg,
      });
      // Non-fatal: listeners still work if commands were previously registered
    }

    // Interaction handler
    this.interactionListener = async (interaction: Interaction) => {
      if (!interaction.isChatInputCommand()) return;
      await this.handleInteraction(interaction, config, ctx);
    };

    ctx.client.on(Events.InteractionCreate, this.interactionListener);

    // Anti-spam message handler
    if (config.anti_spam) {
      this.messageListener = async (message: Message) => {
        if (message.author.bot) return;
        if (!message.guild) return;
        await this.handleAntiSpam(message, config, ctx);
      };
      ctx.client.on(Events.MessageCreate, this.messageListener);
    }

    this.initialized = true;
    ctx.logger.info("Moderation module initialized.", {
      warning_limit: config.warning_limit,
      warning_action: config.warning_action,
      anti_spam: config.anti_spam,
    });

    return { ok: true };
  }

  async shutdown(ctx: ModuleContext): Promise<void> {
    this.removeListeners(ctx);
    this.initialized = false;
    ctx.logger.info("Moderation module shut down.");
  }

  getHealth(): ModuleHealthReport {
    let state: ModuleState = "RUNNING";
    if (!this.initialized) {
      state = "DISABLED";
    } else if (this.errorCount > 5) {
      state = "DEGRADED";
    }

    const report: ModuleHealthReport = {
      state,
      lastSuccessAt: this.lastSuccessAt,
      errorCount: this.errorCount,
    };
    if (this.errorCount > 5) {
      report.message = `${this.errorCount} consecutive errors — check bot permissions`;
    }
    return report;
  }

  // ─── Slash command registration ──────────────────────────────────────────────

  private async registerCommands(ctx: ModuleContext): Promise<void> {
    const token = (ctx.client as any).token as string | undefined;
    const appId = (ctx.client as any).application?.id as string | undefined;

    if (!token || !appId) {
      ctx.logger.warn("Cannot register slash commands: missing bot token or application ID.");
      return;
    }

    const rest = new REST({ version: "10" }).setToken(token);
    await rest.put(Routes.applicationGuildCommands(appId, ctx.guildId), {
      body: COMMANDS,
    });

    ctx.logger.info("Moderation slash commands registered.", { guildId: ctx.guildId });
  }

  // ─── Interaction handler ─────────────────────────────────────────────────────

  private async handleInteraction(
    interaction: ChatInputCommandInteraction,
    config: ModerationConfig,
    ctx: ModuleContext
  ): Promise<void> {
    const { commandName } = interaction;
    if (!["warn", "timeout", "kick", "ban", "warnings"].includes(commandName)) return;

    try {
      switch (commandName) {
        case "warn":
          await this.handleWarn(interaction, config, ctx);
          break;
        case "timeout":
          await this.handleTimeout(interaction, config, ctx);
          break;
        case "kick":
          await this.handleKick(interaction, config, ctx);
          break;
        case "ban":
          await this.handleBan(interaction, config, ctx);
          break;
        case "warnings":
          await this.handleWarnings(interaction, ctx);
          break;
      }
    } catch (err) {
      this.errorCount++;
      ctx.logger.error("Error handling moderation interaction.", {
        command: commandName,
        error: err instanceof Error ? err.message : String(err),
      });
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "An error occurred while processing that command.",
          ephemeral: true,
        }).catch(() => {});
      }
    }
  }

  // ─── /warn ───────────────────────────────────────────────────────────────────

  private async handleWarn(
    interaction: ChatInputCommandInteraction,
    config: ModerationConfig,
    ctx: ModuleContext
  ): Promise<void> {
    const targetUser = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") ?? "No reason provided";

    const member = await interaction.guild?.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      await interaction.reply({ content: "Could not find that member in this server.", ephemeral: true });
      return;
    }

    // Increment warning count
    const prev = this.warnings.get(targetUser.id) ?? 0;
    const count = prev + 1;
    this.warnings.set(targetUser.id, count);

    const hitLimit = count >= config.warning_limit;

    await this.sendLog(interaction.guild!, config, ctx, {
      action: "warn",
      target: member,
      moderator: interaction.user,
      reason,
      extra: `Warning ${count}/${config.warning_limit}`,
    });

    await ctx.db.logModerationAction({
      guildId: ctx.guildId,
      actorDiscordId: interaction.user.id,
      targetDiscordId: targetUser.id,
      action: "warn",
      reason,
      metadata: { count, warning_limit: config.warning_limit },
    });

    if (hitLimit) {
      await this.applyWarningAction(member, config, ctx, interaction.user.id, reason);
      await interaction.reply({
        content: `⚠️ ${targetUser.tag} has been warned (${count}/${config.warning_limit}). Warning limit reached — applying action: **${config.warning_action}**.`,
        ephemeral: false,
      });
    } else {
      await interaction.reply({
        content: `⚠️ ${targetUser.tag} has been warned (${count}/${config.warning_limit}). Reason: ${reason}`,
        ephemeral: false,
      });
    }

    this.lastSuccessAt = new Date();
    this.errorCount = 0;
  }

  // ─── /timeout ────────────────────────────────────────────────────────────────

  private async handleTimeout(
    interaction: ChatInputCommandInteraction,
    config: ModerationConfig,
    ctx: ModuleContext
  ): Promise<void> {
    const targetUser = interaction.options.getUser("user", true);
    const durationMinutes =
      interaction.options.getInteger("duration_minutes") ?? config.timeout_duration_minutes;
    const reason = interaction.options.getString("reason") ?? "No reason provided";

    const member = await interaction.guild?.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      await interaction.reply({ content: "Could not find that member in this server.", ephemeral: true });
      return;
    }

    if (!this.botHasPermission(interaction, PermissionFlagsBits.ModerateMembers, ctx)) {
      await interaction.reply({ content: "I don't have permission to timeout members.", ephemeral: true });
      return;
    }

    await member.timeout(durationMinutes * 60 * 1000, reason);

    await this.sendLog(interaction.guild!, config, ctx, {
      action: "timeout",
      target: member,
      moderator: interaction.user,
      reason,
      extra: `Duration: ${durationMinutes} minutes`,
    });

    await ctx.db.logModerationAction({
      guildId: ctx.guildId,
      actorDiscordId: interaction.user.id,
      targetDiscordId: targetUser.id,
      action: "timeout",
      reason,
      metadata: { duration_minutes: durationMinutes },
    });

    await interaction.reply({
      content: `🔇 ${targetUser.tag} has been timed out for ${durationMinutes} minute(s). Reason: ${reason}`,
      ephemeral: false,
    });

    this.lastSuccessAt = new Date();
    this.errorCount = 0;
  }

  // ─── /kick ───────────────────────────────────────────────────────────────────

  private async handleKick(
    interaction: ChatInputCommandInteraction,
    config: ModerationConfig,
    ctx: ModuleContext
  ): Promise<void> {
    const targetUser = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") ?? "No reason provided";

    const member = await interaction.guild?.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      await interaction.reply({ content: "Could not find that member in this server.", ephemeral: true });
      return;
    }

    if (!this.botHasPermission(interaction, PermissionFlagsBits.KickMembers, ctx)) {
      await interaction.reply({ content: "I don't have permission to kick members.", ephemeral: true });
      return;
    }

    await member.kick(reason);

    await this.sendLog(interaction.guild!, config, ctx, {
      action: "kick",
      target: member,
      moderator: interaction.user,
      reason,
    });

    await ctx.db.logModerationAction({
      guildId: ctx.guildId,
      actorDiscordId: interaction.user.id,
      targetDiscordId: targetUser.id,
      action: "kick",
      reason,
    });

    await interaction.reply({
      content: `👢 ${targetUser.tag} has been kicked. Reason: ${reason}`,
      ephemeral: false,
    });

    this.lastSuccessAt = new Date();
    this.errorCount = 0;
  }

  // ─── /ban ────────────────────────────────────────────────────────────────────

  private async handleBan(
    interaction: ChatInputCommandInteraction,
    config: ModerationConfig,
    ctx: ModuleContext
  ): Promise<void> {
    const targetUser = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") ?? "No reason provided";

    if (!this.botHasPermission(interaction, PermissionFlagsBits.BanMembers, ctx)) {
      await interaction.reply({ content: "I don't have permission to ban members.", ephemeral: true });
      return;
    }

    await interaction.guild?.members.ban(targetUser.id, { reason });

    const member = await interaction.guild?.members.fetch(targetUser.id).catch(() => null);

    await this.sendLog(interaction.guild!, config, ctx, {
      action: "ban",
      target: member ?? { user: targetUser, displayName: targetUser.username } as any,
      moderator: interaction.user,
      reason,
    });

    await ctx.db.logModerationAction({
      guildId: ctx.guildId,
      actorDiscordId: interaction.user.id,
      targetDiscordId: targetUser.id,
      action: "ban",
      reason,
    });

    await interaction.reply({
      content: `🔨 ${targetUser.tag} has been banned. Reason: ${reason}`,
      ephemeral: false,
    });

    this.lastSuccessAt = new Date();
    this.errorCount = 0;
  }

  // ─── /warnings ───────────────────────────────────────────────────────────────

  private async handleWarnings(
    interaction: ChatInputCommandInteraction,
    ctx: ModuleContext
  ): Promise<void> {
    const targetUser = interaction.options.getUser("user", true);
    const count = this.warnings.get(targetUser.id) ?? 0;

    await interaction.reply({
      content: `${targetUser.tag} has **${count}** warning(s).`,
      ephemeral: true,
    });

    this.lastSuccessAt = new Date();
    this.errorCount = 0;
  }

  // ─── Warning action ──────────────────────────────────────────────────────────

  private async applyWarningAction(
    member: GuildMember,
    config: ModerationConfig,
    ctx: ModuleContext,
    actorId: string,
    reason: string
  ): Promise<void> {
    try {
      switch (config.warning_action) {
        case "none":
          break;
        case "timeout":
          if (!member.guild.members.me?.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            ctx.logger.warn("Bot lacks ModerateMembers permission for warning action timeout.");
            return;
          }
          await member.timeout(config.timeout_duration_minutes * 60 * 1000, reason);
          break;
        case "kick":
          if (!member.guild.members.me?.permissions.has(PermissionFlagsBits.KickMembers)) {
            ctx.logger.warn("Bot lacks KickMembers permission for warning action kick.");
            return;
          }
          await member.kick(reason);
          break;
        case "ban":
          if (!member.guild.members.me?.permissions.has(PermissionFlagsBits.BanMembers)) {
            ctx.logger.warn("Bot lacks BanMembers permission for warning action ban.");
            return;
          }
          await member.ban({ reason });
          break;
      }

      await ctx.db.logModerationAction({
        guildId: ctx.guildId,
        actorDiscordId: actorId,
        targetDiscordId: member.id,
        action: `warning_limit_${config.warning_action}`,
        reason,
        metadata: { warning_limit: config.warning_limit },
      });
    } catch (err) {
      this.errorCount++;
      ctx.logger.error("Failed to apply warning action.", {
        action: config.warning_action,
        userId: member.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ─── Anti-spam ───────────────────────────────────────────────────────────────

  async handleAntiSpam(
    message: Message,
    config: ModerationConfig,
    ctx: ModuleContext
  ): Promise<void> {
    const userId = message.author.id;
    const now = Date.now();
    const windowMs = 10_000; // 10 seconds

    const entry = this.spamMap.get(userId) ?? { timestamps: [] };
    // Prune timestamps outside the window
    entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
    entry.timestamps.push(now);
    this.spamMap.set(userId, entry);

    if (entry.timestamps.length >= config.anti_spam_threshold) {
      // Reset to prevent re-triggering
      entry.timestamps = [];

      const member = await message.guild?.members.fetch(userId).catch(() => null);
      if (!member) return;

      // Check bot permission
      if (!message.guild?.members.me?.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        ctx.logger.warn("Bot lacks ModerateMembers permission for anti-spam timeout.", {
          userId,
          guildId: ctx.guildId,
        });
        return;
      }

      try {
        await member.timeout(60_000, "Auto-timeout: spam detected"); // 60 seconds

        await this.sendLog(message.guild, config, ctx, {
          action: "anti_spam_timeout",
          target: member,
          moderator: message.guild.members.me ?? member,
          reason: `Sent ${config.anti_spam_threshold}+ messages in 10 seconds`,
        });

        await ctx.db.logModerationAction({
          guildId: ctx.guildId,
          actorDiscordId: message.guild.members.me?.id ?? "bot",
          targetDiscordId: userId,
          action: "anti_spam_timeout",
          reason: "Spam detected",
          metadata: { threshold: config.anti_spam_threshold, window_seconds: 10 },
        });

        ctx.logger.info("Anti-spam timeout applied.", { userId, guildId: ctx.guildId });
        this.lastSuccessAt = new Date();
      } catch (err) {
        this.errorCount++;
        ctx.logger.error("Anti-spam timeout failed.", {
          userId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  // ─── Log embed ───────────────────────────────────────────────────────────────

  private async sendLog(
    guild: NonNullable<ChatInputCommandInteraction["guild"]>,
    config: ModerationConfig,
    ctx: ModuleContext,
    opts: {
      action: string;
      target: GuildMember | { user: { tag: string; id: string }; displayName: string };
      moderator: GuildMember | { tag: string; id: string };
      reason: string;
      extra?: string;
    }
  ): Promise<void> {
    if (!config.log_channel_id) return;

    const channel = guild.channels.cache.get(config.log_channel_id);
    if (!channel || !channel.isTextBased()) {
      ctx.logger.warn("Moderation log channel not found or not a text channel.", {
        log_channel_id: config.log_channel_id,
      });
      return;
    }

    const actionColors: Record<string, number> = {
      warn: 0xffa500,
      timeout: 0xffcc00,
      kick: 0xff6600,
      ban: 0xff0000,
      anti_spam_timeout: 0xff9900,
    };

    const targetUser = "user" in opts.target ? opts.target.user : (opts.target as GuildMember).user;
    const displayName =
      "displayName" in opts.target ? opts.target.displayName : (opts.target as GuildMember).displayName;

    const embed = new EmbedBuilder()
      .setTitle(`Moderation Action: ${opts.action.replace(/_/g, " ").toUpperCase()}`)
      .setColor(actionColors[opts.action] ?? 0x5865f2)
      .addFields(
        { name: "Target", value: `${displayName} (<@${targetUser.id}>)`, inline: true },
        { name: "Moderator", value: `<@${opts.moderator.id}>`, inline: true },
        { name: "Reason", value: opts.reason, inline: false }
      )
      .setTimestamp();

    if (opts.extra) {
      embed.addFields({ name: "Details", value: opts.extra, inline: false });
    }

    try {
      await (channel as TextChannel).send({ embeds: [embed] });
    } catch (err) {
      ctx.logger.error("Failed to send moderation log embed.", {
        log_channel_id: config.log_channel_id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private botHasPermission(
    interaction: ChatInputCommandInteraction,
    permission: bigint,
    ctx: ModuleContext
  ): boolean {
    const me = interaction.guild?.members.me;
    if (!me) {
      ctx.logger.warn("Bot member not found in guild cache — cannot verify permissions.");
      return false;
    }
    if (!me.permissions.has(permission)) {
      ctx.logger.warn("Bot lacks required permission for moderation command.", {
        command: interaction.commandName,
        permission: permission.toString(),
      });
      return false;
    }
    return true;
  }

  private removeListeners(ctx: ModuleContext): void {
    if (this.interactionListener) {
      ctx.client.off(Events.InteractionCreate, this.interactionListener);
      this.interactionListener = undefined;
    }
    if (this.messageListener) {
      ctx.client.off(Events.MessageCreate, this.messageListener);
      this.messageListener = undefined;
    }
  }

  // Expose for testing
  getWarnings(): Map<string, number> {
    return this.warnings;
  }

  getSpamMap(): Map<string, SpamEntry> {
    return this.spamMap;
  }
}

export default ModerationModule;
