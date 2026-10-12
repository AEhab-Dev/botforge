import { spawn, type ChildProcess } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Path to the bot-runtime entry point
const RUNTIME_ENTRY = resolve(__dirname, "../../bot-runtime/src/index.ts");

// Use tsx from the workspace root node_modules, falling back to the local one
const TSX_BIN = resolve(__dirname, "../../../node_modules/.bin/tsx");

export interface ManagedProcess {
  botInstanceId: string;
  deploymentId: string;
  process: ChildProcess;
  startedAt: Date;
  restartCount: number;
}

/**
 * ProcessManager — owns the lifecycle of bot-runtime child processes.
 *
 * One process per bot instance. If a process crashes it is restarted
 * up to MAX_RESTARTS times with exponential backoff, then marked as
 * failed so the worker stops trying.
 */
export class ProcessManager {
  private processes = new Map<string, ManagedProcess>();
  private readonly MAX_RESTARTS = 3;

  // Callback invoked when a process exits — the worker uses this to
  // update deployment status in the DB.
  onExit?: (botInstanceId: string, deploymentId: string, code: number | null, willRestart: boolean) => Promise<void>;

  /**
   * Start a bot-runtime process for the given bot instance.
   * Resolves when the process has been spawned (not when it's ready).
   */
  async start(
    botInstanceId: string,
    deploymentId: string,
    env: Record<string, string>
  ): Promise<void> {
    // Kill any existing process for this bot before starting a new one
    if (this.processes.has(botInstanceId)) {
      await this.stop(botInstanceId);
    }

    const child = spawn(TSX_BIN, [RUNTIME_ENTRY], {
      env: {
        ...process.env,
        ...env,
        ACTIVE_BOT_INSTANCE_ID: botInstanceId,
      },
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });

    const managed: ManagedProcess = {
      botInstanceId,
      deploymentId,
      process: child,
      startedAt: new Date(),
      restartCount: 0,
    };

    this.processes.set(botInstanceId, managed);

    // Prefix all stdout/stderr with the bot instance ID for log clarity
    child.stdout?.on("data", (data: Buffer) => {
      process.stdout.write(`[bot:${botInstanceId.slice(0, 8)}] ${data.toString()}`);
    });

    child.stderr?.on("data", (data: Buffer) => {
      process.stderr.write(`[bot:${botInstanceId.slice(0, 8)}][err] ${data.toString()}`);
    });

    child.on("exit", (code, signal) => {
      console.log(
        `[worker] Bot ${botInstanceId.slice(0, 8)} exited — code=${code} signal=${signal}`
      );

      const current = this.processes.get(botInstanceId);
      if (!current) return;

      // Determine if we'll auto-restart before notifying the DB
      const crashed = code !== 0 && signal !== "SIGTERM";
      const willRestart = crashed && current.restartCount < this.MAX_RESTARTS;

      // Notify the worker so it can update the DB
      this.onExit?.(botInstanceId, deploymentId, code, willRestart);

      // Auto-restart on unexpected crash
      if (willRestart) {
        const delay = Math.pow(2, current.restartCount) * 2000; // 2s, 4s, 8s
        console.log(
          `[worker] Restarting bot ${botInstanceId.slice(0, 8)} in ${delay}ms ` +
          `(attempt ${current.restartCount + 1}/${this.MAX_RESTARTS})`
        );
        current.restartCount++;
        setTimeout(() => {
          this.start(botInstanceId, deploymentId, env).catch((err) => {
            console.error(`[worker] Failed to restart bot ${botInstanceId.slice(0, 8)}:`, err);
          });
        }, delay);
      } else {
        this.processes.delete(botInstanceId);
      }
    });

    console.log(
      `[worker] Spawned bot ${botInstanceId.slice(0, 8)} (pid=${child.pid}, deployment=${deploymentId.slice(0, 8)})`
    );
  }

  /**
   * Stop a running bot process gracefully (SIGTERM → SIGKILL after 10s).
   */
  async stop(botInstanceId: string): Promise<void> {
    const managed = this.processes.get(botInstanceId);
    if (!managed) return;

    this.processes.delete(botInstanceId);

    return new Promise((resolve) => {
      const { process: child } = managed;

      if (child.exitCode !== null) {
        // Already exited
        resolve();
        return;
      }

      const forceKillTimer = setTimeout(() => {
        console.warn(`[worker] Force-killing bot ${botInstanceId.slice(0, 8)} after timeout`);
        child.kill("SIGKILL");
      }, 10_000);

      child.once("exit", () => {
        clearTimeout(forceKillTimer);
        resolve();
      });

      child.kill("SIGTERM");
    });
  }

  /**
   * Stop all running processes — called on worker shutdown.
   */
  async stopAll(): Promise<void> {
    const ids = Array.from(this.processes.keys());
    await Promise.all(ids.map((id) => this.stop(id)));
  }

  isRunning(botInstanceId: string): boolean {
    return this.processes.has(botInstanceId);
  }

  runningCount(): number {
    return this.processes.size;
  }
}
