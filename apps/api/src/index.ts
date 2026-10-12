import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";

import { authRoutes } from "./routes/auth.js";
import { botRoutes } from "./routes/bots.js";
import { moduleRoutes } from "./routes/modules.js";
import { discordRoutes } from "./routes/discord.js";

const app = new Hono();

// ─── Global middleware ────────────────────────────────────────────────────────

app.use("*", logger());
app.use("*", secureHeaders());
app.use(
  "*",
  cors({
    origin: process.env["APP_BASE_URL"] ?? "http://localhost:3000",
    credentials: true,
  })
);

// ─── Routes ───────────────────────────────────────────────────────────────────

app.route("/api/v1/auth", authRoutes);
app.route("/api/v1/bots", botRoutes);
app.route("/api/v1/modules", moduleRoutes);
app.route("/api/v1/integrations/discord", discordRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────

app.get("/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

// ─── 404 fallback ─────────────────────────────────────────────────────────────

app.notFound((c) => c.json({ error: "NOT_FOUND" }, 404));

app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: "INTERNAL_SERVER_ERROR" }, 500);
});

// ─── Start ────────────────────────────────────────────────────────────────────

const port = parseInt(process.env["PORT"] ?? "3001", 10);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`BotForge API running on http://localhost:${info.port}`);
});

export type AppType = typeof app;
