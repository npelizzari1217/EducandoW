# Delta for system-modules-crud

## MODIFIED Requirements

### Requirement: List Active Modules

`GET /v1/modules` MUST return all modules where `active: true` and `deletedAt: null`, ordered by `code` ascending. Each entry SHALL include `id`, `code`, `name`, `active`, `createdAt`, `updatedAt`, and `actions` (array of action codes from `module_actions`). Any authenticated user MAY access this endpoint.

(Previously: ROOT-only access; response lacked `actions` field.)

#### Scenario: Authenticated user lists modules with actions

- GIVEN any authenticated user with a valid JWT
- WHEN `GET /v1/modules` is called
- THEN the system returns HTTP 200 with `{ data: [...] }` containing active modules sorted by `code`
- AND each module includes `id`, `code`, `name`, `active`, `createdAt`, `updatedAt`, `actions`

#### Scenario: Module actions populated from module_actions

- GIVEN module USERS has actions READ, CREATE, UPDATE, DELETE in the database
- WHEN `GET /v1/modules` is called
- THEN the USERS entry includes `actions: ["READ", "CREATE", "UPDATE", "DELETE"]`

#### Scenario: Soft-deleted modules excluded from list

- GIVEN a module with `active: false` and `deletedAt` set
- WHEN `GET /v1/modules` is called
- THEN the soft-deleted module MUST NOT appear in the response

#### Scenario: Unauthenticated request rejected

- GIVEN a request without a valid JWT
- WHEN `GET /v1/modules` is called
- THEN the system MUST return HTTP 401 Unauthorized
