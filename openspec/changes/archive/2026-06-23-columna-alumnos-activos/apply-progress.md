# Apply Progress — columna-alumnos-activos

**Batch**: 1 (first and only — all tasks complete)
**Mode**: Strict TDD (RED → GREEN per task)
**Test run**: `pnpm test` — 1564 API + 452 web = 2016 tests, all pass
**Build**: `pnpm build` — clean (no TypeScript errors)

---

## Task Status

- [x] T-1 — Domain port: `countEnrolledByCourseCycleIds` added to `CourseCycleRepository`
- [x] T-2 — Prisma impl + repo tests: `groupBy` aggregation, empty-ids guard, 4 spec cases
- [x] T-3 — Use-case threading + tests: `ListCourseCyclesUseCase` returns `{ ...result, studentCounts }`
- [x] T-4 — Controller DTO + tests: `toResponse` 4th param, admin list threads the Map, `studentCount: number` always emitted
- [x] T-5 — Frontend type + table column + tests: `studentCount?: number` in `CourseCycle`, `{ key: 'studentCount', header: 'Alumnos' }` column added

---

## Files Changed

| File | Change |
|------|--------|
| `packages/domain/src/course-cycle/repositories/course-cycle-repository.ts` | Added `countEnrolledByCourseCycleIds` port method |
| `api/src/infrastructure/persistence/prisma/repositories/prisma-course-cycle.repository.ts` | Implemented `countEnrolledByCourseCycleIds` with single `groupBy` |
| `api/src/infrastructure/persistence/prisma/repositories/prisma-course-cycle.repository.spec.ts` | Added `alumnosXCursoXCiclo.groupBy` to mock client; 4 new test cases |
| `api/src/application/course-cycle/use-cases/course-cycle.use-cases.ts` | `ListCourseCyclesUseCase.execute` now calls count port and returns `studentCounts` |
| `api/src/application/course-cycle/__tests__/course-cycle.use-cases.test.ts` | Added `countEnrolledByCourseCycleIds` stub to `makeMockRepo`; 3 new test cases |
| `api/src/presentation/course-cycle/course-cycle.controller.ts` | 4th param `studentCount?` on `toResponse`; admin list path threads the count |
| `api/src/presentation/course-cycle/__tests__/course-cycle.dto.test.ts` | 3 new test cases for `studentCount` in list response |
| `api/src/presentation/course-cycle/__tests__/course-cycle-teacher-filter.controller.spec.ts` | Fixed `makeListResult` to include `studentCounts: new Map()` |
| `web/src/types/course-cycle.ts` | Added `studentCount?: number` to `CourseCycle` interface |
| `web/src/pages/dashboard/course-cycles.tsx` | Added `studentCount` to tableData; added `Alumnos` column |
| `web/src/pages/dashboard/__tests__/course-cycles.test.tsx` | 4 new tests for Alumnos column (header + cell role assertions) |
| `openspec/changes/columna-alumnos-activos/tasks.md` | All tasks marked [x] |

---

## Lessons Learned

- Existing `course-cycle-teacher-filter.controller.spec.ts` had `makeListResult` returning plain `PaginatedResult` without `studentCounts`. Fixed by adding `studentCounts: new Map()` to the test helper.
- `screen.getByText('Alumnos')` would be ambiguous because the table already renders an "Alumnos" action button per row. Used `getByRole('columnheader', { name: 'Alumnos' })` and `getByRole('cell', { name: '8' })` for unambiguous assertions.
- S-7 guard satisfied: no migration files introduced.
