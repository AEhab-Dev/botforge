FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.12.1 --activate

# ─── Dependencies ─────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY packages/shared-schemas/package.json packages/shared-schemas/
COPY packages/module-sdk/package.json packages/module-sdk/
COPY modules/welcome/package.json modules/welcome/
COPY modules/auto-role/package.json modules/auto-role/
COPY modules/custom-commands/package.json modules/custom-commands/
COPY modules/moderation/package.json modules/moderation/
RUN pnpm install --frozen-lockfile --prod=false

# ─── Build ────────────────────────────────────────────────────────────────────
FROM deps AS build
COPY . .
RUN pnpm --filter "@botforge/shared-schemas" --filter "@botforge/module-sdk" build
RUN pnpm --filter "@botforge/api" typecheck

# ─── Runtime ──────────────────────────────────────────────────────────────────
FROM node:22-alpine AS api
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.12.1 --activate

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/packages ./packages

WORKDIR /app/apps/api
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "--loader", "ts-node/esm", "src/index.ts"]
