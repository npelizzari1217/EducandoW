# Multi-Tenant Routing Specification

## Purpose

Define how the system routes database connections based on the tenant context in the JWT, replacing the singleton PrismaService with a dynamic factory. (Implements R4, R7)

## Requirements

### Requirement: JWT Includes dbName

The JWT payload MUST include `dbName` (the tenant database name) and `institutionId`. These fields are set during login from the user's associated institution. (Ref: R4)

#### Scenario: JWT payload contains tenant info

- GIVEN a user with `institutionId: "abc-123"` and `dbName: "educandow_abc-123"` in the database
- WHEN the user successfully authenticates
- THEN the issued JWT contains `{ sub, role, institutionId: "abc-123", dbName: "educandow_abc-123" }`

#### Scenario: User without institution gets no dbName

- GIVEN a user with `institutionId: null` (e.g., a ROOT user not yet assigned)
- WHEN the user authenticates
- THEN the JWT contains `{ sub, role, institutionId: null, dbName: null }`
- AND any request to tenant-scoped endpoints MUST return 403

### Requirement: PrismaService Dynamic Resolution

`PrismaService` MUST function as a factory that maintains a `Map<dbName, PrismaClient>` cache. On each request, middleware extracts `dbName` from the JWT and provides the corresponding `PrismaClient` to repositories. (Ref: R7)

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

A `TenantMiddleware` MUST extract `dbName` from the JWT payload and attach it to the request context. If the JWT is absent or `dbName` is null, requests to tenant-scoped endpoints MUST be rejected with 403. Requests to master-only endpoints (health, institution CRUD) proceed without `dbName`. (Ref: R9)

#### Scenario: Health check works without JWT

- GIVEN no JWT in the request
- WHEN `GET /health` is called
- THEN the request succeeds and queries `educandow_master`

#### Scenario: Tenant-scoped endpoint without dbName returns 403

- GIVEN a JWT with `dbName: null`
- WHEN a tenant-scoped endpoint like `GET /v1/students` is called
- THEN the response is HTTP 403 with "No tenant context found"