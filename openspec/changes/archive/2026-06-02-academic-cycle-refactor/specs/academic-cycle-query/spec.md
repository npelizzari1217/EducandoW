# Delta for Academic Cycle Query

## MODIFIED Requirements

### Requirement: List Active Academic Cycles

The system SHALL expose `GET /v1/academic-cycles` that returns academic cycles filtered by `active` status, `institutionId`, and `level`.
(Previously: each cycle response included a `description` field alongside `id`, `name`, `level`, `startDate`, `endDate`, `active`.)

#### Scenario: Active cycles returned for institution and level

- GIVEN an institution has active academic cycles for level PRIMARIO
- WHEN `GET /v1/academic-cycles?active=true&institutionId={id}&level=2` is called
- THEN the response SHALL contain cycles where `active=true` and `level=2`
- AND each cycle SHALL include `id`, `name`, `level`, `startDate`, `endDate`, `active`
- AND the response MUST NOT include a `description` field in any cycle object

#### Scenario: No active cycles for given filters

- GIVEN no active cycles exist for the specified institution and level
- WHEN `GET /v1/academic-cycles?active=true&institutionId={id}&level=2` is called
- THEN the response SHALL return `{ data: [] }` with HTTP 200

#### Scenario: Unauthenticated request rejected

- GIVEN no valid JWT is provided
- WHEN `GET /v1/academic-cycles` is called
- THEN the response SHALL return HTTP 401

### Requirement: Filter by Active Status

The system SHALL support an `active` query parameter. When `active=true`, only cycles where `active=true` and `deletedAt IS NULL` SHALL be returned.
(Previously: no change to filtering logic — requirement kept identical.)

#### Scenario: Active-only filter excludes inactive cycles

- GIVEN one active and one inactive cycle exist for the same institution
- WHEN `GET /v1/academic-cycles?active=true&institutionId={id}` is called
- THEN only the active cycle SHALL appear in the response

### Requirement: Authorization

The endpoint SHALL require roles ADMIN, MANAGER, or TEACHER to access.
(Previously: no change to authorization — requirement kept identical.)

#### Scenario: Teacher can list cycles

- GIVEN a user with role TEACHER and a valid JWT
- WHEN the user calls `GET /v1/academic-cycles?active=true`
- THEN the response SHALL return HTTP 200 with matching cycles

#### Scenario: Student cannot list cycles

- GIVEN a user with role STUDENT
- WHEN the user calls `GET /v1/academic-cycles`
- THEN the response SHALL return HTTP 403

## ADDED Requirements

### Requirement: CycleCode Alphanumeric Format

The `code` field on an academic cycle MUST be an alphanumeric uppercase string of 1 to 15 characters matching `^[A-Z0-9][A-Z0-9\-]{0,14}$`. Lowercase letters MUST be rejected. Codes longer than 15 characters MUST be rejected. Existing 4-digit numeric codes remain valid as a subset of the new format.

#### Scenario: Alphanumeric code accepted

- GIVEN a valid JWT with role ADMIN
- WHEN a cycle is created or updated with `code = "CICLO-2026-A"`
- THEN the system SHALL accept the request and persist the code as-is

#### Scenario: Lowercase code rejected

- GIVEN a valid JWT with role ADMIN
- WHEN a cycle is created or updated with `code = "ciclo2026"`
- THEN the system SHALL return HTTP 422 with a validation error on `code`

#### Scenario: Code exceeding 15 characters rejected

- GIVEN a valid JWT with role ADMIN
- WHEN a cycle is created or updated with a `code` of 16 or more characters
- THEN the system SHALL return HTTP 422 with a validation error on `code`

#### Scenario: Legacy 4-digit numeric code still accepted

- GIVEN a cycle that already has `code = "2025"`
- WHEN it is retrieved via `GET /v1/academic-cycles`
- THEN the response SHALL include `code = "2025"` without error

## REMOVED Requirements

### Requirement: CycleDescription

(Reason: `description` is redundant — `name` already conveys the cycle's semantic identity. The field is removed from all layers: Prisma schema, entity, DTOs, use cases, controller, frontend types, UI, seed, and barrel exports. The `description` column SHALL be dropped from the `academic_cycles` table via a non-reversible migration.)
