# BotForge

> Managed Discord bot platform with AI-powered configuration.

## Quick Start (Local Development)

### Prerequisites
- Node.js 20+
- pnpm 9+
- Docker Desktop

### 1. Install dependencies
```bash
pnpm install
```

### 2. Start the database
```bash
docker compose -f infrastructure/docker/docker-compose.dev.yml up -d
```

### 3. Configure environment
```bash
cp .env.example .env
# Edit .env and fill in your Discord credentials and AI API key
```

### 4. Run database migrations
```bash
pnpm db:migrate
```

### 5. Seed the module catalogue
```bash
pnpm db:seed
```

### 6. Start the API
```bash
pnpm --filter @botforge/api dev
```

The API runs on http://localhost:3001

### 7. Verify the API
```bash
curl http://localhost:3001/health
# → {"status":"ok","timestamp":"..."}

curl http://localhost:3001/api/v1/modules
# → {"modules":[...]}
```

---

## Project Structure

```
botforge/
├── apps/
│   ├── web/          Next.js 15 dashboard (Phase 5)
│   └── api/          Hono REST API  ← start here
├── services/
│   ├── bot-runtime/  Discord bot process
│   └── deployment-worker/  Deploy queue worker (Phase 2)
├── packages/
│   ├── shared-schemas/  Zod schemas (BotSpecification, entitlements)
│   └── module-sdk/      Module interface types
└── modules/
    ├── welcome/
    ├── auto-role/
    ├── custom-commands/
    ├── moderation/
    └── twitch-notifications/
```

## Development Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 0 | ✅ Complete | Architecture, schemas, DB, API skeleton |
| 1 | 🔄 In Progress | Core backend — auth, bots CRUD, config revisions |
| 2 | ⏳ Next | Discord runtime — connection, slash commands, modules |
| 3 | ⏳ | First modules — welcome, auto-role, custom commands |
| 4 | ⏳ | AI builder — natural language → BotSpecification |
| 5 | ⏳ | Dashboard — Next.js UI |
| 6 | ⏳ | Production hardening |
| 7 | ⏳ | Billing — Stripe subscriptions |

## Key Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Bot Spec Schema](docs/BOT_SPEC_SCHEMA.md)
- [Module Development](docs/MODULE_DEVELOPMENT.md)
- [Database Schema](docs/DATABASE_SCHEMA.md)

## Non-Negotiable Rules

1. No AI-generated code executes in the bot runtime — only approved modules
2. No cross-tenant data access — every query enforces ownership
3. No secrets in logs, AI prompts, or environment files committed to git
4. No deployment without config validation
5. No "running" status until health checks pass

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for full security boundary details.
