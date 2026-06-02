# Academic Cycle Query Specification

## Purpose

Provides an API to query academic cycles, enabling consumers to discover active cycles for a given institution and educational level.

## Requirements

### Requirement: List Active Academic Cycles

The system SHALL expose `GET /v1/academic-cycles` that returns academic cycles filtered by `active` status, `institutionId`, and `level`.

#### Scenario: Active cycles returned for institution and level

- GIVEN an institution has active academic cycles for level PRIMARIO
- WHEN `GET /v1/academic-cycles?active=true&institutionId={id}&level=2` is called
- THEN the response SHALL contain cycles where `active=true` and `level=2`
- AND each cycle SHALL include `id`, `code`, `name`, `level`, `startDate`, `endDate`, `active`
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

#### Scenario: Active-only filter excludes inactive cycles

- GIVEN one active and one inactive cycle exist for the same institution
- WHEN `GET /v1/academic-cycles?active=true&institutionId={id}` is called
- THEN only the active cycle SHALL appear in the response

### Requirement: Authorization

The endpoint SHALL require roles ADMIN, MANAGER, or TEACHER to access.

#### Scenario: Teacher can list cycles

- GIVEN a user with role TEACHER and a valid JWT
- WHEN the user calls `GET /v1/academic-cycles?active=true`
- THEN the response SHALL return HTTP 200 with matching cycles

#### Scenario: Student cannot list cycles

- GIVEN a user with role STUDENT
- WHEN the user calls `GET /v1/academic-cycles`
- THEN the response SHALL return HTTP 403
