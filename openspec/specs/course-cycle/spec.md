# CourseCycle Specification

## Purpose

Vincula un Curso (`CourseSection`) con un `StudyPlan` y un `AcademicCycle` formando la entidad `CourseCycle`. Permite organizar, filtrar y cerrar los cursos por ciclo lectivo. Un ciclo cerrado (`active=false`) bloquea toda modificación propia y de sus dependencias.

---

## Requirements

### Requirement: CourseCycle Data Model

The system MUST persist each `CourseCycle` with the following fields:

| Field | Type | Constraint |
|-------|------|------------|
| `id` | Int PK | autoincrement |
| `courseId` | String FK | → CourseSection (UUID) |
| `studyPlanId` | String FK | → StudyPlan (UUID) |
| `cycleId` | String FK | → AcademicCycle (UUID) |
| `courseName` | String | UPPERCASE always |
| `level` | Enum | Inicial \| Primario \| Secundario \| Terciario |
| `active` | Boolean | default `true` |
| `passingGrade` | Float | 1..10 inclusive |
| `promotionText` | String | free text |
| `firstBimonthStart/End` | DateTime pair | **optional** (nullable), end > start when provided |
| `secondBimonthStart/End` | DateTime pair | **optional** (nullable), end > start when provided |
| `thirdBimonthStart/End` | DateTime pair | **optional** (nullable), end > start when provided |
| `fourthBimonthStart/End` | DateTime pair | **optional** (nullable), end > start when provided |
| `activeGradingPeriod` | Int? | nullable; explicit period override (1–4) |
| `lastModifiedAt` | DateTime | auto-updated on write |

The system MUST enforce a unique constraint on `(courseId, cycleId)`.
(Previously: all 8 bimester date fields were required — non-nullable; `activeGradingPeriod` field did not exist)

> **S3b-0 removal (2026-06-17):** The `homeroomTeacherId` column (FK `course_cycles_homeroom_teacher_id_fkey` SetNull → teachers, index `course_cycles_homeroom_teacher_id_idx`) was removed from `course_cycles` by migration `20260617120000_drop_homeroom_teacher_id`. The field is absent from the data model table above. Homeroom teacher resolution is now exclusively via `AsignacionCursoXCiclo(rol=TITULAR)` (see `teacher-identity-authz/spec.md` TIA-R5). Archive: `openspec/changes/archive/2026-06-17-retiro-homeroom-column-s3b0/`.

#### Scenario: Create a valid CourseCycle

- GIVEN a valid `courseId`, `studyPlanId`, `cycleId`, and all required fields
- WHEN `POST /v1/course-cycles` is called
- THEN the record is persisted with `active=true`, `courseName` in UPPERCASE, and `activeGradingPeriod=null`
- AND `lastModifiedAt` is set to the current timestamp

#### Scenario: Reject duplicate (courseId, cycleId)

- GIVEN a `CourseCycle` already exists for `(courseId, cycleId)`
- WHEN `POST /v1/course-cycles` is called with the same pair
- THEN the system returns `CourseCycleAlreadyExistsError` (HTTP 409)
- AND no record is created

#### Scenario: Create CourseCycle without bimester dates — dates inherited from AcademicCycle

- GIVEN a valid `cycleId` pointing to an `AcademicCycle` that has all 8 bimester dates set
- AND the request body does NOT include any bimester date fields
- WHEN `POST /v1/course-cycles` is called
- THEN the record is persisted with all 8 bimester date fields as `null`
- AND the effective bimester dates in GET responses are those from the AcademicCycle

#### Scenario: Create CourseCycle with own bimester dates — own dates take precedence

- GIVEN a valid `cycleId` pointing to an `AcademicCycle` that has bimester dates set
- AND the request body includes all 8 bimester dates
- WHEN `POST /v1/course-cycles` is called
- THEN the record is persisted with the provided bimester dates
- AND the effective bimester dates in GET responses are those from the CourseCycle itself

---

### Requirement: Value Object — CourseName

The system MUST normalize `courseName` to uppercase before persistence. The system MUST reject empty or whitespace-only names.

#### Scenario: Name with lowercase letters is normalized

- GIVEN a create or update request with `courseName: "matemática"`
- WHEN the use case processes the input
- THEN `courseName` is stored as `"MATEMÁTICA"`

#### Scenario: Empty name is rejected

- GIVEN a create request with `courseName: ""`
- WHEN the use case processes the input
- THEN the system returns a validation error
- AND no record is created

---

### Requirement: Value Object — PassingGrade

The system MUST accept `passingGrade` values between 1 and 10 inclusive. The system MUST reject values outside this range.

#### Scenario: Valid passing grade is accepted

- GIVEN `passingGrade: 6`
- WHEN a CourseCycle is created
- THEN the grade is stored without modification

#### Scenario: Out-of-range grade is rejected

- GIVEN `passingGrade: 0` or `passingGrade: 11`
- WHEN a CourseCycle is created or updated
- THEN the system returns a validation error
- AND no record is written

---

### Requirement: Value Object — BimonthPeriod

Each provided bimester pair MUST satisfy `end > start`. The system MUST reject pairs where `end <= start`. If neither date in a pair is provided, the pair is treated as absent (null). Partial pairs (only start or only end) MUST be rejected.
(Previously: all 8 bimester fields were required; now all are optional — but if provided, end > start rule still applies)

#### Scenario: Valid bimester period is accepted

- GIVEN `firstBimonthStart: 2026-03-01` and `firstBimonthEnd: 2026-04-30`
- WHEN a CourseCycle is created
- THEN both dates are stored

#### Scenario: Invalid bimester period is rejected

- GIVEN `firstBimonthStart: 2026-04-30` and `firstBimonthEnd: 2026-03-01` (end ≤ start)
- WHEN a CourseCycle is created or updated
- THEN the system returns a `BimonthPeriodInvalidError`
- AND no record is written

#### Scenario: Partial bimester pair is rejected

- GIVEN `firstBimonthStart: 2026-03-01` is provided but `firstBimonthEnd` is absent
- WHEN a CourseCycle is created or updated
- THEN the system returns a validation error

#### Scenario: No bimester dates provided — stored as null

- GIVEN no bimester date fields are included in the request
- WHEN a CourseCycle is created
- THEN all 8 bimester fields are stored as `null`

---

### Requirement: CourseCycle — activeGradingPeriod Field

The system MUST persist `activeGradingPeriod` as a nullable integer on `CourseCycle`. This field stores an explicit period override set by the user. When `null`, the resolved period is calculated from effective bimester dates via `GradingPeriodCalculator`. The field MUST be writable only through `PATCH /v1/course-cycles/:id/grading-period`.

| Field | Type | Constraint |
|-------|------|------------|
| `activeGradingPeriod` | Int? | nullable, 1–4; set via grading-period endpoint only |

#### Scenario: CourseCycle created — activeGradingPeriod defaults to null

- GIVEN a valid create request for `CourseCycle`
- WHEN `POST /v1/course-cycles` is called
- THEN the new record has `activeGradingPeriod=null`

#### Scenario: General PATCH does not accept activeGradingPeriod

- GIVEN a `PATCH /v1/course-cycles/:id` request body that includes `activeGradingPeriod`
- WHEN the use case processes the input
- THEN `activeGradingPeriod` is ignored and NOT persisted via this endpoint
- AND the field MUST only be set through `PATCH /v1/course-cycles/:id/grading-period`

---

### Requirement: CourseCycle — getCurrentPeriod() Domain Method

The system MUST provide a `getCurrentPeriod()` method on the `CourseCycle` entity. It MUST return `activeGradingPeriod` if set (non-null). If `activeGradingPeriod` is `null`, it MUST delegate to `GradingPeriodCalculator.currentPeriod()` using the effective bimester dates (own dates if set, otherwise AcademicCycle dates). It MUST return `null` when no period can be resolved.

#### Scenario: getCurrentPeriod returns explicit value

- GIVEN a `CourseCycle` with `activeGradingPeriod=3`
- WHEN `courseCycle.getCurrentPeriod()` is called
- THEN it returns `3` without invoking the calculator

#### Scenario: getCurrentPeriod delegates to calculator when no override

- GIVEN a `CourseCycle` with `activeGradingPeriod=null` and today within bimester 2 range
- WHEN `courseCycle.getCurrentPeriod()` is called
- THEN it returns `2` (from the calculator)

#### Scenario: getCurrentPeriod returns null when outside all ranges

- GIVEN a `CourseCycle` with `activeGradingPeriod=null` and today outside all bimester ranges
- WHEN `courseCycle.getCurrentPeriod()` is called
- THEN it returns `null`

---

### Requirement: Active/Inactive Guard

The system MUST reject any modification to a `CourseCycle` where `active=false` with a `CourseCycleClosedError` (HTTP 409). The only allowed operations on a closed record are read and explicit reactivation via `PATCH /:id/activate`.

#### Scenario: Update blocked when cycle is closed

- GIVEN a `CourseCycle` with `active=false`
- WHEN `PATCH /v1/course-cycles/:id` is called
- THEN the system returns `CourseCycleClosedError` (HTTP 409)
- AND the record is not modified

#### Scenario: Delete blocked when cycle is closed

- GIVEN a `CourseCycle` with `active=false`
- WHEN `DELETE /v1/course-cycles/:id` is called
- THEN the system returns `CourseCycleClosedError` (HTTP 409)

#### Scenario: Deactivate an active CourseCycle

- GIVEN a `CourseCycle` with `active=true`
- WHEN `PATCH /v1/course-cycles/:id/deactivate` is called
- THEN `active` is set to `false` and `lastModifiedAt` is updated

#### Scenario: Reactivate a closed CourseCycle

- GIVEN a `CourseCycle` with `active=false`
- WHEN `PATCH /v1/course-cycles/:id/activate` is called
- THEN `active` is set to `true` and `lastModifiedAt` is updated

---

### Requirement: Bulk Generate CourseCycles

The system MUST expose `POST /v1/course-cycles/generate`. Given a `cycleId` and an optional `studyPlanId`, it MUST perform a per-course UPSERT: if a `CourseCycle` for `(courseId, cycleId)` already exists it MUST update `courseName`; if it does not exist it MUST create it. The system MUST derive `level` via `Level.fromParts(plan.level, plan.modality)` — it MUST NOT hardcode any level value. When `studyPlanId` is absent, the system MUST process ALL active `StudyPlan` records whose composite level matches the `level` filter. The system MUST return `{ created, updated, total }`. Generated records MUST store `null` for all bimester fields — effective dates are resolved from the AcademicCycle at read time.
(Previously: `studyPlanId` was required; duplicates were silently skipped (no update); `level` was hardcoded to `buildLevel('PRIMARIO')`; response was `{ created, skipped, total }`)

#### Scenario: All courses generated — none pre-exist

- GIVEN a `StudyPlan` with 5 courses and a valid `AcademicCycle`, and none are registered yet
- WHEN `POST /v1/course-cycles/generate` is called with `{ studyPlanId, cycleId }`
- THEN 5 `CourseCycle` records are created with bimester fields as `null`
- AND the response is `{ created: 5, updated: 0, total: 5 }`

#### Scenario: Some courses already exist — courseName is updated

- GIVEN a `StudyPlan` with 5 courses and 2 already have a `CourseCycle` for `cycleId`
- WHEN `POST /v1/course-cycles/generate` is called with `{ studyPlanId, cycleId }`
- THEN 3 new records are created and 2 existing records have `courseName` updated
- AND the response is `{ created: 3, updated: 2, total: 5 }`

#### Scenario: Level derived from plan — not hardcoded

- GIVEN a `StudyPlan` with `level=2` (PRIMARIO) and `modality=1`
- WHEN `POST /v1/course-cycles/generate` is called
- THEN each generated `CourseCycle` has `level = 21` (`Level.fromParts(2, 1)`)
- AND NOT the hardcoded `buildLevel('PRIMARIO')` value

#### Scenario: studyPlanId absent — all plans for the level are processed

- GIVEN a `level` filter value and a valid `cycleId`, and no `studyPlanId` is provided
- AND there are 3 active `StudyPlan` records matching that composite level
- WHEN `POST /v1/course-cycles/generate` is called with `{ level, cycleId }`
- THEN the system processes all courses from all 3 plans
- AND returns `{ created, updated, total }` aggregated across all plans

#### Scenario: studyPlanId absent — no plans found for level

- GIVEN a `level` filter value and no `StudyPlan` records match it
- WHEN `POST /v1/course-cycles/generate` is called with `{ level, cycleId }`
- THEN the system returns `{ created: 0, updated: 0, total: 0 }`
- AND no error is raised

#### Scenario: StudyPlan not found

- GIVEN a non-existent `studyPlanId`
- WHEN `POST /v1/course-cycles/generate` is called
- THEN the system returns HTTP 404 with `StudyPlanNotFoundError`

#### Scenario: AcademicCycle not found

- GIVEN a non-existent `cycleId`
- WHEN `POST /v1/course-cycles/generate` is called
- THEN the system returns HTTP 404 with `AcademicCycleNotFoundError`

#### Scenario: AcademicCycle is inactive

- GIVEN an `AcademicCycle` with `active=false`
- WHEN `POST /v1/course-cycles/generate` is called with that `cycleId`
- THEN the system returns `AcademicCycleClosedError` (HTTP 409)
- AND no records are created or updated

---

### Requirement: CRUD Endpoints

The system MUST expose the following REST endpoints:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/course-cycles` | List with filters; paginated; ordered by `courseName ASC` |
| GET | `/v1/course-cycles/:id` | Get by ID — returns effective bimester dates + `modality` (Fase 3b) |
| POST | `/v1/course-cycles` | Create |
| PATCH | `/v1/course-cycles/:id` | Update (blocked if `active=false`) |
| DELETE | `/v1/course-cycles/:id` | Soft delete (blocked if `active=false`) |
| PATCH | `/v1/course-cycles/:id/deactivate` | Set `active=false` |
| PATCH | `/v1/course-cycles/:id/activate` | Set `active=true` |
| POST | `/v1/course-cycles/generate` | Bulk generate |
| GET | `/v1/course-cycles/:id/grading-period` | Get active grading period with source |
| PATCH | `/v1/course-cycles/:id/grading-period` | Set or clear explicit period override |
| GET | `/v1/course-cycles/:uuid/students` | List enrolled students for the cycle (Fase 3b) |

`GET /v1/course-cycles` MUST support query filters: `?level=`, `?cycleId=`, `?active=`. Filters SHOULD be combinable. The response for GET (single and list) MUST include `effectiveBimonthDates` — the CourseCycle's own dates if not null, otherwise those of the linked AcademicCycle.
(Previously: no `effectiveBimonthDates` in response; bimester dates were always own fields; grading-period endpoints did not exist)

`GET /v1/course-cycles/:uuid` (single) MUST also include `modality` as a NUMERIC code in its response (added Fase 3b — see Requirement: modality in CourseCycle Single Response below).

#### Scenario: GET CourseCycle without own dates — returns AcademicCycle dates as effective

- GIVEN a `CourseCycle` with all bimester fields `null`
- AND its linked `AcademicCycle` has `firstBimStart: 2026-03-01` and `firstBimEnd: 2026-04-30`
- WHEN `GET /v1/course-cycles/:id` is called
- THEN `effectiveBimonthDates.firstBimonthStart` is `2026-03-01`
- AND `effectiveBimonthDates.firstBimonthEnd` is `2026-04-30`
- AND `ownBimonthDates` fields are all `null`

#### Scenario: GET CourseCycle with own dates — returns own dates as effective

- GIVEN a `CourseCycle` with `firstBimonthStart: 2026-04-01` and `firstBimonthEnd: 2026-05-15`
- AND its linked `AcademicCycle` has different dates for the first bimester
- WHEN `GET /v1/course-cycles/:id` is called
- THEN `effectiveBimonthDates.firstBimonthStart` is `2026-04-01`
- AND `effectiveBimonthDates.firstBimonthEnd` is `2026-05-15`

#### Scenario: List with combined filters

- GIVEN CourseCycles with mixed levels and cycles
- WHEN `GET /v1/course-cycles?level=Primario&cycleId=abc&active=true` is called
- THEN only records matching all three filters are returned
- AND results are ordered by `courseName ASC`
- AND the response includes pagination metadata (`page`, `pageSize`, `total`)
- AND each record includes `effectiveBimonthDates`

#### Scenario: Get by ID — not found

- GIVEN no `CourseCycle` exists with `id=999`
- WHEN `GET /v1/course-cycles/999` is called
- THEN the system returns HTTP 404 with `CourseCycleNotFoundError`

---

### Requirement: modality in CourseCycle Single Response (Fase 3b)

> Added: competency-grading-ui Fase 3b (2026-06-09). Archive: `openspec/changes/archive/2026-06-09-competency-grading-ui/specs/course-cycle-modality/spec.md`

`GET /v1/course-cycles/:uuid` MUST include `modality` in its response body.

The response MUST contain at minimum:

```json
{
  "uuid": "<uuid>",
  "level": "<number>",
  "modality": "<number|null>",
  "studyPlanId": "<id>"
}
```

`level` and `modality` are NUMERIC codes (resolved via `findGradingContextByUuid`), NOT
strings. The frontend maps codes → labels for display. All fields present before this
change remain present and unchanged. `modality` MUST NOT be `null` if the CourseCycle
record has a modality value.

#### Scenario CCM-1: Response includes modality field

- GIVEN a CourseCycle with uuid="cc-1", level code 2 (PRIMARIO), modality code 0 (COMUN)
- WHEN `GET /v1/course-cycles/cc-1`
- THEN HTTP 200 is returned
- AND the response body contains `"modality": 0` (numeric code)
- AND `"level": 2` is also present (existing field, unchanged)

#### Scenario CCM-2: CourseCycle not found — behavior unchanged

- GIVEN no CourseCycle with uuid="cc-none"
- WHEN `GET /v1/course-cycles/cc-none`
- THEN HTTP 404 is returned (no change to error behavior)

---

### Requirement: Enrolled Students for a CourseCycle (Fase 3b)

> Added: competency-grading-ui Fase 3b (2026-06-09). Archive: `openspec/changes/archive/2026-06-09-competency-grading-ui/specs/students-by-cycle/spec.md`

The system MUST expose:

```
GET /v1/course-cycles/:uuid/students
```

**Response shape** (HTTP 200) — wrapped in `{ data }` per project convention:

```json
{
  "data": [
    {
      "studentId": "<uuid or id>",
      "firstName": "<string>",
      "lastName": "<string>"
    }
  ]
}
```

The list is DERIVED from the existing internal `findEnrolledStudentIds` logic — there is
no explicit Enrollment→CourseCycle FK until Fase 4. This is intentional. Empty list is a
valid response (HTTP 200 `{ "data": [] }`).

CourseCycle not found → HTTP 404.

**HTTP mapping**:

| Situation                                | HTTP Status |
|------------------------------------------|-------------|
| Students returned (including empty list) | 200 OK      |
| CourseCycle uuid not found               | 404         |

#### Scenario SBC-1: Happy path — returns enrolled students

- GIVEN CourseCycle with uuid="cc-1" exists and has 3 enrolled students
- WHEN `GET /v1/course-cycles/cc-1/students`
- THEN HTTP 200 is returned with a list of 3 entries
- AND each entry contains `studentId`, `firstName`, `lastName`

#### Scenario SBC-2: Course cycle not found → 404

- GIVEN no CourseCycle with uuid="cc-nonexistent"
- WHEN `GET /v1/course-cycles/cc-nonexistent/students`
- THEN HTTP 404 is returned

#### Scenario SBC-3: Course cycle with no enrolled students → empty list, not 404

- GIVEN CourseCycle with uuid="cc-empty" exists but has no enrolled students
- WHEN `GET /v1/course-cycles/cc-empty/students`
- THEN HTTP 200 is returned with `{ "data": [] }`

---

### Requirement: Frontend CRUD Page

The system MUST provide a page at `/course-cycles` with:
- A filterable table: columns `courseName`, `level`, `cycle name`, `active` (badge), `passingGrade`, action buttons (edit, toggle active)
- Filter controls: combobox for `level` (composite LevelType 10–40), combobox for `cycleId`, combobox for `studyPlanId` (optional), toggle for `active/inactive`
- A "Generar Cursos" button that is enabled only when both `level` and `cycleId` filters are selected; it MUST call `POST /v1/course-cycles/generate` directly using the current filter values — NO modal dialog
- A create/edit form with all fields; bimester date fields are OPTIONAL
- The table MUST always display `courseName`; it MUST NOT display internal IDs
- The form MUST indicate when bimester dates are inherited from the cycle (shown as inherited, editable to override)
- The component `GenerateCourseCyclesModal` and the "Nuevo Curso por Ciclo" button MUST NOT exist

(Previously: "Generar cursos" opened a modal with `StudyPlan` selector + `AcademicCycle` selector; `studyPlanId` filter was absent from the page; modal `GenerateCourseCyclesModal` existed; response toast showed `{ created, skipped, total }`)

#### Scenario: "Generar Cursos" button disabled without required filters

- GIVEN the page is loaded but `level` or `cycleId` filter is not selected
- THEN the "Generar Cursos" button is disabled
- AND no request is sent

#### Scenario: "Generar Cursos" submits with required filters only

- GIVEN the user has selected `level` and `cycleId` but NOT `studyPlanId`
- WHEN the user clicks "Generar Cursos"
- THEN `POST /v1/course-cycles/generate` is called with `{ level, cycleId }` (no `studyPlanId`)
- AND the table refreshes showing the created/updated records
- AND a success toast displays `{ created, updated, total }`

#### Scenario: "Generar Cursos" submits with all three filters

- GIVEN the user has selected `level`, `cycleId`, and `studyPlanId`
- WHEN the user clicks "Generar Cursos"
- THEN `POST /v1/course-cycles/generate` is called with `{ level, cycleId, studyPlanId }`
- AND the table refreshes
- AND a success toast displays `{ created, updated, total }`

#### Scenario: Table filters update results

- GIVEN the page is loaded with results
- WHEN the user selects `level=Secundario` and toggles `active=true`
- THEN the table re-fetches with `?level=Secundario&active=true`
- AND only matching records are displayed

#### Scenario: Form shows inherited dates when CourseCycle has none

- GIVEN the user opens the edit form for a CourseCycle with no own bimester dates
- THEN the bimester date fields show the AcademicCycle's dates as placeholder/inherited values
- AND the user can override them by entering own values

---

### Requirement: Materias & Competencias Cascade — Single Student (existing)

> This operation predates the `asignacion-cascade-masiva` change (2026-06-23).
> Implemented as `cascade-student-materias-competencias.use-case.ts`.

`POST /course-cycles/:ccId/alumnos/:id/cascade` materializes `MateriasXAlumnoXCursoXCiclo`
and `CompetenciaXMateriaXAlumnoXCursoXCiclo` rows for a single enrolled student of a
CourseCycle. The operation is idempotent (skipDuplicates). Auth guard:
`@Roles('ROOT', { module: 'COURSE_CYCLES', action: 'UPDATE' })`.

This use case MUST NOT be modified by any bulk cascade change. The two endpoints coexist
independently; the per-student variant remains available for targeted re-runs.

---

### Requirement: Materias & Competencias Cascade — Bulk (All Enrolled Students)

> Added by `asignacion-cascade-masiva`, 2026-06-23.
>
> ADR-B3: Plain return value (no `Result<T,E>`) — consistent with the per-student UC which
>   also uses plain return + throw, not Result monad. Best-effort intent is satisfied at
>   iteration level via per-student try/catch + `studentsFailed` counter.
> ADR-B4: Button is always-enabled. The `GET /course-cycles` response carries no student
>   count column. An empty CC is a harmless zero no-op (HTTP 200, all fields = 0).
>   Future coupling note: when the planned "active-students count column" feature lands,
>   the button COULD be gated on count > 0 — this is a known, accepted future decision point.
> ADR-B5: NestJS route order is forced. `POST /alumnos/cascade` MUST be declared BEFORE
>   `POST /alumnos/:id/cascade`; otherwise NestJS matches the literal segment "cascade" as
>   the dynamic `:id` parameter (same precedent as /printable before /:id/printable).
> Deploy: code-only change. No DB migration, no new tables, no Prisma schema changes.
>   Safe standard deploy via deploy.ps1.

A single HTTP call SHALL materialize `MateriasXAlumnoXCursoXCiclo` and
`CompetenciaXMateriaXAlumnoXCursoXCiclo` rows for EVERY enrolled student of a given
CourseCycle, replacing the need to invoke the per-student endpoint one-by-one.

#### BCC-R1 — Endpoint & Route Registration

- The system SHALL expose `POST /course-cycles/:ccId/alumnos/cascade` as the bulk cascade
  endpoint.
- This route MUST be registered in the NestJS router BEFORE
  `POST /course-cycles/:ccId/alumnos/:id/cascade` (ADR-B5).
- The bulk endpoint SHALL require the same role/permission guards as the per-student endpoint
  (`@Roles('ROOT', { module: 'COURSE_CYCLES', action: 'UPDATE' })`).
- Unauthenticated or unauthorized requests SHALL receive HTTP 401/403 and SHALL NOT mutate
  any data.

#### BCC-R2 — Idempotency

- Both `MateriasXAlumnoXCursoXCiclo` and `CompetenciaXMateriaXAlumnoXCursoXCiclo` rows
  SHALL be created with `skipDuplicates: true`.
- Re-running the endpoint on a fully-populated CourseCycle SHALL return HTTP 200 with
  `materiasCreated = 0`, `competenciasCreated = 0`, and SHALL NOT modify any pre-existing row.
- `CompetenciaPeriodo` (grade) rows SHALL NEVER be touched (ADR-7).

#### BCC-R3 — Partial Failure (Best-Effort)

- If one student's cascade throws, the operation SHALL continue processing the remaining
  students.
- The failed student SHALL be counted in `studentsFailed`; the operation SHALL NOT propagate
  a top-level exception.
- The overall HTTP response SHALL be 200 regardless of partial failures.

#### BCC-R4 — Response Shape

```typescript
{
  data: {
    studentsProcessed:   number;  // students whose cascade succeeded
    studentsFailed:      number;  // students whose cascade threw
    materiasCreated:     number;  // MateriasXAlumnoXCursoXCiclo rows inserted
    materiasSkipped:     number;  // skipped (already existed)
    competenciasCreated: number;  // CompetenciaXMateriaXAlumnoXCursoXCiclo rows inserted
    competenciasSkipped: number;  // skipped (already existed)
  }
}
```

#### BCC-R5 — Empty CourseCycle

When a CourseCycle has zero enrolled students, the endpoint SHALL return HTTP 200 with all
response fields equal to `0`. It SHALL NOT return an error.

#### BCC-R6 — Use Case Design Constraints

- Resides in `api/src/application/course-cycle/cascade-all-students-materias-competencias.use-case.ts`.
- Calls `findByCourseCycle(ccId)` exactly ONCE for enrolled students.
- Calls `findByCourseCycleId(ccId)` exactly ONCE for materias, filtering `esOptativa = false`.
- Resolves active competencies once per unique `studyPlanSubjectId` (not once per student).
- MUST NOT delegate to the per-student use case (avoids N+1 `findById` per student).
- Uses the same 5 existing repository ports as the per-student UC — no new ports required.

#### BCC-R7 — Frontend — Bulk Cascade Button

- A button labelled "Asignar materias y competencias" SHALL appear in the course-row action
  group of `web/src/pages/dashboard/course-cycles.tsx`.
- The button SHALL be always-enabled in idle state (ADR-B4). It is disabled only while a
  request is in-flight for that specific course row.
- Clicking the enabled button SHALL present a confirmation dialog before any HTTP request
  is issued.
- After user confirmation, the button SHALL enter a loading/disabled state for the duration
  of the request; no other course-row action SHALL be blocked.
- On success: a toast SHALL display the aggregated counts from the response.
- On failure (non-2xx or network error): an error toast SHALL be shown.

#### SC-01 — Happy path: N students, no prior data

```
Given a CourseCycle ccId with N enrolled students (N > 0)
  And none of the students have MateriasXAlumnoXCursoXCiclo rows
  And none of the students have CompetenciaXMateriaXAlumnoXCursoXCiclo rows
When POST /course-cycles/:ccId/alumnos/cascade is called with valid auth
Then HTTP 200 is returned
  And response.data.studentsProcessed == N
  And response.data.studentsFailed == 0
  And response.data.materiasCreated == N × (non-optativa materia count)
  And response.data.competenciasCreated == N × (total active competencies of non-optativa materias)
```

#### SC-02 — Idempotency: re-run on fully populated course

```
Given a CourseCycle where all students already have materias and competencias assigned
When POST /course-cycles/:ccId/alumnos/cascade is called again
Then HTTP 200 is returned
  And response.data.materiasCreated == 0
  And response.data.competenciasCreated == 0
  And response.data.materiasSkipped > 0
  And response.data.competenciasSkipped > 0
  And no pre-existing row is modified or deleted
```

#### SC-03 — Grade preservation (ADR-7)

```
Given a student in ccId with existing CompetenciaPeriodo rows (grades)
When POST /course-cycles/:ccId/alumnos/cascade is called
Then all CompetenciaPeriodo rows are unchanged after the operation
  And no CompetenciaPeriodo rows are deleted or updated
```

#### SC-04 — Partial failure: one student throws

```
Given a CourseCycle with 3 enrolled students
  And the cascade for student B is configured to throw an error
When POST /course-cycles/:ccId/alumnos/cascade is called
Then HTTP 200 is returned
  And response.data.studentsProcessed == 2
  And response.data.studentsFailed == 1
  And students A and C have their rows created correctly
```

#### SC-05 — Empty course

```
Given a CourseCycle with 0 enrolled students
When POST /course-cycles/:ccId/alumnos/cascade is called
Then HTTP 200 is returned
  And response.data == { studentsProcessed: 0, studentsFailed: 0,
      materiasCreated: 0, materiasSkipped: 0,
      competenciasCreated: 0, competenciasSkipped: 0 }
```

#### SC-06 — Route disambiguation: bulk route not shadowed

```
Given the NestJS router registers:
  - POST /course-cycles/:ccId/alumnos/cascade  → BulkCascadeHandler (declared first)
  - POST /course-cycles/:ccId/alumnos/:id/cascade → PerStudentCascadeHandler
When a request arrives at POST /course-cycles/abc123/alumnos/cascade
Then it is dispatched to BulkCascadeHandler
  And PerStudentCascadeHandler is NOT invoked
  And the :id param is NOT set to "cascade"
```

> This scenario MUST have a dedicated controller unit test confirming the routing
> decision via prototype method order (C-13 in the controller spec).

#### SC-07 — Authorization: unauthenticated request rejected

```
Given no authentication token is present
When POST /course-cycles/:ccId/alumnos/cascade is called
Then HTTP 401 or 403 is returned
  And no MateriasXAlumnoXCursoXCiclo rows are created
  And no CompetenciaXMateriaXAlumnoXCursoXCiclo rows are created
```

#### SC-08 — Authorization: authorized role mirrors per-student cascade

```
Given a user with the same role that can call POST /course-cycles/:ccId/alumnos/:id/cascade
When POST /course-cycles/:ccId/alumnos/cascade is called
Then the request is authorized (not rejected with 401/403)
```

#### SC-09 — Optativas excluded

```
Given a CourseCycle with materias where some have esOptativa = true
When POST /course-cycles/:ccId/alumnos/cascade is called
Then only MateriasXAlumnoXCursoXCiclo rows for esOptativa = false materias are created
  And no MateriasXAlumnoXCursoXCiclo row is created for any optativa materia
```

#### SC-10 — Active competencies only

```
Given a CourseCycle with materias whose study-plan subjects have both active
      and inactive competencias
When POST /course-cycles/:ccId/alumnos/cascade is called
Then only CompetenciaXMateriaXAlumnoXCursoXCiclo rows for active competencias are created
  And no row is created for inactive competencias
```

#### SC-11 — Frontend: button always-enabled in idle (ADR-B4)

```
Given a course row rendered in CursosXCiclo (any alumnosCount)
Then the "Asignar materias y competencias" button is present in the DOM
  And the button is NOT disabled in its idle state
  And an empty CC (zero students) produces a successful zero-result response, not an error
```

#### SC-12 — Frontend: confirmation cancel aborts request

```
Given a course row
When the user clicks "Asignar materias y competencias"
  And the confirmation dialog appears
  And the user clicks Cancel / dismisses the dialog
Then no POST /course-cycles/:ccId/alumnos/cascade request is issued
  And the button returns to its idle enabled state
```

#### SC-13 — Frontend: success toast shows counts

```
Given a course row
When the user confirms the bulk cascade
  And POST /course-cycles/:ccId/alumnos/cascade returns HTTP 200 with counts
Then a success toast is displayed showing the aggregated counts
  And the button returns to its idle enabled state
```

#### SC-14 — Frontend: error toast on failure

```
Given a course row
When the user confirms the bulk cascade
  And POST /course-cycles/:ccId/alumnos/cascade returns a non-2xx response or network error
Then an error toast is displayed
  And the button returns to its idle enabled state (not permanently disabled)
```

#### SC-15 — Frontend: loading state while in-flight

```
Given the user has confirmed the bulk cascade for course C
When the POST request is in-flight
Then the "Asignar materias y competencias" button for course C is in loading/disabled state
  And no other course-row action is affected by this state
```
