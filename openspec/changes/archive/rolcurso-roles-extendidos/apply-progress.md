# Apply Progress: rolcurso-roles-extendidos

**Batch**: 1 of 1 (all tasks completed)
**Date**: 2026-06-23
**TDD mode**: STRICT
**Test result**: 3096 passed (1114 domain, 1540 api, 442 web) — 0 failures
**Build result**: `pnpm build` — all 3 packages compile, exit 0

---

## Tasks

- [x] **T1** — Domain enum extended to 6 values. +2 tests (6-value count + create with each new role). GREEN.
- [x] **T2** — Use-case coverage test added (SECRETARIO bypasses removeTitulares). Immediately GREEN — no impl change needed.
- [x] **T3** — Prisma tenant schema updated. Prisma client regenerated via `pnpm --filter api prisma:generate`.
- [x] **T4** — Migration SQL authored manually at `api/prisma_tenant/migrations/20260623110000_rolcurso_roles_extendidos/migration.sql`. NOT applied (Docker unavailable in WSL). Must run `pnpm --filter api prisma:migrate:deploy:tenant` on ALL tenant DBs ON SERVER before frontend ships.
- [x] **T5** — Frontend refactored. `ROL_CURSO_LABELS` map + `RolCurso` const+type in `web/src/types/materia-grupo.ts`. `formRol` widened, select derives 6 options from map. +1 test (SC-07). GREEN.
- [x] **T6** — `pnpm test` + `pnpm build` both green. Gate passed.

---

## Files Changed

| File | Change |
|------|--------|
| `packages/domain/src/asignacion-curso-ciclo/entities/asignacion-curso-x-ciclo.ts` | +4 enum values + updated JSDoc |
| `packages/domain/src/asignacion-curso-ciclo/__tests__/entities/asignacion-curso-x-ciclo.test.ts` | +2 tests (T1) |
| `api/src/application/asignacion-curso/__tests__/assign-docente-to-curso.use-case.test.ts` | +1 test (T2) |
| `api/prisma_tenant/schema.prisma` | +4 enum values to RolCurso |
| `api/prisma_tenant/migrations/20260623110000_rolcurso_roles_extendidos/migration.sql` | NEW — authored only, not applied |
| `web/src/types/materia-grupo.ts` | added RolCurso const+type, ROL_CURSO_LABELS, widened rol field |
| `web/src/pages/dashboard/materia-grupos.tsx` | widened formRol, derived select, updated heading |
| `web/src/pages/dashboard/__tests__/materia-grupos.test.tsx` | +1 test SC-07 |
| `openspec/changes/rolcurso-roles-extendidos/tasks.md` | all 6 tasks marked [x] |

---

## Deviations

### ADR-2 partial deviation: RolCurso defined as const+type in web, not imported from domain

**Design said**: import `RolCurso` from `@educandow/domain`.
**Actual**: defined as `const RolCurso = { ... } as const` + `type RolCurso` in `web/src/types/materia-grupo.ts`.

**Root cause**: `@educandow/domain` compiles to CJS via `tsc`. Rollup (Vite's production bundler) cannot statically analyze named exports from CJS files using `Object.defineProperty(exports, "X", { get: ... })`. Vite's `commonjsOptions.include` does not apply to workspace-linked packages.

**Impact**: Minimal. Values are identical at runtime. TypeScript enforces the 6-value type. The const has an explicit comment pointing to the domain SSOT. If the domain enum changes, a developer must also update this const — same as the pre-existing `MANAGEMENT_ROLES` pattern in the same file.

**Resolution path**: Add an ESM build output to `@educandow/domain` (tsconfig `"module": "ESNext"`, `"outDir": "dist/esm"`) and a `"module"` field in package.json. This would allow Rollup to use the ESM build and enable the original import approach. This is a separate change, not blocking this PR.

---

## Deploy Order (CRITICAL — ADR-4)

1. Merge PR
2. On server: `pnpm --filter api prisma:migrate:deploy:tenant` for **all tenants**
3. Verify: `SELECT enum_range(NULL::"RolCurso")` must return 6 values per tenant
4. Only then deploy/restart the frontend build

Skipping step 2 before step 4 will cause runtime errors: "invalid input value for enum RolCurso: SECRETARIO" on any INSERT with a new role.
