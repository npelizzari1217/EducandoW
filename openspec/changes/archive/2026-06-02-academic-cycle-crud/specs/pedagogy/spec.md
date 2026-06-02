# Delta for pedagogy (academic-cycle)

## ADDED Requirements

### Requirement: AcademicCycle Extended Data Model

The system MUST persist each `AcademicCycle` with the following fields:

| Field | Type | Constraint |
|-------|------|------------|
| `id` | Int PK | autoincrement (replaces UUID PK) |
| `uuid` | String | unique, public identifier |
| `code` | String | 4 numeric digits, unique per tenant |
| `name` | String | required |
| `description` | String | optional |
| `level` | Enum | INICIAL \| PRIMARIO \| SECUNDARIO \| TERCIARIO |
| `modality` | String | existing field, unchanged |
| `startDate` | DateTime | required |
| `endDate` | DateTime | required |
| `active` | Boolean | default `true` |
| `deletedAt` | DateTime | nullable, soft-delete marker |
| `firstBimStart/End` | DateTime pair | optional, end > start |
| `secondBimStart/End` | DateTime pair | optional, end > start |
| `thirdBimStart/End` | DateTime pair | optional, end > start |
| `fourthBimStart/End` | DateTime pair | optional, end > start |

#### Scenario: AcademicCycle created with all bimester dates

- GIVEN valid `name`, `level`, `code`, `startDate`, `endDate`, and all 8 bimester dates
- WHEN `POST /v1/academic-cycles` is called
- THEN a record is persisted with `uuid` generated and `active=true`
- AND all 8 bimester dates are stored

#### Scenario: AcademicCycle created without bimester dates

- GIVEN valid `name`, `level`, `code`, `startDate`, `endDate` — no bimester dates
- WHEN `POST /v1/academic-cycles` is called
- THEN the record is persisted with all bimester date fields as `null`

---

### Requirement: Value Object — CycleCode

The system MUST validate `code` as exactly 4 numeric digits. The system MUST reject codes that contain non-numeric characters or have a length other than 4.

#### Scenario: Valid 4-digit code is accepted

- GIVEN `code: "2024"`
- WHEN `POST /v1/academic-cycles` is called
- THEN the record is persisted with `code: "2024"`

#### Scenario: Non-numeric code is rejected

- GIVEN `code: "20AB"`
- WHEN `POST /v1/academic-cycles` is called
- THEN the system returns HTTP 400 with `CycleCodeInvalidError`
- AND no record is created

#### Scenario: Code shorter or longer than 4 digits is rejected

- GIVEN `code: "24"` or `code: "20240"`
- WHEN `POST /v1/academic-cycles` is called
- THEN the system returns HTTP 400 with `CycleCodeInvalidError`

---

### Requirement: Value Object — CycleDescription

The system MUST reject an empty string or whitespace-only value for `description`. If `description` is not provided, it MAY be stored as `null`.

#### Scenario: Valid description is stored

- GIVEN `description: "Ciclo lectivo del año 2026"`
- WHEN `POST /v1/academic-cycles` is called
- THEN `description` is persisted as provided

#### Scenario: Empty description is rejected

- GIVEN `description: "  "`
- WHEN `POST /v1/academic-cycles` is called
- THEN the system returns HTTP 400 with `CycleDescriptionInvalidError`

---

### Requirement: AcademicCycle CRUD Endpoints

The system MUST expose the following REST endpoints:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/academic-cycles` | List with filters; paginated; ordered by `startDate DESC` |
| GET | `/v1/academic-cycles/:uuid` | Get by UUID |
| POST | `/v1/academic-cycles` | Create |
| PATCH | `/v1/academic-cycles/:uuid` | Update |
| DELETE | `/v1/academic-cycles/:uuid` | Soft delete |
| PATCH | `/v1/academic-cycles/:uuid/toggle-active` | Toggle `active` flag |

`GET /v1/academic-cycles` MUST support `?level=`, `?active=`, `?page=`, `?pageSize=`. Filters SHOULD be combinable.

#### Scenario: List filtered by level and active

- GIVEN cycles exist for levels PRIMARIO and SECUNDARIO, mix of active/inactive
- WHEN `GET /v1/academic-cycles?level=PRIMARIO&active=true` is called
- THEN only active PRIMARIO cycles are returned, ordered by `startDate DESC`
- AND the response includes `{ data, page, pageSize, total }`

#### Scenario: Get by UUID — not found

- GIVEN no cycle exists with the given UUID
- WHEN `GET /v1/academic-cycles/:uuid` is called
- THEN the system returns HTTP 404 with `AcademicCycleNotFoundError`

#### Scenario: Create cycle with duplicate code

- GIVEN a cycle with `code: "2026"` already exists
- WHEN `POST /v1/academic-cycles` with `code: "2026"` is called
- THEN the system returns HTTP 409 with `CycleCodeAlreadyExistsError`
- AND no record is created

#### Scenario: Update cycle — bimester dates changed

- GIVEN an existing cycle with UUID `abc`
- WHEN `PATCH /v1/academic-cycles/abc` with new bimester dates is called
- THEN the cycle is updated and `updatedAt` reflects the modification

#### Scenario: Soft delete cycle

- GIVEN an existing cycle with UUID `abc` and `deletedAt = null`
- WHEN `DELETE /v1/academic-cycles/abc` is called
- THEN `deletedAt` is set to current timestamp
- AND the cycle no longer appears in list queries

#### Scenario: Toggle active on an active cycle

- GIVEN a cycle with `active=true`
- WHEN `PATCH /v1/academic-cycles/:uuid/toggle-active` is called
- THEN `active` is set to `false`

#### Scenario: Toggle active on an inactive cycle

- GIVEN a cycle with `active=false`
- WHEN `PATCH /v1/academic-cycles/:uuid/toggle-active` is called
- THEN `active` is set to `true`

---

### Requirement: AcademicCycle Access Control

All AcademicCycle write endpoints (POST, PATCH, DELETE) MUST require authentication and MUST enforce `@Roles('ROOT', { module: 'COURSES', action: '*' })`. Read endpoints (GET) MUST require authentication and MUST enforce `@Roles('ROOT', { module: 'COURSES', action: 'read' })`.

#### Scenario: ROOT user can create a cycle

- GIVEN a user with role ROOT
- WHEN `POST /v1/academic-cycles` is called with valid data
- THEN the cycle is created and HTTP 201 is returned

#### Scenario: User without COURSES module is rejected

- GIVEN a user with a valid JWT but without the COURSES module permission
- WHEN `POST /v1/academic-cycles` is called
- THEN the system returns HTTP 403

---

### Requirement: AcademicCycle Management Frontend Page

The system MUST provide a page at `/academic-cycles` with:
- A filterable table: columns `code`, `name`, `description`, `level`, `active` (badge), `startDate`, `endDate`, action buttons (edit, toggle active, delete)
- Filter controls: combobox for `level`, toggle for `active/inactive`
- A create/edit form with all fields including the 8 bimester dates

#### Scenario: Filter by level updates table

- GIVEN the page is loaded with cycles of multiple levels
- WHEN the user selects `level=SECUNDARIO` from the filter
- THEN the table re-fetches with `?level=SECUNDARIO`
- AND only SECUNDARIO cycles are displayed

#### Scenario: Create cycle from form

- GIVEN the user fills the form with valid `name`, `code`, `level`, `startDate`, `endDate`
- WHEN the user submits the form
- THEN `POST /v1/academic-cycles` is called and the table refreshes with the new cycle

---

## MODIFIED Requirements

### Requirement: List Active Academic Cycles

The system SHALL expose `GET /v1/academic-cycles` that returns academic cycles filtered by `active` status, `level`, with optional pagination. Results SHALL be ordered by `startDate DESC`.
(Previously: filtered by `active`, `institutionId`, `level` — no pagination, no `code`/`uuid` in response, no bimester dates)

Each cycle in the response SHALL include `uuid`, `code`, `name`, `description`, `level`, `modality`, `startDate`, `endDate`, `active`, and all 8 bimester date fields.

#### Scenario: Active cycles returned for level

- GIVEN active academic cycles exist for level PRIMARIO
- WHEN `GET /v1/academic-cycles?active=true&level=PRIMARIO` is called
- THEN the response SHALL contain cycles where `active=true` and `level=PRIMARIO`
- AND each cycle SHALL include `uuid`, `code`, `name`, `description`, bimester dates, `startDate`, `endDate`, `active`

#### Scenario: No active cycles for given filters

- GIVEN no active cycles exist for the specified level
- WHEN `GET /v1/academic-cycles?active=true&level=PRIMARIO` is called
- THEN the response SHALL return `{ data: [], page: 1, pageSize: 20, total: 0 }` with HTTP 200

#### Scenario: Unauthenticated request rejected

- GIVEN no valid JWT is provided
- WHEN `GET /v1/academic-cycles` is called
- THEN the response SHALL return HTTP 401

---

### Requirement: Filter by Active Status

The system SHALL support an `active` query parameter. When `active=true`, only cycles where `active=true` and `deletedAt IS NULL` SHALL be returned. When `active=false`, only inactive non-deleted cycles SHALL be returned. When omitted, all non-deleted cycles SHALL be returned.
(Previously: same filter behavior but no soft-delete awareness mentioned explicitly)

#### Scenario: Active-only filter excludes inactive cycles

- GIVEN one active and one inactive cycle exist
- WHEN `GET /v1/academic-cycles?active=true` is called
- THEN only the active cycle SHALL appear in the response

#### Scenario: Omitting active filter returns all non-deleted cycles

- GIVEN one active and one inactive cycle exist, both with `deletedAt = null`
- WHEN `GET /v1/academic-cycles` is called without `active` param
- THEN both cycles are returned

---

### Requirement: Authorization

All endpoints SHALL require a valid JWT. Write endpoints SHALL require `@Roles('ROOT', { module: 'COURSES', action: '*' })`. Read endpoints SHALL require `@Roles('ROOT', { module: 'COURSES', action: 'read' })`.
(Previously: allowed ADMIN, MANAGER, or TEACHER roles — no module-based access control)

#### Scenario: User with COURSES module can read cycles

- GIVEN a user with role TEACHER and module COURSES with action `read`
- WHEN `GET /v1/academic-cycles` is called
- THEN the response SHALL return HTTP 200 with matching cycles

#### Scenario: User without module permission is rejected on write

- GIVEN a user with a valid JWT but no COURSES module permission
- WHEN `POST /v1/academic-cycles` is called
- THEN the response SHALL return HTTP 403

#### Scenario: Student without module cannot access

- GIVEN a user with role STUDENT and no COURSES module
- WHEN `GET /v1/academic-cycles` is called
- THEN the response SHALL return HTTP 403
