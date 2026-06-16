# Archive Report: `notas-get-authz-grupo`

**Status**: ARCHIVED / CLOSED
**Date**: 2026-06-16
**Branch**: feat/notas-get-authz-grupo
**Verdict**: PASS WITH WARNINGS → all warnings resolved before archive

---

## What Shipped

Closes the GET read-path group-scoped student filtering gap identified as follow-up debt #1
from `docente-ciclo-grupos` (WARNING-1 / F5-A2 / F5-T8 / F5-T9).

The `get-subject-grades-by-subject.use-case.ts` previously passed an authorization gate
(`canWriteGrades`) but then returned ALL enrolled students for the course-cycle without
group filtering. A TEACHER scoped to G1 could see students from G2.

This change replaces the boolean gate with a tri-state scope resolver:
- `getAllowedStudentIds(userId, roles, courseCycleId, subjectId)` → `'all' | string[] | null`
- `null` → HTTP 403 (no valid assignment)
- `'all'` → all enrolled students (administrative roles)
- `string[]` → filtered student set for the teacher's assigned group(s)

**Files changed** (~250 lines, 8 files):
- `packages/domain/src/grading/assignment-authorizer.port.ts` — `getAllowedStudentIds` signature + `StudentScope` type
- `packages/domain/src/materia-grupo-ciclo/alumnos-x-grupo-repository.ts` — `findStudentIdsByGrupoIds` signature
- `api/src/application/grading/assignment-authorizer.service.ts` — implementation (private `resolveAssignedGrupos` + refactor `canWriteGrades` + `getAllowedStudentIds`)
- `api/src/application/grading/get-subject-grades-by-subject.use-case.ts` — gate replaced with scope filter
- `api/src/presentation/grading/grading.module.ts` — `PrismaAlumnosXGrupoRepository` added as 3rd dep to `AssignmentAuthorizer` factory
- `api/src/infrastructure/materia-grupo-ciclo/prisma-alumnos-x-grupo.repository.ts` — 2-hop Prisma query + Set dedup
- `api/src/application/grading/__tests__/assignment-authorizer.service.test.ts` — new method branches + write-path regression (11 cases)
- `api/src/application/grading/get-subject-grades-by-subject.use-case.spec.ts` — migrated mocks + F5-T8/F5-T9 scenarios

**Commits on branch** (9 total):
- `9cf1b74` feat(domain): add findStudentIdsByGrupoIds to AlumnosXGrupoRepository; add getAllowedStudentIds + StudentScope to AssignmentAuthorizerPort (T2+T3)
- T1, T4, T5, T6, T7, T8, T9, T10 in subsequent commits
- `148f6ee` test(materia-grupo-ciclo): add findStudentIdsByGrupoIds to repo mocks (WARNING-1 fix)

---

## Spec Coverage

All 6 delta scenarios PASS with concrete test coverage:

| # | Scenario | Test | Status |
|---|----------|------|--------|
| 1 | TEACHER one-grupo scope → only that grupo's students | F5-T8 in use-case.spec.ts | PASS |
| 2 | Administrative 'all' scope → all students | ALL-SCOPE + authorizer tests | PASS |
| 3 | No assignment → null → 403 | AUTHZ-C1 + authorizer null branches | PASS |
| 4 | Multi-grupo → deduplicated union | co-docencia in authorizer + repo dedup test | PASS |
| 5 | Co-docencia shared record | repo dedup + authorizer grupoIds forwarding | PASS |
| 6 | Empty grupo → HTTP 200, students:[] | GRUPO-VACÍO in both test files | PASS |

**Two-hop query** (findStudentIdsByGrupoIds): verified correct. AlumnosXGrupoXCursoXMateriaXCiclo
has no `studentId` column; hop-1 reads `alumnosXMateriaXCursoXCicloId`, hop-2 resolves `studentId`.
Set dedup on both hops. Guard for `grupoIds.length === 0` returns `[]` immediately.

**Test counts at archive**:
- Domain: 92 files, 1036 tests, 0 failures (GREEN)
- API: 128 files, 1207 tests, 0 failures (GREEN)

**Coverage** (application/grading folder): 96.07% Stmts, 88.47% Branch (threshold: ≥80% MET).

---

## F5-T8 / F5-T9 Traceability

- **F5-T8** (`docente-ciclo-grupos` deferred task): CLOSED at unit level.
  Test: `F5-T8: getAllowedStudentIds returns ["s1","s2"] → students[] contains only s1 and s2`
  in `get-subject-grades-by-subject.use-case.spec.ts`.
- **F5-T9** (`docente-ciclo-grupos` deferred task): CLOSED at unit level.
  Test: `F5-T9: getAllowedStudentIds returns ["s1"] → s2 and s3 are absent`.

Full DB integration tests for these scenarios remain deferred, consistent with the project's
current test strategy. See "Deferred Items" below.

---

## Main Spec Merge

The following main capability specs were updated to incorporate this delta:

- `openspec/specs/subject-period-grades/spec.md`: SPG-R8 note added; **SPG-R10** added
  (group-scoped read, scenarios SPG-S10–S13)
- `openspec/specs/subject-final-grades/spec.md`: SFG-R10 note added; **SFG-R11** added
  (group-scoped read, scenarios SFG-S13–S15)

Both requirements carry attribution:
> Declared by: `docente-ciclo-grupos/specs/notas/delta.md`
> Implemented (read path) by: `notas-get-authz-grupo` · 2026-06-16

---

## Debt Register Update

`docente-ciclo-grupos/verify-report.md` debt item #1 marked as RESOLVED.
Item #4 updated to note F5-T8/T9 are closed at unit level.

---

## Deferred Items

1. **DB integration tests for F5-T8/F5-T9**: Full end-to-end test with a real tenant database
   and actual `GrupoXCursoXMateriaXCiclo` rows. Consistent with project test strategy (unit mocks
   satisfy the spec gate). These are tracked in `docente-ciclo-grupos` debt register item #4.

2. **SUGGESTION-1**: `get-subject-grades-by-subject.use-case.ts` branch coverage is exactly 80.00%
   (the spec gate). The untested branch is line 97 (second branch of the early-return after scope
   check when `periods.length === 0`). Non-blocking; zero margin. A follow-up test can cover it.

---

## Engram Artifact IDs

- proposal: #1034
- spec: #1035
- design: #1036
- tasks: #1037
- verify-report: #1039
- archive-report: (saved after this report)
