# Tasks — columna-alumnos-activos

**Change**: Add "Alumnos" enrolled-count column to the admin CursosXCiclo list.
**Delivery**: Single PR (fits within 400-line budget — see Review Workload Forecast below).
**TDD mode**: STRICT — write failing test first, then implement.
**Test command**: `pnpm test` | **Build**: `pnpm build` | **Coverage target**: ≥80%

---

## Review Workload Forecast

| Metric                       | Value                                      |
|------------------------------|--------------------------------------------|
| Source files changed         | 6                                          |
| Test files changed           | 4                                          |
| Estimated lines added/changed| ~225                                       |
| 400-line budget risk         | Low                                        |
| Chained PRs recommended      | No                                         |
| Decision needed before apply | No                                         |
| Notes                        | Read-only aggregation. No migration. No new Prisma model. Fits one PR. |

---

## Dependency order

All tasks are **sequential** through the layer stack. Each task is one coherent work unit (failing test → green impl → commit).

```
T-1 (port) → T-2 (infra+test) → T-3 (UC+test) → T-4 (ctrl+test) → T-5 (web+test)
```

No parallel execution — the port must compile before the impl, the impl must exist before the UC test can stub it, the UC must return `studentCounts` before the controller can thread it, and the API contract must be stable before the frontend test is meaningful.

---

## T-1 — Domain port: add `countEnrolledByCourseCycleIds`

**Spec ref**: S-1 (S-1-A, S-1-B, S-1-C)
**Status**: [x]

### What
Add the method signature to `CourseCycleRepository` (domain port).

### File
`packages/domain/src/course-cycle/repositories/course-cycle-repository.ts`

### Change
After the existing `findByUuids` method, insert:

```typescript
/**
 * Returns a Map of courseCycleId → enrolled student count, derived from
 * alumnosXCursoXCiclo bridge rows. Zero-enrollment CCs are absent from the Map
 * (callers MUST default missing keys to 0).
 * S-1: empty ids input → empty Map (no DB query).
 */
countEnrolledByCourseCycleIds(ids: string[]): Promise<Map<string, number>>;
```

### Test
No separate runtime test for a pure interface. TypeScript compilation (`pnpm --filter api typecheck`) enforces that the only `implements CourseCycleRepository` class (`PrismaCourseCycleRepository`) gains this method — TS errors if it does not.

### Commit
`feat(domain): add countEnrolledByCourseCycleIds port to CourseCycleRepository`

---

## T-2 — Prisma impl + repo tests

**Spec ref**: S-2 (S-2-A, S-2-B, S-2-C), S-1-B, S-1-C
**Status**: [x]
**Depends on**: T-1

### Test first
File: `api/src/infrastructure/persistence/prisma/repositories/prisma-course-cycle.repository.spec.ts`

Extend `makeMockClient()` with:
```typescript
alumnosXCursoXCiclo: {
  groupBy: vi.fn(),
},
```

Add a new `describe('countEnrolledByCourseCycleIds', ...)` block with these cases:

1. **Empty ids guard** — `ids = []` → returns `new Map()` without calling `groupBy`.
2. **Correct count map** — `groupBy` resolves with `[{ courseCycleId: 'cc-1', _count: { studentId: 2 } }]`; result Map has `'cc-1' → 2`.
3. **Single groupBy call** — spy confirms exactly one `groupBy` call for non-empty ids (S-2-A, no N+1).
4. **Absent CC not in Map** — CC uuid not present in `groupBy` result is absent from the returned Map (caller responsibility to default to 0).

### Implementation
File: `api/src/infrastructure/persistence/prisma/repositories/prisma-course-cycle.repository.ts`

Add method to `PrismaCourseCycleRepository`:

```typescript
async countEnrolledByCourseCycleIds(ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const rows = await this.client.alumnosXCursoXCiclo.groupBy({
    by: ['courseCycleId'],
    where: { courseCycleId: { in: ids } },
    _count: { studentId: true },
  });
  return new Map(rows.map((r) => [r.courseCycleId, r._count.studentId]));
}
```

### Commit
`feat(infra): implement countEnrolledByCourseCycleIds with single groupBy aggregation`

---

## T-3 — Use-case threading + tests

**Spec ref**: S-3 (S-3-A, S-3-B, S-3-C)
**Status**: [x]
**Depends on**: T-2

### Test first
File: `api/src/application/course-cycle/__tests__/course-cycle.use-cases.test.ts`

Add/extend `describe('ListCourseCyclesUseCase', ...)`:

1. **studentCounts threaded** — stub `countEnrolledByCourseCycleIds` on the `as unknown as` cast mock (add `countEnrolledByCourseCycleIds: vi.fn().mockResolvedValue(new Map([['cc-uuid-1', 3]]))`); call `execute({})`; assert result includes `studentCounts` Map with `'cc-uuid-1' → 3`.
2. **Page uuids used** — assert `countEnrolledByCourseCycleIds` was called with the uuids from `findAll`'s `data` array (NOT with filter params).
3. **Empty page** — `findAll` returns `data: []`; assert `countEnrolledByCourseCycleIds` called with `[]` (S-3-B).

> **Design trap**: The mock is cast with `as unknown as CourseCycleRepository`. TypeScript will NOT complain if `countEnrolledByCourseCycleIds` is absent from the object — but it will be `undefined` at runtime when the UC calls it. The stub MUST be added to the mock object before the test runs.

### Implementation
File: `api/src/application/course-cycle/use-cases/course-cycle.use-cases.ts`

`ListCourseCyclesUseCase.execute` (currently ~L292-294):

```typescript
async execute(filters: ListCourseCyclesInput) {
  const result = await this.courseCycleRepo.findAll(filters as CourseCycleFilters);
  const studentCounts = await this.courseCycleRepo.countEnrolledByCourseCycleIds(
    result.data.map((cc) => cc.uuid),
  );
  return { ...result, studentCounts };
}
```

### Commit
`feat(application): thread studentCounts through ListCourseCyclesUseCase`

---

## T-4 — Controller DTO + tests

**Spec ref**: S-4 (S-4-A, S-4-B, S-4-C)
**Status**: [x]
**Depends on**: T-3

### Test first
File: `api/src/presentation/course-cycle/__tests__/course-cycle.dto.test.ts`

Add test cases for `studentCount` in the list response:

1. **studentCount present** — mock `listUC.execute` to return `studentCounts: new Map([['cc-uuid-1', 5]])`; call the list endpoint; response item has `studentCount: 5` (S-4-B, S-4-C).
2. **absent key defaults to 0** — Map has no entry for the CC uuid; response item has `studentCount: 0` (S-4-A).
3. **teacher path defaults to 0** — listTeacherCCsUC path; response item has `studentCount: 0` (scope out).

### Implementation
File: `api/src/presentation/course-cycle/course-cycle.controller.ts`

**Step 1** — Extend `toResponse` signature (after `modality`):
```typescript
private toResponse(
  cc: { ... },
  academicCycleDates?: { ... } | null,
  modality?: number | null,
  studentCount?: number,        // ← add 4th param
)
```

Add `studentCount: studentCount ?? 0` to the returned object.

**Step 2** — Admin list path (currently ~L139-144): thread the count:
```typescript
data: result.data.map((cc) =>
  this.toResponse(cc, null, null, result.studentCounts.get(cc.uuid) ?? 0)
),
```

All other `toResponse` call-sites omit the 4th arg → default 0. No other call-site needs touching.

### Commit
`feat(presentation): add studentCount field to course-cycle list response DTO`

---

## T-5 — Frontend type + table column + tests

**Spec ref**: S-5 (S-5-A, S-5-B), S-6 (S-6-A, S-6-B, S-6-C, S-6-D)
**Status**: [x]
**Depends on**: T-4

### Test first
File: `web/src/pages/dashboard/__tests__/course-cycles.test.tsx`

Add test cases:

1. **Column header renders** — render the table; assert `screen.getByText('Alumnos')` is present (S-6-A).
2. **Row shows correct count** — mock API response with `studentCount: 7`; assert the cell renders `"7"` (S-6-B).
3. **Undefined count renders as 0** — mock API response without `studentCount` field; assert cell renders `"0"` (S-6-D).
4. **Zero renders as "0" not blank** — mock with `studentCount: 0`; assert `"0"` not empty (S-6-C).

### Implementation

**File 1**: `web/src/types/course-cycle.ts`

Add `studentCount?: number` to the `CourseCycle` interface (optional, backwards-compatible — S-5-A, S-5-B).

**File 2**: `web/src/pages/dashboard/course-cycles.tsx`

In `tableData` mapping (~L211): add `studentCount: cc.studentCount ?? 0`.

In the `columns` array (~L346-392): add after the last column:
```typescript
{ key: 'studentCount', header: 'Alumnos' }
```

No custom `render` fn — plain numeric display.

### Commit
`feat(web): add Alumnos enrolled-count column to course-cycles table`

---

## Summary checklist

| # | Task                              | Layer        | Test file(s)                                       | Depends on |
|---|-----------------------------------|--------------|----------------------------------------------------|------------|
| 1 | Add port method (interface only)  | domain       | TS compilation (typecheck)                         | —          |
| 2 | Prisma groupBy impl               | infra        | `prisma-course-cycle.repository.spec.ts`           | T-1        |
| 3 | UC: call port + return Map        | application  | `course-cycle.use-cases.test.ts`                   | T-2        |
| 4 | Controller: 4th param + DTO field | presentation | `course-cycle.dto.test.ts`                         | T-3        |
| 5 | Frontend type + column            | web          | `course-cycles.test.tsx`                           | T-4        |

**S-7 guard**: no `*.sql` or migration file may appear in this change. Verify before each commit.
