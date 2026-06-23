# Verify Report — rolcurso-roles-extendidos
Generated: 2026-06-23
Verdict: **PASS WITH WARNINGS**
CRITICAL: 0 | WARNING: 1 | SUGGESTION: 1

---

## Test Results

| Package | Test Files | Tests | Result |
|---------|-----------|-------|--------|
| @educandow/domain | 99 | 1114 | PASS |
| api | (cached) | 1540 | PASS |
| web | 44 | 442 | PASS |
| **Total** | | **3096** | **0 failures** |

Build: `pnpm build` — 3 packages compiled, 0 TypeScript errors, exit 0.
Coverage: Not independently run in this verify pass. Apply report claims ≥80% achieved; all spec tests present and green.

---

## Spec Requirements Verification

### SPEC-1 — Domain enum has exactly 6 values (UPPER_SNAKE_CASE)
**STATUS: PASS**
File: `packages/domain/src/asignacion-curso-ciclo/entities/asignacion-curso-x-ciclo.ts`
`enum RolCurso { PRECEPTOR, TITULAR, SECRETARIO, DIRECTOR, EOE, DOCENTE_AUXILIAR }` — 6 values confirmed.

### SPEC-1 / SC-01 — Domain test asserts 6-value count
**STATUS: PASS**
File: `packages/domain/src/asignacion-curso-ciclo/__tests__/entities/asignacion-curso-x-ciclo.test.ts`
Test "RolCurso contains exactly 6 values (SPEC-1/SC-01)" asserts `Object.values(RolCurso).toHaveLength(6)` with `arrayContaining` all 6 values. Test "creates assignments with each new RolCurso value (SPEC-1)" exercises all 4 new roles. Both green.

### SPEC-2 — Prisma tenant enum mirrors domain exactly
**STATUS: PASS**
File: `api/prisma_tenant/schema.prisma` lines 102–109.
`enum RolCurso { PRECEPTOR TITULAR SECRETARIO DIRECTOR EOE DOCENTE_AUXILIAR }` — 6 values, same order, same names.
Comment explicitly states "Note: mirrors domain enum RolCurso exactly (SSOT = domain package, ADR-1)".

### SPEC-3 — Zod DTO auto-syncs (no file change needed)
**STATUS: PASS**
File: `api/src/presentation/asignacion-curso/dto/asignacion-curso.dto.ts`
Line 11: `rol: z.nativeEnum(RolCurso)` — `z.nativeEnum` picks up all 6 values directly from the domain enum at runtime. No change required.

### SPEC-4 / SC-03 — TITULAR retains ACC-S5 singleton; new roles have NO singleton
**STATUS: PASS**
File: `api/src/application/asignacion-curso/assign-docente-to-curso.use-case.ts`
Condition on line 51: `if (input.rol === RolCurso.TITULAR)` — only TITULAR triggers `removeTitularesForCourse`. Unchanged.
Test "assigning a new role (SECRETARIO) does NOT remove titulares (SPEC-4/SC-03)" asserts `removeTitularesForCourse` is NOT called for SECRETARIO. Green.

### SPEC-5 — Backward compatible (existing rows untouched)
**STATUS: PASS** (by design)
Migration is additive-only: no DROP, no UPDATE, no data changes. Existing PRECEPTOR/TITULAR rows unaffected.

### SPEC-6 — Migration is additive-only, applied to all tenant DBs
**STATUS: PASS**
File: `api/prisma_tenant/migrations/20260623110000_rolcurso_roles_extendidos/migration.sql`
4 bare `ALTER TYPE "RolCurso" ADD VALUE` statements. No `BEGIN`/`COMMIT` transaction wrapper (required by Postgres). Comment documents deploy order. Naming follows convention (timestamp_description). Not yet applied locally (correct — requires server deploy).

### SPEC-7 / SC-07 — Web dropdown shows all 6 with Spanish labels, derived from single map
**STATUS: PASS**
File: `web/src/types/materia-grupo.ts`
`ROL_CURSO_LABELS` map defined for all 6 values: Preceptor, Titular, Secretario, Director, EOE, Docente Auxiliar.
File: `web/src/pages/dashboard/materia-grupos.tsx` line 709
Select uses `Object.entries(ROL_CURSO_LABELS)` — all 6 options derived from the single map (not 6 hardcoded literals).
`formRol` state is typed as `RolCurso`, initialized to `RolCurso.PRECEPTOR` (not a raw string literal).
Test SC-07 (`web/src/pages/dashboard/__tests__/materia-grupos.test.tsx` line 456) asserts exactly 6 options with correct Spanish labels. Green.

### SPEC-8 — Level-agnostic (no conditional branching by level)
**STATUS: PASS**
No level-based conditional added anywhere in the changed files.

---

## ADR-2 Deviation Assessment

### Finding: WARNING — Frontend `const RolCurso` re-declares domain enum values instead of importing

**What was done**: `web/src/types/materia-grupo.ts` declares `const RolCurso` as a local const-object mirror of the domain enum rather than importing `RolCurso` from `@educandow/domain`.

**Stated reason (documented in code)**: The domain package outputs CJS (TypeScript `tsc` default). Rollup (used by Vite for production builds) cannot statically analyze named exports from CJS files that use the `Object.defineProperty(exports, "RolCurso", { get: ... })` getter pattern. The `const+type` pattern is equivalent at runtime and TypeScript provides full type safety within the web package.

**Is the tradeoff acceptable?** Yes, conditionally. The CJS limitation is real and documented. The comment explicitly references the domain SSOT and SPEC-1's sync requirement. TypeScript type safety is preserved within the web package.

**Does it reintroduce 3-way drift risk?** YES — this is the core risk:
1. Domain enum (authoritative)
2. Prisma tenant enum (already verified by schema + migration)
3. Frontend `const RolCurso` (NO automated cross-check against domain)

The web test suite (SC-07) only verifies that 6 options render with correct labels — it does not import from `@educandow/domain` and compare. If a 7th value is added to the domain enum in a future change, the frontend const could silently drift until runtime.

**Recommended guard**: Add a Vitest test in `web/src/types/__tests__/materia-grupo-sync.test.ts` that imports BOTH `RolCurso` from `@educandow/domain` AND from `../materia-grupo` and asserts key/value equality. This is feasible because Vitest runs under Node (not Rollup), so the CJS import works fine in tests. The test would fail immediately if any future enum extension is applied to the domain but not mirrored in the frontend const.

This guard is NOT required to archive this change (the current 6-value state is correct), but it is strongly recommended before the next enum extension.

---

## Task Completion

| Task | Status | Verified |
|------|--------|---------|
| T1: Domain enum + tests | [x] | PASS — confirmed on disk |
| T2: Use-case no-singleton test | [x] | PASS — confirmed on disk |
| T3: Prisma schema sync | [x] | PASS — confirmed on disk |
| T4: Migration SQL | [x] | PASS — confirmed on disk (not deployed — correct) |
| T5: Frontend refactor + test | [x] | PASS — confirmed on disk |
| T6: pnpm test + build green | [x] | PASS — 3096 tests, 0 failures, build exit 0 |

---

## Verdict

**PASS WITH WARNINGS**

- 0 CRITICAL issues
- 1 WARNING (ADR-2 drift risk — frontend const has no automated cross-check against domain enum)
- 1 SUGGESTION (add cross-check Vitest test before next enum extension)
- All spec requirements satisfied
- All tasks complete and verified on disk
- Tests: 3096 passed, 0 failed
- Build: exit 0

The change is safe to archive. The WARNING does not block archive — it is a future-proofing recommendation.
