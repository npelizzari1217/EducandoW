# Design — columna-alumnos-activos

Architectural HOW for adding a per-CourseCycle enrolled-student count to the admin
CursosXCiclo listing. Approach **Option A** (single `groupBy` aggregation) is already
chosen in the proposal (#1382). This document specifies exact signatures, integration
points, the threading flow, ADR-style decisions, and the TDD impact.

## Architecture approach

- **Pattern**: Clean / Hexagonal. The count is sourced through the existing
  `CourseCycleRepository` port (domain), implemented in infrastructure (Prisma),
  orchestrated in `ListCourseCyclesUseCase` (application), and serialized in the
  thin controller (`toResponse`).
- **Layering / boundaries**:
  - Domain port returns a **domain-friendly `Map<string, number>`**, never ORM types.
  - `studentCount` is a **presentation-derived field**. It is NOT added to the
    `CourseCycle` domain entity, NOT to `toDomain`, NOT to `toPersistence`. It is
    stitched into the wire DTO in the controller, exactly mirroring the existing
    `modality` precedent (parallel data computed via `findGradingContextsByUuids`
    and threaded through `toResponse`).
  - Single aggregation for the whole page → no N+1, list endpoint stays O(1) queries
    for the count (one extra query alongside the existing `findMany` + `count`).
- **Tenant scoping**: aggregation runs on `TenantContext.getClient()` only. The
  `AlumnosXCursoXCiclo` model lives in `prisma_tenant/schema.prisma`. No master/tenant
  mixing.

## Component map & data flow

```
web/course-cycles.tsx (column "Alumnos")
        │  GET /course-cycles
        ▼
CourseCycleController.list()  ── admin full-list path only ──┐
        │ calls listUC.execute(filters)                       │ threads counts into
        ▼                                                      │ toResponse(cc, null, null, count)
ListCourseCyclesUseCase.execute()                             │
        │ 1. findAll(filters)  → PaginatedResult<CourseCycle> │
        │ 2. countEnrolledByCourseCycleIds(page uuids) → Map  │
        │ returns { ...result, studentCounts: Map }           │
        ▼                                                      │
CourseCycleRepository (domain port)  ◄───────────────────────┘
        │ countEnrolledByCourseCycleIds(ids): Promise<Map<string,number>>
        ▼
PrismaCourseCycleRepository (infra)
        │ client.alumnosXCursoXCiclo.groupBy({ by:['courseCycleId'], where:{ in ids }, _count:{ studentId:true } })
        ▼
tenant DB · alumnos_x_curso_x_ciclo · @@index([courseCycleId])
```

## 1. Domain port addition

File: `packages/domain/src/course-cycle/repositories/course-cycle-repository.ts`

Add to the `CourseCycleRepository` interface:

```ts
/**
 * Returns enrolled-student counts for the given CourseCycle UUIDs.
 * Counts ALL AlumnosXCursoXCiclo bridge rows per courseCycleId (no Student.active
 * filter — every bridge row is an enrollment; consistent with enrolled-students.query).
 * Single grouped aggregation (no N+1). Empty input → empty Map (no DB query).
 * UUIDs with zero enrollments are ABSENT from the Map; callers default to 0.
 * Tenant scoping is via TenantContext.
 */
countEnrolledByCourseCycleIds(ids: string[]): Promise<Map<string, number>>;
```

### Implementors / consumers that MUST be updated (port-breakage audit)

Adding a method to a domain port breaks every class that `implements` it. Audit result:

- **MUST update (TypeScript WILL error otherwise)**:
  - `api/src/infrastructure/persistence/prisma/repositories/prisma-course-cycle.repository.ts`
    — the only class that `implements CourseCycleRepository`. Add the method (§2).
- **Will NOT break (verified)** — test doubles use `as unknown as CourseCycleRepository`
  casts, so a partial mock does not need the method to satisfy the compiler:
  - `api/src/application/course-cycle/__tests__/course-cycle.use-cases.test.ts:66`
  - `api/.../add-student-to-course-cycle.use-case.test.ts`,
    `remove-student-from-course-cycle.use-case.test.ts`,
    `student-observation/list-by-course.use-case.test.ts`,
    `pedagogy/competency.use-cases.test.ts`,
    `grading/list-teacher-course-cycles.use-case.spec.ts`.

  These compile fine today and will keep compiling. However, the **use-case test that
  exercises the new threading (§6) MUST add a stub** `countEnrolledByCourseCycleIds`
  on its mock, or the call will be `undefined` at runtime.

## 2. Prisma implementation

File: `api/src/infrastructure/persistence/prisma/repositories/prisma-course-cycle.repository.ts`

```ts
async countEnrolledByCourseCycleIds(ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();          // empty-ids guard: no DB query

  const rows = await this.client.alumnosXCursoXCiclo.groupBy({
    by: ['courseCycleId'],
    where: { courseCycleId: { in: ids } },
    _count: { studentId: true },
  });

  const result = new Map<string, number>();
  for (const row of rows) {
    result.set(row.courseCycleId, row._count.studentId);
  }
  return result;                                    // CCs with 0 enrollments are absent
}
```

- Hits existing `@@index([courseCycleId])` on `alumnos_x_curso_x_ciclo`.
- ONE SQL aggregation for the whole page — NOT `include: { _count: ... }` (that emits a
  per-row correlated subquery → SQL N+1).
- Prisma client accessor is `alumnosXCursoXCiclo` (model `AlumnosXCursoXCiclo`).
- The mock client factory in the spec (`makeMockClient`) must add an
  `alumnosXCursoXCiclo: { groupBy: vi.fn() }` branch.

## 3. Use case

File: `api/src/application/course-cycle/use-cases/course-cycle.use-cases.ts`
(`ListCourseCyclesUseCase`, currently lines 288–295)

```ts
async execute(filters: ListCourseCyclesInput) {
  const result = await this.courseCycleRepo.findAll(filters as CourseCycleFilters);
  const uuids = result.data.map((cc) => cc.uuid);          // page UUIDs, NOT filter params
  const studentCounts = await this.courseCycleRepo.countEnrolledByCourseCycleIds(uuids);
  return { ...result, studentCounts };
}
```

- Count by the **page result UUIDs** (`result.data`), never the filter params — only the
  rows actually returned for this page get counted, keeping the aggregation page-bounded.
- Augmented return shape:
  `PaginatedResult<CourseCycle> & { studentCounts: Map<string, number> }`.
- Empty page → `uuids = []` → repo returns empty Map (guarded, no DB hit).
- No `findByUuid` existence check needed (this is a list, not a single lookup).

## 4. Controller

File: `api/src/presentation/course-cycle/course-cycle.controller.ts`

**Admin full-tenant list path** (currently lines 130–144):

```ts
const result = await this.listUC.execute({ /* filters as today */ });
return {
  data: result.data.map((cc) =>
    this.toResponse(cc, null, null, result.studentCounts.get(cc.uuid) ?? 0),
  ),
  page: result.page,
  pageSize: result.pageSize,
  total: result.total,
};
```

**`toResponse` signature** — add an optional 4th param (after `modality`), mirroring the
`modality` threading pattern:

```ts
private toResponse(
  cc: { /* unchanged */ },
  academicCycleDates?: { /* unchanged */ } | null,
  modality?: number | null,
  studentCount?: number,            // NEW — presentation-derived, defaults to 0
) {
  // ...existing body...
  return {
    // ...existing fields...
    studentCount: studentCount ?? 0,   // missing/absent → 0
  };
}
```

- The teacher path and the ROOT-`teacherUserId` path (lines 117, 127) are **scope OUT**:
  they keep calling `toResponse(cycle, null, modality)` → `studentCount` defaults to `0`.
  This keeps the DTO shape uniform without computing counts on the teacher path.
- `studentCount` stays out of the domain entity — it only exists on the wire DTO.

## 5. Frontend

File: `web/src/types/course-cycle.ts` — add to the `CourseCycle` DTO interface:

```ts
studentCount?: number;   // enrolled-student count; admin list only, absent → treat as 0
```

File: `web/src/pages/dashboard/course-cycles.tsx`

- `tableData` mapping (line 211) — add the field:
  ```ts
  studentCount: cc.studentCount ?? 0,
  ```
- `Table` columns (lines 346–392) — add a simple numeric column, placed after
  `passingGrade` (or before `actions`):
  ```ts
  { key: 'studentCount', header: 'Alumnos' },
  ```
- No render function needed — plain numeric value (ui-patterns: simple numeric column).

## 6. TDD impact (Strict TDD active — test first)

| Test file | Cases to add (RED → GREEN) |
|-----------|----------------------------|
| `api/src/infrastructure/persistence/prisma/repositories/prisma-course-cycle.repository.spec.ts` | (a) empty `ids` → empty Map, no `groupBy` call; (b) `groupBy` result maps to correct `Map<uuid, count>`; (c) issues a single `groupBy` with `by:['courseCycleId']`, `where:{ courseCycleId:{ in:ids } }`, `_count:{ studentId:true }`; (d) CC absent from result → not in Map (caller defaults 0). Add `alumnosXCursoXCiclo.groupBy` to `makeMockClient`. |
| `api/src/application/course-cycle/__tests__/course-cycle.use-cases.test.ts` | `ListCourseCyclesUseCase` returns `studentCounts`; counts are requested for the page UUIDs (not filters); empty page → no/empty count call. Stub `countEnrolledByCourseCycleIds` on the existing `as unknown as CourseCycleRepository` mock. |
| `api/src/presentation/course-cycle/__tests__/course-cycle.dto.test.ts` (or controller spec) | `toResponse` includes `studentCount`; admin list threads the count from `result.studentCounts`; missing/absent UUID → `studentCount: 0`; teacher path → `studentCount: 0`. |
| `web/src/pages/dashboard/__tests__/course-cycles.test.tsx` | "Alumnos" column header renders; a row with `studentCount` shows the number; `studentCount` undefined → renders `0`. Update mock CC objects to include `studentCount`. |

Coverage target ≥ 80% (project rule). Run via `pnpm test`.

## 7. Confirmations

- **No DB migration**: read-only aggregation over existing table + existing
  `@@index([courseCycleId])`. Standard deploy.
- **Tenant-only**: `AlumnosXCursoXCiclo` is tenant schema; repo uses
  `TenantContext.getClient()` exclusively.
- **No N+1**: exactly one extra `groupBy` query per list request, regardless of page size.

## ADR-style decisions

### ADR-1 — Count method on `CourseCycleRepository`, not `AlumnosXCursoXCicloRepository`
- **Decision**: add `countEnrolledByCourseCycleIds` to `CourseCycleRepository`.
- **Rationale**: `ListCourseCyclesUseCase` already depends on `CourseCycleRepository`
  and nothing else; threading the count through the same port avoids injecting a second
  repository dependency into the list use case, and mirrors the existing
  `findGradingContextsByUuids` precedent (parallel CC-keyed lookup on the same port).
- **Rejected alternative**: put it on the existing
  `packages/domain/src/course-cycle/repositories/alumnos-x-curso-x-ciclo-repository.ts`
  (impl `prisma-alumnos-x-curso-x-ciclo.repository.ts`). Arguably "purer" since the
  aggregation is over that table, but it forces a second injected dependency into the
  list use case for a single derived number. Rejected for cohesion with the existing
  modality/grading-context threading already living on `CourseCycleRepository`.

### ADR-2 — `groupBy` aggregation, not `include: { _count }`
- **Decision**: single `groupBy` over the page UUIDs.
- **Rejected alternative**: Prisma `include: { _count: { select: { alumnosXCursoXCiclo: true } } }`
  on `findAll` — emits a correlated subquery per row (SQL N+1). Rejected.

### ADR-3 — `studentCount` is presentation-derived, not a domain field
- **Decision**: stitch `studentCount` in `toResponse` only; do not touch the
  `CourseCycle` entity / `toDomain` / `toPersistence`.
- **Rationale**: it is a query-time aggregate, not part of the CourseCycle's identity or
  invariants. Mirrors `modality` (also stitched in `toResponse`, not on the entity).

### ADR-4 — No `Student.active` filter
- **Decision**: count ALL bridge rows. `AlumnosXCursoXCiclo` has no status field; every
  row is an enrollment, consistent with `enrolled-students.query.ts`. (Baked in proposal.)

### ADR-5 — Map omits zero-count CCs; callers default to 0
- **Decision**: repo Map only contains CCs that have rows; use case returns the Map as-is;
  controller does `studentCounts.get(uuid) ?? 0`; frontend does `cc.studentCount ?? 0`.
- **Rationale**: empty-safe error handling — no throws anywhere in the count path
  (error-handling standard). A CC with zero students simply renders `0`.

## Deferred follow-up (record, do NOT implement)

Once `studentCount` is present in the admin list DTO, the
**"Asignar materias y competencias"** bulk-cascade button in `course-cycles.tsx`
(`btn-bulk-cascade-*`, lines 379–387) COULD be gated on `cc.studentCount > 0` for better
UX (today it is always-enabled per ADR-B4: empty CC → harmless no-op). This is the
`asignacion-cascade-masiva` follow-up. Out of scope for this change.
