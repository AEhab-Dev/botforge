import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import { ModuleRunner } from "./runtime/ModuleRunner.js";

// ─── Entry point ──────────────────────────────────────────────────────────────
// The runtime reads which bot instance to manage from the environment.
// The deployment-worker sets ACTIVE_BOT_INSTANCE_ID before starting this process.

const botInstanceId = process.env["ACTIVE_BOT_INSTANCE_ID"];

if (!botInstanceId) {
  console.error("[runtime] ACTIVE_BOT_INSTANCE_ID is not set. Exiting.");
  process.exit(1);
}

async function main() {
  console.log(`[runtime] Starting for bot instance: ${botInstanceId}`);

  const runner = new ModuleRunner(botInstanceId!);
  await runner.start();

  // Graceful shutdown on SIGTERM (e.g. from deployment-worker stopping the process)
  process.on("SIGTERM", async () => {
    console.log("[runtime] Received SIGTERM — shutting down gracefully...");
    await runner.stop();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    console.log("[runtime] Received SIGINT — shutting down gracefully...");
    await runner.stop();
    process.exit(0);
  });

  // Uncaught errors — log and exit so the deployment-worker can restart
  process.on("uncaughtException", (err) => {
    console.error("[runtime] Uncaught exception:", err);
    runner.stop().finally(() => process.exit(1));
  });

  process.on("unhandledRejection", (reason) => {
    console.error("[runtime] Unhandled rejection:", reason);
    runner.stop().finally(() => process.exit(1));
  });
}

main().catch((err) => {
  console.error("[runtime] Failed to start:", err);
  process.exit(1);
});
