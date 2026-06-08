# Competency Valuations Specification

## Purpose

Record, retrieve, and update period-based qualitative valuations per student per
competency per course cycle. Valuations are auto-created when a `CourseCycle` is
instantiated. This replicates the legacy WINDEV `ComXMatXCurXAlumno` qualitative
tracking model.

> **History**: Fase 2 (competency-hierarchy) established the StudyPlan-based hierarchy.
> Fase 3 (competency-instantiation, 2026-06-08) normalized the data model (slim parent +
> lazy child), moved the auto-creation trigger to CourseCycle instantiation, removed all
> flat period columns, and added the PATCH grade-period endpoint.

---

## Requirements

### Requirement: CompetencyValuation Data Model

The system MUST persist each `CompetencyValuation` as a slim parent record with
the following fields:

| Field           | Type      | Constraint                                          |
|-----------------|-----------|-----------------------------------------------------|
| `id`            | String PK | `@default(uuid())` — project convention             |
| `studentId`     | Int FK    | → `Student.id`, NOT NULL                           |
| `competencyId`  | Int FK    | → `SubjectCompetency.id`, NOT NULL                 |
| `courseCycleId` | String FK | → `CourseCycle.uuid`, NOT NULL                     |
| `active`        | Boolean   | default `true`                                      |
| `deletedAt`     | DateTime? | soft-delete marker                                  |
| `createdAt`     | DateTime  | auto                                                |
| `updatedAt`     | DateTime  | auto                                                |

**UNIQUE constraint**: `(studentId, competencyId, courseCycleId)`.

Default state: no period values on the parent — all grading data lives in child
`CompetencyPeriodValuation` rows (see below). Flat period columns (`valuation1–4`,
`modificable1–4`, `imprimible1–4`, `periodActive`) are permanently removed as of Fase 3.

#### Scenario MVM-1: Parent created with courseCycleId

- GIVEN valid `studentId`, `competencyId`, and `courseCycleId`
- WHEN a `CompetencyValuation` parent is created
- THEN the record is persisted with those three FK fields
- AND no flat period fields exist on the row

#### Scenario MVM-2: Duplicate (student, competency, cycle) rejected

- GIVEN a `CompetencyValuation` already exists for
  `(studentId=5, competencyId=2, courseCycleId="cc-1")`
- WHEN a second record with the same triple is attempted
- THEN the system returns HTTP 400 (unique constraint violation)
- AND no record is created

#### Scenario MVM-3: Same (student, competency) allowed in different cycles

- GIVEN a `CompetencyValuation` for `(studentId=5, competencyId=2, courseCycleId="cc-2024")`
- WHEN a `CompetencyValuation` for `(studentId=5, competencyId=2, courseCycleId="cc-2025")` is created
- THEN both records persist independently (different cycles are not a duplicate)

---

### Requirement: CompetencyPeriodValuation Data Model

A `CompetencyPeriodValuation` child record MUST exist for each (valuation, period item)
pair where a grade has been explicitly assigned. Child rows are created **LAZILY** — only
when the first grade PATCH is applied to a pair.

| Field               | Type                  | Constraint                                          |
|---------------------|-----------------------|-----------------------------------------------------|
| `id`                | String PK             | `@default(uuid())` — project convention             |
| `valuationId`       | String FK             | → `CompetencyValuation.id`, NOT NULL, CASCADE delete |
| `periodItemId`      | String FK             | → `GradingPeriodTemplateItem.id`, NOT NULL, RESTRICT |
| `gradeScaleValueId` | String? FK            | → `GradeScaleValue.id`, nullable, SetNull on delete  |
| `gradeCode`         | String?               | snapshot of `GradeScaleValue.code` at grading time  |
| `internalStatus`    | GradeInternalStatus?  | snapshot at grading time; `APROBADO \| NO_APROBADO \| EN_PROCESO \| LIBRE \| null` |
| `modificable`       | Boolean               | default `true`                                       |
| `imprimible`        | Boolean               | default `false`                                      |
| `createdAt`         | DateTime              | auto                                                 |
| `updatedAt`         | DateTime              | auto                                                 |

**UNIQUE constraint**: `(valuationId, periodItemId)`.

#### Scenario MVM-4: Child created lazily on first grade PATCH

- GIVEN a `CompetencyValuation` parent exists with no `CompetencyPeriodValuation` children
- WHEN a grade is PATCHed for a valid `periodItemId`
- THEN a new `CompetencyPeriodValuation` row is created with `modificable=true`, `imprimible=false`
- AND `gradeCode` and `internalStatus` are snapshotted from the referenced `GradeScaleValue`

#### Scenario MVM-5: Duplicate (valuationId, periodItemId) rejected by DB constraint

- GIVEN a `CompetencyPeriodValuation` already exists for `(valuationId=10, periodItemId=3)`
- WHEN a second direct insert with the same pair is attempted (outside the PATCH upsert path)
- THEN the DB unique constraint prevents creation and an error is returned

#### Scenario MVM-6: Ungraded child row has null grade fields

- GIVEN a `CompetencyPeriodValuation` row exists but `gradeScaleValueId` is null
- WHEN the row is retrieved
- THEN `gradeScaleValueId`, `gradeCode`, and `internalStatus` are all `null`
- AND `modificable=true`, `imprimible=false` (defaults)

---

### Requirement: Auto-Creation at CourseCycle Instantiation

Auto-creation of `CompetencyValuation` parent records MUST fire at `CourseCycle`
instantiation/generation (`GenerateCourseCyclesUseCase`), NOT at `SubjectAssignment`
creation or `Enrollment` creation.

`AutoCreateCompetencyValuationsUC` MUST:
- Accept `courseCycleId` as the sole input parameter.
- Create one `CompetencyValuation` parent record per
  `(enrolled student in the cycle's course section) × (active SubjectCompetency
  reachable via CourseCycle → StudyPlan → StudyPlanCourse → StudyPlanSubject)`.
- Use batch insert with `skipDuplicates: true` for idempotency.
- Fire as a **fire-and-forget** side effect: a failure MUST NOT roll back or block
  the `CourseCycle` creation (logged, not propagated).

Creating a `SubjectAssignment` MUST NOT auto-create any `CompetencyValuation` records.

#### Scenario ACT-1: Cycle instantiation creates parents for enrolled students × active competencies

- GIVEN a `CourseCycle` linked to 3 enrolled students
- AND the cycle's study plan subjects have 4 active `SubjectCompetency` entries total
- WHEN the `CourseCycle` is instantiated/generated
- THEN 12 `CompetencyValuation` parent records are created (3 × 4)
- AND each record carries `courseCycleId` = the newly instantiated cycle's uuid

#### Scenario ACT-2: Idempotency — re-instantiation skips existing parents

- GIVEN 12 `CompetencyValuation` parents already exist for `courseCycleId="cc-1"`
- WHEN auto-creation is triggered again for the same `CourseCycle`
- THEN no new records are created (`skipDuplicates` behavior)
- AND existing records are unchanged

#### Scenario ACT-3: No enrolled students — no parents created

- GIVEN a `CourseCycle` with 0 enrolled students
- WHEN the `CourseCycle` is instantiated
- THEN no `CompetencyValuation` records are created
- AND the instantiation succeeds (no error)

#### Scenario ACT-4: Subjects with zero active competencies contribute nothing

- GIVEN a `CourseCycle` with 2 subjects: subject A has 3 active competencies, subject B has 0
- AND 2 enrolled students
- WHEN the `CourseCycle` is instantiated
- THEN 6 `CompetencyValuation` parents are created (2 students × 3 competencies from A)
- AND subject B contributes 0 records

#### Scenario ACT-5: Auto-creation failure does not block CourseCycle instantiation

- GIVEN auto-creation of `CompetencyValuation` parents throws or returns a failure
- WHEN a `CourseCycle` is instantiated
- THEN the `CourseCycle` generation still succeeds (no HTTP error propagation)
- AND the failure is logged, not re-thrown to the caller

#### Scenario ACT-6: SubjectAssignment creation does NOT create valuation records

- GIVEN a course section with 3 enrolled students
- AND a subject being assigned has 2 active competencies
- WHEN a `SubjectAssignment` is created
- THEN NO `CompetencyValuation` records are created
- AND the `SubjectAssignment` is created successfully (HTTP 2xx)

---

### Requirement: Grade a Period (PATCH endpoint)

The system MUST expose:

```
PATCH /v1/competency-valuations/:uuid/periods/:periodItemId
```

**Request body**: `{ gradeScaleValueId: string | null }`
- Non-null value: UUID of the `GradeScaleValue` to assign.
- `null`: clears the current grade (sets `gradeScaleValueId`, `gradeCode`, `internalStatus` to null).

**Processing contract** (in order):

1. Resolve `CompetencyValuation` by `:uuid` → 404 if not found.
2. Resolve the `CourseCycle` (via `CompetencyValuation.courseCycleId`) to obtain
   `level` and `modality`.
3. Resolve the `GradingPeriodTemplate` for `(institutionId, level, modality)` →
   HTTP 400 (`GradingPeriodTemplateNotFoundError`) if none is configured for this cycle.
4. Verify `:periodItemId` belongs to that template →
   HTTP 400 (`PeriodItemNotInTemplateError`) if not found.
5. When `gradeScaleValueId` is non-null: resolve the `GradeScaleValue` by UUID and
   verify it belongs to the `GradeScale` configured for the same `(institutionId, level, modality)` →
   HTTP 400 (`GradeScaleValueMismatchError`) if mismatched; 404 if not found.
6. If a `CompetencyPeriodValuation` child row exists for `(valuationId, periodItemId)`
   and `modificable=false` → HTTP 400 (`PeriodLockedError`).
7. Lazily create the child row if it does not yet exist
   (defaults: `modificable=true`, `imprimible=false`).
8. Persist: `gradeScaleValueId`, snapshot `gradeCode` and `internalStatus` from the
   `GradeScaleValue` at write time (or set all three to null when clearing).
9. Return HTTP 200 with the `CompetencyPeriodValuation` data.
10. Invalidate boletin cache for the affected student/cycle.

**HTTP mapping**:

| Situation                                      | HTTP Status |
|------------------------------------------------|-------------|
| Grade set or cleared successfully              | 200 OK      |
| CompetencyValuation uuid not found             | 404         |
| GradeScaleValue uuid not found                 | 404         |
| Template not configured for level+modality     | 400         |
| periodItemId not in template                   | 400         |
| gradeScaleValueId belongs to wrong scale       | 400         |
| Period locked (modificable=false)              | 400         |

No 422 or 409 codes are used on this endpoint (project override).

#### Scenario GPE-1: Grade a period — happy path (lazy create child row)

- GIVEN `CompetencyValuation` uuid="v-1" with `courseCycleId="cc-1"` (no period children)
- AND the cycle's template has `periodItemId=7` as a valid item
- AND `gradeScaleValueId="gsv-a"` exists in the matching scale (`gradeCode="MB"`, `internalStatus=APROBADO`)
- WHEN `PATCH /v1/competency-valuations/v-1/periods/7` with `{ gradeScaleValueId: "gsv-a" }`
- THEN a `CompetencyPeriodValuation` child row is created for `(valuationId, periodItemId=7)`
- AND `gradeCode="MB"`, `internalStatus=APROBADO` are snapshotted
- AND the response is HTTP 200 with the created row

#### Scenario GPE-2: Grade a period — update existing child row

- GIVEN a `CompetencyPeriodValuation` already exists for `(v-1, periodItem=7)` with `gradeCode="B"`, `modificable=true`
- WHEN `PATCH /v1/competency-valuations/v-1/periods/7` with `{ gradeScaleValueId: "gsv-mb" }`
- THEN the row is updated: `gradeCode` and `internalStatus` are re-snapshotted from `gsv-mb`
- AND HTTP 200 is returned

#### Scenario GPE-3: Clear grade (set null)

- GIVEN a `CompetencyPeriodValuation` for `(v-1, 7)` with `gradeCode="MB"`, `modificable=true`
- WHEN `PATCH /v1/competency-valuations/v-1/periods/7` with `{ gradeScaleValueId: null }`
- THEN `gradeScaleValueId`, `gradeCode`, `internalStatus` are all set to `null`
- AND HTTP 200 is returned

#### Scenario GPE-4: Grade a locked period (modificable=false)

- GIVEN a `CompetencyPeriodValuation` for `(v-1, 7)` with `modificable=false`
- WHEN `PATCH /v1/competency-valuations/v-1/periods/7` with `{ gradeScaleValueId: "gsv-a" }`
- THEN the system returns HTTP 400 with `PeriodLockedError`
- AND the row is unchanged

#### Scenario GPE-5: CompetencyValuation not found

- GIVEN no `CompetencyValuation` with uuid="nonexistent"
- WHEN `PATCH /v1/competency-valuations/nonexistent/periods/7`
- THEN the system returns HTTP 404

#### Scenario GPE-6: GradingPeriodTemplate not configured for cycle's level+modality

- GIVEN the institution has no `GradingPeriodTemplate` for `(PRIMARIO, COMUN)`
- AND `CompetencyValuation v-1` belongs to a cycle with `level=PRIMARIO, modality=COMUN`
- WHEN `PATCH /v1/competency-valuations/v-1/periods/7`
- THEN the system returns HTTP 400 with `GradingPeriodTemplateNotFoundError`
- AND no child row is created (graceful reject, no crash)

#### Scenario GPE-7: periodItemId does not belong to the cycle's template

- GIVEN `CompetencyValuation v-1` belongs to `courseCycleId="cc-1"` (level=PRIMARIO, modality=COMUN)
- AND `periodItemId=99` does NOT belong to the `GradingPeriodTemplate` for that level+modality
- WHEN `PATCH /v1/competency-valuations/v-1/periods/99`
- THEN the system returns HTTP 400 with `PeriodItemNotInTemplateError`

#### Scenario GPE-8: gradeScaleValueId belongs to a different scale (mismatch)

- GIVEN `gradeScaleValueId="gsv-z"` belongs to a `GradeScale` for `(SECUNDARIO, TECNICA)`,
  not for `(PRIMARIO, COMUN)` which is the cycle's level+modality
- WHEN `PATCH /v1/competency-valuations/v-1/periods/7` with `{ gradeScaleValueId: "gsv-z" }`
- THEN the system returns HTTP 400 with `GradeScaleValueMismatchError`

#### Scenario GPE-9: gradeScaleValueId UUID not found

- GIVEN `gradeScaleValueId="gsv-unknown"` does not exist in the DB
- WHEN `PATCH /v1/competency-valuations/v-1/periods/7` with `{ gradeScaleValueId: "gsv-unknown" }`
- THEN the system returns HTTP 404

---

### Requirement: Migration Integrity

The Fase 3 migration applies to empty tables (user-confirmed). No backfill needed.

**Migration steps** (in order):
1. DROP columns `valuation1–4`, `modificable1–4`, `imprimible1–4`, `periodActive` from `competency_valuations`.
2. ADD column `courseCycleId` (String, NOT NULL) to `competency_valuations` with FK → `CourseCycle.uuid`.
3. DROP existing UNIQUE constraint on `(studentId, competencyId)`.
4. ADD new UNIQUE constraint on `(studentId, competencyId, courseCycleId)`.
5. CREATE table `competency_period_valuations` as specified in the CompetencyPeriodValuation model above.

**FK on-delete behaviors**:

| Parent Entity                  | Child Entity                   | On Delete Parent |
|-------------------------------|-------------------------------|-----------------|
| `CourseCycle`                 | `CompetencyValuation`          | **RESTRICT**    |
| `CompetencyValuation`         | `CompetencyPeriodValuation`    | **CASCADE**     |
| `GradingPeriodTemplateItem`   | `CompetencyPeriodValuation`    | **RESTRICT**    |
| `SubjectCompetency`           | `CompetencyValuation`          | CASCADE (existing, preserved) |
| `Student`                     | `CompetencyValuation`          | CASCADE (existing, preserved) |

**Post-migration invariants**:
1. `competency_valuations.courseCycleId` is NOT NULL — every parent is bound to a cycle.
2. UNIQUE `(studentId, competencyId, courseCycleId)` — one parent per student/competency/cycle triple.
3. UNIQUE `(valuationId, periodItemId)` — one child per valuation/period pair.
4. `CompetencyPeriodValuation` rows only exist if a grade has been explicitly assigned (lazy creation).
5. `CourseCycle` records with existing valuations cannot be deleted without first removing those valuations.
6. `GradingPeriodTemplateItem` records with existing `CompetencyPeriodValuation` rows cannot be deleted.

---

### Requirement: CompetencyValuation Endpoints

The system MUST expose the following REST endpoints:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/competency-valuations` | List by `studentId` + `studyPlanSubjectId` (Fase 4 read shape TBD) |
| GET | `/v1/competency-valuations/:uuid` | Get single valuation by UUID |
| PATCH | `/v1/competency-valuations/:uuid/periods/:periodItemId` | Grade a specific period |

Manual POST and DELETE of individual valuations are NOT exposed — creation and
removal are handled by the auto-creation triggers and cascade deletes respectively.

The old flat `PATCH /v1/competency-valuations/:uuid` endpoint (Fase 2) is **removed** as of
Fase 3. Use `PATCH /v1/competency-valuations/:uuid/periods/:periodItemId` instead.

Batch retrieval by `subjectId` (Fase 2 endpoint) is **removed** as of Fase 3.
The GET list endpoint shape for the new normalized model is deferred to Fase 4.

#### Scenario: Get single valuation — not found

- GIVEN no valuation exists with the given UUID
- WHEN `GET /v1/competency-valuations/:uuid` is called
- THEN HTTP 404 is returned with `CompetencyValuationNotFoundError`

---

### Requirement: CompetencyValuation Access Control

All endpoints MUST require authentication.
Write endpoints (PATCH) MUST enforce `@Roles('ROOT', { module: 'COURSES', action: '*' })`.
Read endpoints (GET) MUST enforce `@Roles('ROOT', { module: 'COURSES', action: 'read' })`.

#### Scenario: Unauthenticated request rejected

- GIVEN no valid JWT is provided
- WHEN any `/v1/competency-valuations` endpoint is called
- THEN HTTP 401 is returned

#### Scenario: User with read permission can retrieve valuations

- GIVEN a user with role TEACHER and module COURSES with action `read`
- WHEN `GET /v1/competency-valuations?studentId=10&studyPlanSubjectId=5` is called
- THEN HTTP 200 is returned with the matching valuations
