import { Hono } from "hono";
import { db } from "../db/client.js";
import { modules } from "../db/schema/index.js";
import { eq } from "drizzle-orm";

export const moduleRoutes = new Hono();

// ─── GET /api/v1/modules ─────────────────────────────────────────────────────
// Public — the module catalogue is not sensitive

moduleRoutes.get("/", async (c) => {
  const rows = await db
    .select()
    .from(modules)
    .where(eq(modules.status, "active"))
    .orderBy(modules.sortOrder);

  return c.json({ modules: rows });
});

// ─── GET /api/v1/modules/:moduleKey ──────────────────────────────────────────

moduleRoutes.get("/:moduleKey", async (c) => {
  const [mod] = await db
    .select()
    .from(modules)
    .where(eq(modules.moduleKey, c.req.param("moduleKey")))
    .limit(1);

  if (!mod) return c.json({ error: "NOT_FOUND" }, 404);
  return c.json({ module: mod });
});
