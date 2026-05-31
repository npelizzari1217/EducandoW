# System Modules CRUD Specification

## Purpose

ROOT-only management of the `modules` master table — list, create, update, and soft-delete system modules. No tenant context; operates directly on the master database. Pedagogical level: ALL.

## Requirements

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

### Requirement: Create Module

`POST /v1/modules` MUST create a new module. Request body SHALL contain `code` (1–50 chars, required) and `name` (1–100 chars, required). The system MUST trim both fields and uppercase `code` before persisting. Response SHALL be HTTP 201 with `{ data: { id, code, name } }`. Only ROOT role MAY create modules.

#### Scenario: ROOT creates a module

- GIVEN a ROOT user
- WHEN `POST /v1/modules` with `{ code: " grades ", name: " Grades System " }`
- THEN the system persists `{ code: "GRADES", name: "Grades System" }`
- AND returns HTTP 201 with `{ data: { id, code: "GRADES", name: "Grades System" } }`

#### Scenario: Duplicate code returns error

- GIVEN a module with `code: "GRADES"` already exists
- WHEN `POST /v1/modules` with `{ code: "GRADES", name: "Other" }`
- THEN the system MUST return an error due to unique constraint on `code`

#### Scenario: Missing required fields

- GIVEN a ROOT user
- WHEN `POST /v1/modules` with an empty body or missing `code`/`name`
- THEN the system MUST return HTTP 400 with validation errors

### Requirement: Update Module

`PATCH /v1/modules/:id` MUST allow partial updates to `code`, `name`, or `active`. Provided fields are updated; absent fields remain unchanged. The system MUST trim and uppercase `code` if provided, and trim `name`. Response SHALL be HTTP 200 with `{ data: { id, code, name, active } }`. If the module does not exist, response SHALL be `{ data: null }`. Only ROOT role MAY update modules.

#### Scenario: ROOT updates a module name

- GIVEN a module with `id: "m1"`, `code: "GRADES"`, `name: "Old Name"`, `active: true`
- WHEN `PATCH /v1/modules/m1` with `{ name: "New Name" }`
- THEN the system returns HTTP 200 with `{ data: { id: "m1", code: "GRADES", name: "New Name", active: true } }`

#### Scenario: Update non-existent module

- GIVEN no module with `id: "nonexistent"`
- WHEN `PATCH /v1/modules/nonexistent` with `{ name: "X" }`
- THEN the system returns HTTP 200 with `{ data: null }`

#### Scenario: ROOT deactivates a module via update

- GIVEN an active module with `id: "m1"`
- WHEN `PATCH /v1/modules/m1` with `{ active: false }`
- THEN the module's `active` field is set to `false`
- AND `updatedAt` is refreshed

### Requirement: Soft-Delete Module

`DELETE /v1/modules/:id` MUST NOT physically remove the record. It SHALL set `active: false` and `deletedAt` to the current timestamp. Response SHALL be HTTP 204 No Content. Only ROOT role MAY soft-delete modules.

#### Scenario: ROOT soft-deletes a module

- GIVEN an active module with `id: "m1"`
- WHEN `DELETE /v1/modules/m1` is called by a ROOT user
- THEN the module's `active` is set to `false` and `deletedAt` is set to the current timestamp
- AND the response is HTTP 204

#### Scenario: Soft-delete is idempotent

- GIVEN a module already soft-deleted (`active: false`, `deletedAt` set)
- WHEN `DELETE /v1/modules/:id` is called again
- THEN the system SHOULD return HTTP 204 (idempotent operation)

#### Scenario: Non-ROOT user cannot soft-delete

- GIVEN a user with role ADMIN
- WHEN `DELETE /v1/modules/:id` is called
- THEN the system MUST return HTTP 403 Forbidden

### Requirement: Modules UI Page

The system MUST provide a protected page at `/modules` accessible only to ROOT users. The page SHALL display a table of modules with columns: code, name, active (visual indicator), and actions (Edit, Delete). An inline form SHALL support creating and editing modules — code field MUST be disabled during edit, and active checkbox MUST appear only during edit. A print button SHALL trigger `window.print()` with `@media print` CSS that hides all except the table. The sidebar SHALL include a "Módulos" item visible only to ROOT users.

#### Scenario: ROOT views modules page

- GIVEN a ROOT user
- WHEN they navigate to `/modules`
- THEN the page displays a table listing all active modules

#### Scenario: Create module via inline form

- GIVEN a ROOT user on `/modules`
- WHEN they click "Nuevo módulo", fill code/name, and submit
- THEN the module is created and the table refreshes with the new entry

#### Scenario: Edit module — code is read-only

- GIVEN a ROOT user clicking "Editar" on a module
- THEN the inline form pre-fills all fields with the code field disabled
- AND an "Activo" checkbox appears (only in edit mode)

#### Scenario: Print produces clean module listing

- GIVEN a ROOT user on `/modules`
- WHEN they click "Imprimir"
- THEN `window.print()` is triggered
- AND `@media print` CSS hides navigation and shows only the table