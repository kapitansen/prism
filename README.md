# Prism

Personal AI-native journal & life-tracker. Its core idea: an **MCP server** that lets any AI agent connect and read meaningful slices of your data — without flooding the agent's context window.

> Work in progress, dogfooded daily. The MCP layer (the centerpiece) is now built; next is the read-time companion and charts.

## The idea

You write free-text journal entries and track a few numeric metrics over time. A background LLM pipeline turns each entry into structure — a short summary, the people / projects / habits / events it mentions, and any numeric values stated in the text. Retrieval afterwards is then **cheap, exact SQL**, not a "magic search". An AI agent connects over MCP and gets a compact, navigable view of months of data instead of a wall of text.

## Design principles

- **Intelligence at write time, not read time.** The LLM extracts structure when an entry is saved; reading is plain SQL. The _agent_ is the semantic layer — it reasons over a small, well-built index (summaries, per-entity digests), so there is no vector database and no context bloat.
- **Index-first for AI.** MCP tools return summaries + metadata (small, paginated responses); full text is a separate call. The briefing stays a constant size whether you have a month or five years of data.
- **Exact numbers from SQL, not the LLM.** Aggregations are computed by the database; the agent receives ready figures.
- **Multi-tenancy from day one.** Tenant = user; a `user_id` filter is mandatory on every query (enforced by a Nest guard), and tenant isolation is covered by tests.
- **Application-level encryption.** Sensitive fields are encrypted with AES-256-GCM; the key lives in the server env, never in the database or backups. A single `EncryptionService` is the only place that touches crypto.
- **English code, localized UI.** All code is in English; UI strings come from locale dictionaries (`react-i18next`).

## Tech stack

- **Language:** TypeScript everywhere (strict mode).
- **Backend:** NestJS · Prisma · PostgreSQL 16.
- **Frontend:** React 19 · Vite · TanStack Query · Tailwind CSS + shadcn/ui.
- **Auth:** JWT access tokens, argon2 password hashing.
- **Tests:** Vitest (unit) · Supertest (API).
- **MCP:** official TypeScript SDK, Streamable HTTP transport, per-user Bearer (JWT) tokens.
- **Tooling:** pnpm workspaces · ESLint + Prettier · Docker Compose.

## Monorepo layout

```
apps/api          — NestJS backend (REST API + AI analysis + MCP server; worker next)
apps/web          — React frontend
packages/shared   — shared types & zod schemas (the extraction-JSON contract)
```

## Getting started

Prerequisites: **Node 24**, **pnpm**, **Docker**.

```bash
# 1. Start Postgres
docker compose up -d

# 2. Install dependencies
pnpm install

# 3. Environment — copy the example and fill in secrets
cp apps/api/.env.example apps/api/.env
#    generate JWT_SECRET / ENCRYPTION_KEY with:  openssl rand -hex 32

# 4. Database — sync the schema and seed dev data
#    (development uses `prisma db push`; a baseline migration comes before deploy)
pnpm --filter @prism/api exec prisma db push
pnpm --filter @prism/api exec prisma db seed

# 5. Run (two terminals)
pnpm --filter @prism/api dev   # API → http://localhost:3000
pnpm --filter @prism/web dev   # web → http://localhost:5173
```

Then sign in with a seeded dev account (see `apps/api/prisma/seed.ts`).

## Tests

```bash
pnpm --filter @prism/api test
```

API tests boot the real app and run against a dedicated `prism_test` database — they assert the connected database name as a safety guard, so they never touch the dev/prod data.

## Status

- ✅ **Backend foundation** — schema, JWT auth + tenant guard, field-level encryption, CRUD for journal entries / entities / numeric metrics, per-account settings.
- ✅ **Frontend** — login, the day editor (two sides — pros / cons — + metric chips), journal, Context (people & topics), CBT cards, settings.
- ✅ **AI analysis** — entries are parsed into structure (summary, metrics, entities, intents) by Claude behind an `LlmRunner` port; interactive multi-round clarification; suggest-confirm for entities (never silently created); per-user "coach pack" tuning; entity `@handle` tagging.
- ✅ **MCP server** — per-user, read-mostly tools the analysis (and any external agent) can call: look up an entity profile, find entries mentioning it, fetch entries by date / range, and write back a learned fact to an entity's dossier. Streamable HTTP + Bearer JWT; every call audit-logged.
- ⏳ **Next** — the read-time companion (a coaching "message of the day") and the dashboard / charts.
