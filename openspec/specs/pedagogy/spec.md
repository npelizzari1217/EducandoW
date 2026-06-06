# Pedagogy Specification (AcademicCycle)

## Purpose

Define el modelo de datos, VOs, endpoints, control de acceso y frontend para la gestión CRUD de Ciclos Lectivos (`AcademicCycle`). Un ciclo lectivo representa el período académico anual para un nivel educativo, con fechas de bimestre opcionales que pueden ser heredadas por los `CourseCycle` asociados.

---

## Requirements

### Requirement: AcademicCycle Extended Data Model

The system MUST persist each `AcademicCycle` with the following fields:

| Field | Type | Constraint |
|-------|------|------------|
| `id` | Int PK | autoincrement (replaces UUID PK) |
| `uuid` | String | unique, public identifier |
| `code` | String | alphanumeric uppercase 1–15 chars, `^[A-Z0-9][A-Z0-9\-]{0,14}$`, unique per tenant |
| `name` | String | required |
| `level` | `EducationalLevel` VO | INICIAL \| PRIMARIO \| SECUNDARIO \| TERCIARIO |
| `modality` | `EducationalModality` VO | COMUN \| TALLERES \| BILINGÜISMO |
| `startDate` | DateTime | required |
| `endDate` | DateTime | required |
| `active` | Boolean | default `true` |
| `deletedAt` | DateTime | nullable, soft-delete marker |
| `firstBimStart/End` | DateTime pair | optional, end > start |
| `secondBimStart/End` | DateTime pair | optional, end > start |
| `thirdBimStart/End` | DateTime pair | optional, end > start |
| `fourthBimStart/End` | DateTime pair | optional, end > start |

(Previously: `level` was `Enum` string, `modality` was a plain `String` field with no VO)

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

### Requirement: Value Object — CycleCode (Alphanumeric Format)

The `code` field on an academic cycle MUST be an alphanumeric uppercase string of 1 to 15 characters matching `^[A-Z0-9][A-Z0-9\-]{0,14}$`. Lowercase letters MUST be rejected. The first character MUST be alphanumeric (no leading hyphen). Codes longer than 15 characters MUST be rejected. Existing 4-digit numeric codes remain valid as a subset of the new format.

#### Scenario: Alphanumeric code accepted

- GIVEN a valid JWT with role ADMIN
- WHEN a cycle is created or updated with `code = "CICLO-2026-A"`
- THEN the system SHALL accept the request and persist the code as-is

#### Scenario: Lowercase code is normalized to uppercase

- GIVEN a valid JWT with role ADMIN
- WHEN a cycle is created with `code = "ciclo2026"`
- THEN the system SHALL normalize the code to `"CICLO2026"` and persist it
- AND the response SHALL include the normalized uppercase value

#### Scenario: Code exceeding 15 characters rejected

- GIVEN a valid JWT with role ADMIN
- WHEN a cycle is created or updated with a `code` of 16 or more characters
- THEN the system SHALL return HTTP 422 with a validation error on `code`

#### Scenario: Leading hyphen rejected

- GIVEN a valid JWT with role ADMIN
- WHEN a cycle is created with `code = "-ABC"`
- THEN the system SHALL return HTTP 422 with a validation error on `code`

#### Scenario: Legacy 4-digit numeric code still accepted

- GIVEN a cycle that already has `code = "2025"`
- WHEN it is retrieved via `GET /v1/academic-cycles`
- THEN the response SHALL include `code = "2025"` without error


---

### Requirement: List Active Academic Cycles

The system SHALL expose `GET /v1/academic-cycles` that returns academic cycles filtered by `active` status, `level`, with optional pagination. Results SHALL be ordered by `startDate DESC`.

Each cycle in the response SHALL include `uuid`, `code`, `name`, `level`, `modality`, `startDate`, `endDate`, `active`, and all 8 bimester date fields. The response MUST NOT include a `description` field in any cycle object.

#### Scenario: Active cycles returned for level

- GIVEN active academic cycles exist for level PRIMARIO
- WHEN `GET /v1/academic-cycles?active=true&level=PRIMARIO` is called
- THEN the response SHALL contain cycles where `active=true` and `level=PRIMARIO`
- AND each cycle SHALL include `uuid`, `code`, `name`, bimester dates, `startDate`, `endDate`, `active`
- AND no cycle object SHALL include a `description` field

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

#### Scenario: Active-only filter excludes inactive cycles

- GIVEN one active and one inactive cycle exist
- WHEN `GET /v1/academic-cycles?active=true` is called
- THEN only the active cycle SHALL appear in the response

#### Scenario: Omitting active filter returns all non-deleted cycles

- GIVEN one active and one inactive cycle exist, both with `deletedAt = null`
- WHEN `GET /v1/academic-cycles` is called without `active` param
- THEN both cycles are returned

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

### Requirement: Authorization

All endpoints SHALL require a valid JWT. Write endpoints SHALL require `@Roles('ROOT', { module: 'COURSES', action: '*' })`. Read endpoints SHALL require `@Roles('ROOT', { module: 'COURSES', action: 'read' })`.

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

---

### Requirement: AcademicCycle Management Frontend Page

The system MUST provide a page at `/academic-cycles` with:
- A filterable table: columns `code`, `name`, `level`, `active` (badge), `startDate`, `endDate`, action buttons (edit, toggle active, delete)
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

### Requirement: AcademicCycle domain entity uses EducationalLevel and EducationalModality VOs

The `AcademicCycle` domain entity MUST use `EducationalLevel` and `EducationalModality` VOs
for its `level` and `modality` fields respectively.
`AcademicCycleProps.level` MUST be typed as `EducationalLevel`.
`AcademicCycleProps.modality` MUST be typed as `EducationalModality`.
`CreateAcademicCycleInput.level` MUST accept `EducationalLevel`.
`CreateAcademicCycleInput.modality` MUST accept `EducationalModality` (optional, defaults to `COMUN`).
`AcademicCycle.create()` MUST store the VO instances directly.
Getters `level` and `modality` MUST return their respective VO types.

#### Scenario: Create with valid EducationalLevel VO

- GIVEN a valid `EducationalLevel` VO for `PRIMARIO` and a valid `EducationalModality` VO for `COMUN`
- WHEN `AcademicCycle.create({ level, modality, ... })` is called
- THEN the entity is created and `cycle.level.code` equals `EducationalLevelCode.PRIMARIO`
- AND `cycle.modality.code` equals `EducationalModalityCode.COMUN`

#### Scenario: Create without modality defaults to COMUN

- GIVEN a valid `EducationalLevel` VO and no `modality` provided
- WHEN `AcademicCycle.create({ level, ... })` is called
- THEN `cycle.modality.code` equals `EducationalModalityCode.COMUN` (0)

#### Scenario: isCurrent() works with VO-typed level and modality

- GIVEN an active `AcademicCycle` whose `startDate` is in the past and `endDate` in the future
- WHEN `cycle.isCurrent()` is called
- THEN it returns `true` regardless of VO types (date comparison is unaffected)

#### Scenario: Reconstruct from persisted numeric codes

- GIVEN numeric codes stored in DB (`level: 2`, `modality: 0`)
- WHEN `AcademicCycle.reconstruct(props)` is called with `EducationalLevel.fromCode(2)` and `EducationalModality.fromCode(0)`
- THEN `cycle.level.toString()` equals `"PRIMARIO"`
- AND `cycle.modality.toString()` equals `"COMUN"`

---

## Competency-Based Assessment (Added via competency-valuations change)

### Requirement: SubjectCompetency as Pedagogy Domain Entity

The `pedagogy` bounded context MUST include a `SubjectCompetency` domain entity
representing a named qualitative objective linked to a `Subject`.
The entity MUST be owned by the `pedagogy` package under
`packages/domain/src/pedagogy/entities/`.

Full spec: `openspec/specs/subject-competencies/spec.md`

#### Scenario: SubjectCompetency belongs to pedagogy bounded context

- GIVEN the system processes subject-level competency definitions
- WHEN `SubjectCompetency` is instantiated
- THEN it MUST reside in `packages/domain/src/pedagogy/entities/subject-competency.ts`
- AND it MUST NOT import from infrastructure or application layers

---

### Requirement: CompetencyValuation as Pedagogy Domain Entity

The `pedagogy` bounded context MUST include a `CompetencyValuation` domain entity
representing a student's qualitative assessment across four academic periods for
a single competency.
The entity MUST be owned by the `pedagogy` package under
`packages/domain/src/pedagogy/entities/`.

Full spec: `openspec/specs/competency-valuations/spec.md`

#### Scenario: CompetencyValuation belongs to pedagogy bounded context

- GIVEN the system processes student period-based competency assessments
- WHEN `CompetencyValuation` is instantiated
- THEN it MUST reside in `packages/domain/src/pedagogy/entities/competency-valuation.ts`
- AND it MUST NOT import from infrastructure or application layers

---

### Requirement: Repository Ports for Competency Entities

The `pedagogy` bounded context MUST define repository interfaces (ports) for
`SubjectCompetency` and `CompetencyValuation` in
`packages/domain/src/pedagogy/repositories/`.

These ports MUST follow the existing `IRepository` / Result pattern convention
already used in the domain package.

#### Scenario: Repository ports are in the domain layer

- GIVEN the Clean Architecture dependency rule
- WHEN `ISubjectCompetencyRepository` or `ICompetencyValuationRepository` is referenced
- THEN they MUST be importable from the domain package without pulling in Prisma or NestJS
