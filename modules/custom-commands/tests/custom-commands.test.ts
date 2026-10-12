import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mock discord.js REST before any imports that use it ─────────────────────
// REST is non-configurable on the discord.js module object, so vi.spyOn fails.
// We use vi.mock to replace the entire module with a factory that preserves
// every real export except REST, which we swap for a controllable mock class.

const mockRestPutFn = vi.fn().mockResolvedValue([]);

vi.mock("discord.js", async (importOriginal) => {
  const real = await importOriginal<typeof import("discord.js")>();
  class MockREST {
    setToken(_token: string) {
      return { put: mockRestPutFn };
    }
  }
  return { ...real, REST: MockREST };
});

// ─── Now import the module under test (REST is already mocked) ────────────────
import { CustomCommandsModule } from "../src/index.js";
import type { ModuleContext } from "@botforge/module-sdk";
import type { CustomCommandsConfig } from "@botforge/shared-schemas";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type CommandDef = CustomCommandsConfig["commands"][number];

function makeCommand(overrides: Partial<CommandDef> = {}): CommandDef {
  return {
    name: "hello",
    description: "Say hello",
    response_type: "text",
    response_content: "Hello, world!",
    required_role_id: null,
    ...overrides,
  };
}

function makeConfig(commands: CommandDef[] = [makeCommand()]): CustomCommandsConfig {
  return { commands };
}

function makeContext(config: CustomCommandsConfig = makeConfig()): ModuleContext {
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
      logModerationAction: vi.fn(),
      getState: vi.fn().mockResolvedValue(null),
      setState: vi.fn(),
      deleteState: vi.fn(),
    },
    getConfig: () => config as any,
  };
}

/** Create a mock ChatInputCommandInteraction */
function makeInteraction(
  commandName: string,
  roleIds: string[] = []
): Record<string, unknown> {
  return {
    isChatInputCommand: () => true,
    commandName,
    user: { id: "user-123" },
    member: {
      roles: {
        cache: {
          has: (id: string) => roleIds.includes(id),
        },
      },
    },
    replied: false,
    deferred: false,
    reply: vi.fn().mockResolvedValue(undefined),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("CustomCommandsModule", () => {
  let mod: CustomCommandsModule;

  beforeEach(() => {
    mod = new CustomCommandsModule();
    mockRestPutFn.mockClear();
    mockRestPutFn.mockResolvedValue([]);
    process.env["DISCORD_APPLICATION_ID"] = "app-123";
  });

  afterEach(() => {
    delete process.env["DISCORD_APPLICATION_ID"];
  });

  // ─── Metadata ─────────────────────────────────────────────────────────────

  describe("metadata", () => {
    it("has the correct key", () => {
      expect(mod.key).toBe("custom_commands");
    });

    it("requires free plan minimum", () => {
      expect(mod.minimumPlan).toBe("free");
    });

    it("declares required permissions", () => {
      expect(mod.requiredPermissions).toContain("SendMessages");
      expect(mod.requiredPermissions).toContain("ViewChannel");
    });

    it("declares Guilds intent", () => {
      expect(mod.requiredIntents).toContain("Guilds");
    });
  });

  // ─── validateConfig ────────────────────────────────────────────────────────

  describe("validateConfig", () => {
    it("returns no errors for a valid text command", () => {
      const errors = mod.validateConfig(makeConfig());
      expect(errors).toHaveLength(0);
    });

    it("returns no errors for a valid embed command", () => {
      const errors = mod.validateConfig(
        makeConfig([makeCommand({ response_type: "embed" })])
      );
      expect(errors).toHaveLength(0);
    });

    it("returns no errors for a valid link command", () => {
      const errors = mod.validateConfig(
        makeConfig([makeCommand({ response_type: "link", response_content: "https://example.com" })])
      );
      expect(errors).toHaveLength(0);
    });

    it("rejects a link command with a non-URL response_content", () => {
      const errors = mod.validateConfig(
        makeConfig([makeCommand({ response_type: "link", response_content: "not-a-url" })])
      );
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain("not a valid URL");
    });

    it("rejects an empty response_content", () => {
      const errors = mod.validateConfig(
        makeConfig([makeCommand({ response_content: "" })])
      );
      expect(errors.length).toBeGreaterThan(0);
    });

    it("rejects a response_content over 2000 characters", () => {
      const errors = mod.validateConfig(
        makeConfig([makeCommand({ response_content: "a".repeat(2001) })])
      );
      expect(errors.length).toBeGreaterThan(0);
    });

    it("rejects a description over 100 characters", () => {
      const errors = mod.validateConfig(
        makeConfig([makeCommand({ description: "d".repeat(101) })])
      );
      expect(errors.length).toBeGreaterThan(0);
    });

    it("rejects duplicate command names", () => {
      const errors = mod.validateConfig(
        makeConfig([makeCommand({ name: "dup" }), makeCommand({ name: "dup" })])
      );
      expect(errors.some((e) => e.includes("Duplicate"))).toBe(true);
    });

    it("rejects more than 25 commands", () => {
      const commands = Array.from({ length: 26 }, (_, i) =>
        makeCommand({ name: `cmd${i}` })
      );
      const errors = mod.validateConfig({ commands });
      expect(errors.some((e) => e.includes("25"))).toBe(true);
    });
  });

  // ─── initialize ───────────────────────────────────────────────────────────

  describe("initialize", () => {
    it("registers an interactionCreate listener", async () => {
      const ctx = makeContext();
      const result = await mod.initialize(ctx);

      expect(result.ok).toBe(true);
      expect(ctx.client.on).toHaveBeenCalledWith("interactionCreate", expect.any(Function));
    });

    it("calls REST PUT to register commands", async () => {
      const ctx = makeContext();
      await mod.initialize(ctx);

      expect(mockRestPutFn).toHaveBeenCalledTimes(1);
      expect(mockRestPutFn).toHaveBeenCalledWith(
        expect.stringContaining("guild-1"),
        expect.objectContaining({ body: expect.any(Array) })
      );
    });

    it("returns ok: false when DISCORD_APPLICATION_ID is missing", async () => {
      delete process.env["DISCORD_APPLICATION_ID"];
      const ctx = makeContext();
      const result = await mod.initialize(ctx);

      expect(result.ok).toBe(false);
      expect(result.error).toContain("DISCORD_APPLICATION_ID");
      expect(ctx.client.on).not.toHaveBeenCalled();
    });

    it("returns ok: false when REST PUT throws", async () => {
      mockRestPutFn.mockRejectedValueOnce(new Error("HTTP 401 Unauthorized"));
      const ctx = makeContext();
      const result = await mod.initialize(ctx);

      expect(result.ok).toBe(false);
      expect(result.error).toContain("Discord API error");
    });

    it("removes old listener before re-registering on re-init", async () => {
      const ctx = makeContext();
      await mod.initialize(ctx);
      await mod.initialize(ctx);

      expect(ctx.client.off).toHaveBeenCalledTimes(1);
      expect(ctx.client.on).toHaveBeenCalledTimes(2);
    });

    it("returns ok: false for invalid config", async () => {
      const ctx = makeContext(makeConfig([makeCommand({ name: "a".repeat(33) })]));
      const result = await mod.initialize(ctx);

      expect(result.ok).toBe(false);
    });
  });

  // ─── shutdown ─────────────────────────────────────────────────────────────

  describe("shutdown", () => {
    it("removes the interactionCreate listener", async () => {
      const ctx = makeContext();
      await mod.initialize(ctx);
      await mod.shutdown(ctx);

      expect(ctx.client.off).toHaveBeenCalledWith(
        "interactionCreate",
        expect.any(Function)
      );
    });

    it("calls REST PUT with empty body to deregister commands", async () => {
      const ctx = makeContext();
      await mod.initialize(ctx);
      await mod.shutdown(ctx);

      // First call: register; second call: deregister (empty body)
      expect(mockRestPutFn).toHaveBeenCalledTimes(2);
      const deregisterCall = mockRestPutFn.mock.calls[1] as [string, { body: unknown[] }];
      expect(deregisterCall[1].body).toHaveLength(0);
    });

    it("is safe to call without prior initialize", async () => {
      const ctx = makeContext();
      await expect(mod.shutdown(ctx)).resolves.not.toThrow();
    });

    it("skips deregistration and warns when DISCORD_APPLICATION_ID is missing", async () => {
      const ctx = makeContext();
      await mod.initialize(ctx);
      delete process.env["DISCORD_APPLICATION_ID"];
      await mod.shutdown(ctx);

      expect(ctx.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("DISCORD_APPLICATION_ID")
      );
    });
  });

  // ─── getHealth ────────────────────────────────────────────────────────────

  describe("getHealth", () => {
    it("reports DISABLED before initialize", () => {
      expect(mod.getHealth().state).toBe("DISABLED");
    });

    it("reports RUNNING after successful initialize", async () => {
      await mod.initialize(makeContext());
      expect(mod.getHealth().state).toBe("RUNNING");
    });

    it("reports DISABLED after shutdown", async () => {
      const ctx = makeContext();
      await mod.initialize(ctx);
      await mod.shutdown(ctx);
      expect(mod.getHealth().state).toBe("DISABLED");
    });
  });

  // ─── Interaction handling ─────────────────────────────────────────────────

  describe("interaction handling", () => {
    /** Trigger the registered interactionCreate listener directly */
    async function triggerInteraction(
      ctx: ModuleContext,
      interaction: Record<string, unknown>
    ): Promise<void> {
      const onMock = ctx.client.on as ReturnType<typeof vi.fn>;
      const onCall = onMock.mock.calls.find(
        (c: unknown[]) => c[0] === "interactionCreate"
      ) as [string, (i: unknown) => Promise<void>] | undefined;
      if (!onCall) throw new Error("interactionCreate listener not registered");
      await onCall[1](interaction);
    }

    it("replies with plain text for text commands", async () => {
      const ctx = makeContext();
      await mod.initialize(ctx);

      const interaction = makeInteraction("hello");
      await triggerInteraction(ctx, interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: "Hello, world!" })
      );
    });

    it("replies with an embed for embed commands", async () => {
      const ctx = makeContext(
        makeConfig([makeCommand({ response_type: "embed", response_content: "Embed text" })])
      );
      await mod.initialize(ctx);

      const interaction = makeInteraction("hello");
      await triggerInteraction(ctx, interaction);

      const call = (interaction.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
        embeds?: unknown[];
      };
      expect(call.embeds).toHaveLength(1);
    });

    it("replies with a button for link commands", async () => {
      const ctx = makeContext(
        makeConfig([
          makeCommand({
            response_type: "link",
            response_content: "https://example.com",
          }),
        ])
      );
      await mod.initialize(ctx);

      const interaction = makeInteraction("hello");
      await triggerInteraction(ctx, interaction);

      const call = (interaction.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
        components?: unknown[];
      };
      expect(call.components).toHaveLength(1);
    });

    it("replies ephemerally when user lacks the required role", async () => {
      const ctx = makeContext(
        makeConfig([makeCommand({ required_role_id: "role-999" })])
      );
      await mod.initialize(ctx);

      // User has no roles
      const interaction = makeInteraction("hello", []);
      await triggerInteraction(ctx, interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "You don't have permission to use this command.",
          ephemeral: true,
        })
      );
    });

    it("allows the command when user has the required role", async () => {
      const ctx = makeContext(
        makeConfig([makeCommand({ required_role_id: "role-999" })])
      );
      await mod.initialize(ctx);

      // User has the required role
      const interaction = makeInteraction("hello", ["role-999"]);
      await triggerInteraction(ctx, interaction);

      const call = (interaction.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
        content?: string;
        ephemeral?: boolean;
      };
      expect(call.ephemeral).toBeUndefined();
      expect(call.content).toBe("Hello, world!");
    });

    it("ignores interactions that are not slash commands", async () => {
      const ctx = makeContext();
      await mod.initialize(ctx);

      const nonSlashInteraction = { isChatInputCommand: () => false, reply: vi.fn() };
      await triggerInteraction(ctx, nonSlashInteraction);

      expect(nonSlashInteraction.reply).not.toHaveBeenCalled();
    });

    it("ignores unknown slash commands silently", async () => {
      const ctx = makeContext();
      await mod.initialize(ctx);

      const interaction = makeInteraction("nonexistent-command");
      await triggerInteraction(ctx, interaction);

      expect(interaction.reply).not.toHaveBeenCalled();
    });
  });
});
