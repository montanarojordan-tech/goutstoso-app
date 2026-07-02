---
name: Goutstoso DB push danger
description: Why `pnpm --filter @workspace/db run push` is unsafe for this project's database and what to do instead.
---

The Goutstoso Postgres database has legacy tables (`gs_users`, `gs_tokens`, `gs_data`, `gs_backups`, `gs_activity`, `gs_files`) that are managed with raw SQL in `artifacts/api-server/src/routes/goutstoso.ts`, not declared in the Drizzle schema (`lib/db/src/schema`).

Because `drizzle-kit push` introspects the live DB and diffs it against the Drizzle schema, it sees those undeclared tables as extraneous and interactively prompts to **drop them** (framed as "rename" or "delete" options), risking real data loss. The interactive prompt also does not respond reliably to piped stdin, so it can appear to hang or silently proceed.

**Why:** past incident — running `push` after adding new `gs_lots`/`gs_mouvements_stock` tables produced a "THIS ACTION WILL CAUSE DATA LOSS" prompt offering to delete all 5 legacy tables. Had to kill the process before it could confirm.

**How to apply:** When adding new tables that need to coexist with the legacy raw-SQL `gs_*` tables, define the Drizzle schema (for types/codegen) but create the actual table in Postgres via a direct `psql "$DATABASE_URL" -c "CREATE TABLE IF NOT EXISTS ..."` matching the schema exactly. Do not run `drizzle-kit push` (or `push-force`) against this database at all — if a prompt like "Is X table created or renamed from another table?" or a data-loss warning appears, abort immediately (do not send confirmation input) and use raw SQL instead.
