# Proposal: Fix Critical Issues — Migration Architecture & Runtime Bugs

## Intent

Fix 7 BLOCKING issues found during codebase audit: missing tenant migrations (36 tables with zero migration files), shared master/tenant migration directory causing cross-schema corruption, a silent SQL column-name bug in seed, a runtime-crashing tenant query with non-existent column, 3 dead sidebar links, and an ESLint error blocking CI.

## Scope

**Nivel pedagógico**: ALL

### In Scope
- Create `prisma/migrations_master/` and `prisma/migrations_tenant/` with baseline squashed migrations capturing exact current DB state
- Archive old mixed migrations to `migrations_archive/`
- Update `create-tenant-db.ts`, `postgres-admin.service.ts`, and package.json scripts to use separated migration dirs
- Fix `seed.ts` L316: `il.institution_id` → `il."institutionId"`
- Fix `listar-alumnos.query.ts` L34: remove `institutionId` from where clause (tenant client already scoped)
- Fix `sidebar.tsx`: remove or route-guard the 3 dead links (`/students-by-course`, `/smtp-config`, `/websocket-config`)
- Fix `App.test.tsx` L44: replace `require('react-router-dom')` with `import { Outlet }`

### Out of Scope
- Non-blocking issues and cleanup items from the audit
- Schema changes beyond baseline capture
- `/students-by-course` page implementation

## Capabilities

### Modified Capabilities
- **tenant-database**: Migration architecture changes — separate master/tenant dirs, baseline squashed migrations, updated tenant-creation scripts
- **sidebar-navigation**: Dead link removal — 3 nav items without corresponding routes must be removed or guarded

## Approach

**Part A — Migration Architecture**: Generate baseline migrations via `prisma migrate diff` from live DB state. Split into two dirs: `migrations_master/` (users, institutions, refresh_tokens) and `migrations_tenant/` (all 42 pedagogical tables). Archive old migrations. Update scripts: `create-tenant-db.ts` and `postgres-admin.service.ts` point to `migrations_tenant/`. Update package.json migrate scripts.

**Part B — Bug Fixes**: Four isolated single-line fixes: SQL column quote in seed, remove stale `institutionId` filter, delete/gate dead sidebar links, replace `require` with `import`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `api/prisma/migrations_tenant/` | New | Baseline squashed tenant migration |
| `api/prisma/migrations_master/` | New | Baseline squashed master migration |
| `api/prisma/migrations/` | Archived → `migrations_archive/` | Old mixed migrations retired |
| `api/scripts/create-tenant-db.ts` | Modified | Point to `migrations_tenant/` |
| `api/src/infrastructure/persistence/postgres-admin.service.ts` | Modified | Point to `migrations_tenant/` |
| `api/package.json` | Modified | Scripts point to correct dirs |
| `api/prisma/seed.ts` L316 | Modified | Fix column reference |
| `api/src/application/shared/queries/listar-alumnos.query.ts` L34 | Modified | Remove stale `institutionId` |
| `web/src/components/layout/sidebar.tsx` L56,L108-109 | Modified | Remove/gate dead links |
| `web/src/__tests__/App.test.tsx` L44 | Modified | Replace `require` with `import` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Baseline migration diff mismatches live DB | Medium | Run `prisma migrate diff` against actual DB, manual review of generated SQL |
| Tenant creation breaks after dir split | Low | End-to-end test: fresh institution creation via API |
| Existing DBs pick up baseline as new migration | Medium | Baseline marked as already-applied via `prisma migrate resolve` |

## Rollback Plan

1. Restore `migrations_archive/` → `migrations/`, revert package.json scripts
2. Revert `create-tenant-db.ts` and `postgres-admin.service.ts` to point to `migrations/`
3. Each bug fix (B3-B6) is isolated and independently revertible via `git revert`

## Dependencies

- PostgreSQL running with `educandow_master` accessible for `prisma migrate diff`
- pnpm workspace available for running tests and lint

## Success Criteria

- [ ] `prisma migrate deploy` works against both master and tenant DBs from clean state
- [ ] `pnpm test` passes in all packages
- [ ] `pnpm lint` passes (0 errors)
- [ ] Fresh institution creation via API succeeds without migration errors
- [ ] All 3 dead sidebar links resolved (routes added OR nav items removed)
- [ ] Baseline migrations generate all 42 tenant tables + all master tables with correct columns
