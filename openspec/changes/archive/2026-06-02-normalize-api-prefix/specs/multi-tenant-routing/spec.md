# Delta for multi-tenant-routing

## MODIFIED Requirements

### Requirement: Tenant Middleware

A `TenantMiddleware` MUST extract `dbName` from the JWT payload and attach the resolved `PrismaClient` to the request context. If the JWT is absent or `dbName` is null, requests to tenant-scoped endpoints MUST be rejected with 403. Requests to master-only endpoints (health, institution CRUD, auth, **profiles**) proceed without `dbName`. (Ref: R9)
(Previously: profiles were not listed as a master-only endpoint; the middleware applied tenant-scope rules to profile requests, causing 403s on `POST /v1/profiles`.)

#### Scenario: Health check works without JWT

- GIVEN no JWT in the request
- WHEN `GET /health` is called
- THEN the request succeeds and queries `educandow_master`

#### Scenario: Tenant-scoped endpoint without dbName returns 403

- GIVEN a JWT with `dbName: null`
- WHEN a tenant-scoped endpoint like `GET /v1/students` is called
- THEN the response is HTTP 403 with "No tenant context found"

#### Scenario: Profiles endpoint classified as master route

- GIVEN any request to `/v1/profiles` (e.g., `POST /v1/profiles`)
- WHEN `TenantMiddleware.isMasterRoute()` evaluates the request path
- THEN the method MUST return `true`
- AND the middleware SHALL NOT apply tenant-scope rules to the request

#### Scenario: Profiles request succeeds without dbName

- GIVEN a ROOT user or any user whose JWT has `dbName: null`
- WHEN `POST /v1/profiles` is called
- THEN the request MUST NOT be rejected with 403 due to missing tenant context
- AND the request proceeds to the handler against `educandow_master`

### Requirement: Middleware Route Scoping

`TenantMiddleware` MUST be applied exclusively to tenant-scoped routes (e.g., `/v1/students/*`, `/v1/teachers/*`, `/v1/grades/*`). It MUST NOT be applied to master-only routes (`/v1/institutions/*`, `/v1/auth/*`, `/v1/profiles/*`, `/health`). The route mapping MUST be explicit in module configuration.
(Previously: `/v1/profiles/*` was not listed in master-only routes — the middleware applied tenant-scope checks to profile endpoints.)

#### Scenario: Master-only routes bypass TenantMiddleware

- GIVEN a request to `POST /v1/institutions`
- WHEN the NestJS middleware chain processes it
- THEN `TenantMiddleware` does NOT execute for this request
- AND the master `PrismaClient` is used directly

#### Scenario: Profiles routes bypass TenantMiddleware

- GIVEN a request to `POST /v1/profiles`
- WHEN the NestJS middleware chain processes it
- THEN `TenantMiddleware` does NOT apply tenant-scope checks
- AND the request proceeds to the handler

#### Scenario: Tenant-scoped routes go through TenantMiddleware

- GIVEN an authenticated request to `GET /v1/students`
- WHEN the middleware chain processes it
- THEN `TenantMiddleware` executes and resolves the tenant `PrismaClient` from JWT `dbName`
