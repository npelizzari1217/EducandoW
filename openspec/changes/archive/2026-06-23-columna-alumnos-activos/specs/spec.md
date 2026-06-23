# Spec — columna-alumnos-activos

Schema: spec-driven  
RFC 2119 applies throughout this document.  
Scenarios use Given/When/Then format as required by `openspec/config.yaml`.

---

## Non-goals (explicit)

- Teacher list path (`listTeacherCCsUC`) SHALL NOT be modified in this change.
- `Student.active` / `Student.deletedAt` filtering SHALL NOT affect the count.
- Gating "Asignar materias y competencias" on `studentCount > 0` is deferred.
- No database migration is required or permitted by this change.
- Pedagogical level: **level-agnostic** — the count applies to all levels (INICIAL, PRIMARIO, SECUNDARIO, TERCIARIO) without distinction.

---

## S-1 — Repository port contract

### Requirement
The `CourseCycleRepository` domain port SHALL declare the method:

```
countEnrolledByCourseCycleIds(ids: string[]): Promise<Map<string, number>>
```

### Scenarios

**S-1-A: Method signature exists on the port**  
Given the domain port `CourseCycleRepository`  
When a consumer inspects its interface  
Then the method `countEnrolledByCourseCycleIds` MUST be present with the exact signature above.

**S-1-B: Empty input**  
Given `ids = []`  
When `countEnrolledByCourseCycleIds([])` is called  
Then the method SHALL return an empty `Map` (no error thrown).

**S-1-C: IDs with no enrollments**  
Given one or more valid `courseCycleId` values that have zero rows in `AlumnosXCursoXCiclo`  
When `countEnrolledByCourseCycleIds(ids)` is called  
Then the returned `Map` SHALL contain an entry for each `id` with value `0`  
OR the caller MUST treat a missing key as `0` (see S-4 default rule).

> Note: the implementation MAY omit zero-count IDs from the returned Map; the use-case MUST default missing keys to `0` (S-4-A). Both approaches are compliant.

---

## S-2 — Infrastructure aggregation (no N+1)

### Requirement
The Prisma implementation of `countEnrolledByCourseCycleIds` SHALL execute a single SQL aggregation for all requested IDs, using `groupBy` with `_count`. It SHALL NOT use `include: { _count }` on a per-row query.

The query SHALL target the **tenant** Prisma client (obtained via `TenantContext.getClient()`). It MUST NOT use the master Prisma client.

### Scenarios

**S-2-A: Single aggregation, not N+1**  
Given a page of N course-cycles  
When the admin list endpoint handles a request  
Then exactly ONE SQL aggregation query for `AlumnosXCursoXCiclo` SHALL be issued per request (verified by spy/mock in unit tests; in integration tests by Prisma call count).

**S-2-B: Correct count returned**  
Given `courseCycleId = "cc-1"` has 3 rows in `AlumnosXCursoXCiclo`  
And `courseCycleId = "cc-2"` has 0 rows  
When `countEnrolledByCourseCycleIds(["cc-1", "cc-2"])` is called  
Then the Map SHALL contain `"cc-1" → 3`  
And the Map entry for `"cc-2"` SHALL be `0` (or absent, relying on S-4-A).

**S-2-C: Tenant isolation**  
Given a multi-tenant deployment  
When `countEnrolledByCourseCycleIds` executes  
Then it SHALL use only the tenant Prisma client for the active request  
And SHALL NOT query master schema tables.

---

## S-3 — Use-case threading

### Requirement
`ListCourseCyclesUseCase.execute()` SHALL call `countEnrolledByCourseCycleIds` with the IDs of the course-cycles returned by `findAll()` for the current page, and SHALL return the resulting count map alongside the course-cycles list so the controller can stitch it in.

### Scenarios

**S-3-A: Count is threaded through**  
Given `findAll()` returns N course-cycles for a page  
When `execute()` completes  
Then the use-case output SHALL include a `studentCounts: Map<string, number>` keyed by `courseCycleId`  
And each key SHALL map to the enrolled student count from the repository.

**S-3-B: Empty page**  
Given `findAll()` returns `[]`  
When `execute()` completes  
Then `countEnrolledByCourseCycleIds` SHALL be called with `[]`  
And the use-case output SHALL include an empty map (no error).

**S-3-C: Repository throws**  
Given the repository raises an unexpected error  
When `execute()` is called  
Then the error SHALL propagate normally (no silent swallow); the use-case MUST NOT return a partial result with missing counts.

---

## S-4 — Response DTO (`studentCount` field)

### Requirement
Each item in the `GET /course-cycles` response DTO SHALL include `studentCount: number`.  
The value SHALL be a non-negative integer.  
It SHALL NOT be `null` or `undefined`.  
It SHALL NOT be omitted from the response.

### Scenarios

**S-4-A: Default to zero when count is missing**  
Given a course-cycle whose ID is not present in the `studentCounts` Map  
When the controller builds the response DTO  
Then `studentCount` SHALL be `0` (not `null`, not `undefined`, not missing).

**S-4-B: Correct positive count**  
Given a course-cycle with 7 enrolled students  
When the controller builds the response DTO  
Then `studentCount` SHALL be `7`.

**S-4-C: Field always present**  
Given ANY course-cycle item in the `GET /course-cycles` response  
When the response is serialised to JSON  
Then the field `studentCount` MUST be present as a JSON number.

---

## S-5 — Frontend type

### Requirement
The `CourseCycle` TypeScript interface in `web/src/types/course-cycle.ts` SHALL declare `studentCount?: number`.

### Scenarios

**S-5-A: Type accepts studentCount**  
Given a `CourseCycle` object received from the API  
When TypeScript compiles the assignment `const count = cc.studentCount ?? 0`  
Then there MUST be no type error.

**S-5-B: Type is optional (backwards-compatible)**  
Given older API responses or stubs without `studentCount`  
When assigned to the `CourseCycle` type  
Then TypeScript SHALL NOT error (the field is optional on the type).

---

## S-6 — Frontend table column

### Requirement
The admin `CursosXCiclo` table in `web/src/pages/dashboard/course-cycles.tsx` SHALL render an **"Alumnos"** column displaying the integer value of `studentCount` for each row.

### Scenarios

**S-6-A: Column header renders**  
Given the admin CursosXCiclo page renders  
When the table headers are inspected  
Then a header cell with text `"Alumnos"` MUST be present.

**S-6-B: Correct count rendered per row**  
Given a course-cycle row with `studentCount = 5`  
When the row renders  
Then the "Alumnos" cell SHALL display `"5"`.

**S-6-C: Zero renders as 0, not blank**  
Given a course-cycle row with `studentCount = 0`  
When the row renders  
Then the "Alumnos" cell SHALL display `"0"` (not empty, not `"-"`, not `null`).

**S-6-D: Missing count falls back to 0**  
Given a course-cycle where `studentCount` is `undefined` (e.g. a test stub)  
When the row renders  
Then the "Alumnos" cell SHALL display `"0"`.

---

## S-7 — No DB migration

### Requirement
This change SHALL NOT introduce any Prisma migration file or schema change.  
All data is read from existing tables and existing indexes.

### Scenario

**S-7-A: No migration artefact**  
Given the change is applied  
When `openspec/changes/columna-alumnos-activos/` is inspected  
Then no `*.sql` or `migration.ts` file SHALL exist in this change.

---

## Traceability matrix

| Spec | Requirement origin |
|------|--------------------|
| S-1  | Proposal Decision 2 (Option A), Clean Arch port-in-domain |
| S-2  | Proposal Decision 2 (no N+1), Decision 3 (tenant DB) |
| S-3  | Proposal scope: thread through use-case |
| S-4  | Proposal Decision 6 (empty-safe → 0), scope: DTO field |
| S-5  | Proposal scope: frontend type |
| S-6  | Proposal scope: "Alumnos" column |
| S-7  | Proposal Decision 4 (no migration) |
