# Multi-Tenant Routing Specification

## Purpose

Define how the system routes database connections based on the tenant context in the JWT, replacing the singleton PrismaService with a dynamic factory. (Implements R4, R7)

## Requirements

### Requirement: JWT Includes dbName

The JWT payload MUST include `dbName` (the tenant database name) and `institutionId`. These fields are set during login from the user's associated institution. Login MUST also verify `active: true` before issuing any JWT — a user from an inactive institution MUST NOT receive a JWT. (Ref: R4, R15)

#### Scenario: JWT payload contains tenant info

- GIVEN a user with `institutionId: "abc-123"` and `dbName: "educandow_abc-123"` in the database and `active: true`
- WHEN the user successfully authenticates
- THEN the issued JWT contains `{ sub, role, institutionId: "abc-123", dbName: "educandow_abc-123" }`

#### Scenario: Login rejected for inactive institution

- GIVEN a user with valid credentials belonging to an institution where `active: false`
- WHEN `POST /v1/auth/login` is submitted
- THEN the system MUST return HTTP 403 and MUST NOT issue a JWT

#### Scenario: User without institution gets no dbName

- GIVEN a user with `institutionId: null` (e.g., a ROOT user not yet assigned)
- WHEN the user authenticates
- THEN the JWT contains `{ sub, role, institutionId: null, dbName: null }`
- AND any request to tenant-scoped endpoints MUST return 403

### Requirement: PrismaService Dynamic Resolution

`PrismaService` MUST function as a factory that maintains a `Map<dbName, PrismaClient>` cache. On each request, `TenantMiddleware` extracts `dbName` from the JWT and attaches the resolved `PrismaClient` to the request context for repositories to consume. A `PrismaClient` is lazily instantiated on first use for a given `dbName`. (Ref: R7)

#### Scenario: Request routed to correct tenant DB

- GIVEN an authenticated request with JWT `dbName: "educandow_1002"`
- WHEN a repository executes a Prisma query
- THEN the query runs against `educandow_1002` database
- AND no data from other tenants is accessible

#### Scenario: Connection caching and reuse

- GIVEN two sequential requests for the same tenant `educandow_1002`
- WHEN the second request resolves its PrismaClient
- THEN the factory returns the cached `PrismaClient` instance from the `Map`
- AND a new connection is NOT created

#### Scenario: First request for a tenant creates a new client

- GIVEN the factory Map contains no entry for `educandow_9999`
- WHEN a request with JWT `dbName: "educandow_9999"` arrives
- THEN the factory lazily creates a new `PrismaClient` for `educandow_9999`
- AND adds it to the Map for subsequent requests

#### Scenario: dbName missing from JWT

- GIVEN an authenticated request with JWT that has no `dbName` (e.g., ROOT user without institution)
- WHEN the tenant middleware processes the request
- THEN the middleware MUST return HTTP 403 with a message like "No tenant context found"
- AND MUST NOT fall back to the master DB for tenant-scoped data

### Requirement: Master DB Repositories Remain Static

Repositories that operate on master DB tables (`PrismaInstitutionRepository`, `PrismaUserRepository`, `PrismaRefreshTokenRepository`) MUST connect to `educandow_master` regardless of the JWT tenant. They MUST NOT use the dynamic factory.

#### Scenario: Institution repository uses master DB

- GIVEN a ROOT user creating an institution
- WHEN `PrismaInstitutionRepository.save()` is called
- THEN the query runs against `educandow_master`
- AND the tenant routing has no effect on this operation

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

### Requirement: TenantMiddleware Active-Status Gate

`TenantMiddleware` MUST check the institution's `active` field after resolving the tenant from JWT `dbName`. If `active: false`, the middleware MUST return HTTP 403 with "Institution is inactive" — this applies to every request reaching a tenant-scoped path, not just login. (Ref: R15)

#### Scenario: Active=false blocks tenant request

- GIVEN a user with a valid JWT for institution `abc-123` where `active: false`
- WHEN a tenant-scoped request like `GET /v1/students` arrives
- THEN `TenantMiddleware` checks `active` via the master DB
- AND returns HTTP 403 with "Institution is inactive" before the request reaches the handler

#### Scenario: Active=true allows tenant request

- GIVEN a user with a valid JWT for institution `abc-123` where `active: true`
- WHEN a tenant-scoped request arrives
- THEN `TenantMiddleware` resolves the `PrismaClient` from the factory Map
- AND the request proceeds to the handler

#### Scenario: ROOT requests bypass active check

- GIVEN a ROOT user with JWT `institutionId: null, dbName: null`
- WHEN a master-only endpoint is called
- THEN `TenantMiddleware` MUST NOT check any institution's `active` status
- AND the request proceeds normally

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
