import { randomBytes } from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { discordConnections } from "../db/schema/index.js";
import { encrypt, decrypt } from "../lib/crypto.js";

// ─── Discord API helpers ──────────────────────────────────────────────────────

const DISCORD_API = "https://discord.com/api/v10";
const DISCORD_CDN = "https://cdn.discordapp.com";

function getOAuthConfig() {
  const clientId = process.env["DISCORD_CLIENT_ID"];
  const clientSecret = process.env["DISCORD_CLIENT_SECRET"];
  const redirectUri = process.env["DISCORD_REDIRECT_URI"];

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Discord OAuth environment variables are not configured.");
  }
  return { clientId, clientSecret, redirectUri };
}

// ─── OAuth state store (in-memory for MVP — use Redis in production) ──────────
// Maps state token → userId, expires at
const stateStore = new Map<string, { userId: string; expiresAt: number }>();

// Clean up expired states every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of stateStore) {
    if (value.expiresAt < now) stateStore.delete(key);
  }
}, 10 * 60 * 1000);

// ─── Discord service ──────────────────────────────────────────────────────────

export const discordService = {
  /**
   * Generate an OAuth2 authorization URL for connecting a user's Discord account.
   * Scope: identify + guilds (read user info and their server list).
   */
  getConnectUrl(userId: string): string {
    const { clientId, redirectUri } = getOAuthConfig();

    // Generate a random state token to prevent CSRF
    const state = randomBytes(16).toString("hex");
    stateStore.set(state, { userId, expiresAt: Date.now() + 10 * 60 * 1000 }); // 10 min TTL

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "identify guilds",
      state,
    });

    return `https://discord.com/oauth2/authorize?${params.toString()}`;
  },

  /**
   * Generate a bot installation URL.
   * This is separate from user OAuth — it installs the bot into a server.
   * Requires the user to have Manage Server permission in the target guild.
   */
  getBotInstallUrl(guildId?: string): string {
    const { clientId } = getOAuthConfig();

    // Bot permissions bitmask — calculated from required permissions
    // SendMessages(2048) + ViewChannel(1024) + ManageRoles(268435456) +
    // KickMembers(2) + BanMembers(4) + ModerateMembers(1099511627776)
    const permissions = "1099511630854";

    const params = new URLSearchParams({
      client_id: clientId,
      permissions,
      scope: "bot applications.commands",
      ...(guildId ? { guild_id: guildId, disable_guild_select: "true" } : {}),
    });

    return `https://discord.com/oauth2/authorize?${params.toString()}`;
  },

  /**
   * Handle the OAuth2 callback — exchange code for tokens, fetch user info,
   * save the connection to the database.
   */
  async handleCallback(
    code: string,
    state: string
  ): Promise<{ userId: string; discordUsername: string }> {
    // Validate state token
    const stateData = stateStore.get(state);
    if (!stateData || stateData.expiresAt < Date.now()) {
      throw new DiscordOAuthError("INVALID_STATE", "OAuth state is invalid or expired.");
    }
    stateStore.delete(state);

    const { userId } = stateData;
    const { clientId, clientSecret, redirectUri } = getOAuthConfig();

    // Exchange authorization code for access token
    const tokenResponse = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const body = await tokenResponse.text();
      throw new DiscordOAuthError("TOKEN_EXCHANGE_FAILED", `Discord token exchange failed: ${body}`);
    }

    const tokens = await tokenResponse.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
    };

    // Fetch Discord user info
    const userResponse = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userResponse.ok) {
      throw new DiscordOAuthError("USER_FETCH_FAILED", "Failed to fetch Discord user info.");
    }

    const discordUser = await userResponse.json() as {
      id: string;
      username: string;
      discriminator: string;
      global_name?: string;
      avatar?: string;
    };

    const username = discordUser.global_name ?? discordUser.username;
    const avatarUrl = discordUser.avatar
      ? `${DISCORD_CDN}/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : null;

    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Upsert the Discord connection
    const existing = await db
      .select({ id: discordConnections.id })
      .from(discordConnections)
      .where(
        and(
          eq(discordConnections.userId, userId),
          eq(discordConnections.discordUserId, discordUser.id)
        )
      )
      .limit(1);

    if (existing.length > 0 && existing[0]) {
      await db
        .update(discordConnections)
        .set({
          username,
          avatarUrl,
          accessTokenEncrypted: encrypt(tokens.access_token),
          refreshTokenEncrypted: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
          tokenExpiresAt,
          revokedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(discordConnections.id, existing[0].id));
    } else {
      await db.insert(discordConnections).values({
        userId,
        discordUserId: discordUser.id,
        username,
        avatarUrl,
        accessTokenEncrypted: encrypt(tokens.access_token),
        refreshTokenEncrypted: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        tokenExpiresAt,
      });
    }

    return { userId, discordUsername: username };
  },

  /**
   * Get the user's Discord guilds where they have Manage Server permission.
   * These are the servers where they can install the bot.
   */
  async getUserGuilds(userId: string): Promise<DiscordGuild[]> {
    const [connection] = await db
      .select()
      .from(discordConnections)
      .where(
        and(
          eq(discordConnections.userId, userId),
          // Only use non-revoked connections
        )
      )
      .limit(1);

    if (!connection?.accessTokenEncrypted) {
      throw new DiscordOAuthError("NOT_CONNECTED", "Discord account not connected.");
    }

    const accessToken = decrypt(connection.accessTokenEncrypted);

    const response = await fetch(`${DISCORD_API}/users/@me/guilds`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.status === 401) {
      throw new DiscordOAuthError("TOKEN_EXPIRED", "Discord token has expired. Please reconnect.");
    }

    if (!response.ok) {
      throw new DiscordOAuthError("GUILDS_FETCH_FAILED", "Failed to fetch Discord servers.");
    }

    const guilds = await response.json() as Array<{
      id: string;
      name: string;
      icon?: string;
      permissions: string;
    }>;

    // Filter to guilds where the user has Manage Guild (0x20) permission
    const MANAGE_GUILD = BigInt(0x20);
    return guilds
      .filter((g) => (BigInt(g.permissions) & MANAGE_GUILD) === MANAGE_GUILD)
      .map((g) => ({
        id: g.id,
        name: g.name,
        iconUrl: g.icon
          ? `${DISCORD_CDN}/icons/${g.id}/${g.icon}.png`
          : null,
      }));
  },

  /**
   * Disconnect a user's Discord account.
   * Marks the connection as revoked — does not delete the record (audit trail).
   */
  async disconnect(userId: string): Promise<void> {
    await db
      .update(discordConnections)
      .set({
        revokedAt: new Date(),
        accessTokenEncrypted: null,
        refreshTokenEncrypted: null,
        updatedAt: new Date(),
      })
      .where(eq(discordConnections.userId, userId));
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DiscordGuild {
  id: string;
  name: string;
  iconUrl: string | null;
}

export class DiscordOAuthError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "DiscordOAuthError";
  }
}
