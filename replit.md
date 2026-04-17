# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Mobile/Web preview**: Expo Router / React
- **External sync**: Goutstoso currently includes user-provided Supabase REST synchronization in the single-file app source.

## Artifacts

- `artifacts/api-server` — shared Express API server at `/api`
- `artifacts/mockup-sandbox` — canvas component preview sandbox
- `artifacts/goutstoso` — Goutstoso management app using the latest user-provided single-file React application. The current implementation lives in `artifacts/goutstoso/app/index.tsx` and includes the mobile-oriented French Goûtstoso admin interface with bottom navigation, products, stocks, points de vente, contrats, factures, comptabilité, PDF invoice export, localStorage persistence, and Supabase REST sync.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/goutstoso run dev` — run the Goutstoso app

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
