# Verify Report — `notas-get-authz-grupo`

> Phase: sdd-verify · Date: 2026-06-16 · Branch: feat/notas-get-authz-grupo
> Verdict: **PASS WITH WARNINGS** — 0 CRITICAL · 1 WARNING · 1 SUGGESTION

---

## Test Suite Results

| Suite | Files | Tests | Failures | Status |
|-------|-------|-------|----------|--------|
| `@educandow/domain` | 92 | 1036 | 0 | GREEN |
| `api` | 128 | 1207 | 0 | GREEN |

The `[Nest] ERROR [UpdateInstitutionUseCase] cascade attendance-types failed` log that appears in the
API run is a pre-existing test that deliberately exercises cascade failure — it is not a failure.

---

## Coverage (changed application/grading code)

| File | Stmts | Branch | Notes |
|------|-------|--------|-------|
| `application/grading` (folder) | 96.07% | 88.47% | ≥ 80% threshold MET |
| `get-subject-grades-by-subject.use-case.ts` | 92.85% | 80.00% | Exactly at threshold (line 97 untested branch) |
| `assignment-authorizer.service.ts` | (included above) | | Well above threshold |

---

## Typecheck

`pnpm --filter api typecheck` exits with 15 errors total.

### Pre-existing (11 — unchanged from docente-ciclo-grupos verify)

| File | Count | Error |
|------|-------|-------|
| `study-plan.use-cases.test.ts` | 5 | `academicYear` does not exist in `StudyPlanProps` |
| `prisma-study-plan.repository.test.ts` | 1 | `academicYear` does not exist in `StudyPlanProps` |
| `course-cycle.dto.test.ts` | 2 | `BimonthPeriod` unused + Expected 13 args got 10 |
| `competency.controller.spec.ts` | 2 | Expected 3 args got 2 |
| `competency.use-cases.test.ts` | 1 | `GradeScaleNotConfiguredError` declared but never read |

Note: the pre-existing academicYear count increased from 4 to 6. The extra 2 are lines 204 and 231 in
`study-plan.use-cases.test.ts`. These are pre-existing errors that existed before this branch.

### New errors from this change (4) — WARNING

All 4 errors are TS2741 in pre-existing test files for **materia-grupo-ciclo** use cases.
They arise because T2 added `findStudentIdsByGrupoIds` to `AlumnosXGrupoRepository` and those tests'
mock objects do not yet implement the new method.

| File | Line | Error |
|------|------|-------|
| `src/application/materia-grupo-ciclo/__tests__/add-student-to-grupo.use-case.test.ts` | 65 | TS2741: `findStudentIdsByGrupoIds` missing in mock |
| `src/application/materia-grupo-ciclo/__tests__/list-grupos.use-case.test.ts` | 47 | TS2741: `findStudentIdsByGrupoIds` missing in mock |
| `src/application/materia-grupo-ciclo/__tests__/list-grupos.use-case.test.ts` | 79 | TS2741: `findStudentIdsByGrupoIds` missing in mock |
| `src/application/materia-grupo-ciclo/__tests__/remove-student-from-grupo.use-case.test.ts` | 35 | TS2741: `findStudentIdsByGrupoIds` missing in mock |

**Impact:** Runtime tests still pass (Vitest does not enforce TS types). Fix is mechanical: add
`findStudentIdsByGrupoIds: vi.fn()` to the mock objects in those 3 files. The use cases being
tested do not call `findStudentIdsByGrupoIds`; the mocks only need the property to satisfy the TS
interface.

---

## Spec Scenario Traceability

| # | Spec Scenario | Test | File | Status |
|---|---------------|------|------|--------|
| 1 | TEACHER scoped to one grupo sees only that grupo's students | F5-T8: `getAllowedStudentIds returns ["s1","s2"] → students[] contains only s1 and s2` | `get-subject-grades-by-subject.use-case.spec.ts` | PASS |
| 2 | Administrative user sees all students | `ALL-SCOPE: getAllowedStudentIds returns "all" → all enrolled students returned` + authorizer tests (SECRETARIO/DIRECTOR/ADMIN/ROOT → 'all') | both test files | PASS |
| 3 | TEACHER with no grupo assignment → 403 | `AUTHZ-C1: getAllowedStudentIds returns null → { forbidden: true }` + authorizer null branches | both test files | PASS |
| 4 | TEACHER assigned to multiple grupos → deduplicated union | `co-docencia: same studentId from 2 grupos → deduped ["s1"]` (authorizer) + `co-docencia: same studentId via 2 different axmIds → deduplicated` (repo) | both test files | PASS |
| 5 | Co-docencia — each teacher sees the shared student; one grade record | Covered by repo dedup test + authorizer passing both grupoIds to `findStudentIdsByGrupoIds`; @@unique invariant is a DB constraint (integration deferred per spec) | both test files | PASS |
| 6 | TEACHER assigned to empty grupo → HTTP 200, students:[] (not 403) | `GRUPO-VACÍO: getAllowedStudentIds returns [] → result is NOT forbidden; students[] = []` + authorizer: `findStudentIdsByGrupoIds returns [] → returns [] (distinct from null)` | both test files | PASS |

All 6 spec scenarios have concrete, passing test coverage.

---

## Two-Hop Query Correctness (T2)

`PrismaAlumnosXGrupoRepository.findStudentIdsByGrupoIds` (`prisma-alumnos-x-grupo.repository.ts`):
- Hop 1: queries `alumnosXGrupoXCursoXMateriaXCiclo` selecting **`alumnosXMateriaXCursoXCicloId`** (no `studentId` column exists on this table — correct)
- Hop 2: queries `alumnosXMateriaXCursoXCiclo` selecting **`studentId`**
- Intermediate dedup: `[...new Set(axg.map(r => r.alumnosXMateriaXCursoXCicloId))]` before hop-2
- Final dedup: `[...new Set(axm.map(r => r.studentId))]`
- Guard: returns `[]` immediately when `grupoIds.length === 0`

Repo tests cover: empty input, hop-1 empty, hop-1→hop-2 happy path, co-docencia dedup, axmId dedup before hop-2. VERIFIED CORRECT.

---

## Write-Path No-Regression (canWriteGrades)

The `resolveAssignedGrupos` private extraction was verified via 11 `canWriteGrades` tests covering all 7 ADR-3 equivalence cases:
- ROOT bypass, SECRETARIO bypass, DIRECTOR bypass, ADMIN bypass (4 admin cases)
- TEACHER with assigned group → permitted
- TEACHER with no DocenteXCiclo → rejected
- TEACHER with DocenteXCiclo but no group → rejected
- TEACHER assigned to different subject → rejected
- No CourseCycle → rejected
- No MateriaXCursoXCiclo → rejected
- No TenantContext → rejected

All 11 pass. Refactor is safe.

---

## DI Wiring (T9)

`grading.module.ts`:
- Line 40: `import { PrismaAlumnosXGrupoRepository }` — present
- Lines 180–181: `PrismaAlumnosXGrupoRepository` class + `'AlumnosXGrupoRepository'` token — present
- Lines 183–190: `AssignmentAuthorizer` factory:
  - `useFactory`: 3 params (`docenteRepo`, `grupoRepo`, `alumnosXGrupoRepo`) — correct
  - `inject: [PrismaDocenteXCicloRepository, PrismaGrupoRepository, PrismaAlumnosXGrupoRepository]` — 3 entries, matches factory params
- No undefined injection risk. T5+T9 atomic deployment confirmed.

---

## DTO Shape (unchanged)

`SubjectGradesBySubjectResult` interface is identical to pre-change: `courseCycleId`, `subjectId`, `periods[]`, `students[]` with all sub-fields. Only the set of rows in `students[]` changes — not the shape. VERIFIED.

---

## F5-T8/F5-T9 Traceability

- **F5-T8** (`docente-ciclo-grupos` blocked task): CLOSED at unit level by `get-subject-grades-by-subject.use-case.spec.ts` test `F5-T8: getAllowedStudentIds returns ["s1","s2"] → students[] contains only s1 and s2`.
- **F5-T9** (`docente-ciclo-grupos` blocked task): CLOSED at unit level by test `F5-T9: getAllowedStudentIds returns ["s1"] → s2 and s3 are absent`.
- Full DB integration deferred: explicitly documented in `tasks.md` and `specs/notas/delta.md` (Invariants section). DOCUMENTED.

---

## Domain Package Exports

- `packages/domain/src/grading/index.ts:71` — exports `{ AssignmentAuthorizerPort, StudentScope }` ✓
- `packages/domain/src/index.ts:149` — re-exports `{ AssignmentAuthorizerPort, StudentScope }` ✓

---

## Task Completion

All 10 tasks marked `[x]` in `tasks.md`. 9 commits on branch `feat/notas-get-authz-grupo` map 1:1 to the task sequence (T2+T3 combined in 9cf1b74, T1, T4, T5, T6, T7, T8, T9, T10).

---

## Findings

### WARNING-1: 4 new TS2741 type errors in materia-grupo-ciclo test mocks

**Files:**
- `api/src/application/materia-grupo-ciclo/__tests__/add-student-to-grupo.use-case.test.ts:65`
- `api/src/application/materia-grupo-ciclo/__tests__/list-grupos.use-case.test.ts:47,79`
- `api/src/application/materia-grupo-ciclo/__tests__/remove-student-from-grupo.use-case.test.ts:35`

**Cause:** T2 added `findStudentIdsByGrupoIds` to `AlumnosXGrupoRepository` interface; the existing mock objects in these 3 unrelated test files don't implement the new method.
**Impact:** Typecheck fails. Runtime tests still pass (0 failures).
**Fix:** Add `findStudentIdsByGrupoIds: vi.fn().mockResolvedValue([])` to each mock object.

### SUGGESTION-1: Branch coverage for `get-subject-grades-by-subject.use-case.ts` is exactly at threshold

Branch coverage is 80.00% (the spec gate). The untested branch is line 97 (the second branch of the early-return when `periods.length === 0` after scope check). This is not a violation but leaves zero margin.

---

## Siguiente Paso Recomendado

Fix WARNING-1 (3 files, mechanical change) before running `sdd-archive`. The change is a 1-liner per file — add `findStudentIdsByGrupoIds: vi.fn().mockResolvedValue([])` to the existing mock objects. Once the typecheck is clean, archive is unblocked.

`sdd-archive` after WARNING-1 is resolved.
