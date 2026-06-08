# Delta Spec — normalized-valuation-model

> **Delta spec**: describes what MUST be true after the change is applied.
> Base: `openspec/specs/competency-valuations/spec.md`.
> This delta replaces the flat data-model section with a normalized two-table model.

---

## Scope

**In**: `CompetencyValuation` parent entity (drop flat columns, add `courseCycleId`, change
UNIQUE); new `CompetencyPeriodValuation` child entity (lazy per-period rows).
**Out**: GET-endpoint response shape changes are not specified here (addressed in Fase 4
when the read layer for the new model is built). Tables are empty at migration time.

---

## MODIFIED: CompetencyValuation Data Model

The `CompetencyValuation` entity MUST conform to the following field definition.
Flat period columns are removed. `courseCycleId` is added and required.

| Field           | Type      | Constraint                                          |
|-----------------|-----------|-----------------------------------------------------|
| `id`            | Int PK    | autoincrement                                       |
| `uuid`          | String    | unique, public identifier                           |
| `studentId`     | Int FK    | → `Student.id`, NOT NULL                           |
| `competencyId`  | Int FK    | → `SubjectCompetency.id`, NOT NULL                 |
| `courseCycleId` | String FK | → `CourseCycle.uuid`, NOT NULL                     |
| `deletedAt`     | DateTime? | soft-delete marker                                  |
| `createdAt`     | DateTime  | auto                                                |
| `updatedAt`     | DateTime  | auto                                                |

**UNIQUE constraint**: `(studentId, competencyId, courseCycleId)`.
(Replaces the previous `(studentId, competencyId)` unique constraint.)

Default state: no period values on the parent — all grading data lives in child rows.

### Scenario MVM-1: Parent created with courseCycleId

- GIVEN valid `studentId`, `competencyId`, and `courseCycleId`
- WHEN a `CompetencyValuation` parent is created
- THEN the record is persisted with those three FK fields
- AND no flat period fields exist on the row

### Scenario MVM-2: Duplicate (student, competency, cycle) rejected

- GIVEN a `CompetencyValuation` already exists for
  `(studentId=5, competencyId=2, courseCycleId="cc-1")`
- WHEN a second record with the same triple is attempted
- THEN the system returns HTTP 400 (unique constraint violation)
- AND no record is created

### Scenario MVM-3: Same (student, competency) allowed in different cycles

- GIVEN a `CompetencyValuation` for `(studentId=5, competencyId=2, courseCycleId="cc-2024")`
- WHEN a `CompetencyValuation` for `(studentId=5, competencyId=2, courseCycleId="cc-2025")` is created
- THEN both records persist independently (different cycles are not a duplicate)

---

## ADDED: CompetencyPeriodValuation Data Model

A new entity `CompetencyPeriodValuation` MUST exist with the following fields:

| Field               | Type                  | Constraint                                          |
|---------------------|-----------------------|-----------------------------------------------------|
| `id`                | Int PK                | autoincrement                                       |
| `uuid`              | String                | unique, public identifier                           |
| `valuationId`       | Int FK                | → `CompetencyValuation.id`, NOT NULL               |
| `periodItemId`      | Int FK                | → `GradingPeriodTemplateItem.id`, NOT NULL         |
| `gradeScaleValueId` | Int? FK               | → `GradeScaleValue.id`, nullable                   |
| `gradeCode`         | String?               | snapshot of `GradeScaleValue.code` at grading time |
| `internalStatus`    | GradeInternalStatus?  | snapshot of `GradeScaleValue.internalStatus` at grading time; `APROBADO \| NO_APROBADO \| EN_PROCESO \| LIBRE \| null` |
| `modificable`       | Boolean               | default `true`                                      |
| `imprimible`        | Boolean               | default `false`                                     |
| `createdAt`         | DateTime              | auto                                                |
| `updatedAt`         | DateTime              | auto                                                |

**UNIQUE constraint**: `(valuationId, periodItemId)`.

Child rows are created **LAZILY** — only when the first grade PATCH is applied to a
`(valuation, periodItem)` pair. They MUST NOT be created at parent auto-creation time.

### Scenario MVM-4: Child created lazily on first grade PATCH

- GIVEN a `CompetencyValuation` parent exists with no `CompetencyPeriodValuation` children
- WHEN a grade is PATCHed for a valid `periodItemId`
- THEN a new `CompetencyPeriodValuation` row is created with `modificable=true`, `imprimible=false`
- AND `gradeCode` and `internalStatus` are snapshotted from the referenced `GradeScaleValue`

### Scenario MVM-5: Duplicate (valuationId, periodItemId) rejected by DB constraint

- GIVEN a `CompetencyPeriodValuation` already exists for `(valuationId=10, periodItemId=3)`
- WHEN a second direct insert with the same pair is attempted (outside the PATCH upsert path)
- THEN the DB unique constraint prevents creation and an error is returned

### Scenario MVM-6: Ungraded child row has null grade fields

- GIVEN a `CompetencyPeriodValuation` row exists but `gradeScaleValueId` is null
- WHEN the row is retrieved
- THEN `gradeScaleValueId`, `gradeCode`, and `internalStatus` are all `null`
- AND `modificable=true`, `imprimible=false` (defaults)

---

## REMOVED: Flat period columns

The following fields are **removed** from `CompetencyValuation` and MUST NOT exist
on the post-migration table:

- `valuation1`, `valuation2`, `valuation3`, `valuation4`
- `modificable1`, `modificable2`, `modificable3`, `modificable4`
- `imprimible1`, `imprimible2`, `imprimible3`, `imprimible4`
- `periodActive`

Any application code or query that references these columns MUST be updated or removed.
