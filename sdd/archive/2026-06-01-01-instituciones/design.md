# Design: Institutions — 25-Field Multi-Tenant

**Change**: 01-instituciones | **Date**: 2026-06-01 | **Status**: Ready for TASKS

## Technical Approach

The codebase already implements majority of the architecture: split schemas, PrismaService factory (Map), TenantMiddleware with active gate, TenantContext (AsyncLocalStorage), 25-field Institution entity, all Value Objects (Cue, HexColor, SmtpConfig, EncryptedSmtpPass), full DTOs, complete controller, login active+dbName checks, and InstitutionContext. Five targeted implementation gaps remain:

1. **CreateInstitutionUseCase** only does `repo.save()` — must become 4-step atomic flow (master record → CREATE DATABASE → run migrations → create admin user) with full rollback
2. **ENCRYPTION_KEY** check only runs in production mode — must become unconditional bootstrap gate before HTTP bind
3. **Cue VO** missing max 20 char validation
4. **GET /v1/institutions** missing `?active` query filter; ADMIN cue restriction on PATCH needs hardening
5. **Frontend** missing 3 color fields (body/footer), CSS theme variables, role-gated form sections

## Architecture Decisions

### Decision 1: Tenant DB Creation Orchestration

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Inline in CreateInstitutionUseCase | Simple but mixes DB admin with domain logic | **Chosen** |
| Separate TenantProvisioningService | Cleaner but premature for single consumer | Rejected |
| Event-driven (emit InstitutionCreated → handler provisions DB) | Decoupled but adds async complexity, no rollback story | Rejected |

**Rationale**: Single consumer (POST /v1/institutions). Inline orchestration with try/catch + compensation is simplest to reason about for the 4-step atomic flow. Extract to dedicated service later when needed.

### Decision 2: Raw SQL for CREATE/DROP DATABASE

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Raw SQL via `pg` driver (CREATE DATABASE / DROP DATABASE) | Direct, no ORM abstraction needed | **Chosen** |
| Prisma `$executeRawUnsafe` | Same result, depends on existing PrismaClient | Rejected — Prisma won't connect to a DB that doesn't exist yet for CREATE |

**Rationale**: `CREATE DATABASE` must run against `postgres` maintenance DB, not the tenant DB. Use a short-lived `pg.Pool` or the master PrismaClient connecting to `postgres` DB.

### Decision 3: Migration Runner

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `prisma migrate deploy` via child_process.exec | Official tool, idempotent, handles locking | **Chosen** |
| Prisma programmatic migrate | Requires `@prisma/internals`, fragile API | Rejected |

**Rationale**: `prisma migrate deploy` is the documented way. Pass `DATABASE_URL=postgresql://.../educandow_{id}` via env. Must set Prisma output path for schema_tenant.

### Decision 4: Admin User Generation

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Accept admin_email in request body | User-controlled, no credential generation needed | **Chosen (primary)** |
| Auto-generate email + temporary password | Secure but requires email delivery | Fallback if admin_email absent |

**Rationale**: Spec says "provided in the request or auto-generated". ROOT creates institution → ROOT knows who the admin is. Accept `admin_email` field in POST body. Auto-generate temp password (16 chars) if not provided. Return credentials one-time in 201.

### Decision 5: ENCRYPTION_KEY Bootstrap Gate

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Check in `loadEnvConfig()` (main.ts before app.listen) | Fast, clean, before HTTP bind | **Chosen** |
| NestJS OnModuleInit guard in EncryptionModule | Correct lifecycle, but after module init | Rejected — HTTP may already bind |

**Rationale**: `loadEnvConfig()` runs in `main.ts` line 11 — before `NestFactory.create()` and `app.listen()`. Move the check from production-only to unconditional. Crash with clear message: `ENCRYPTION_KEY must be exactly 32 bytes`.

### Decision 6: CSS Theme Strategy

| Option | Tradeoff | Decision |
|--------|----------|----------|
| CSS custom properties on `:root` | Browser-native, no re-render needed | **Chosen** |
| CSS-in-JS theme provider | Framework-coupled, per-component overhead | Rejected |

**Rationale**: `document.documentElement.style.setProperty('--header-color', ...)` in a `useEffect` inside InstitutionProvider. Components read `var(--header-color)` via CSS or inline styles. Zero framework dependency.

### Decision 7: ?active Query Filter

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Add optional `active?: boolean` to `findAll` repository method, pass to Prisma where | Clean, single query | **Chosen** |
| Filter in use case after full fetch | Simple but loads all rows including inactive | Rejected |

**Rationale**: Repository `findAll()` currently hardcodes `where: { active: true }`. Change signature to `findAll(active?: boolean)`. When `active` is undefined, omit the where clause entirely.

## Data Flow

### Institution Creation (4-step atomic)

```
POST /v1/institutions
  │
  ▼
InstitutionController.create()
  │
  ▼
CreateInstitutionUseCase.execute()
  │
  ├─[1] Validate + create Institution entity (Cue uniqueness check before DB work)
  ├─[2] repo.save(inst)                           ──► educandow_master.institutions
  ├─[3] CREATE DATABASE educandow_{id}            ──► PostgreSQL (via postgres DB)
  ├─[4] prisma migrate deploy (schema_tenant)     ──► educandow_{id}
  ├─[5] Create admin user in master DB            ──► educandow_master.users
  │
  └─► 201 { id, name, db_name, admin: { email, password } }
  
  ON ANY FAILURE:
  ├─ Drop DATABASE educandow_{id} if created (step 3)
  ├─ Delete institution record from master (step 2)
  ├─ Delete admin user if created (step 5)
  └─► 500 { error }
```

### Tenant Request Routing
```
Request → AuthGuard (decodes JWT, sets req.user.dbName)
        → TenantMiddleware (checks isMasterRoute, resolves PrismaClient via Map, checks active)
        → TenantContext.run({ prismaClient, dbName, institutionId })
        → Repository reads prismaClient from TenantContext.getClient()
        → Query against tenant DB
```

### Theme Application
```
Login → AuthContext dispatches 'auth:login'
      → InstitutionProvider listens, calls GET /v1/institutions/me
      → Receives branding colors
      → useEffect: document.documentElement.style.setProperty('--header-color', color)
      → Components render with var(--header-color)
```

## Error Handling

| Failure Point | Detection | Compensation | HTTP |
|---------------|-----------|-------------|------|
| Master record write fails | Prisma error | None (no DB created yet) | 500 |
| CREATE DATABASE fails | pg error | Delete master record | 500 |
| Migration fails | prisma exit code ≠ 0 | DROP DATABASE + delete master record | 500 |
| Admin creation fails | Prisma error | DROP DATABASE + delete master record | 500 |
| PrismaClient connection (tenant) | Connection error | Log, return 503 with retry | 503 |
| Missing ENCRYPTION_KEY | loadEnvConfig() | Crash before HTTP bind, clear message | N/A |
| Inactive institution login | active === false | Reject login, no JWT | 403 |
| Inactive institution tenant request | TenantMiddleware check | Block request | 403 |
| Duplicate CUE | findByCue check | Reject before DB creation | 409 |

## File Manifest

### Slice 1: Schema + Domain
| File | Action | Description |
|------|--------|-------------|
| `packages/domain/src/institution/value-objects/cue.ts` | Modify | Add max 20 char validation |
| `packages/domain/src/institution/value-objects/__tests__/cue.test.ts` | Create | Unit tests for max-length, null, valid |

### Slice 2: Branding + SMTP + Notifications
| File | Action | Description |
|------|--------|-------------|
| `api/src/infrastructure/config/env.config.ts` | Modify | Unconditional ENCRYPTION_KEY 32-byte check |
| `api/src/main.ts` | Modify | Call loadEnvConfig before NestFactory.create (already done, verify) |
| `api/src/infrastructure/config/__tests__/env.config.test.ts` | Create | Test crash on missing/invalid ENCRYPTION_KEY |

### Slice 3: Multi-Tenant
| File | Action | Description |
|------|--------|-------------|
| `api/src/infrastructure/persistence/postgres-admin.service.ts` | Create | CREATE/DROP DATABASE via pg driver |
| `api/src/application/institution/use-cases/institution.use-cases.ts` | Modify | Rewrite CreateInstitutionUseCase with 4-step atomic flow |
| `api/src/application/institution/use-cases/create-institution-admin.use-case.ts` | Create | Admin user creation (hash password, insert into master.users) |
| `api/src/application/institution/use-cases/__tests__/create-institution.test.ts` | Create | Integration test with rollback scenarios |
| `api/src/presentation/institution/dto/create-institution-full.dto.ts` | Modify | Add admin_email to schema |
| `api/src/app.module.ts` | Modify | Register PostgresAdminService provider |

### Slice 4: Endpoints
| File | Action | Description |
|------|--------|-------------|
| `api/src/presentation/institution/institution.controller.ts` | Modify | List: add ?active query param. Create: return admin credentials. PATCH: enforce ADMIN cue restriction |
| `api/src/application/institution/use-cases/institution.use-cases.ts` | Modify | ListInstitutionsUseCase: accept active filter. UpdateInstitutionUseCase: harden ADMIN cannot change cue |
| `packages/domain/src/institution/repositories/institution-repository.ts` | Modify | findAll(active?: boolean) |
| `api/src/infrastructure/persistence/prisma/repositories/prisma-institution.repository.ts` | Modify | findAll: conditional where clause |

### Slice 5: Frontend
| File | Action | Description |
|------|--------|-------------|
| `web/src/context/institution-context.tsx` | Modify | Add CSS theme variable application (useEffect), add body/footer colors |
| `web/src/pages/dashboard/institutions.tsx` | Modify | Add body_color, footer_color, footer_text_color fields. Add isRoot role gate for SMTP/Branding/active sections. Handle admin_user in create response |
| `web/src/context/theme-context.tsx` | Modify | Read CSS vars from InstitutionContext |
| `web/src/components/layout/dashboard-layout.tsx` | Modify | Apply theme CSS class from InstitutionContext |

## Interfaces / Contracts

### PostgresAdminService
```typescript
interface PostgresAdminService {
  createDatabase(dbName: string): Promise<void>;
  dropDatabase(dbName: string): Promise<void>;
  runTenantMigrations(dbName: string): Promise<void>;
}
```

### Create Institution Response (extended)
```typescript
{
  data: {
    id: string;
    name: string;
    db_name: string;
    admin?: {
      email: string;
      password: string;  // one-time display
    };
    // ... all 25 fields
  }
}
```

### InstitutionRepository.findAll (extended)
```typescript
findAll(active?: boolean): Promise<Institution[]>;
// active === true   → WHERE active = true
// active === false  → WHERE active = false
// active undefined  → no WHERE clause (all)
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (domain) | Cue VO max-length | `packages/domain` Vitest |
| Unit (domain) | Institution.create with 25 fields | Vitest |
| Unit (config) | ENCRYPTION_KEY bootstrap validation | Vitest |
| Integration (api) | Create institution 4-step flow (happy + 3 rollback points) | NestJS TestingModule + test DB |
| Integration (api) | List institutions with ?active filter | NestJS TestingModule |
| Integration (api) | PATCH cue restriction for ADMIN | NestJS TestingModule |
| E2E (api) | Full create → login → /me → theme roundtrip | SuperTest |
| Unit (web) | InstitutionContext CSS variable application | Vitest + jsdom |
| Unit (web) | Form role-gating (ROOT vs ADMIN sections) | Vitest + React Testing Library |

## Open Questions

- None. All architectural decisions resolved.

---

**Ready for**: sdd-tasks
