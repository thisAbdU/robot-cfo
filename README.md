# Robot-CFO

Monorepo for the Robot-CFO product: a Next.js frontend, a NestJS API, and shared TypeScript contracts.

## Layout

| Path | Purpose |
|------|---------|
| `apps/frontend` | Next.js 15 (App Router, Tailwind, ESLint, `src/`). Dev: `pnpm dev:frontend`. |
| `apps/backend` | NestJS 11 (`AppModule`, `AppController`, `AppService`). Dev: `pnpm dev:backend`. |
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
