# Institution Lifecycle Specification

## Purpose

Define the soft-delete mechanism and session blocking that controls institution lifecycle — from creation through deactivation. (Implements R9, R15)

## Requirements

### Requirement: Extended Identity Fields

The `Institution` entity MUST support the following additional identity and address fields. All are optional at creation time.

| Field | Type | Constraint |
|-------|------|-----------|
| `contact_email` | `string?` | Replaces `email`. Valid email format if provided |
| `phone` | `string?` | Max 30 chars |
| `address` | `string?` | Max 255 chars |
| `city` | `string?` | Max 100 chars |
| `province` | `string?` | Max 100 chars; displayed on constancia-regular PDF when present |
| `postal_code` | `string?` | Max 20 chars |
| `country` | `string?` | Max 100 chars |
| `ministry_reg` | `string?` | Max 100 chars |
| `cue` | `string?` | UNIQUE per spec tenant-database; max 20 chars |
| `website` | `string?` | Valid URL if provided, max 500 chars |

#### Scenario: All identity fields accepted on creation

- GIVEN a ROOT user submitting `POST /v1/institutions` with all 9 optional identity fields populated
- WHEN the request is validated and persisted
- THEN the institution is created with all fields stored as provided
- AND the response includes every supplied field

#### Scenario: contact_email replaces legacy email field

- GIVEN a creation request with `contact_email: "admin@school.edu"`
- WHEN the institution is persisted
- THEN the stored field name is `contact_email`, not `email`
- AND no `email` field exists on the Institution entity or DB column

#### Scenario: Invalid email format rejected

- GIVEN a request with `contact_email: "not-an-email"`
- WHEN validation runs
- THEN the system MUST reject it with a `ValidationError` indicating invalid email format

### Requirement: Create Institution

`POST /v1/institutions` MUST create a new institution. Only ROOT with `{ module: 'INSTITUTIONS', action: 'CREATE' }` MAY create. (Ref: R9) The full 25-field model MUST be accepted; fields not provided default to `null` or their specified default.

#### Scenario: ROOT creates an institution

- GIVEN a ROOT user with INSTITUTIONS:CREATE
- WHEN `POST /v1/institutions` with valid data (any subset of 25 fields)
- THEN the system returns HTTP 201 with the created institution including `db_name`

#### Scenario: ADMIN cannot create

- GIVEN an ADMIN user (not ROOT)
- WHEN `POST /v1/institutions`
- THEN the system MUST return HTTP 403

### Requirement: List Institutions with Tenant Filter

`GET /v1/institutions` MUST return all institutions for ROOT with `{ module: 'INSTITUTIONS', action: 'READ' }`. Non-ROOT MUST only see their own institution (JWT `institutionId`). The endpoint MUST support an optional `?active=true|false` query parameter to filter by `active` status; when the parameter is omitted, all institutions are returned regardless of active status.

#### Scenario: ROOT lists all

- GIVEN a ROOT user with INSTITUTIONS:READ
- WHEN `GET /v1/institutions`
- THEN the system returns HTTP 200 with all institutions (active and inactive)

#### Scenario: ROOT filters by active=true

- GIVEN multiple institutions, some with `active: false`
- WHEN `GET /v1/institutions?active=true`
- THEN only institutions with `active: true` are returned

#### Scenario: Non-ROOT sees only own institution

- GIVEN an ADMIN from institution "XYZ"
- WHEN `GET /v1/institutions`
- THEN the system returns HTTP 200 with only "XYZ"

#### Scenario: Unauthenticated rejected

- GIVEN a request without valid JWT
- WHEN `GET /v1/institutions`
- THEN the system MUST return HTTP 401

### Requirement: Get Institution by ID

`GET /v1/institutions/:id` MUST return a single institution. Only ROOT with `{ module: 'INSTITUTIONS', action: 'READ' }` MAY access. The response MUST include all 25 fields (excluding `smtp_pass`).

#### Scenario: ROOT gets by ID

- GIVEN a ROOT user with INSTITUTIONS:READ
- WHEN `GET /v1/institutions/:id` with valid UUID
- THEN the system returns HTTP 200 with full 25-field institution data

#### Scenario: Not found returns null

- GIVEN a ROOT user
- WHEN `GET /v1/institutions/nonexistent-uuid`
- THEN the system returns HTTP 200 with `{ data: null }`

#### Scenario: ADMIN cannot access by ID

- GIVEN an ADMIN (not ROOT)
- WHEN `GET /v1/institutions/:id`
- THEN the system MUST return HTTP 403

### Requirement: Update Institution

`PATCH /v1/institutions/:id` MUST use `@Roles('ROOT', 'ADMIN')`. ROOT MAY update any institution including `active`. ADMIN MAY only update their own institution (JWT `institutionId`) and MUST NOT change `active`. ADMIN MUST NOT change `cue`. Non-existent returns `{ data: null }`. The endpoint MUST accept any subset of the 25 mutable fields.

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

#### Scenario: ADMIN cannot change cue

- GIVEN an ADMIN editing own institution
- WHEN `PATCH /v1/institutions/:id` with `{ cue: "9999999" }`
- THEN the system MUST return HTTP 403 — only ROOT MAY change `cue`

#### Scenario: ROOT reactivates inactive institution

- GIVEN an institution with `active: false`
- WHEN ROOT calls `PATCH /v1/institutions/:id` with `{ active: true }`
- THEN `active` is set to `true` and users can log in

### Requirement: Soft-Delete via active=false

`DELETE /v1/institutions/:id` MUST set `active: false` (not physical delete). Tenant DB is preserved. Endpoint MUST use `@Roles('ROOT')` — no other role MAY access. (Ref: R15)

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

### Requirement: Session Blocked for Inactive Institutions

If `active: false` on a user's institution, the system MUST reject the session even though credentials are valid. This applies at two points: (1) during login authentication, and (2) on every subsequent request via tenant middleware. (Ref: R15)

#### Scenario: Login rejected for inactive institution

- GIVEN a user with valid credentials belonging to an institution where `active: false`
- WHEN they submit `POST /v1/auth/login`
- THEN the system MUST reject the login with HTTP 403 and a message like "Institution is inactive"
- AND no JWT is issued

#### Scenario: Existing session invalidated by deactivation

- GIVEN a user with a valid JWT whose institution is deactivated (`active: false`) AFTER their session started
- WHEN they make any authenticated request
- THEN the tenant middleware MUST check `active` status
- AND return HTTP 403 with "Institution is inactive"
- AND the frontend MUST redirect to login

#### Scenario: ROOT user can still access admin endpoints

- GIVEN a ROOT user (who may not belong to any institution)
- WHEN they make a request to master-only endpoints (e.g., `GET /v1/institutions`)
- THEN the request MUST succeed regardless of any institution's `active` status
- AND ROOT user list and CRUD operations are not blocked by institutional deactivation

### Requirement: Active Field in All Institution Responses

Every API response that includes institution data MUST include the `active` boolean field. The `GET /v1/institutions/me` response MUST include it so the frontend can check it proactively.

#### Scenario: Active field present in institution responses

- GIVEN an institution with `active: true`
- WHEN any endpoint returns institution data (`GET /v1/institutions`, `GET /v1/institutions/:id`, `GET /v1/institutions/me`)
- THEN the `active` field is included in the response

#### Scenario: List can filter by active status

- GIVEN multiple institutions, some active and some inactive
- WHEN `GET /v1/institutions?active=true` is called
- THEN only institutions with `active: true` are returned
- AND when `active` query param is omitted, all institutions are returned (both active and inactive)
