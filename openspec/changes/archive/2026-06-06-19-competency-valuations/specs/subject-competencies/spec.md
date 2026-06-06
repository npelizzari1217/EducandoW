# Subject Competencies Specification

## Purpose

Define and manage qualitative competencies/objectives linked to a Subject entity
within the pedagogy bounded context. Each competency is tenant-scoped, subject-scoped,
named, and can be soft-deactivated.

---

## Requirements

### Requirement: SubjectCompetency Data Model

The system MUST persist each `SubjectCompetency` with the following fields:

| Field | Type | Constraint |
|-------|------|------------|
| `id` | Int PK | autoincrement |
| `uuid` | String | unique, public identifier |
| `subjectId` | Int FK | references `Subject`, required |
| `name` | String | required, non-empty, max 255 chars |
| `active` | Boolean | default `true` |
| `deletedAt` | DateTime | nullable, soft-delete marker |
| `createdAt` | DateTime | auto |
| `updatedAt` | DateTime | auto |

The combination `(subjectId, name)` MUST be unique among non-deleted records.

#### Scenario: Competency created for a subject

- GIVEN a valid `subjectId` and a non-empty `name`
- WHEN `POST /v1/subject-competencies` is called with valid auth
- THEN a record is persisted with `active=true`, `deletedAt=null`, and a generated `uuid`
- AND HTTP 201 is returned with the competency payload

#### Scenario: Duplicate name rejected for same subject

- GIVEN a competency with `name="Lectura comprensiva"` already exists for `subjectId=5`
- WHEN `POST /v1/subject-competencies` with the same `name` and `subjectId` is called
- THEN HTTP 409 is returned with `SubjectCompetencyAlreadyExistsError`
- AND no record is created

#### Scenario: Empty name rejected

- GIVEN a request body with `name=""`
- WHEN `POST /v1/subject-competencies` is called
- THEN HTTP 422 is returned with a validation error on `name`

---

### Requirement: List Competencies by Subject

The system SHALL expose `GET /v1/subject-competencies?subjectId=:id` that returns
all non-deleted competencies for a given subject ordered by `name ASC`.
The `subjectId` query parameter is REQUIRED. Results MAY be filtered by `active`.

#### Scenario: List active competencies for a subject

- GIVEN 3 active and 1 inactive competency exist for `subjectId=5`
- WHEN `GET /v1/subject-competencies?subjectId=5&active=true` is called
- THEN the response contains the 3 active competencies ordered by `name ASC`

#### Scenario: List all non-deleted competencies

- GIVEN 3 active and 1 inactive (but not soft-deleted) competency exist for `subjectId=5`
- WHEN `GET /v1/subject-competencies?subjectId=5` is called
- THEN the response contains all 4 competencies

#### Scenario: Missing subjectId parameter rejected

- GIVEN no `subjectId` in query string
- WHEN `GET /v1/subject-competencies` is called
- THEN HTTP 422 is returned with a validation error on `subjectId`

---

### Requirement: SubjectCompetency CRUD Endpoints

The system MUST expose the following REST endpoints:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/subject-competencies` | List by `subjectId`; filter by `active` |
| GET | `/v1/subject-competencies/:uuid` | Get single competency by UUID |
| POST | `/v1/subject-competencies` | Create |
| PATCH | `/v1/subject-competencies/:uuid` | Update `name` and/or `active` |
| DELETE | `/v1/subject-competencies/:uuid` | Soft delete |

#### Scenario: Get by UUID — not found

- GIVEN no competency exists with the given UUID
- WHEN `GET /v1/subject-competencies/:uuid` is called
- THEN HTTP 404 is returned with `SubjectCompetencyNotFoundError`

#### Scenario: Soft delete a competency

- GIVEN a competency with UUID `abc` and `deletedAt=null`
- WHEN `DELETE /v1/subject-competencies/abc` is called
- THEN `deletedAt` is set to current timestamp
- AND the competency no longer appears in list queries

#### Scenario: Update competency name

- GIVEN a competency with UUID `abc`
- WHEN `PATCH /v1/subject-competencies/abc` with `{ name: "Nueva competencia" }` is called
- THEN the record is updated and `updatedAt` is refreshed

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
