# Archive Report — columna-alumnos-activos

**Archived**: 2026-06-23  
**Verdict**: PASS (0 CRITICAL / 0 WARNING / 0 SUGGESTION)  
**Delivery**: Code-only, safe standard deploy via `deploy.ps1`. No DB migration.

---

## What was shipped

**Feature**: "Alumnos" column in the admin CursosXCiclo list showing the count of enrolled
students per CourseCycle. Count = rows in `AlumnosXCursoXCiclo` for that `courseCycleId`,
ALL enrolled, NO `Student.active` filter.

**Approach (Option A)**: single `groupBy` aggregation on `AlumnosXCursoXCiclo` per request —
no N+1. Threaded: domain port → Prisma impl → `ListCourseCyclesUseCase` → controller DTO →
frontend column. `studentCount` is a presentation-derived field (NOT on the domain entity),
mirroring the existing `modality` threading pattern.

**Tenant isolation**: uses `TenantContext.getClient()` exclusively. No master DB access.

---

## Files changed

| File | Change |
|------|--------|
| `packages/domain/src/course-cycle/repositories/course-cycle-repository.ts` | Added `countEnrolledByCourseCycleIds(ids: string[]): Promise<Map<string, number>>` to domain port |
| `api/src/infrastructure/persistence/prisma/repositories/prisma-course-cycle.repository.ts` | Implemented with single `alumnosXCursoXCiclo.groupBy`; empty-ids guard |
| `api/src/infrastructure/persistence/prisma/repositories/prisma-course-cycle.repository.spec.ts` | Added `alumnosXCursoXCiclo.groupBy` to `makeMockClient`; 4 new test cases |
| `api/src/application/course-cycle/use-cases/course-cycle.use-cases.ts` | `ListCourseCyclesUseCase.execute` calls count and returns `{ ...result, studentCounts }` |
| `api/src/application/course-cycle/__tests__/course-cycle.use-cases.test.ts` | Added stub + 3 new test cases for threading |
| `api/src/presentation/course-cycle/course-cycle.controller.ts` | `toResponse` gets 4th param `studentCount?`; admin list threads `result.studentCounts.get(cc.uuid) ?? 0` |
| `api/src/presentation/course-cycle/__tests__/course-cycle.dto.test.ts` | 3 new test cases for `studentCount` |
| `api/src/presentation/course-cycle/__tests__/course-cycle-teacher-filter.controller.spec.ts` | `makeListResult` updated to include `studentCounts: new Map()` |
| `web/src/types/course-cycle.ts` | Added `studentCount?: number` to `CourseCycle` interface |
| `web/src/pages/dashboard/course-cycles.tsx` | `tableData` maps `studentCount: cc.studentCount ?? 0`; column `{ key: 'studentCount', header: 'Alumnos' }` |
| `web/src/pages/dashboard/__tests__/course-cycles.test.tsx` | 4 new test cases using `getByRole('columnheader')` and `getByRole('cell')` |

---

## Test results

| Suite | Tests | Result |
|-------|-------|--------|
| domain | 1114 | PASS |
| api | 1564 | PASS |
| web | 452 | PASS |
| **Total** | **3130** | **PASS** |

`pnpm build` — 442 files compiled, 0 TypeScript errors.

---

## Spec coverage

| Spec | Verdict |
|------|---------|
| EAL-S1 — Repository port contract | PASS |
| EAL-S2 — Infrastructure aggregation (no N+1) | PASS |
| EAL-S3 — Use-case threading | PASS |
| EAL-S4 — Response DTO (`studentCount`) | PASS |
| EAL-S5 — Frontend type | PASS |
| EAL-S6 — Frontend table column ("Alumnos") | PASS |
| EAL-S7 — No DB migration | PASS |

---

## Canonical spec merge

Delta spec merged into:
- `openspec/specs/course-cycle/spec.md`
  - CRUD Endpoints table: `GET /v1/course-cycles` annotated with `studentCount`
  - Frontend CRUD Page: "Alumnos" column added to table column list
  - New Requirement section `Enrolled Student Count in CursosXCiclo List` (EAL-S1 through EAL-S7)

---

## Deferred items (not implemented — follow-up needed)

1. **Gate "Asignar materias y competencias" button on `studentCount > 0`**  
   Now feasible since the list response carries `studentCount`. Documented as ADR-B4 in the
   bulk cascade section of `course-cycle/spec.md`. A new `/sdd-new` change is recommended.

2. **Teacher list path (`listTeacherCCsUC`) does not receive `studentCount`**  
   Explicitly out of scope. Teacher-facing list endpoints default to `0` via the unchanged
   `toResponse` call-sites. No action required.

---

## Engram artifact IDs (traceability)

| Artifact | Engram ID |
|----------|-----------|
| proposal | #1382 |
| spec | #1383 |
| design | #1384 |
| tasks | #1385 |
| apply-progress | #1387 |
| verify-report | #1388 |
| archive-report | (this document — saved to engram topic `sdd/columna-alumnos-activos/archive-report`) |

---

## Gotchas learned

- `as unknown as CourseCycleRepository` casts in test doubles do NOT trigger TS errors when a
  port method is added — only the real `implements` class does. Use-case threading tests MUST
  explicitly add the stub to the mock object.
- `screen.getByText('Alumnos')` is ambiguous in `course-cycles.tsx` because an "Alumnos" action
  button already exists per row. Use `getByRole('columnheader', { name: 'Alumnos' })` and
  `getByRole('cell', { name: 'N' })` for precise assertions.
- `course-cycle-teacher-filter.controller.spec.ts`'s `makeListResult` did not include
  `studentCounts`. After the use-case change, the controller calls `result.studentCounts.get(...)`
  which would crash. Fixed by adding `studentCounts: new Map()` to `makeListResult`.
