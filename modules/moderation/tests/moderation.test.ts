import { describe, it, expect, vi, beforeEach } from "vitest";
import { ModerationModule } from "../src/index.js";
import type { ModuleContext } from "@botforge/module-sdk";
import type { ModerationConfig } from "@botforge/shared-schemas";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<ModerationConfig> = {}): ModerationConfig {
  return {
    log_channel_id: null,
    warning_limit: 3,
    warning_action: "timeout",
    timeout_duration_minutes: 60,
    anti_spam: true,
    anti_spam_threshold: 5,
    ...overrides,
  };
}

function makeContext(configOverrides: Partial<ModerationConfig> = {}): ModuleContext {
  const config = makeConfig(configOverrides);
  return {
    botInstanceId: "bot-1",
    guildId: "guild-1",
    client: { on: vi.fn(), off: vi.fn(), emit: vi.fn(), token: "fake-token" } as any,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    db: {
      logModerationAction: vi.fn().mockResolvedValue(undefined),
      getState: vi.fn().mockResolvedValue(null),
      setState: vi.fn(),
      deleteState: vi.fn(),
    },
    getConfig: () => config as any,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ModerationModule", () => {
  let mod: ModerationModule;

  beforeEach(() => {
    mod = new ModerationModule();
  });

  // ─── Metadata ─────────────────────────────────────────────────────────────

  describe("metadata", () => {
    it("has the correct key", () => {
      expect(mod.key).toBe("moderation");
    });

    it("requires starter plan minimum", () => {
      expect(mod.minimumPlan).toBe("starter");
    });

    it("declares required permissions", () => {
      expect(mod.requiredPermissions).toContain("KickMembers");
      expect(mod.requiredPermissions).toContain("BanMembers");
      expect(mod.requiredPermissions).toContain("ModerateMembers");
    });

    it("declares required intents", () => {
      expect(mod.requiredIntents).toContain("GuildMessages");
      expect(mod.requiredIntents).toContain("GuildMembers");
    });
  });

  // ─── validateConfig ────────────────────────────────────────────────────────

  describe("validateConfig", () => {
    it("returns no errors for a valid config", () => {
      expect(mod.validateConfig(makeConfig())).toHaveLength(0);
    });

    it("rejects warning_limit of 0", () => {
      const errors = mod.validateConfig(makeConfig({ warning_limit: 0 }));
      expect(errors.length).toBeGreaterThan(0);
    });

    it("rejects warning_limit of 11", () => {
      const errors = mod.validateConfig(makeConfig({ warning_limit: 11 }));
      expect(errors.length).toBeGreaterThan(0);
    });

    it("rejects timeout_duration_minutes of 0", () => {
      const errors = mod.validateConfig(makeConfig({ timeout_duration_minutes: 0 }));
      expect(errors.length).toBeGreaterThan(0);
    });

    it("rejects timeout_duration_minutes above 40320", () => {
      const errors = mod.validateConfig(makeConfig({ timeout_duration_minutes: 40321 }));
      expect(errors.length).toBeGreaterThan(0);
    });

    it("rejects anti_spam_threshold of 1", () => {
      const errors = mod.validateConfig(makeConfig({ anti_spam_threshold: 1 }));
      expect(errors.length).toBeGreaterThan(0);
    });

    it("rejects anti_spam_threshold of 21", () => {
      const errors = mod.validateConfig(makeConfig({ anti_spam_threshold: 21 }));
      expect(errors.length).toBeGreaterThan(0);
    });

    it("accepts boundary values", () => {
      const errors = mod.validateConfig(
        makeConfig({
          warning_limit: 1,
          timeout_duration_minutes: 1,
          anti_spam_threshold: 2,
        })
      );
      expect(errors).toHaveLength(0);
    });
  });

  // ─── initialize ───────────────────────────────────────────────────────────

  describe("initialize", () => {
    it("returns ok: true on valid config (command registration may fail gracefully)", async () => {
      const ctx = makeContext();
      const result = await mod.initialize(ctx);
      expect(result.ok).toBe(true);
    });

    it("registers InteractionCreate listener", async () => {
      const ctx = makeContext();
      await mod.initialize(ctx);
      expect(ctx.client.on).toHaveBeenCalledWith("interactionCreate", expect.any(Function));
    });

    it("registers MessageCreate listener when anti_spam is true", async () => {
      const ctx = makeContext({ anti_spam: true });
      await mod.initialize(ctx);
      expect(ctx.client.on).toHaveBeenCalledWith("messageCreate", expect.any(Function));
    });

    it("does not register MessageCreate listener when anti_spam is false", async () => {
      const ctx = makeContext({ anti_spam: false });
      await mod.initialize(ctx);
      const calls = (ctx.client.on as ReturnType<typeof vi.fn>).mock.calls;
      const msgListenerCalls = calls.filter(([event]: [string]) => event === "messageCreate");
      expect(msgListenerCalls).toHaveLength(0);
    });

    it("is idempotent — removes old listeners on re-init", async () => {
      const ctx = makeContext();
      await mod.initialize(ctx);
      await mod.initialize(ctx);
      expect(ctx.client.off).toHaveBeenCalledTimes(2); // interactionCreate + messageCreate
    });

    it("returns ok: false for invalid config", async () => {
      const ctx = makeContext({ warning_limit: 0 });
      const result = await mod.initialize(ctx);
      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ─── shutdown ─────────────────────────────────────────────────────────────

  describe("shutdown", () => {
    it("removes listeners on shutdown", async () => {
      const ctx = makeContext();
      await mod.initialize(ctx);
      await mod.shutdown(ctx);
      expect(ctx.client.off).toHaveBeenCalled();
    });

    it("is safe to call without prior initialize", async () => {
      const ctx = makeContext();
      await expect(mod.shutdown(ctx)).resolves.not.toThrow();
    });
  });

  // ─── getHealth ────────────────────────────────────────────────────────────

  describe("getHealth", () => {
    it("reports DISABLED before initialize", () => {
      expect(mod.getHealth().state).toBe("DISABLED");
    });

    it("reports RUNNING after successful initialize", async () => {
      const ctx = makeContext();
      await mod.initialize(ctx);
      expect(mod.getHealth().state).toBe("RUNNING");
    });

    it("reports DISABLED after shutdown", async () => {
      const ctx = makeContext();
      await mod.initialize(ctx);
      await mod.shutdown(ctx);
      expect(mod.getHealth().state).toBe("DISABLED");
    });
  });

  // ─── Anti-spam ────────────────────────────────────────────────────────────

  describe("handleAntiSpam", () => {
    function makeMessage(userId: string, guildId = "guild-1") {
      const botMe = {
        id: "bot-999",
        permissions: {
          has: vi.fn().mockReturnValue(true),
        },
        timeout: vi.fn().mockResolvedValue(undefined),
      };
      const member = {
        id: userId,
        timeout: vi.fn().mockResolvedValue(undefined),
        guild: { id: guildId, members: { me: botMe } },
      };
      return {
        author: { id: userId, bot: false },
        guild: {
          id: guildId,
          members: {
            me: botMe,
            fetch: vi.fn().mockResolvedValue(member),
          },
          channels: { cache: { get: vi.fn().mockReturnValue(null) } },
        },
      } as any;
    }

    it("does not timeout below the threshold", async () => {
      const ctx = makeContext({ anti_spam_threshold: 5 });
      const config = makeConfig({ anti_spam_threshold: 5 });
      const msg = makeMessage("user-1");

      // Send 4 messages — below threshold
      for (let i = 0; i < 4; i++) {
        await mod.handleAntiSpam(msg, config, ctx);
      }

      expect(msg.guild.members.fetch).not.toHaveBeenCalled();
    });

    it("times out a user who hits the threshold", async () => {
      const ctx = makeContext({ anti_spam_threshold: 5 });
      const config = makeConfig({ anti_spam_threshold: 5 });
      const msg = makeMessage("user-2");

      // Send exactly threshold messages
      for (let i = 0; i < 5; i++) {
        await mod.handleAntiSpam(msg, config, ctx);
      }

      expect(msg.guild.members.fetch).toHaveBeenCalledWith("user-2");
    });

    it("resets timestamps after triggering so the user is not immediately timed out again", async () => {
      const ctx = makeContext({ anti_spam_threshold: 3 });
      const config = makeConfig({ anti_spam_threshold: 3 });
      const msg = makeMessage("user-3");

      for (let i = 0; i < 3; i++) {
        await mod.handleAntiSpam(msg, config, ctx);
      }

      // After trigger, spamMap entry timestamps should be cleared
      const entry = mod.getSpamMap().get("user-3");
      expect(entry?.timestamps).toHaveLength(0);
    });

    it("logs a warning when bot lacks ModerateMembers permission", async () => {
      const ctx = makeContext({ anti_spam_threshold: 3 });
      const config = makeConfig({ anti_spam_threshold: 3 });
      const msg = makeMessage("user-4");
      // Override permission check to return false
      (msg.guild.members.me.permissions.has as ReturnType<typeof vi.fn>).mockReturnValue(false);

      for (let i = 0; i < 3; i++) {
        await mod.handleAntiSpam(msg, config, ctx);
      }

      expect(ctx.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("ModerateMembers"),
        expect.any(Object)
      );
    });
  });

  // ─── Warning map ──────────────────────────────────────────────────────────

  describe("warnings state", () => {
    it("starts with an empty warnings map", () => {
      expect(mod.getWarnings().size).toBe(0);
    });
  });
});
