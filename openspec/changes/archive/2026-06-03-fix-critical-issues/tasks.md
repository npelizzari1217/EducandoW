# Tasks: Fix Critical Issues — Migration Architecture & Runtime Bugs

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 500–700 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR (bulk is generated baseline SQL; ~80 hand-written lines) |
| Delivery strategy | ask-on-risk |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Medium

| Unit | Goal | PR |
|------|------|-----|
| 1 | Migration separation + 4 bug fixes + verification | Single PR |

## Phase 1: Migration Architecture (infrastructure, foundation)

- [x] 1.1 Create `migrations_master/`, `migrations_tenant/`, `migrations_archive/` under `api/prisma/`; move all 10 migration folders + `migration_lock.toml` from `migrations/` → `migrations_archive/`; copy lock to both new dirs
- [x] 1.2 Generate master baseline via `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema_master.prisma --script`; add `IF NOT EXISTS` to CREATE TABLE/INDEX; wrap FKs in `DO $$ BEGIN … EXCEPTION WHEN duplicate_object THEN NULL; END $$`; save as `migrations_master/20240101000000_init_master/migration.sql` (depends on 1.1)
- [x] 1.3 Generate tenant baseline (same pattern, `schema_tenant.prisma`); save as `migrations_tenant/20240101000000_init_tenant/migration.sql` (depends on 1.1)
- [x] 1.4 Mark baselines applied: `prisma migrate resolve --applied 20240101000000_init_master --schema=prisma_master/schema.prisma` and `…init_tenant`; verify `prisma migrate status` → "up to date" (depends on 1.2, 1.3)
- [x] 1.5 Update `api/package.json` migrate scripts to use `--schema` flags referencing `prisma_master/schema.prisma` and `prisma_tenant/schema.prisma`; restructured into separate prisma dirs for Prisma v5 compatibility (depends on 1.1)

## Phase 2: Script Updates (infrastructure, depends on Phase 1)

- [x] 2.1 Update `api/scripts/create-tenant-db.ts`: point migration to `prisma_tenant/schema.prisma`; add Node.js `pg` fallback when `psql` unavailable; verify `error: unknown` → `error: any` (depends on 1.5)
- [x] 2.2 Update `api/src/infrastructure/persistence/postgres-admin.service.ts`: point tenant migration to `prisma_tenant/schema.prisma` via correct `--schema` (depends on 1.5)

## Phase 3: Runtime Bug Fixes (independent, parallelizable)

- [x] 3.1 Fix `api/prisma/seed.ts` `ensureInstitutionLevels()`: replace raw SQL with `prisma.institution.findMany({ where: { active: true, levels: { none: {} } } })`; added unit test with 4 test cases; verify idempotent
- [x] 3.2 Fix `api/src/application/shared/queries/listar-alumnos.query.ts`: remove `institutionId` from `where` (tenant client already DB-scoped); added unit test with 4 test cases; verify unit tests pass
- [x] 3.3 Fix `web/src/components/layout/sidebar.tsx`: remove `/students-by-course`, `/smtp-config`, `/websocket-config` list items; updated 22 sidebar tests — 6 tests updated to reflect removed items; verify all tests pass
- [x] 3.4 Fix `web/src/__tests__/App.test.tsx` L44: replace `require('react-router-dom')` with `import { Outlet } from 'react-router-dom'`; verify `pnpm --filter web lint` → 0 errors

## Phase 4: Verification (final gate)

- [x] 4.1 E2E tenant creation: created `educandow_test_e2e`, ran tenant migrations, verified 41 tables created, all 14 core pedagogical tables present, 0 master tables in tenant DB (depends on 2.1)
- [x] 4.2 Full suite: `pnpm test` in all packages → 284 API + 89 Web = 373 total, 0 failures (depends on all prior)
- [x] 4.3 Master DB health: `prisma migrate status` → "up to date"; all 13 master tables + _prisma_migrations present (depends on 1.4)
