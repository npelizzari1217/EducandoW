# Verify Report: optativas-inscripcion — PR1

> Phase: verify
> Scope: PR1 only (T1.1–T1.10). PR2/PR3 tasks are intentionally out of scope.
> Date: 2026-06-22
> Verdict: FAIL — 1 CRITICAL issue blocks merge

---

## Test Results

| Suite | Files | Tests | Status |
|-------|-------|-------|--------|
| @educandow/domain | 99 | 1112 | PASS |
| api | 153 | 1490 | PASS |
| web | 42 | 426 | PASS |
| **Total** | **294** | **3028** | **PASS** |

All 3028 tests pass. The cascade filter tests (MGC-S15, S16, S17) pass and genuinely assert the correct behavior (see below).

## TypeCheck

```
pnpm --filter api typecheck → EXIT 2 (FAIL)
11 TypeScript errors across 7 test files
```

---

## Findings

### CRITICAL

#### C1 — TypeScript typecheck fails: 11 errors in 7 test files

`pnpm --filter api typecheck` exits with code 2. The root cause is that T1.3 and T1.4 added `setEsOptativa` and `removeStudent` as **required** methods to the port interfaces (`MateriaXCursoXCicloRepository` and `AlumnosXMateriaRepository`), but 7 existing test files that create mock repo objects were only partially updated — they received `esOptativa: false` fixture fixes but the mock factory functions were NOT updated to include the new interface methods.

Affected files and required additions:
- `api/src/application/materia-grupo-ciclo/__tests__/add-student-to-grupo.use-case.test.ts` — add `removeStudent: vi.fn()` to AlumnosXMateriaRepository mock
- `api/src/application/materia-grupo-ciclo/__tests__/add-student-to-materia.use-case.test.ts` — add `setEsOptativa: vi.fn()` AND `removeStudent: vi.fn()`
- `api/src/application/materia-grupo-ciclo/__tests__/create-grupo.use-case.test.ts` — add `setEsOptativa: vi.fn()`
- `api/src/application/materia-grupo-ciclo/__tests__/list-alumnos-materia.use-case.test.ts` — add `removeStudent: vi.fn()`
- `api/src/application/materia-grupo-ciclo/__tests__/list-materias.use-case.test.ts` — add `setEsOptativa: vi.fn()` AND `removeStudent: vi.fn()` (two mock factories in this file)
- `api/src/application/materia-grupo-ciclo/__tests__/materialize-materias.use-case.test.ts` — add `setEsOptativa: vi.fn()`
- `api/src/application/materia-grupo-ciclo/__tests__/update-grupo.use-case.test.ts` — add `setEsOptativa: vi.fn()`

The fix is mechanical: ~10 additional `vi.fn()` stubs across 7 files. No logic changes. After fix, re-run `pnpm --filter api typecheck` to confirm clean.

Note: T1.10 used `pnpm build` (Turbo, transpile-only via esbuild) rather than `tsc --noEmit`. Turbo does not enforce type checking, so the errors were not caught during apply. The verify phase detected this gap.

**This blocks PR1 merge.**

---

### WARNINGS

#### W1 — Migration not applied to database

Migration SQL exists at `api/prisma_tenant/migrations/20260622000000_add_es_optativa_to_materia_x_curso_x_ciclo/migration.sql` and is correct:
```sql
ALTER TABLE "materias_x_curso_x_ciclo" ADD COLUMN "es_optativa" BOOLEAN NOT NULL DEFAULT false;
```

The Prisma client was regenerated successfully (`esOptativa` is fully typed in `@prisma/tenant-client`). However, `prisma migrate dev` was not run during apply (non-interactive CI environment). The DB schema is not in sync.

**Required before deploying or running integration tests against a live DB:**
```
pnpm --filter api prisma:migrate:tenant   # dev
# or
pnpm --filter api prisma:deploy:tenant    # prod
```

This is a deploy-time action, not a code defect. The `migration_name` lock in Prisma's migration history table will prevent duplicate application.

#### W2 — `removeStudent` pre-implemented in PR1 without tests

`PrismaAlumnosXMateriaRepository.removeStudent` was pre-implemented during T1.9 to satisfy the `AlumnosXMateriaRepository` port contract added in T1.4, keeping the build clean. Tests for this method are deferred to PR2 (T2.1).

The implementation is structurally correct:
```typescript
async removeStudent(id: string): Promise<void> {
  await this.client.materiasXAlumnoXCursoXCiclo.deleteMany({ where: { id } });
}
```
`deleteMany` is idempotent (no throw on missing row) — consistent with the spec (MGC-R9, D4). Risk is low because the pattern mirrors the existing `upsertMany` idiom and the logic is trivially correct. Tests in PR2 will provide formal coverage.

---

### SUGGESTIONS

#### S1 — Mock factory pattern fragility

The current pattern declares mock repos as their full interface type (`MateriaXCursoXCicloRepository`, `AlumnosXMateriaRepository`), which requires updating every mock factory on each port addition. Consider a `createMock<T>()` helper or `Partial<T> as T` pattern to reduce the blast radius of future port extensions.

#### S2 — Migration timestamp collision risk

The timestamp `20260622000000` is the current date with zeroed time. If another migration is authored on the same day with the same timestamp pattern, there could be a conflict. Low risk for this PR since it's the only schema change in the slice, but worth adopting `prisma migrate dev --name ...` for future migrations to get a precise timestamp.

---

## Code Inspection — PR1 Behavioral Correctness

### Cascade filter (D2, MGC-R8)

Filter is applied at the correct location — after `findByCourseCycleId`, before BOTH the alumno upsert AND the competency resolution:
```typescript
// cascade-student-materias-competencias.use-case.ts, line 56
const materias = (await this.materiaRepo.findByCourseCycleId(ccId)).filter((m) => !m.esOptativa);
```
The single filtered `materias` variable drives both step 3 (alumno upsert) and step 4 (unique SPS IDs for competency resolution). D2 is fully satisfied.

### Cascade tests genuinely assert D2

MGC-S15 test suite contains two explicit assertions:
1. `upsertMany` receives only the 2 obligatoria `materiaXCursoXCicloId`s (not the optativa ones)
2. `findActiveByStudyPlanSubject` is NOT called for optativa `studyPlanSubjectId`s

MGC-S16: all-obligatoria regression guard — `upsertMany` called with all materias.
MGC-S17: all-optativa — `upsertMany` NOT called, `bulkCreate` NOT called, result is all zeros, no error.

These are genuine behavioral assertions, not count-only checks.

### Entity (D1, MGC-R7)

`esOptativa: boolean` in `MateriaXCursoXCicloProps` (required).
`esOptativa?: boolean` in `CreateMateriaXCursoXCicloInput` (optional, defaults to `false`).
`create()` uses `input.esOptativa ?? false` — correct.
`reconstruct()` spreads props — `esOptativa` flows through without extra code. Correct.

### Port changes (T1.3, T1.4)

`MateriaXCursoXCicloRepository.upsertMany` — `esOptativa?: boolean` added (optional). Existing callers (`MaterializeMateriasUseCase` via `materialize-materias.use-case.ts:33`) do not pass `esOptativa` and remain source-compatible. Verified.

`AlumnosXMateriaRepository.removeStudent` added. Port-only in PR1; impl pre-added to satisfy interface.

`MateriaXCursoXCicloRepository.setEsOptativa` added. Port + Prisma impl both present. Correct.

### Prisma repo (T1.8, T1.9)

`upsertMany` maps `esOptativa: d.esOptativa ?? false` — correct.
`setEsOptativa` delegates to `client.materiaXCursoXCiclo.update({ where: { id }, data: { esOptativa } })` — correct.
`toDomain` passes `esOptativa: row.esOptativa` — round-trip preserved. Correct.

### Schema (T1.5)

`esOptativa Boolean @default(false) @map("es_optativa")` present in `api/prisma_tenant/schema.prisma`. Correct. No index (consistent with D7). No backfill (correct — existing rows get `false`, which is the right semantic).

---

## Task Completion Status

| Task | Status | Notes |
|------|--------|-------|
| T1.1 | [x] DONE | Entity tests written |
| T1.2 | [x] DONE | Entity implementation correct |
| T1.3 | [x] DONE | Port extended; caused typecheck issue in test mocks |
| T1.4 | [x] DONE | Port extended; caused typecheck issue in test mocks |
| T1.5 | [x] DONE | Schema + migration SQL authored; client regenerated; DB not migrated (W1) |
| T1.6 | [x] DONE | Cascade tests written, genuinely assert D2 |
| T1.7 | [x] DONE | Cascade filter correctly placed |
| T1.8 | [x] DONE | Prisma repo tests cover all 4 scenarios + toDomain round-trip |
| T1.9 | [x] DONE | Prisma repo impl correct; `removeStudent` pre-implemented (W2) |
| T1.10 | [x] PARTIAL | Tests pass; build passes; **typecheck NOT run — 11 TS errors undetected (C1)** |

---

## Summary

**Verdict: FAIL — 1 CRITICAL / 2 WARNING / 2 SUGGESTION**

PR1 is structurally sound. The behavioral implementation is correct, the cascade filter satisfies all D2 requirements, and all 3028 tests pass. The single blocker is a mechanical TypeScript issue: 7 existing test mock factory functions were not updated to include the new port methods (`setEsOptativa`, `removeStudent`) added in T1.3 and T1.4. `pnpm --filter api typecheck` fails with 11 errors as a result.

**Fix is ~10 `vi.fn()` additions across 7 files.** After that fix + a clean typecheck run, PR1 is safe to commit and open as a PR.

**Next recommended: sdd-apply (fix C1 typecheck errors) → re-run sdd-verify → sdd-archive**
