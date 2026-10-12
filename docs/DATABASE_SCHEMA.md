# BotForge — Database Schema

Database: **PostgreSQL 16+**
ORM: **Drizzle ORM** (TypeScript, used in apps/api and services/deployment-worker)
Migrations: **Drizzle Kit** (`pnpm db:migrate`)

---

## Design Rules

- Every table has a UUID primary key (gen_random_uuid())
- Every table has `created_at timestamptz DEFAULT now()`
- Soft deletes use `deleted_at timestamptz` — never hard-delete user-owned resources
- Foreign keys are enforced at the DB level
- Sensitive values (tokens, secrets) are stored AES-256-GCM encrypted; the column name ends in `_encrypted`
- Audit-relevant actions are written to `audit_logs` — never rely on table history alone

---

## Tables

### users

```sql
CREATE TABLE users (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 TEXT NOT NULL UNIQUE,
  email_verified_at     TIMESTAMPTZ,
  display_name          TEXT NOT NULL,
  avatar_url            TEXT,
  password_hash         TEXT,                    -- bcrypt, nullable if OAuth-only
  auth_provider         TEXT NOT NULL DEFAULT 'email',  -- 'email' | 'discord'
  provider_user_id      TEXT,                    -- external provider's user ID
  account_status        TEXT NOT NULL DEFAULT 'active', -- 'active' | 'suspended' | 'deleted'
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at         TIMESTAMPTZ,
  deleted_at            TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_provider ON users(auth_provider, provider_user_id);
```

### sessions

```sql
CREATE TABLE sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL UNIQUE,   -- SHA-256 of the session token; raw token sent to client only
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address    TEXT,
  user_agent    TEXT
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token_hash);
```

### email_verifications

```sql
CREATE TABLE email_verifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### password_resets

```sql
CREATE TABLE password_resets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### workspaces

```sql
CREATE TABLE workspaces (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  owner_id     UUID NOT NULL REFERENCES users(id),
  status       TEXT NOT NULL DEFAULT 'active',   -- 'active' | 'suspended'
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workspaces_owner ON workspaces(owner_id);
```

### workspace_members

```sql
CREATE TABLE workspace_members (
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'member',   -- 'owner' | 'admin' | 'member'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);
```

### discord_connections

```sql
CREATE TABLE discord_connections (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  discord_user_id   TEXT NOT NULL,
  username          TEXT NOT NULL,
  avatar_url        TEXT,
  access_token_encrypted   TEXT,     -- AES-256-GCM encrypted
  refresh_token_encrypted  TEXT,
  token_expires_at  TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at        TIMESTAMPTZ,
  UNIQUE(user_id, discord_user_id)
);
```

### bot_instances

```sql
CREATE TABLE bot_instances (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id              UUID NOT NULL REFERENCES workspaces(id),
  name                      TEXT NOT NULL,
  description               TEXT,
  platform                  TEXT NOT NULL DEFAULT 'discord',
  discord_guild_id          TEXT,              -- set after server is selected
  discord_bot_token_encrypted TEXT,            -- per-instance token if using own app
  status                    TEXT NOT NULL DEFAULT 'draft',
    -- 'draft' | 'deploying' | 'running' | 'degraded' | 'stopped' | 'failed' | 'deleted'
  current_config_revision_id UUID,            -- FK added after bot_config_revisions exists
  current_deployment_id     UUID,             -- FK added after deployments exists
  last_healthy_at           TIMESTAMPTZ,
  last_error_code           TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at                TIMESTAMPTZ
);

CREATE INDEX idx_bot_instances_workspace ON bot_instances(workspace_id);
CREATE INDEX idx_bot_instances_status ON bot_instances(status) WHERE deleted_at IS NULL;
```

### bot_config_revisions

```sql
CREATE TABLE bot_config_revisions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_instance_id UUID NOT NULL REFERENCES bot_instances(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  schema_version  INTEGER NOT NULL DEFAULT 1,
  configuration   JSONB NOT NULL,              -- validated BotSpecification JSON
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  change_summary  TEXT,
  validation_status TEXT NOT NULL DEFAULT 'valid', -- 'valid' | 'invalid'
  is_active       BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(bot_instance_id, revision_number)
);

CREATE INDEX idx_revisions_bot ON bot_config_revisions(bot_instance_id);
-- Only one active revision per bot
CREATE UNIQUE INDEX idx_revisions_active ON bot_config_revisions(bot_instance_id)
  WHERE is_active = true;
```

### modules (catalogue)

```sql
CREATE TABLE modules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key      TEXT NOT NULL UNIQUE,   -- e.g. 'welcome', 'auto_role'
  name            TEXT NOT NULL,
  description     TEXT NOT NULL,
  current_version TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'deprecated' | 'beta'
  minimum_plan    TEXT NOT NULL DEFAULT 'free',
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### module_versions

```sql
CREATE TABLE module_versions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id            UUID NOT NULL REFERENCES modules(id),
  version              TEXT NOT NULL,
  config_schema        JSONB NOT NULL,     -- JSON Schema for the config
  default_config       JSONB NOT NULL,
  required_permissions TEXT[] NOT NULL DEFAULT '{}',
  required_intents     TEXT[] NOT NULL DEFAULT '{}',
  release_status       TEXT NOT NULL DEFAULT 'stable', -- 'stable' | 'beta' | 'deprecated'
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(module_id, version)
);
```

### deployments

```sql
CREATE TABLE deployments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_instance_id     UUID NOT NULL REFERENCES bot_instances(id),
  config_revision_id  UUID NOT NULL REFERENCES bot_config_revisions(id),
  status              TEXT NOT NULL DEFAULT 'queued',
    -- 'queued' | 'deploying' | 'starting' | 'running' | 'failed' | 'stopped' | 'rolled_back'
  runtime_version     TEXT,
  health_status       TEXT,
  error_code          TEXT,
  error_summary       TEXT,                -- user-facing message, no stack traces
  started_at          TIMESTAMPTZ,
  finished_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_deployments_bot ON deployments(bot_instance_id);
CREATE INDEX idx_deployments_status ON deployments(status);
```

### subscriptions

```sql
CREATE TABLE subscriptions (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id              UUID NOT NULL REFERENCES workspaces(id) UNIQUE,
  billing_provider          TEXT NOT NULL DEFAULT 'stripe',
  provider_customer_id      TEXT,
  provider_subscription_id  TEXT UNIQUE,
  plan_id                   TEXT NOT NULL DEFAULT 'free',  -- 'free' | 'starter' | 'pro'
  status                    TEXT NOT NULL DEFAULT 'active',
    -- 'trialing' | 'active' | 'past_due' | 'cancelled' | 'unpaid' | 'expired'
  current_period_start      TIMESTAMPTZ,
  current_period_end        TIMESTAMPTZ,
  cancel_at_period_end      BOOLEAN NOT NULL DEFAULT false,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### usage_records

```sql
CREATE TABLE usage_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id),
  bot_instance_id UUID REFERENCES bot_instances(id),
  usage_type      TEXT NOT NULL,   -- 'ai_request' | 'bot_hour' | 'scheduled_task'
  quantity        INTEGER NOT NULL DEFAULT 1,
  unit            TEXT NOT NULL,
  period_start    TIMESTAMPTZ NOT NULL,
  period_end      TIMESTAMPTZ NOT NULL,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata        JSONB
);

CREATE INDEX idx_usage_workspace_period ON usage_records(workspace_id, period_start);
```

### audit_logs

```sql
CREATE TABLE audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID REFERENCES workspaces(id),
  actor_user_id UUID REFERENCES users(id),
  action        TEXT NOT NULL,        -- e.g. 'bot.created', 'deployment.started', 'module.enabled'
  resource_type TEXT NOT NULL,        -- e.g. 'bot_instance', 'deployment'
  resource_id   UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata      JSONB                 -- additional context, NO secrets
);

CREATE INDEX idx_audit_workspace ON audit_logs(workspace_id, created_at DESC);
```

### background_jobs

```sql
-- Managed by pg-boss; this is for reference only.
-- pg-boss creates its own schema (pgboss.*) automatically.
-- Custom job types:
--   'deploy_bot'     — payload: { deploymentId, botInstanceId, configRevisionId }
--   'stop_bot'       — payload: { botInstanceId }
--   'health_check'   — payload: { botInstanceId, deploymentId }
--   'send_email'     — payload: { to, subject, template, data }
```

---

## Foreign Key Additions (circular references resolved after table creation)

```sql
ALTER TABLE bot_instances
  ADD CONSTRAINT fk_current_revision
    FOREIGN KEY (current_config_revision_id)
    REFERENCES bot_config_revisions(id) DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT fk_current_deployment
    FOREIGN KEY (current_deployment_id)
    REFERENCES deployments(id) DEFERRABLE INITIALLY DEFERRED;
```

---

## Drizzle Schema Location

The Drizzle schema files live at:
```
apps/api/src/db/schema/
├── users.ts
├── sessions.ts
├── workspaces.ts
├── discord.ts
├── bots.ts
├── modules.ts
├── deployments.ts
├── billing.ts
├── usage.ts
└── audit.ts
```

Run migrations:
```bash
pnpm --filter @botforge/api db:generate   # generate migration files
pnpm --filter @botforge/api db:migrate    # apply to DB
pnpm --filter @botforge/api db:seed       # seed module catalogue
```
