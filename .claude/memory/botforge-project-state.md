---
name: botforge-project-state
description: BotForge SaaS platform — current build state, stack decisions, and next steps
metadata:
  type: project
---

## BotForge — Managed Discord Bot Platform

Located at: `E:/claudeCode/botforge/`

### Stack decisions (confirmed by user)
- Frontend: Next.js 15 (TypeScript) — not yet built
- API: Hono + TypeScript — Phase 1 complete
- Bot runtime: discord.js (TypeScript)
- Database: PostgreSQL + Drizzle ORM
- Auth: Custom (bcrypt + session tokens, no auth provider)
- Hosting: VPS (DigitalOcean / Hetzner)
- Monorepo: pnpm workspaces + Turborepo

### Phase 0 completed ✅
All 4 architecture documents written:
- `docs/ARCHITECTURE.md`
- `docs/BOT_SPEC_SCHEMA.md`
- `docs/MODULE_DEVELOPMENT.md`
- `docs/DATABASE_SCHEMA.md`

### Phase 1 complete ✅ (core backend)
Working, typechecks clean:
- `packages/shared-schemas` — Zod BotSpecification schema, entitlements, AI proposal types
- `packages/module-sdk` — BotModule interface, ModuleContext, lifecycle types
- `apps/api` — Hono API with auth routes, bots CRUD, modules catalogue, Discord stub routes
- `apps/api/src/services/auth.service.ts` — register, login, logout, verify-email, password reset
- `apps/api/src/db/schema/` — full Drizzle schema (users, sessions, workspaces, bots, modules, billing, audit)
- `apps/api/src/db/seeds/index.ts` — seeds 5 modules into catalogue
- `services/bot-runtime` — ModuleRunner skeleton (loads config from DB, connects Discord, initializes modules)
- `infrastructure/docker/docker-compose.dev.yml` — PostgreSQL for local dev

### Key architectural rule (non-negotiable)
AI produces BotSpecification JSON → backend validates → runtime executes approved modules only.
NO arbitrary code generation or execution.

### Next phase: Phase 2 — Discord runtime
1. Discord OAuth flow (apps/api/src/routes/discord.ts — currently stubbed)
2. Bot installation flow (guild selection, permission validation)
3. First module implementations (modules/welcome/, modules/auto-role/)
4. Deployment worker (services/deployment-worker/)
5. Slash command registration

### Run commands
```bash
cd E:/claudeCode/botforge
docker compose -f infrastructure/docker/docker-compose.dev.yml up -d
unset NODE_ENV && pnpm install
pnpm --filter @botforge/api db:migrate
pnpm --filter @botforge/api db:seed
pnpm --filter @botforge/api dev   # API on :3001
```

### Known issue
`NODE_ENV=production` is set in the shell environment — always `unset NODE_ENV` before running pnpm install or dev commands to get devDependencies.

[[botforge-client-project]] — Moon Ideas / Camron Stuart custom bot ($1000) informed architecture but is separate deliverable.
