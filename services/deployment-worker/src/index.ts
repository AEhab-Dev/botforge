import { ProcessManager } from "./ProcessManager.js";
import { DeploymentPoller } from "./DeploymentPoller.js";

async function main() {
  console.log("[worker] BotForge Deployment Worker starting...");

  const manager = new ProcessManager();
  const poller = new DeploymentPoller(manager);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`[worker] Received ${signal} — shutting down...`);
    await poller.stop();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("uncaughtException", (err) => {
    console.error("[worker] Uncaught exception:", err);
    // Give in-flight DB writes 3 seconds to finish before shutting down
    setTimeout(() => {
      poller.stop().finally(() => process.exit(1));
    }, 3000);
  });

  process.on("unhandledRejection", (reason) => {
    console.error("[worker] Unhandled rejection:", reason);
    setTimeout(() => {
      poller.stop().finally(() => process.exit(1));
    }, 3000);
  });

  await poller.start();

  console.log(
    `[worker] Ready. Running ${manager.runningCount()} bot(s).`
  );
}

main().catch((err) => {
  console.error("[worker] Failed to start:", err);
  process.exit(1);
});
