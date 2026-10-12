import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { discordService, DiscordOAuthError } from "../services/discord.service.js";

export const discordRoutes = new Hono();

/**
 * GET /api/v1/discord/connect
 * Returns the Discord OAuth URL for the current user to authorize their account.
 */
discordRoutes.get("/connect", requireAuth, async (c) => {
  const user = c.get("user");
  const url = discordService.getConnectUrl(user.id);
  return c.json({ url });
});

/**
 * GET /api/v1/discord/callback
 * Discord redirects here after the user authorizes.
 * Exchanges the code for tokens and saves the connection.
 */
discordRoutes.get("/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");

  // User denied the authorization
  if (error) {
    const frontendUrl = process.env["FRONTEND_URL"] ?? "http://localhost:3000";
    return c.redirect(`${frontendUrl}/settings/integrations?error=discord_denied`);
  }

  if (!code || !state) {
    return c.json({ error: "Missing code or state parameter." }, 400);
  }

  try {
    const { discordUsername } = await discordService.handleCallback(code, state);
    const frontendUrl = process.env["FRONTEND_URL"] ?? "http://localhost:3000";
    return c.redirect(
      `${frontendUrl}/settings/integrations?success=discord_connected&username=${encodeURIComponent(discordUsername)}`
    );
  } catch (err) {
    if (err instanceof DiscordOAuthError) {
      if (err.code === "INVALID_STATE") {
        return c.json({ error: "OAuth state is invalid or expired. Please try again." }, 400);
      }
      return c.json({ error: err.message }, 502);
    }
    throw err;
  }
});

/**
 * GET /api/v1/discord/servers
 * Returns the list of Discord servers where the user has Manage Server permission.
 * These are the servers where they can install the bot.
 */
discordRoutes.get("/servers", requireAuth, async (c) => {
  const user = c.get("user");

  try {
    const guilds = await discordService.getUserGuilds(user.id);
    return c.json({ guilds });
  } catch (err) {
    if (err instanceof DiscordOAuthError) {
      if (err.code === "NOT_CONNECTED") {
        return c.json({ error: "Discord account not connected.", code: "NOT_CONNECTED" }, 400);
      }
      if (err.code === "TOKEN_EXPIRED") {
        return c.json({ error: "Discord token expired. Please reconnect.", code: "TOKEN_EXPIRED" }, 401);
      }
      return c.json({ error: err.message }, 502);
    }
    throw err;
  }
});

/**
 * GET /api/v1/discord/bot-install-url
 * Returns the URL to install the bot into a specific server.
 * The frontend redirects the user to this URL after they pick a server.
 */
discordRoutes.get("/bot-install-url", requireAuth, async (c) => {
  const guildId = c.req.query("guild_id");
  const url = discordService.getBotInstallUrl(guildId ?? undefined);
  return c.json({ url });
});

/**
 * DELETE /api/v1/discord/connection
 * Disconnects the user's Discord account.
 */
discordRoutes.delete("/connection", requireAuth, async (c) => {
  const user = c.get("user");
  await discordService.disconnect(user.id);
  return c.json({ message: "Discord account disconnected." });
});

/**
 * GET /api/v1/discord/status
 * Returns whether the current user has a connected Discord account.
 */
discordRoutes.get("/status", requireAuth, async (c) => {
  const user = c.get("user");

  try {
    // Try fetching guilds — if it works, we're connected
    await discordService.getUserGuilds(user.id);
    return c.json({ connected: true });
  } catch (err) {
    if (err instanceof DiscordOAuthError && err.code === "NOT_CONNECTED") {
      return c.json({ connected: false });
    }
    if (err instanceof DiscordOAuthError && err.code === "TOKEN_EXPIRED") {
      return c.json({ connected: false, reason: "token_expired" });
    }
    throw err;
  }
});
