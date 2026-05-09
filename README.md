# Robot-CFO

Monorepo for the Robot-CFO product: a Next.js frontend, a NestJS API, and shared TypeScript contracts.

## Layout

| Path | Purpose |
|------|---------|
| `apps/frontend` | Next.js 15 (App Router, Tailwind, ESLint, `src/`). Dev: `pnpm dev:frontend`. |
| `apps/backend` | NestJS 11 API: Prisma + Postgres, LI.FI treasury balances (15m cron), Snapshot governance sync. Dev: `pnpm dev:backend`. |
| `packages/shared` | Shared types and interfaces (`@robot-cfo/shared`), e.g. DAO and treasury shapes. |

## Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/) (workspace installs use the root lockfile)

## Install

From the repository root:

```bash
pnpm install
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev:frontend` | Start Next.js in development |
| `pnpm dev:backend` | Start NestJS in watch mode |
| `pnpm build` | Build shared types check, then frontend and backend |
| `pnpm lint` | Run lint in all workspace packages that define `lint` |

## Workspace packages

- Root `package.json` and `pnpm-workspace.yaml` include `apps/*` and `packages/*`.
- `tsconfig.base.json` holds shared compiler defaults; apps extend it for app-specific settings.
- Import shared types in either app with:

  ```ts
  import type { DaoProposal, TreasurySnapshot } from "@robot-cfo/shared";
  ```

The Next.js app lists `@robot-cfo/shared` in `transpilePackages` so workspace sources resolve cleanly during development.

## Environment

Copy `.env.example` files in each app when you add them; root `.gitignore` excludes `.env` and `.env.*`.

**Backend (`apps/backend/.env`):** `DATABASE_URL` (Postgres), optional `LIFI_INTEGRATOR` / `LIFI_API_KEY`, `SNAPSHOT_SPACE_IDS` (comma-separated Snapshot spaces), `GEMINI_API_KEY` / `GEMINI_MODEL` for the CFO brain. Optional `CORS_ORIGINS` (comma-separated browser origins; defaults include `http://localhost:3000` and `:3001`). Run migrations from `apps/backend` with `pnpm prisma:migrate`.

**Frontend (`apps/frontend/.env.local`):** `NEXT_PUBLIC_API_URL` pointing at the Nest API (defaults to `http://localhost:3000`). If both Next and Nest use port 3000, run one app on another port (e.g. `PORT=3001 pnpm dev:backend` or `pnpm dev -- -p 3001` in `apps/frontend`) and set `NEXT_PUBLIC_API_URL` accordingly.

Useful HTTP routes after `pnpm dev:backend`: `GET /treasuries`, `GET /treasuries/:treasuryId/ai-decisions`, `POST /ai/analyze/:treasuryId`, `POST /execution/prepare`, `POST /execution/propose`, `POST /execution/register-bridge-tx`, `POST /blockchain/sync-balances`, `POST /governance/sync-active`, `GET /governance/proposals`, `GET /governance/:spaceId` (sync + list for one DAO, e.g. `balancer.eth`). The home page wires CFO analysis + execution (prepare / propose / register bridge tx) to these endpoints via `NEXT_PUBLIC_API_URL`.

**Execution / Safe:** `EXECUTION_RPC_URL` or `CHAIN_<id>_RPC_URL`, `SAFE_PROPOSER_PRIVATE_KEY` (proposer only — queues txs), optional `SAFE_API_KEY` for the hosted Safe Transaction Service. Store LI.FI route params on `AIDecision.data.execution` or pass them in `POST /execution/prepare`. After the source-chain tx is mined, call `POST /execution/register-bridge-tx` with `{ aiDecisionId, txHash }` so the cron job can poll LI.FI bridge completion.
