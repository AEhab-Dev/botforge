import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { authService } from "../services/auth.service.js";
import type { User } from "../db/schema/users.js";

// Extend Hono's context variables type
declare module "hono" {
  interface ContextVariableMap {
    user: User;
  }
}

const COOKIE_NAME = "bf_session";

/**
 * requireAuth middleware — attaches the authenticated user to context.
 * Returns 401 if the session cookie is missing or invalid.
 */
export async function requireAuth(c: Context, next: Next) {
  const token = getCookie(c, COOKIE_NAME);
  if (!token) {
    return c.json({ error: "UNAUTHORIZED", message: "Authentication required." }, 401);
  }

  const user = await authService.validateSession(token);
  if (!user) {
    return c.json({ error: "UNAUTHORIZED", message: "Session expired or invalid." }, 401);
  }

  c.set("user", user);
  await next();
}
