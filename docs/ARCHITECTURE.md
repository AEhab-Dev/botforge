# BotForge — Architecture

## Overview

BotForge is a managed Discord bot platform with AI-powered configuration and a modular runtime.
Customers describe what they want in plain English. The platform converts that into a validated
configuration, deploys a bot, and hosts it.

**Core principle:** The AI interprets intent and produces configuration. It does not generate or
execute arbitrary code. All bot behavior is implemented as approved, tested modules.

---

## Services

```
┌─────────────────────────────────────────────────────────────────┐
│                          CUSTOMER BROWSER                        │
└─────────────────────────────────┬───────────────────────────────┘
                                  │ HTTPS
┌─────────────────────────────────▼───────────────────────────────┐
│                     apps/web  (Next.js 15)                       │
│  Dashboard · Bot Builder UI · Auth pages · Public site           │
└─────────────────────────────────┬───────────────────────────────┘
                                  │ HTTP/REST
┌─────────────────────────────────▼───────────────────────────────┐
│                     apps/api  (Hono + TypeScript)                │
│  Auth · Bot CRUD · Config · Modules · Deployment · Billing       │
└──────┬───────────────────────────┬──────────────────────────────┘
       │ DB (Drizzle/pg)           │ Job queue (pg-boss)
       │                           │
┌──────▼──────┐          ┌────────▼─────────────────────────────┐
│  PostgreSQL  │          │   services/deployment-worker          │
│  (primary   │          │   Picks up deploy jobs, provisions    │
│   database) │          │   bot runtime, runs health checks     │
└──────┬──────┘          └────────┬─────────────────────────────┘
       │                          │ Start/stop/update
       │                 ┌────────▼─────────────────────────────┐
       │                 │   services/bot-runtime                │
       │                 │   Connects to Discord, runs modules,  │
       └─────────────────│   writes health + events to DB        │
                         └────────┬─────────────────────────────┘
                                  │ Discord Gateway + REST API
                         ┌────────▼─────────────────────────────┐
                         │           DISCORD                      │
                         └──────────────────────────────────────┘

Additional:
  services/scheduler     — Fires scheduled announcements, polls Twitch/YouTube
  packages/shared-schemas — Zod schemas shared by api + bot-runtime
  packages/module-sdk    — Module interface, lifecycle, context types
  packages/auth          — Session management, password hashing, tokens
  packages/billing       — Stripe integration, entitlement checks
  packages/observability — Structured logging, metrics helpers
```

---

## Security Boundaries

### Hard rules — never cross these

1. The AI service receives: supported module catalogue, current config, user message.
   It does NOT receive: DB credentials, bot tokens, payment secrets, other users' data.

2. The bot-runtime process does NOT expose an HTTP API to the internet.
   It writes status/events to the database; the API reads from there.

3. Every API route checks ownership before touching a resource.
   A user supplying a different bot_id or guild_id in a request must get 403, not someone else's data.

4. Secrets (Discord tokens, API keys) are stored encrypted in the database.
   They are decrypted only inside the deployment-worker and bot-runtime processes, never sent to the web client.

5. Module code runs inside the bot-runtime process. No user-supplied code executes.
   The AI produces configuration JSON; it does not produce executable modules.

---

## Data Flow: Bot Creation → Deployment

```
User types description
        │
        ▼
  POST /api/v1/bot-builder/sessions/{id}/messages
        │
        ▼
  AI Service (Claude API)
  ├── Receives: user message + module catalogue
  ├── Returns: structured BotSpecification (Zod-validated)
  └── Asks clarifying questions if required fields are missing
        │
        ▼
  Config Review UI (user edits, approves)
        │
        ▼
  POST /api/v1/bots/{id}/config/revisions
  ├── Validates config against module schemas
  ├── Saves immutable revision to DB
  └── Returns revision_id
        │
        ▼
  POST /api/v1/bots/{id}/deployments
  ├── Checks subscription entitlements
  ├── Checks Discord permissions
  ├── Creates deployment record (status: QUEUED)
  └── Enqueues job via pg-boss
        │
        ▼
  deployment-worker picks up job
  ├── Loads config revision
  ├── Resolves module versions
  ├── Starts bot-runtime process (or sends reload signal)
  └── Waits for health check
        │
        ▼
  bot-runtime connects to Discord
  ├── Initializes enabled modules
  ├── Registers slash commands
  ├── Writes status = RUNNING to DB
  └── Begins processing events
        │
        ▼
  API polls DB, updates dashboard
```

---

## Deployment States

```
DRAFT → VALIDATING → READY_TO_DEPLOY → QUEUED → DEPLOYING → STARTING
                                                                  │
                                                    ┌─────────────┴─────────────┐
                                                    │                           │
                                                RUNNING                      FAILED
                                                    │
                                         ┌──────────┴──────────┐
                                         │                      │
                                      DEGRADED               STOPPING
                                                                 │
                                                              STOPPED
```

A deployment is only marked RUNNING after health checks pass.
FAILED deployments preserve the previous RUNNING deployment record for rollback.

---

## Multi-Tenant Isolation

Every resource row in the database has an owner chain:
  user → workspace → bot_instance → config_revision → deployment

Every API query includes a WHERE clause that enforces this chain.
The DB schema uses foreign keys to enforce referential integrity.

Row-level security (PostgreSQL RLS) is configured as a secondary defense,
but application-level authorization is the primary check.

---

## Communication Between Services

- **API ↔ DB:** Drizzle ORM over a connection pool (pg)
- **API → Worker:** pg-boss job queue (PostgreSQL-backed, no Redis dependency for MVP)
- **Worker → Runtime:** Process signals + shared DB rows (runtime reads its config from DB on startup)
- **Runtime → API:** Runtime writes health/events to DB; API reads on poll or webhook
- **API → AI:** HTTP to Anthropic Claude API (provider-abstracted)
- **Runtime → Discord:** discord.js WebSocket Gateway + REST

Using PostgreSQL as the job queue (pg-boss) removes Redis as an MVP dependency.
Redis can be added later for caching if needed.

---

## Module Isolation

Modules share the bot-runtime process but are logically isolated:
- Each module has its own initialized state
- Module errors are caught and logged; unrelated modules continue running
- A module that fails initialization enters FAILED state; the runtime marks it degraded
- The deployment-worker monitors health and can restart the runtime if all modules fail

---

## Monorepo Layout

```
botforge/
├── apps/
│   ├── web/          Next.js 15 — public site + dashboard
│   ├── api/          Hono — REST API
│   └── admin/        Internal admin panel (Phase 6+)
│
├── services/
│   ├── bot-runtime/  discord.js runtime — runs customer bots
│   ├── deployment-worker/  Processes deploy jobs from queue
│   └── scheduler/    Fires scheduled announcements, polls feeds
│
├── packages/
│   ├── shared-schemas/  Zod schemas used by api + runtime
│   ├── module-sdk/      Module interface types + helpers
│   ├── auth/            Session, JWT, password utilities
│   ├── billing/         Stripe helpers, entitlement logic
│   └── observability/   Structured logger, metrics
│
├── modules/
│   ├── welcome/
│   ├── auto-role/
│   ├── custom-commands/
│   ├── moderation/
│   └── twitch-notifications/
│
├── infrastructure/
│   ├── docker/       Compose files for local dev
│   ├── deployment/   VPS deployment scripts
│   └── monitoring/   Health check + alerting config
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── security/     Cross-tenant isolation tests
│
└── docs/
    ├── ARCHITECTURE.md     (this file)
    ├── BOT_SPEC_SCHEMA.md
    ├── MODULE_DEVELOPMENT.md
    ├── API.md
    └── DEPLOYMENT.md
```
