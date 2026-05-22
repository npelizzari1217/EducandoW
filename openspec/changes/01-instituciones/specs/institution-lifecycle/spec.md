# Institution Lifecycle Specification

## Purpose

Define the soft-delete mechanism and session blocking that controls institution lifecycle — from creation through deactivation. (Implements R9, R15)

## Requirements

### Requirement: Soft-Delete via active=false

`DELETE /v1/institutions/:id` MUST NOT physically remove the institution record or its tenant database. Instead, it MUST set `active: false` on the institution record in the master DB. The tenant database is preserved intact. Only ROOT role MAY soft-delete. (Ref: R15)

#### Scenario: Soft-delete preserves data

- GIVEN an existing active institution with `id: "abc-123"` and tenant DB `educandow_abc-123`
- WHEN `DELETE /v1/institutions/abc-123` is called by a ROOT user
- THEN the institution's `active` field is set to `false` in `educandow_master`
- AND the `educandow_abc-123` database remains intact and untouched
- AND the response is HTTP 204 No Content

#### Scenario: Already-deactivated institution returns 204

- GIVEN an institution with `active: false`
- WHEN `DELETE /v1/institutions/:id` is called again
- THEN the system SHOULD return HTTP 204 (idempotent operation)
- AND no error is raised

#### Scenario: Non-ROOT user cannot soft-delete

- GIVEN a user with role ADMIN
- WHEN they call `DELETE /v1/institutions/:id`
- THEN the system MUST return HTTP 403 Forbidden

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

### Requirement: Reactivation

An institution with `active: false` MAY be reactivated by setting `active: true` via `PATCH /v1/institutions/:id` by ROOT users only. After reactivation, login and session proceed normally.

#### Scenario: Reactivate institution

- GIVEN an inactive institution with `active: false`
- WHEN a ROOT user calls `PATCH /v1/institutions/:id` with `{ "active": true }`
- THEN the institution's `active` field is set to `true`
- AND users of that institution can now log in successfully

#### Scenario: Reactivation restores full access

- GIVEN a recently reactivated institution
- WHEN a user of that institution logs in
- THEN the system issues a JWT and the session works normally
- AND `GET /v1/institutions/me` returns `active: true`

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