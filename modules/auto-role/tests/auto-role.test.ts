import { describe, it, expect, vi, beforeEach } from "vitest";
import { AutoRoleModule } from "../src/index.js";
import type { ModuleContext } from "@botforge/module-sdk";
import type { AutoRoleConfig } from "@botforge/shared-schemas";

function makeConfig(overrides: Partial<AutoRoleConfig> = {}): AutoRoleConfig {
  return { role_ids: ["111111111111111111"], ...overrides };
}

function makeContext(configOverrides: Partial<AutoRoleConfig> = {}): ModuleContext {
  return {
    botInstanceId: "bot-1",
    guildId: "guild-1",
    client: { on: vi.fn(), off: vi.fn() } as any,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    db: {
      logModerationAction: vi.fn(),
      getState: vi.fn().mockResolvedValue(null),
      setState: vi.fn(),
      deleteState: vi.fn(),
    },
    getConfig: () => makeConfig(configOverrides) as any,
  };
}

describe("AutoRoleModule", () => {
  let mod: AutoRoleModule;

  beforeEach(() => { mod = new AutoRoleModule(); });

  describe("validateConfig", () => {
    it("passes with valid role_ids", () => {
      expect(mod.validateConfig(makeConfig())).toHaveLength(0);
    });

    it("requires at least one role", () => {
      const errors = mod.validateConfig(makeConfig({ role_ids: [] }));
      expect(errors.length).toBeGreaterThan(0);
    });

    it("rejects more than 5 roles", () => {
      const errors = mod.validateConfig(
        makeConfig({ role_ids: ["1", "2", "3", "4", "5", "6"] })
      );
      expect(errors).toContain("A maximum of 5 auto-roles are supported.");
    });
  });

  describe("initialize", () => {
    it("registers GuildMemberAdd listener on valid config", async () => {
      const ctx = makeContext();
      const result = await mod.initialize(ctx);
      expect(result.ok).toBe(true);
      expect(ctx.client.on).toHaveBeenCalledWith("guildMemberAdd", expect.any(Function));
    });

    it("returns ok: false with empty role_ids", async () => {
      const ctx = makeContext({ role_ids: [] });
      const result = await mod.initialize(ctx);
      expect(result.ok).toBe(false);
      expect(ctx.client.on).not.toHaveBeenCalled();
    });
  });

  describe("shutdown", () => {
    it("removes listener after initialize", async () => {
      const ctx = makeContext();
      await mod.initialize(ctx);
      await mod.shutdown(ctx);
      expect(ctx.client.off).toHaveBeenCalledWith("guildMemberAdd", expect.any(Function));
    });

    it("is safe to call without prior initialize", async () => {
      const ctx = makeContext();
      await expect(mod.shutdown(ctx)).resolves.not.toThrow();
    });
  });

  describe("getHealth", () => {
    it("reports DISABLED before initialize", () => {
      expect(mod.getHealth().state).toBe("DISABLED");
    });

    it("reports RUNNING after initialize", async () => {
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

  describe("metadata", () => {
    it("has key auto_role", () => { expect(mod.key).toBe("auto_role"); });
    it("requires free plan", () => { expect(mod.minimumPlan).toBe("free"); });
    it("requires ManageRoles permission", () => {
      expect(mod.requiredPermissions).toContain("ManageRoles");
    });
  });
});
