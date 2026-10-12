import { describe, it, expect, vi, beforeEach } from "vitest";
import { WelcomeModule } from "../src/index.js";
import type { ModuleContext } from "@botforge/module-sdk";
import type { WelcomeConfig } from "@botforge/shared-schemas";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<WelcomeConfig> = {}): WelcomeConfig {
  return {
    channel_id: "123456789",
    message_template: "Welcome {user} to {server}!",
    auto_role_id: null,
    delete_after_seconds: null,
    use_embed: false,
    ...overrides,
  };
}

function makeContext(configOverrides: Partial<WelcomeConfig> = {}): ModuleContext {
  const config = makeConfig(configOverrides);
  return {
    botInstanceId: "bot-1",
    guildId: "guild-1",
    client: { on: vi.fn(), off: vi.fn(), emit: vi.fn() } as any,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    db: {
      logModerationAction: vi.fn(),
      getState: vi.fn().mockResolvedValue(null),
      setState: vi.fn(),
      deleteState: vi.fn(),
    },
    getConfig: () => config as any,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("WelcomeModule", () => {
  let mod: WelcomeModule;

  beforeEach(() => {
    mod = new WelcomeModule();
  });

  // ─── validateConfig ────────────────────────────────────────────────────────

  describe("validateConfig", () => {
    it("returns no errors for a valid config", () => {
      const errors = mod.validateConfig(makeConfig());
      expect(errors).toHaveLength(0);
    });

    it("requires channel_id", () => {
      const errors = mod.validateConfig(makeConfig({ channel_id: null }));
      expect(errors).toContain(
        "Welcome channel must be configured before the bot can be deployed."
      );
    });

    it("requires a non-empty message template", () => {
      const errors = mod.validateConfig(makeConfig({ message_template: "" }));
      expect(errors.length).toBeGreaterThan(0);
    });

    it("rejects a message template over 2000 characters", () => {
      const errors = mod.validateConfig(
        makeConfig({ message_template: "a".repeat(2001) })
      );
      expect(errors).toContain(
        "Welcome message template must be 2000 characters or fewer."
      );
    });

    it("rejects delete_after_seconds of 0", () => {
      const errors = mod.validateConfig(makeConfig({ delete_after_seconds: 0 }));
      expect(errors.length).toBeGreaterThan(0);
    });

    it("accepts delete_after_seconds within range", () => {
      const errors = mod.validateConfig(makeConfig({ delete_after_seconds: 30 }));
      expect(errors).toHaveLength(0);
    });
  });

  // ─── initialize ───────────────────────────────────────────────────────────

  describe("initialize", () => {
    it("registers a GuildMemberAdd listener on success", async () => {
      const ctx = makeContext();
      const result = await mod.initialize(ctx);

      expect(result.ok).toBe(true);
      expect(ctx.client.on).toHaveBeenCalledWith(
        "guildMemberAdd",
        expect.any(Function)
      );
    });

    it("returns ok: false when channel_id is missing", async () => {
      const ctx = makeContext({ channel_id: null });
      const result = await mod.initialize(ctx);

      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
      // Should NOT register listener on failed init
      expect(ctx.client.on).not.toHaveBeenCalled();
    });

    it("removes old listener before re-registering on re-init", async () => {
      const ctx = makeContext();
      await mod.initialize(ctx);
      await mod.initialize(ctx); // second init

      expect(ctx.client.off).toHaveBeenCalledTimes(1);
      expect(ctx.client.on).toHaveBeenCalledTimes(2);
    });
  });

  // ─── shutdown ─────────────────────────────────────────────────────────────

  describe("shutdown", () => {
    it("removes the GuildMemberAdd listener", async () => {
      const ctx = makeContext();
      await mod.initialize(ctx);
      await mod.shutdown(ctx);

      expect(ctx.client.off).toHaveBeenCalledWith(
        "guildMemberAdd",
        expect.any(Function)
      );
    });

    it("is safe to call without prior initialize", async () => {
      const ctx = makeContext();
      await expect(mod.shutdown(ctx)).resolves.not.toThrow();
    });
  });

  // ─── getHealth ────────────────────────────────────────────────────────────

  describe("getHealth", () => {
    it("reports DISABLED before initialize", () => {
      const health = mod.getHealth();
      expect(health.state).toBe("DISABLED");
    });

    it("reports RUNNING after successful initialize", async () => {
      const ctx = makeContext();
      await mod.initialize(ctx);
      const health = mod.getHealth();
      expect(health.state).toBe("RUNNING");
    });

    it("reports DISABLED after shutdown", async () => {
      const ctx = makeContext();
      await mod.initialize(ctx);
      await mod.shutdown(ctx);
      const health = mod.getHealth();
      expect(health.state).toBe("DISABLED");
    });
  });

  // ─── Module metadata ──────────────────────────────────────────────────────

  describe("metadata", () => {
    it("has the correct key", () => {
      expect(mod.key).toBe("welcome");
    });

    it("requires free plan minimum", () => {
      expect(mod.minimumPlan).toBe("free");
    });

    it("declares required permissions", () => {
      expect(mod.requiredPermissions).toContain("SendMessages");
      expect(mod.requiredPermissions).toContain("ViewChannel");
    });

    it("declares GuildMembers intent", () => {
      expect(mod.requiredIntents).toContain("GuildMembers");
    });
  });
});
