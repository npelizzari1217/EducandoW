# Proposal: Bootstrap Script

## Intent

A `git pull` gives you the code but the master DB needs 4 manual steps: create the `educandow_master` database, run Prisma migrations, seed RBAC+ROOT user, and configure `.env` with `MASTER_DATABASE_URL` + `ENCRYPTION_KEY`. Automate this into a single idempotent bootstrap script that runs before the API starts.

## Scope

### In Scope
- `api/scripts/bootstrap.ts` — standalone Node.js/TypeScript script that validates env, creates master DB, runs migrate deploy, and runs seed
- `api/.env.example` — add `MASTER_DATABASE_URL` and `ENCRYPTION_KEY` entries
- `api/package.json` — add `"bootstrap": "ts-node scripts/bootstrap.ts"` script entry

### Out of Scope
- Tenant database creation (already automated via `CreateInstitutionUseCase` → `PostgresAdminService`)
- Docker Compose / infrastructure provisioning (the script assumes PostgreSQL is running)
- Production hardening (secrets management, CI integration)

## Capabilities

### New Capabilities
- `master-database-bootstrap`: One-command idempotent setup of the master DB (create DB → migrate → seed RBAC+ROOT)

### Modified Capabilities
None.

## Approach

Follow the pattern from `api/scripts/create-tenant-db.ts`: use `pg` Pool connected to the `postgres` maintenance DB for `CREATE DATABASE`, then shell out to `prisma migrate deploy` and `prisma:seed` via `execSync`. All operations are idempotent — `CREATE DATABASE IF NOT EXISTS` via error handling, Prisma `migrate deploy` is naturally idempotent, and `seed.ts` uses `upsert()` throughout.

**Nivel pedagógico**: ALL (infraestructura — no afecta un nivel específico)

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `api/scripts/bootstrap.ts` | New | Bootstrap script |
| `api/.env.example` | Modified | Add `MASTER_DATABASE_URL`, `ENCRYPTION_KEY` |
| `api/package.json` | Modified | Add `"bootstrap"` script entry |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Script run against production DB | Low | Clear step-by-step output shows DB name before each operation; script checks `NODE_ENV` warns if not development |
| `pg` package not installed (prod-only deps) | Low | `pg` is in `dependencies` (not devDependencies) — already available |
| Seed fails mid-way leaving partial data | Low | Seed uses `upsert` — re-running is safe; no partial state risk |

## Rollback Plan

No rollback needed — the script is idempotent and does not modify existing data. If something goes wrong, fix the error and re-run.

## Dependencies

- PostgreSQL running and accessible via `MASTER_DATABASE_URL`
- `pg` package (already in `dependencies`)
- `prisma` CLI (already in `devDependencies`, used via `npx`)

## Success Criteria

- [x] `pnpm bootstrap` creates `educandow_master`, runs migrations, seeds RBAC+ROOT on first run
- [x] `pnpm bootstrap` succeeds without errors on second run (idempotent)
- [x] `.env.example` documents `MASTER_DATABASE_URL` and `ENCRYPTION_KEY`
- [x] Script validates `ENCRYPTION_KEY` is exactly 32 bytes before proceeding
