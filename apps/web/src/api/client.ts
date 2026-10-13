// Central API client — all requests go through here.
// Uses credentials: 'include' so the session cookie is sent automatically.

const BASE = '/api/v1'

class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(res.status, body.error ?? 'UNKNOWN', body.message ?? res.statusText)
  }

  return res.json()
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  register: (data: { email: string; password: string; displayName: string }) =>
    request<{ user: User; token?: string }>('/auth/register', {
      method: 'POST', body: JSON.stringify(data),
    }),

  login: (data: { email: string; password: string }) =>
    request<{ user: User }>('/auth/login', {
      method: 'POST', body: JSON.stringify(data),
    }),

  logout: () => request('/auth/logout', { method: 'POST' }),

  me: () => request<{ user: User }>('/auth/me'),

  verifyEmail: (token: string) =>
    request<{ message: string }>('/auth/verify-email', {
      method: 'POST', body: JSON.stringify({ token }),
    }),

  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', {
      method: 'POST', body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, password: string) =>
    request<{ message: string }>('/auth/reset-password', {
      method: 'POST', body: JSON.stringify({ token, password }),
    }),
}

// ─── Bots ─────────────────────────────────────────────────────────────────────

export const botsApi = {
  list: () => request<{ bots: Bot[] }>('/bots'),

  get: (id: string) => request<{ bot: Bot }>(`/bots/${id}`),

  create: (data: { name: string; description?: string }) =>
    request<{ bot: Bot }>('/bots', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: { name?: string; description?: string }) =>
    request<{ bot: Bot }>(`/bots/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: string) => request(`/bots/${id}`, { method: 'DELETE' }),

  setToken: (id: string, botToken: string) =>
    request<{ message: string }>(`/bots/${id}/token`, {
      method: 'PATCH', body: JSON.stringify({ botToken }),
    }),

  saveConfig: (id: string, configuration: unknown, changeSummary?: string) =>
    request<{ revision: ConfigRevision }>(`/bots/${id}/config/revisions`, {
      method: 'POST', body: JSON.stringify({ configuration, changeSummary }),
    }),

  getRevisions: (id: string) =>
    request<{ revisions: ConfigRevision[] }>(`/bots/${id}/config/revisions`),

  deploy: (id: string) =>
    request<{ deployment: Deployment }>(`/bots/${id}/deploy`, { method: 'POST' }),

  stop: (id: string) =>
    request<{ message: string }>(`/bots/${id}/stop`, { method: 'POST' }),

  cancelDeployment: (id: string) =>
    request<{ message: string }>(`/bots/${id}/cancel-deployment`, { method: 'POST' }),

  getDeployments: (id: string) =>
    request<{ deployments: Deployment[] }>(`/bots/${id}/deployments`),
}

// ─── Modules ──────────────────────────────────────────────────────────────────

export const modulesApi = {
  list: () => request<{ modules: Module[] }>('/modules'),
}

// ─── Discord ──────────────────────────────────────────────────────────────────

export const discordApi = {
  getConnectUrl: () => request<{ url: string }>('/discord/connect'),
  getServers: () => request<{ guilds: DiscordGuild[] }>('/discord/servers'),
  getBotInstallUrl: (guildId?: string) =>
    request<{ url: string }>(`/discord/bot-install-url${guildId ? `?guild_id=${guildId}` : ''}`),
  getStatus: () => request<{ connected: boolean; reason?: string }>('/discord/status'),
  disconnect: () => request('/discord/connection', { method: 'DELETE' }),
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  displayName: string
  avatarUrl: string | null
  emailVerifiedAt: string | null
  accountStatus: string
}

export interface Bot {
  id: string
  workspaceId: string
  name: string
  description: string | null
  platform: string
  status: 'draft' | 'deploying' | 'running' | 'stopping' | 'stopped' | 'error' | 'deleted'
  discordGuildId: string | null
  discordBotTokenEncrypted: string | null  // non-null means token is set
  currentDeploymentId: string | null
  lastErrorCode: string | null
  createdAt: string
  updatedAt: string
}

export interface ConfigRevision {
  id: string
  botInstanceId: string
  revisionNumber: number
  configuration: unknown
  createdAt: string
  changeSummary: string | null
  validationStatus: string
  isActive: boolean
}

export interface Deployment {
  id: string
  botInstanceId: string
  configRevisionId: string
  status: 'queued' | 'deploying' | 'running' | 'stopped' | 'failed'
  healthStatus: string | null
  errorCode: string | null
  errorSummary: string | null
  startedAt: string | null
  finishedAt: string | null
  createdAt: string
}

export interface Module {
  id: string
  moduleKey: string
  name: string
  description: string
  currentVersion: string
  minimumPlan: string
  sortOrder: number
}

export interface DiscordGuild {
  id: string
  name: string
  iconUrl: string | null
}

export { ApiError }
