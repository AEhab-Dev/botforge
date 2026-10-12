import {
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Interaction,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";
import type {
  BotModule,
  ModuleContext,
  ModuleHealthReport,
  ModuleState,
} from "@botforge/module-sdk";
import type { CustomCommandsConfig } from "@botforge/shared-schemas";

/**
 * CustomCommandsModule — registers configurable slash commands for a guild.
 *
 * Responsibilities:
 * - Register guild slash commands via Discord REST API on initialize
 * - Respond to interactionCreate events for each configured command
 * - Enforce required_role_id checks with ephemeral permission errors
 * - Support text, embed (indigo), and link (button) response types
 * - Deregister all guild slash commands on shutdown (empty PUT)
 */
export class CustomCommandsModule implements BotModule<CustomCommandsConfig> {
  readonly key = "custom_commands" as const;
  readonly version = "1.0.0";
  readonly displayName = "Custom Commands";
  readonly description = "Create configurable slash commands with text, embed, or link responses.";
  readonly minimumPlan = "free" as const;
  readonly requiredPermissions = ["SendMessages", "ViewChannel"];
  readonly requiredIntents = ["Guilds"];

  private errorCount = 0;
  private lastSuccessAt?: Date;
  private initialized = false;

  private listener: ((interaction: Interaction) => Promise<void>) | undefined;

  // ─── Validation ───────────────────────────────────────────────────────────

  validateConfig(config: CustomCommandsConfig): string[] {
    const errors: string[] = [];

    if (config.commands.length > 25) {
      errors.push("You can have at most 25 custom commands.");
    }

    const names = new Set<string>();
    for (const cmd of config.commands) {
      if (!/^[\w-]+$/.test(cmd.name)) {
        errors.push(
          `Command name "${cmd.name}" must be alphanumeric with dashes/underscores only.`
        );
      }
      if (cmd.name.length < 1 || cmd.name.length > 32) {
        errors.push(`Command name "${cmd.name}" must be between 1 and 32 characters.`);
      }
      if (cmd.description.length > 100) {
        errors.push(`Command "${cmd.name}" description must be 100 characters or fewer.`);
      }
      if (!cmd.response_content || cmd.response_content.trim().length === 0) {
        errors.push(`Command "${cmd.name}" must have a non-empty response_content.`);
      }
      if (cmd.response_content.length > 2000) {
        errors.push(
          `Command "${cmd.name}" response_content must be 2000 characters or fewer.`
        );
      }
      if (cmd.response_type === "link" && !isValidUrl(cmd.response_content)) {
        errors.push(
          `Command "${cmd.name}" has response_type "link" but response_content is not a valid URL.`
        );
      }
      if (names.has(cmd.name)) {
        errors.push(`Duplicate command name: "${cmd.name}".`);
      }
      names.add(cmd.name);
    }

    return errors;
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  async initialize(ctx: ModuleContext): Promise<{ ok: boolean; error?: string }> {
    // Remove old listener before re-registering (idempotent re-init)
    if (this.initialized && this.listener) {
      ctx.client.off(Events.InteractionCreate, this.listener);
      this.initialized = false;
    }

    const config = ctx.getConfig<CustomCommandsConfig>();

    const validationErrors = this.validateConfig(config);
    if (validationErrors.length > 0) {
      return { ok: false, error: validationErrors[0] ?? "Invalid configuration" };
    }

    const applicationId = process.env["DISCORD_APPLICATION_ID"];
    if (!applicationId) {
      return {
        ok: false,
        error: "DISCORD_APPLICATION_ID environment variable is not set.",
      };
    }

    // Register slash commands with Discord REST API
    try {
      await this.registerCommands(ctx, config, applicationId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ctx.logger.error("Failed to register slash commands with Discord API.", { error: message });
      return { ok: false, error: `Discord API error: ${message}` };
    }

    // Build a fast lookup map by command name
    const commandMap = new Map(config.commands.map((cmd) => [cmd.name, cmd]));

    // Register the interaction listener
    this.listener = async (interaction: Interaction) => {
      if (!interaction.isChatInputCommand()) return;
      await this.handleInteraction(interaction, commandMap, ctx);
    };

    ctx.client.on(Events.InteractionCreate, this.listener);
    this.initialized = true;

    ctx.logger.info("Custom commands module initialized.", {
      commandCount: config.commands.length,
      guildId: ctx.guildId,
    });

    return { ok: true };
  }

  async shutdown(ctx: ModuleContext): Promise<void> {
    if (this.listener) {
      ctx.client.off(Events.InteractionCreate, this.listener);
      this.listener = undefined;
    }

    const applicationId = process.env["DISCORD_APPLICATION_ID"];
    if (applicationId) {
      try {
        await this.deregisterCommands(ctx, applicationId);
      } catch (err) {
        ctx.logger.warn("Failed to deregister slash commands on shutdown.", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } else {
      ctx.logger.warn(
        "DISCORD_APPLICATION_ID not set — skipping slash command deregistration."
      );
    }

    this.initialized = false;
    ctx.logger.info("Custom commands module shut down.");
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
      health.message = `${this.errorCount} consecutive errors — check bot permissions`;
    }

    return health;
  }

  // ─── Discord REST helpers ─────────────────────────────────────────────────

  private async registerCommands(
    ctx: ModuleContext,
    config: CustomCommandsConfig,
    applicationId: string
  ): Promise<void> {
    const token = (ctx.client as { token?: string | null }).token;
    if (!token) {
      throw new Error("Discord client token is not available.");
    }

    const rest = new REST({ version: "10" }).setToken(token);

    const commandBodies = config.commands.map((cmd) =>
      new SlashCommandBuilder()
        .setName(cmd.name)
        .setDescription(cmd.description || "No description provided.")
        .toJSON()
    );

    await rest.put(Routes.applicationGuildCommands(applicationId, ctx.guildId), {
      body: commandBodies,
    });

    ctx.logger.info("Slash commands registered.", {
      count: commandBodies.length,
      guildId: ctx.guildId,
    });
  }

  private async deregisterCommands(
    ctx: ModuleContext,
    applicationId: string
  ): Promise<void> {
    const token = (ctx.client as { token?: string | null }).token;
    if (!token) {
      ctx.logger.warn("Cannot deregister commands — client token unavailable.");
      return;
    }

    const rest = new REST({ version: "10" }).setToken(token);

    // Empty PUT clears all guild commands
    await rest.put(Routes.applicationGuildCommands(applicationId, ctx.guildId), {
      body: [],
    });

    ctx.logger.info("Slash commands deregistered.", { guildId: ctx.guildId });
  }

  // ─── Interaction handler ──────────────────────────────────────────────────

  private async handleInteraction(
    interaction: ChatInputCommandInteraction,
    commandMap: Map<string, CustomCommandsConfig["commands"][number]>,
    ctx: ModuleContext
  ): Promise<void> {
    const cmd = commandMap.get(interaction.commandName);

    if (!cmd) {
      // Not one of our commands — ignore silently
      return;
    }

    try {
      // Role check
      if (cmd.required_role_id) {
        const member = interaction.member as GuildMember | null;
        const hasRole = member?.roles?.cache?.has(cmd.required_role_id) ?? false;

        if (!hasRole) {
          await interaction.reply({
            content: "You don't have permission to use this command.",
            ephemeral: true,
          });
          return;
        }
      }

      // Send response by type
      switch (cmd.response_type) {
        case "text": {
          await interaction.reply({ content: cmd.response_content });
          break;
        }

        case "embed": {
          const embed = new EmbedBuilder()
            .setDescription(cmd.response_content)
            .setColor(0x4b0082); // Indigo
          await interaction.reply({ embeds: [embed] });
          break;
        }

        case "link": {
          const button = new ButtonBuilder()
            .setLabel("Open Link")
            .setStyle(ButtonStyle.Link)
            .setURL(cmd.response_content);

          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);
          await interaction.reply({ components: [row] });
          break;
        }

        default: {
          // Exhaustiveness guard — should not reach here with valid config
          ctx.logger.warn("Unknown response_type on command.", {
            commandName: cmd.name,
            response_type: (cmd as { response_type: string }).response_type,
          });
          await interaction.reply({
            content: "This command is misconfigured. Please contact an administrator.",
            ephemeral: true,
          });
        }
      }

      this.lastSuccessAt = new Date();
      this.errorCount = 0;

      ctx.logger.info("Custom command executed.", {
        commandName: cmd.name,
        userId: interaction.user.id,
        guildId: ctx.guildId,
      });
    } catch (err) {
      this.errorCount++;
      ctx.logger.error("Failed to respond to slash command.", {
        commandName: cmd.name,
        error: err instanceof Error ? err.message : String(err),
      });

      // Best-effort follow-up if the interaction isn't already replied to
      if (!interaction.replied && !interaction.deferred) {
        try {
          await interaction.reply({
            content: "Something went wrong while running this command.",
            ephemeral: true,
          });
        } catch {
          // Interaction may have expired — ignore
        }
      }
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

// Default export so the runtime can do: new (await import(...)).default()
export default CustomCommandsModule;
