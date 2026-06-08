# Competency Valuations Specification

## Purpose

Record, retrieve, and update period-based qualitative valuations per student per
competency. Valuations are auto-created when a student enrolls in a course section
or when a subject is assigned to a course section. This replicates the legacy
WINDEV `ComXMatXCurXAlumno` qualitative tracking model.

---

## Requirements

### Requirement: CompetencyValuation Data Model

The system MUST persist each `CompetencyValuation` with the following fields:

| Field | Type | Constraint |
|-------|------|------------|
| `id` | Int PK | autoincrement |
| `uuid` | String | unique, public identifier |
| `studentId` | Int FK | references `Student`, required |
| `competencyId` | Int FK | references `SubjectCompetency`, required |
| `valuation1`–`valuation4` | String? | nullable, qualitative value per period |
| `modificable1`–`modificable4` | Boolean | default `true` per period |
| `imprimible1`–`imprimible4` | Boolean | default `false` per period |
| `periodActive` | Int | 1–4, current active period, default `1` |
| `deletedAt` | DateTime | nullable, soft-delete marker |
| `createdAt` | DateTime | auto |
| `updatedAt` | DateTime | auto |

The pair `(studentId, competencyId)` MUST be unique (DB constraint).
Default state: all valuations `null`, all `modificable=true`, all `imprimible=false`,
`periodActive=1`.

#### Scenario: Valuation record has correct defaults on creation

- GIVEN a `CompetencyValuation` is auto-created for `studentId=10`, `competencyId=3`
- WHEN the record is retrieved
- THEN `valuation1` through `valuation4` are all `null`
- AND `modificable1` through `modificable4` are all `true`
- AND `imprimible1` through `imprimible4` are all `false`
- AND `periodActive` equals `1`

#### Scenario: Duplicate (studentId, competencyId) rejected

- GIVEN a valuation already exists for `studentId=10`, `competencyId=3`
- WHEN a second record with the same pair is attempted
- THEN the DB constraint prevents creation and an error is returned

---

### Requirement: Auto-Creation on SubjectAssignment

When a `SubjectAssignment` is created linking a `Subject` to a course section, the
system MUST auto-create one `CompetencyValuation` record for every combination of
(enrolled student in that section) × (active competency of the assigned subject).

As of Fase 2 (competency-hierarchy), the active competencies are resolved by navigating
the StudyPlan hierarchy `CourseCycle → StudyPlan → StudyPlanCourse → StudyPlanSubject →
SubjectCompetency`, NOT via the global `Subject`. Auto-creation MUST use batch insert
(`createMany`) to avoid N+1 queries. Records MUST NOT be duplicated — the
`(studentId, competencyId)` unique constraint MUST be used with `skipDuplicates: true`.

Auto-creation is a SIDE EFFECT of `CreateSubjectAssignmentUC`: a failure in auto-creation
MUST NOT propagate or roll back the SubjectAssignment creation (fire-and-forget, logged).

#### Scenario: Auto-creation failure does not break SubjectAssignment

- GIVEN auto-creation of valuations throws or returns a failure
- WHEN a `SubjectAssignment` is created
- THEN the `SubjectAssignment` creation still succeeds (HTTP 2xx)
- AND the failure is logged, not propagated to the caller

#### Scenario: SubjectAssignment triggers valuation auto-creation

- GIVEN a course section with 3 enrolled students
- AND the subject being assigned has 2 active competencies
- WHEN a `SubjectAssignment` is created
- THEN 6 `CompetencyValuation` records are created (3 students × 2 competencies)
- AND each record has default values (`valuation=null`, `modificable=true`, `imprimible=false`)

#### Scenario: Pre-existing valuations are not duplicated

- GIVEN 2 valuation records already exist for a student/competency pair
- WHEN a `SubjectAssignment` triggers batch auto-creation for the same pairs
- THEN no duplicate records are created (skipDuplicates behavior)
- AND existing records are unchanged

#### Scenario: Subject with no active competencies skips creation

- GIVEN a subject has 0 active competencies
- WHEN a `SubjectAssignment` is created for that subject
- THEN no `CompetencyValuation` records are created

---

### Requirement: Auto-Creation on Enrollment

When a student `Enrollment` is created in a course section, the system MUST
auto-create one `CompetencyValuation` record for every active `SubjectCompetency`
reachable via the section's existing `SubjectAssignment` records.

Auto-creation MUST use batch insert with `skipDuplicates: true`.

#### Scenario: Enrollment triggers valuation auto-creation

- GIVEN a course section has 2 subject assignments, each subject with 2 active competencies
- WHEN a new student is enrolled in that section
- THEN 4 `CompetencyValuation` records are created for that student (2 subjects × 2 competencies)

#### Scenario: Enrollment in section with no subject assignments

- GIVEN a course section has no `SubjectAssignment` records
- WHEN a student is enrolled
- THEN no `CompetencyValuation` records are created

---

### Requirement: Update Valuation per Period

The system MUST allow updating a `valuation` for a given period only when the
corresponding `modificable{N}` flag is `true`. Attempts to update a locked period
MUST be rejected.

The `imprimible{N}` flag MAY be updated independently of `modificable{N}`.

#### Scenario: Update valuation on a modificable period

- GIVEN a valuation record with `modificable2=true`
- WHEN `PATCH /v1/competency-valuations/:uuid` with `{ valuation2: "Logrado" }` is called
- THEN the record is updated and `valuation2="Logrado"`

#### Scenario: Update valuation on a locked period rejected

- GIVEN a valuation record with `modificable2=false`
- WHEN `PATCH /v1/competency-valuations/:uuid` with `{ valuation2: "Logrado" }` is called
- THEN HTTP 422 is returned with `ValuationPeriodLockedError`
- AND `valuation2` is unchanged

#### Scenario: Update imprimible flag independently

- GIVEN a valuation record with `modificable1=false`
- WHEN `PATCH /v1/competency-valuations/:uuid` with `{ imprimible1: true }` is called
- THEN `imprimible1` is set to `true` regardless of `modificable1`

---

### Requirement: Batch Retrieval by Student and StudyPlanSubject

The system SHALL expose an endpoint to retrieve all valuations for a given
`studentId` and `studyPlanSubjectId` combination in a single call, for use in report
cards and period grids. The valuations are resolved via a two-step join: resolve the
`SubjectCompetency` ids for the `studyPlanSubjectId`, then fetch valuations whose
`competencyId` is in that set.

#### Scenario: Batch retrieval returns all valuations for student/study-plan-subject

- GIVEN 4 `CompetencyValuation` records exist for `studentId=10` across competencies of `studyPlanSubjectId=5`
- WHEN `GET /v1/competency-valuations?studentId=10&studyPlanSubjectId=5` is called
- THEN the response contains all 4 records with all period fields

#### Scenario: No valuations found returns empty list

- GIVEN no valuations exist for the given `studentId` and `studyPlanSubjectId`
- WHEN `GET /v1/competency-valuations?studentId=10&studyPlanSubjectId=5` is called
- THEN the response returns `{ data: [] }` with HTTP 200

---

### Requirement: CompetencyValuation CRUD Endpoints

The system MUST expose the following REST endpoints:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/competency-valuations` | Batch list by `studentId` + `studyPlanSubjectId` |
| GET | `/v1/competency-valuations/:uuid` | Get single valuation by UUID |
| PATCH | `/v1/competency-valuations/:uuid` | Update period valuations and flags |

Manual POST and DELETE of individual valuations are NOT exposed — creation and
removal are handled by the auto-creation triggers and cascade deletes respectively.

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
