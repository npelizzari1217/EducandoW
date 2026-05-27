# Delta for Institution Lifecycle

## ADDED Requirements

### Requirement: Create Institution

`POST /v1/institutions` MUST create a new institution. Only ROOT with `{ module: 'INSTITUTIONS', action: 'CREATE' }` MAY create. (Ref: R9)

#### Scenario: ROOT creates an institution

- GIVEN a ROOT user with INSTITUTIONS:CREATE
- WHEN `POST /v1/institutions` with valid data
- THEN the system returns HTTP 201 with created institution

#### Scenario: ADMIN cannot create

- GIVEN an ADMIN user (not ROOT)
- WHEN `POST /v1/institutions`
- THEN the system MUST return HTTP 403

### Requirement: List Institutions with Tenant Filter

`GET /v1/institutions` MUST return all institutions for ROOT with `{ module: 'INSTITUTIONS', action: 'READ' }`. Non-ROOT MUST only see their own institution (JWT `institutionId`).

#### Scenario: ROOT lists all

- GIVEN a ROOT user with INSTITUTIONS:READ
- WHEN `GET /v1/institutions`
- THEN the system returns HTTP 200 with all institutions

#### Scenario: Non-ROOT sees only own institution

- GIVEN an ADMIN from institution "XYZ"
- WHEN `GET /v1/institutions`
- THEN the system returns HTTP 200 with only "XYZ"

#### Scenario: Unauthenticated rejected

- GIVEN a request without valid JWT
- WHEN `GET /v1/institutions`
- THEN the system MUST return HTTP 401

### Requirement: Get Institution by ID

`GET /v1/institutions/:id` MUST return a single institution. Only ROOT with `{ module: 'INSTITUTIONS', action: 'READ' }` MAY access.

#### Scenario: ROOT gets by ID

- GIVEN a ROOT user with INSTITUTIONS:READ
- WHEN `GET /v1/institutions/:id` with valid UUID
- THEN the system returns HTTP 200 with institution data

#### Scenario: Not found returns null

- GIVEN a ROOT user
- WHEN `GET /v1/institutions/nonexistent-uuid`
- THEN the system returns HTTP 200 with `{ data: null }`

#### Scenario: ADMIN cannot access by ID

- GIVEN an ADMIN (not ROOT)
- WHEN `GET /v1/institutions/:id`
- THEN the system MUST return HTTP 403

### Requirement: Update Institution

`PATCH /v1/institutions/:id` MUST use `@Roles('ROOT', 'ADMIN')`. ROOT MAY update any institution including `active`. ADMIN MAY only update their own institution (JWT `institutionId`) and MUST NOT change `active`. Non-existent returns `{ data: null }`.

#### Scenario: ROOT updates any institution

- GIVEN a ROOT user
- WHEN `PATCH /v1/institutions/:id` with `{ name: "New" }`
- THEN the system updates and returns HTTP 200

#### Scenario: ADMIN updates own institution

- GIVEN an ADMIN with JWT `institutionId: "xyz"`
- WHEN `PATCH /v1/institutions/xyz` with `{ phone: "555" }`
- THEN the system updates and returns HTTP 200

#### Scenario: ADMIN cannot update other institution

- GIVEN an ADMIN with JWT `institutionId: "xyz"`
- WHEN `PATCH /v1/institutions/abc`
- THEN the system MUST return HTTP 403

#### Scenario: ADMIN cannot change active

- GIVEN an ADMIN editing own institution
- WHEN `PATCH /v1/institutions/:id` with `{ active: false }`
- THEN the system MUST return HTTP 403 — only ROOT MAY change `active`

#### Scenario: ROOT reactivates inactive institution

- GIVEN an institution with `active: false`
- WHEN ROOT calls `PATCH /v1/institutions/:id` with `{ active: true }`
- THEN `active` is set to `true` and users can log in

## MODIFIED Requirements

### Requirement: Soft-Delete via active=false

`DELETE /v1/institutions/:id` MUST set `active: false` (not physical delete). Tenant DB is preserved. Endpoint MUST use `@Roles('ROOT')` — no other role MAY access. (Ref: R15)
(Previously: "Only ROOT role MAY soft-delete" — now explicit `@Roles`)

#### Scenario: Soft-delete preserves data

- GIVEN an active institution `abc-123` with tenant DB `educandow_abc-123`
- WHEN `DELETE /v1/institutions/abc-123` by ROOT
- THEN `active: false` in master DB, tenant DB intact, HTTP 204

#### Scenario: Already-deactivated returns 204

- GIVEN an institution with `active: false`
- WHEN `DELETE /v1/institutions/:id` by ROOT again
- THEN the system SHOULD return HTTP 204 (idempotent)

#### Scenario: Non-ROOT cannot soft-delete

- GIVEN an ADMIN user (not ROOT)
- WHEN `DELETE /v1/institutions/:id`
- THEN the system MUST return HTTP 403

## REMOVED Requirements

### Requirement: Reactivation

(Reason: Subsumed by "Update Institution". Reactivation via PATCH is now scenario "ROOT reactivates inactive institution".)