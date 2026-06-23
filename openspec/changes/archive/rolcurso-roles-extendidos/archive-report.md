# Archive Report: rolcurso-roles-extendidos

**Archived**: 2026-06-23
**Mode**: hybrid
**Verdict**: PASS WITH WARNINGS (0 CRITICAL, 1 WARNING, 1 SUGGESTION)
**Change**: Extend `RolCurso` enum from 2 to 6 values (add SECRETARIO, DIRECTOR, EOE, DOCENTE_AUXILIAR)

---

## Engram Artifact IDs

| Phase          | Observation ID |
|----------------|----------------|
| proposal       | #1362          |
| spec           | #1363          |
| design         | #1364          |
| tasks          | #1365          |
| apply-progress | #1366          |
| verify-report  | #1367          |
| archive-report | (this record)  |

---

## Specs Synced

| Domain                  | Action  | Details                                                                                              |
|-------------------------|---------|------------------------------------------------------------------------------------------------------|
| asignacion-curso-ciclo  | Updated | Added ACC-R7 with SPEC-1..8 invariants + SC-01..10 scenarios; updated Purpose and header             |

---

## Archive Contents

| Artifact                               | Status                      |
|----------------------------------------|-----------------------------|
| proposal.md                            | archived                    |
| specs/rolcurso-roles-extendidos.spec.md| archived (delta — merged)   |
| design.md                              | archived                    |
| tasks.md                               | archived (6/6 tasks complete)|
| apply-progress.md                      | archived                    |
| verify-report.md                       | archived                    |

---

## Verification Summary

- **Tests**: 3096 passing (1114 domain, 1540 api, 442 web) — 0 failures
- **Build**: all 3 packages compile, exit 0
- **CRITICAL issues**: 0
- **WARNINGS**: 1 (W1 — see Open Items below)
- **SUGGESTIONS**: 1 (S1 — add cross-check test)

---

## Source of Truth Updated

- `openspec/specs/asignacion-curso-ciclo/spec.md` — **Updated**: new section ACC-R7 added
  with 8 invariants (SPEC-1..8) and 10 acceptance scenarios (SC-01..10) for the 6-value
  `RolCurso` enum. Purpose updated to list all 6 functional roles. Header updated to
  reference this change and carry forward open deployment guard note.

---

## Implementation Summary

| Task | Description                                                          | Commit type          |
|------|----------------------------------------------------------------------|----------------------|
| T1   | Domain enum extended to 6 values + 2 new tests                      | feat(domain)         |
| T2   | Use-case test: SECRETARIO bypasses removeTitulares (SPEC-4)          | test(asignacion-curso)|
| T3   | Prisma tenant schema enum synced + client regenerated                | chore(prisma)        |
| T4   | Migration SQL authored (4 bare ALTER TYPE ADD VALUE, no transaction) | chore(migration)     |
| T5   | Frontend: ROL_CURSO_LABELS map, 6-option select, SC-07 test          | feat(web)            |
| T6   | pnpm test + pnpm build verification gate                             | —                    |

**Files changed**:
- `packages/domain/src/asignacion-curso-ciclo/entities/asignacion-curso-x-ciclo.ts`
- `packages/domain/src/asignacion-curso-ciclo/__tests__/entities/asignacion-curso-x-ciclo.test.ts`
- `api/src/application/asignacion-curso/__tests__/assign-docente-to-curso.use-case.test.ts`
- `api/prisma_tenant/schema.prisma`
- `api/prisma_tenant/migrations/20260623110000_rolcurso_roles_extendidos/migration.sql` (NEW — not yet deployed)
- `web/src/types/materia-grupo.ts`
- `web/src/pages/dashboard/materia-grupos.tsx`
- `web/src/pages/dashboard/__tests__/materia-grupos.test.tsx`

---

## Open Items (MUST NOT be lost)

### W1 — Frontend const drift risk (WARNING — non-blocking)

**What**: `web/src/types/materia-grupo.ts` re-declares `const RolCurso` as a local
constant instead of importing from `@educandow/domain`. Root cause: `@educandow/domain`
outputs CJS; Rollup (Vite production build) cannot statically analyze named exports from
CJS files using the `Object.defineProperty(exports, ..., { get: ... })` getter pattern.

**Risk**: 3-way drift potential (domain enum / Prisma schema / frontend const). If the
domain enum gains a 7th value, the frontend const can silently diverge — no compile error.

**Recommended guard (S1)**: Add a Vitest test that imports both `RolCurso` from
`@educandow/domain` AND from `web/src/types/materia-grupo.ts` and asserts key/value
equality. Vitest runs under Node (not Rollup), so the CJS import works there.

**Priority**: implement before the next `RolCurso` extension.

### Deploy Guard — Migration NOT yet applied (BLOCKING for production)

**What**: `api/prisma_tenant/migrations/20260623110000_rolcurso_roles_extendidos/migration.sql`
has been authored but NOT applied to any tenant database (Docker unavailable in WSL dev).

**Risk**: If the frontend with the 6-option dropdown is deployed before the migration
runs on all tenant DBs, any INSERT with a new role value (`SECRETARIO`, `DIRECTOR`,
`EOE`, `DOCENTE_AUXILIAR`) will fail with a Postgres error:
`invalid input value for enum "RolCurso"`.

**Required action**: Run `pnpm --filter api prisma:migrate:deploy:tenant` on ALL tenant
databases on the server BEFORE deploying the frontend build that includes this change.

**Postgres gotcha**: `ALTER TYPE ... ADD VALUE` cannot run inside a transaction block.
The authored migration SQL uses bare statements (no `BEGIN`/`COMMIT` wrapper) — this
is correct and intentional.

---

## SDD Cycle Complete

Change `rolcurso-roles-extendidos` has been fully planned, implemented, verified, and
archived. The SDD cycle is closed.
