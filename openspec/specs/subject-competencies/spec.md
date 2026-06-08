# Subject Competencies Specification

## Purpose

Define and manage qualitative competencies/objectives linked to a `StudyPlanSubject`
within the pedagogy bounded context. As of Fase 2 (competency-hierarchy), competencies
are scoped to the **Plan×Curso×Materia** tuple (`StudyPlanSubject`), NOT to the global
`Subject`. Each competency is tenant-scoped, study-plan-subject-scoped, named, and can be
soft-deactivated. The same subject appearing in two courses of a plan yields two
independent competency sets.

---

## Requirements

### Requirement: SubjectCompetency Data Model

The system MUST persist each `SubjectCompetency` with the following fields:

| Field | Type | Constraint |
|-------|------|------------|
| `id` | Int PK | autoincrement |
| `uuid` | String | unique, public identifier |
| `studyPlanSubjectId` | Int FK | references `StudyPlanSubject`, required, `onDelete: Cascade` |
| `name` | String | required, non-empty, max 255 chars |
| `active` | Boolean | default `true` |
| `deletedAt` | DateTime | nullable, soft-delete marker |
| `createdAt` | DateTime | auto |
| `updatedAt` | DateTime | auto |

The combination `(studyPlanSubjectId, name)` MUST be unique among non-deleted records.
Deleting a `StudyPlanSubject` cascades to its competencies. The deprecated `periodActive`
field was removed in Fase 2.

#### Scenario: Competency created for a study-plan-subject

- GIVEN a valid `studyPlanSubjectId` and a non-empty `name`
- WHEN `POST /v1/subject-competencies` is called with valid auth
- THEN a record is persisted with `active=true`, `deletedAt=null`, and a generated `uuid`
- AND HTTP 201 is returned with the competency payload

#### Scenario: Duplicate name rejected for same study-plan-subject

- GIVEN a competency with `name="Lectura comprensiva"` already exists for `studyPlanSubjectId=5`
- WHEN `POST /v1/subject-competencies` with the same `name` and `studyPlanSubjectId` is called
- THEN HTTP 400 is returned with a duplicate-name validation error
- AND no record is created

#### Scenario: Empty name rejected

- GIVEN a request body with `name=""`
- WHEN `POST /v1/subject-competencies` is called
- THEN HTTP 400 is returned with a validation error on `name`

---

### Requirement: List Competencies by StudyPlanSubject

The system SHALL expose `GET /v1/subject-competencies?studyPlanSubjectId=:id` that returns
all non-deleted competencies for a given study-plan-subject ordered by `name ASC`.
The `studyPlanSubjectId` query parameter is REQUIRED. Results MAY be filtered by `active`.

#### Scenario: List active competencies for a study-plan-subject

- GIVEN 3 active and 1 inactive competency exist for `studyPlanSubjectId=5`
- WHEN `GET /v1/subject-competencies?studyPlanSubjectId=5&active=true` is called
- THEN the response contains the 3 active competencies ordered by `name ASC`

#### Scenario: List all non-deleted competencies

- GIVEN 3 active and 1 inactive (but not soft-deleted) competency exist for `studyPlanSubjectId=5`
- WHEN `GET /v1/subject-competencies?studyPlanSubjectId=5` is called
- THEN the response contains all 4 competencies

#### Scenario: Missing studyPlanSubjectId parameter rejected

- GIVEN no `studyPlanSubjectId` in query string
- WHEN `GET /v1/subject-competencies` is called
- THEN HTTP 400 is returned with a validation error on `studyPlanSubjectId`

---

### Requirement: SubjectCompetency CRUD Endpoints

The system MUST expose the following REST endpoints:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/subject-competencies` | List by `studyPlanSubjectId`; filter by `active` |
| GET | `/v1/subject-competencies/:uuid` | Get single competency by UUID |
| POST | `/v1/subject-competencies` | Create |
| POST | `/v1/subject-competencies/copy` | Copy all active competencies from a source to a target StudyPlanSubject |
| PATCH | `/v1/subject-competencies/:uuid` | Update `name` and/or `active` |
| DELETE | `/v1/subject-competencies/:uuid` | Soft delete |

The `/copy` route MUST be declared BEFORE the `/:uuid` route so NestJS does not match
`copy` as a UUID param.

#### Scenario: Get by UUID — not found

- GIVEN no competency exists with the given UUID
- WHEN `GET /v1/subject-competencies/:uuid` is called
- THEN HTTP 404 is returned with a not-found error

#### Scenario: Soft delete a competency

- GIVEN a competency with UUID `abc` and `deletedAt=null`
- WHEN `DELETE /v1/subject-competencies/abc` is called
- THEN `deletedAt` is set to current timestamp
- AND the competency no longer appears in list queries

#### Scenario: Update competency name

- GIVEN a competency with UUID `abc`
- WHEN `PATCH /v1/subject-competencies/abc` with `{ name: "Nueva competencia" }` is called
- THEN the record is updated and `updatedAt` is refreshed

#### Scenario: Update name to a duplicate sibling name rejected

- GIVEN two competencies `A` and `B` exist for `studyPlanSubjectId=5`
- WHEN `PATCH /v1/subject-competencies/{B.uuid}` renames `B` to `A.name`
- THEN HTTP 400 is returned with a duplicate-name validation error
- AND `B` is unchanged

#### Scenario: Update name to its own current name allowed

- GIVEN a competency `A` with `name="Lectura"` for `studyPlanSubjectId=5`
- WHEN `PATCH /v1/subject-competencies/{A.uuid}` with `{ name: "Lectura" }` is called
- THEN the request succeeds (idempotent — own name is not a conflict)

#### Scenario: Update non-existent competency

- GIVEN no competency exists with the given UUID
- WHEN `PATCH /v1/subject-competencies/:uuid` is called
- THEN HTTP 404 is returned with a not-found error

---

### Requirement: Copy Competencies Between Courses

The system SHALL expose `POST /v1/subject-competencies/copy` accepting
`{ sourceStudyPlanSubjectId, targetStudyPlanSubjectId }` that copies every active
competency of the source into the target. The operation is idempotent and skips names
that already exist in the target. It returns `{ copied, skipped }` counts.

#### Scenario: Copy active competencies to another course

- GIVEN `studyPlanSubjectId=5` has 3 active competencies and `studyPlanSubjectId=8` has none
- WHEN `POST /v1/subject-competencies/copy` with `{ source: 5, target: 8 }` is called
- THEN 3 competencies are created under `studyPlanSubjectId=8`
- AND the response is `{ copied: 3, skipped: 0 }`

#### Scenario: Copy skips duplicate names

- GIVEN the target already has a competency named like one in the source
- WHEN the copy is performed
- THEN the duplicate-named competency is skipped and counted in `skipped`

#### Scenario: Source equals target rejected

- GIVEN `sourceStudyPlanSubjectId === targetStudyPlanSubjectId`
- WHEN `POST /v1/subject-competencies/copy` is called
- THEN HTTP 400 is returned with a validation error

---

### Requirement: SubjectCompetency Access Control

All write endpoints (POST, PATCH, DELETE) MUST require authentication and MUST enforce
`@Roles('ROOT', { module: 'COURSES', action: '*' })`.
Read endpoints (GET) MUST require authentication and MUST enforce
`@Roles('ROOT', { module: 'COURSES', action: 'read' })`.

#### Scenario: Unauthenticated request rejected

- GIVEN no valid JWT is provided
- WHEN any `/v1/subject-competencies` endpoint is called
- THEN HTTP 401 is returned

#### Scenario: User without COURSES module rejected on write

- GIVEN a valid JWT without the COURSES module permission
- WHEN `POST /v1/subject-competencies` is called
- THEN HTTP 403 is returned
