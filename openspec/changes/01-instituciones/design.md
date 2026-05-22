# Design: Módulo 01 — Instituciones Multi-Tenant

## Technical Approach

Split the monolithic Prisma schema into `schema_master.prisma` (Institution 25 columns + User + RefreshToken) and `schema_tenant.prisma` (11 pedagogical tables without `institutionId`). Replace the singleton `PrismaService` with a factory that maintains a `Map<dbName, PrismaClient>`. Inject `dbName` into the JWT payload so a `TenantMiddleware` can resolve the correct PrismaClient per request. Encrypt `smtp_pass` with AES-256-GCM. Expose `GET /v1/institutions/me` for the frontend's new `InstitutionContext` to load branding, flags, and levels at login.

## Architecture Decisions

| Decision | Options | Tradeoff | Choice |
|----------|---------|----------|--------|
| Schema separation | **A)** Two `.prisma` files, two `PrismaClient` instances, two `prisma generate` runs **B)** Single schema with `@@schema` namespacing | A works today with any Prisma version; B requires Prisma 5.2+ and adds schema-complexity. A is the safe path. | **A** — two separate schema files |
| Tenant-to-master connection | **A)** `AsyncLocalStorage` stores dbName on request, repos read it **B)** `REQUEST`-scoped DI with per-request PrismaClient **C)** Middleware sets `request.prisma` directly | A is NestJS-idiomatic and doesn't pollute DI tree. B would require all repos to be request-scoped (memory heavy). | **A** — AsyncLocalStorage + middleware |
| smtp_pass encryption | **A)** AES-256-GCM with `crypto.createCipheriv` **B)** Environment-level encryption via `pgcrypto` **C)** Application-level vault (HashiCorp) | A is zero-dependency, 32-byte key from env, encrypt/decrypt at app boundary. C is overkill for this stage. | **A** — Node `crypto` module, AES-256-GCM |
| Active institution check | **A)** Check in TenantMiddleware on every request **B)** Check only at login | A prevents already-issued JWTs from accessing a deactivated institution. B wouldn't catch mid-session deactivation. | **A** — middleware validates `active` per request |
| POST /institutions rollback | **A)** Saga pattern with compensating actions **B)** Try/catch with delete DB + delete record | A is more robust but complex; B is sufficient for the happy path. Only write the record AFTER DB creation succeeds. | **B** — sequential with manual rollback in catch |

## Data Model: Schema Master

```prisma
// api/prisma/schema_master.prisma
datasource db {
  provider = "postgresql"
  url      = env("MASTER_DATABASE_URL")
}

model Institution {
  id                String    @id @default(uuid())
  name              String
  cue               String?   @unique
  ministry_reg      String?
  address           String?
  city              String?
  postal_code       String?
  country           String?   @default("AR")
  phone             String?
  website           String?
  contact_email     String?
  logo_url          String?
  header_color      String?   // ^#[0-9a-fA-F]{6}$
  header_text_color String?
  body_text_color   String?
  smtp_host         String?
  smtp_user         String?
  smtp_pass         String?   // AES-256-GCM ciphertext
  smtp_encryption   String?   // "TLS" | "SSL" | "NONE"
  smtp_port         Int?
  send_email        Boolean   @default(false)
  send_messages     Boolean   @default(false)
  socket_host       String?
  socket_port       Int?
  active            Boolean   @default(true)
  db_name           String    @unique
  levels            String[]
  created_at        DateTime  @default(now())
  updated_at        DateTime  @updatedAt

  users         User[]
  refreshTokens RefreshToken[]

  @@map("institutions")
}

model User { /* unchanged — stays in master */ }
model RefreshToken { /* unchanged — stays in master */ }
```

**Tenant schema** (`api/prisma/schema_tenant.prisma`): identical to current `schema.prisma` models Student, Teacher, Enrollment, Subject, CourseSection, SubjectAssignment, Grade, Attendance — **minus the `institution` relation and `institutionId` field on all of them**. Generator set to output to `@prisma/tenant-client`.

## Component Design

### 1. PrismaService → Factory

```
api/src/infrastructure/persistence/prisma/prisma.service.ts
```

- Stores `master: PrismaClient` (always connected to `MASTER_DATABASE_URL`)
- Stores `tenants: Map<string, PrismaClient>` (lazy, keyed by `dbName`)
- `getClient(dbName?: string): PrismaClient` — returns master when dbName is undefined/null; otherwise returns/creates tenant client using `DATABASE_URL` template where db name is swapped at runtime
- `onModuleDestroy()` disconnects all cached clients
- Tenant client creation: reads `MASTER_DATABASE_URL`, replaces database name portion with `dbName`, instantiates `PrismaClient` with that URL

### 2. TenantMiddleware

```
api/src/infrastructure/auth/tenant.middleware.ts
```

- Implements `NestMiddleware` — applied globally in `AppModule.configure()`
- Reads `request.user` (set by AuthGuard)
- Extracts `dbName` and `institutionId` from `request.user`
- For master-only routes (`/health`, `POST /v1/institutions`, `GET /v1/institutions`, `DELETE /v1/institutions/:id`, `/v1/auth/*`): sets `request.prismaClient = masterClient`
- For tenant-scoped routes: if `dbName` is null → **403**. Otherwise checks `active` via master DB query → if false → **403**. If true → sets `request.prismaClient = factory.getClient(dbName)`
- Stores active check result in `AsyncLocalStorage` so repos can access `prismaClient` without DI-by-request

### 3. InstitutionContext (React)

```
web/src/context/institution-context.tsx
```

- `InstitutionProvider` wraps children at `App` level (sibling to `AuthProvider`)
- On mount (once user is authenticated): calls `GET /v1/institutions/me`
- Stores: `id`, `name`, `logo_url`, `header_color`, `header_text_color`, `body_text_color`, `send_email`, `send_messages`, `socket_host`, `socket_port`, `active`, `levels[]`
- On fetch failure: falls back to defaults (`levels: []`, all colors null, `send_email: false`, `send_messages: false`, `active: true`)
- Exports `useInstitution()` hook

## API Design

| Method | Endpoint | Auth | Status | Request Body / Response |
|--------|----------|------|--------|------------------------|
| `POST` | `/v1/institutions` | ROOT | 201 | Body: 25-field DTO (validated with Zod, extended from current `CreateInstitutionSchema`). Response: `{ id, name, db_name, cue }`. Side effect: creates tenant DB + runs migrations. |
| `GET` | `/v1/institutions` | ROOT, ADMIN, MANAGER, TEACHER | 200 | Query: `?active=true\|false` (optional). Response: `{ data: Institution[] }` — all fields EXCEPT `smtp_pass` |
| `GET` | `/v1/institutions/:id` | Same | 200 | Response: full Institution minus `smtp_pass` |
| `GET` | `/v1/institutions/me` | Any auth'd | 200/404 | NEW. Reads `institutionId` from JWT. Returns full config: brand colors, logo, SMTP meta (no pass), notification toggles, socket, `levels[]`, `active`, `db_name`. 404 if `institutionId` is null. |
| `PATCH` | `/v1/institutions/:id` | ROOT | 200 | NEW. Body: partial institution fields (Zod partial). Allows updating branding, SMTP, toggles, `active` |
| `DELETE` | `/v1/institutions/:id` | ROOT | 204 | Sets `active = false`. Idempotent on already-inactive. Never deletes tenant DB. |
| `GET` | `/v1/institutions/:id/levels` | Same | 200 | Existing — unchanged |

## File Changes

### Created (11 files)

| File | Slice | Purpose |
|------|-------|---------|
| `api/prisma/schema_master.prisma` | 1 | Institution (25 cols) + User + RefreshToken |
| `api/prisma/schema_tenant.prisma` | 1 | Pedagogical tables without institutionId |
| `packages/domain/src/institution/value-objects/hex-color.ts` | 1 | Self-validating `^#[0-9a-fA-F]{6}$` |
| `packages/domain/src/institution/value-objects/cue.ts` | 1 | Alphanumeric CUE validation |
| `packages/domain/src/institution/value-objects/smtp-config.ts` | 3 | Bundled SMTP fields as value object |
| `api/src/infrastructure/auth/tenant.middleware.ts` | 2 | JWT → dbName extraction, active check, AsyncLocalStorage |
| `api/src/infrastructure/crypto/encryption.service.ts` | 3 | AES-256-GCM encrypt/decrypt for smtp_pass |
| `api/src/presentation/institution/dto/create-institution-full.dto.ts` | 1 | Zod schema for 25-field creation |
| `api/src/presentation/institution/dto/update-institution.dto.ts` | 3 | Zod partial for PATCH endpoint |
| `web/src/context/institution-context.tsx` | 4 | React context + provider for institution config |
| `web/src/hooks/use-theme.ts` | 5 | Applies CSS variables from InstitutionContext |

### Modified (13 files)

| File | Slice | Changes |
|------|-------|---------|
| `packages/domain/src/institution/entities/institution.ts` | 1 | 25 props, `active`, `dbName`, update method |
| `packages/domain/src/institution/value-objects/index.ts` | 1 | Export new VOs |
| `packages/domain/src/institution/repositories/institution-repository.ts` | 1 | Add `findByCue`, `softDelete`, `update` |
| `api/src/infrastructure/persistence/prisma/prisma.service.ts` | 2 | Singleton → factory with `Map<dbName, PrismaClient>` |
| `api/src/infrastructure/persistence/prisma/repositories/prisma-institution.repository.ts` | 1, 3 | 25-field toDomain/toPrisma mapping, uses master client, softDelete |
| `api/src/infrastructure/auth/jwt-auth-port.ts` | 2 | Add `dbName` to JwtPayload + AuthPort interface |
| `api/src/application/auth/ports/auth-port.ts` | 2 | Add `dbName: string?` to sign/verify payload |
| `api/src/application/auth/use-cases/login.use-case.ts` | 2 | Resolve `dbName` from institution, include in JWT + active check |
| `api/src/application/institution/use-cases/institution.use-cases.ts` | 1, 2, 3 | CreateUseCase: 25 fields + tenant DB creation. DeleteUseCase → softDelete. New: GetMeUseCase, UpdateInstitutionUseCase |
| `api/src/presentation/institution/institution.controller.ts` | 1, 2, 3, 4 | Add `POST` with full DTO, `PATCH`, `GET /me`. DELETE → soft-delete. |
| `api/src/presentation/institution/institution.module.ts` | 1, 2 | Wire new use cases + factory PrismaService |
| `api/src/infrastructure/config/env.config.ts` | 2, 3 | Add `MASTER_DATABASE_URL`, `ENCRYPTION_KEY` |
| `web/src/pages/dashboard/institutions.tsx` | 3, 4 | 25-field form with branding/SMTP sections |
| `web/src/components/layout/sidebar.tsx` | 5 | Filter `navItems` by `levels[]` from InstitutionContext, hide sections by flags |

### Deleted (1 file)

| File | Reason |
|------|--------|
| `api/prisma/schema.prisma` | Split into `schema_master.prisma` + `schema_tenant.prisma` |

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Domain | Institution entity with 25 props, HexColor VO, Cue VO | `packages/domain/src/institution/__tests__/`. Vitest unit tests for create/reconstruct, validation rejection, Value Object guards |
| Domain | SmtpConfig VO — validation of encryption enum | Unit test with valid TLS/SSL/NONE, reject STARTTLS |
| Application | CreateInstitutionUseCase — tenant DB mock, rollback | Mock `PrismaService` and `exec`, verify DB created, migrations called, rollback on failure |
| Application | LoginUseCase — dbName in JWT, active check rejection | Mock repos, verify JWT includes `dbName`, verify active=false → 403 |
| Infrastructure | EncryptionService — encrypt/decrypt roundtrip | Unit test with known key, verify plaintext ≠ ciphertext, decrypt recovers original |
| Infrastructure | PrismaService factory — same dbName returns cached client | Integration test with test containers or in-memory SQLite |
| Infrastructure | TenantMiddleware — dbName extraction, active check, master vs tenant routing | Integration test with mocked PrismaService |
| API e2e | POST /institutions → 201 + tenant DB | Supertest with mocked `exec` for migrations |
| API e2e | GET /me → 200 with full config, no smtp_pass | Supertest with seeded data |
| API e2e | DELETE → active=false, login rejected post-delete | Two-step: delete, then attempt login → 403 |
| Frontend | InstitutionContext — loads data, fallback on error | Vitest + React Testing Library, mock apiClient |
| Frontend | Sidebar — filters by levels[] | Render sidebar with mock context, verify hidden items |

## Migration Plan

1. **Schema split**: Move current `schema.prisma` to `schema_master.prisma`, strip pedagogical models into `schema_tenant.prisma`, remove `institutionId` + `Institution` relation from tenant models
2. **Prisma generate**: Run `prisma generate --schema=api/prisma/schema_master.prisma` and `prisma generate --schema=api/prisma/schema_tenant.prisma` → output to `@prisma/client` and `@prisma/tenant-client`
3. **Existing DB migration**: Run `prisma migrate dev --schema=api/prisma/schema_master.prisma --name expand_institution_25_fields` to add the new columns to the existing `institutions` table (existing data has NULL for new cols — acceptable since no production)
4. **No data migration needed**: No production data. New tenant DBs are created automatically from POST.
5. **Rollback**: `git revert` + drop tenant DBs manually. Master schema has `institutionId` on tenant tables removed via migration — revert re-adds it.

## Security

- **smtp_pass**: Encrypted at persistence layer (repository calls `EncryptionService.encrypt()` before Prisma write, `DecryptionService.decrypt()` only when SMTP transport is instantiated for sending). NEVER returned in any API response — `toResponse()` mapper explicitly excludes `smtp_pass`.
- **Tenant isolation**: Each tenant DB is a separate PostgreSQL database. No query crosses databases. Connection strings are constructed at runtime — never exposed to clients.
- **ENCRYPTION_KEY**: Required at startup. 32 bytes. `loadEnvConfig()` validates length and throws on boot if missing or wrong size.
- **Output sanitization**: `InstitutionResponseDTO` (Zod schema for API output) explicitly omits `smtp_pass`. The `GET /me` controller manually builds response object excluding it.
