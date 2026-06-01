# Design: 03-user-profiles — User Profiles (Permission Templates)

## Technical Approach

The codebase **already contains ~90% of the implementation**: the `Profile` + `ProfileModulePermission` tables exist in the schema, all 7 REST endpoints are wired in `ProfilesController`, the 7 use cases are implemented in `profiles.use-cases.ts`, `profileToModuleAccess` conversion exists, `CreateUserUseCase` and `UpdateUserUseCase` already handle `profileId`, and both frontend pages (`profiles.tsx`, `users.tsx` ProfileSelector) are built. The remaining work is **spec alignment**: normalizing API responses, tightening validation, fixing a missing parameter pass-through, and adjusting seed data.

No new files are created. No files are deleted. Only 5 files are modified — 3 backend, 1 DTO, 1 frontend.

## Architecture Decisions

### Decision 1: Existing NestJS module structure — extend, not rebuild

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Rebuild profiles module from scratch | Clean separation, but reimplements 7 use cases already working | ❌ Rejected |
| Extend existing ProfilesModule + UsersModule | Minimal change, existing patterns respected, low regression risk | ✅ **Chosen** |

**Rationale**: The `ProfilesModule` at `api/src/presentation/profiles/` already has controller, module, DTOs, and 7 use cases in `api/src/application/profiles/use-cases/profiles.use-cases.ts`. It is already imported in `app.module.ts`. Rewriting it would introduce unnecessary risk.

### Decision 2: 12-module normalization — backend responsibility

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Return only stored permission rows; client fills defaults | Smaller payload but every client must know all 12 modules | ❌ Rejected |
| Normalize to 12 entries server-side (absent → all-false) | Slightly larger payload but single source of truth | ✅ **Chosen** |

**Rationale**: `GetProfilePermissionsUseCase` already does this for `GET /:id/permissions`. `GetProfileUseCase` (`GET /:id`) must do the same per spec scenario "Returns exactly 12 module entries". Both endpoints share the same normalization logic — extract to a shared helper.

### Decision 3: `assignedModuleCount` — rename in response, not in Prisma

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Use `_count.permissions` as-is (Prisma default) | No code change, leaks Prisma internal naming | ❌ Rejected |
| Map to `assignedModuleCount` in use case response | Explicit, spec-compliant, frontend needs coordinate update | ✅ **Chosen** |

**Rationale**: The spec explicitly names this field `assignedModuleCount`. Since rows with all booleans false are never stored (see `UpsertPermissionsUseCase` filter), `_count.permissions` == `assignedModuleCount` numerically. Map it so the API contract is explicit.

### Decision 4: `profileId: null` on update — keep user_modules untouched

**Choice**: When `PATCH /v1/users/:id` receives `profileId: null`, set `user.profileId = null` but do NOT touch `user_modules`.  
**Rationale**: Already implemented correctly in `UpdateUserUseCase` — the `if (input.profileId !== undefined)` block only deletes+recreates when `input.profileId` is truthy. When `null`, it just sets `data.profileId = null`. No change needed.

### Decision 5: Seed alignment — 2 profiles per spec

**Choice**: Keep "Admin Completo" (all 12 modules × 5 booleans true), rename "Docente" to "Docente Básico" with strict spec permissions (STUDENTS:READ, GRADES:READ+CREATE+UPDATE, ATTENDANCE:READ+CREATE+UPDATE), remove "Preceptor".  
**Rationale**: Spec explicitly defines only 2 seed profiles. The current seed has 3. Shrink to match.

## Data Flow — Profile Assignment on User Create

```
POST /v1/users { profileId: "p-docente", moduleAccess: [...], ... }
  │
  ▼
UsersController.create()
  │ passes body.profileId  ←── MISSING (needs fix)
  ▼
CreateUserUseCase.execute({ profileId, moduleAccess, ... })
  │
  ├─ 1. Load ProfileModulePermission rows for profileId
  │     profileToModuleAccess(rows) → ModuleAccessItem[]
  │         canRead→READ, canCreate→CREATE, canEdit→UPDATE,
  │         canDelete→DELETE, canPrint→PRINT
  │         (rows with all-false excluded)
  │
  ├─ 2. filterModuleAccess(profileAccess, creatorModules)
  │     Intersect against creator's allowed modules
  │
  ├─ 3. Create UserModule rows from filtered profile access
  │
  └─ 4. If moduleAccess also present:
        ┌─ Delete existing UserModule rows
        └─ Recreate from moduleAccess (manual wins per-module)
           filterModuleAccess applied again
```

## API Route Design

All routes already exist in `ProfilesController` at `/v1/profiles`:

| Method | Path | Auth | Status | Change Needed |
|--------|------|------|--------|---------------|
| `GET` | `/v1/profiles` | USERS:READ | ✅ Exists | Map `assignedModuleCount` |
| `GET` | `/v1/profiles/:id` | USERS:READ | ✅ Exists | Normalize to 12 entries, non-existent→null |
| `POST` | `/v1/profiles` | USERS:CREATE | ✅ Exists | None |
| `PATCH` | `/v1/profiles/:id` | USERS:UPDATE | ✅ Exists | Non-existent→null |
| `DELETE` | `/v1/profiles/:id` | USERS:DELETE | ✅ Exists | None |
| `GET` | `/v1/profiles/:id/permissions` | USERS:READ | ✅ Exists | None (already normalized) |
| `PUT` | `/v1/profiles/:id/permissions` | USERS:UPDATE | ✅ Exists | UUID validation on moduleId |

**No new routes needed.** All 7 endpoints are already wired.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `api/prisma/seed.ts` | Modify | Rename profiles: keep "Admin Completo", rename "Docente" → "Docente Básico" with spec permissions (STUDENTS:READ, GRADES:READ+CREATE+UPDATE, ATTENDANCE:READ+CREATE+UPDATE), remove "Preceptor" |
| `api/src/application/profiles/use-cases/profiles.use-cases.ts` | Modify | `ListProfilesUseCase`: map `_count.permissions` → `assignedModuleCount`. `GetProfileUseCase`: normalize permissions to 12 entries (one per module, absent→all-false) using shared helper; non-existent check. `UpdateProfileUseCase`: non-existent → `{ data: null }` |
| `api/src/presentation/profiles/dto/update-permissions.dto.ts` | Modify | Change `moduleId: z.string().min(1)` → `z.string().uuid('moduleId inválido')` for proper UUID validation per spec scenario |
| `api/src/presentation/users/users.controller.ts` | Modify | Pass `profileId: body.profileId` in `createUC.execute()` — currently missing |
| `web/src/pages/dashboard/profiles.tsx` | Modify | Table column render: use `p.assignedModuleCount` instead of `p._count?.permissions` |

**No files created. No files deleted.**

## Component/Module Breakdown

### Backend (NestJS — Clean Architecture)

```
api/src/
├── application/profiles/use-cases/
│   └── profiles.use-cases.ts        ← MODIFY (3 use cases: List, Get, Update)
├── application/users/use-cases/
│   └── users.use-cases.ts           (no change — already handles profileId)
├── application/users/
│   └── filter-module-access.ts      (no change — already correct)
├── presentation/profiles/
│   ├── profiles.controller.ts       (no change — all endpoints wired)
│   ├── profiles.module.ts           (no change — all use cases registered)
│   └── dto/
│       ├── create-profile.dto.ts    (no change)
│       ├── update-profile.dto.ts    (no change)
│       └── update-permissions.dto.ts ← MODIFY (UUID validation)
├── presentation/users/
│   ├── users.controller.ts          ← MODIFY (pass profileId in create)
│   ├── users.module.ts              (no change)
│   └── dto/
│       ├── create-user.dto.ts       (no change — profileId already present)
│       └── update-user.dto.ts       (no change — profileId already present)
└── prisma/
    ├── schema_master.prisma         (no change — tables already exist)
    └── seed.ts                      ← MODIFY (profile names/permissions)
```

### Frontend (React)

```
web/src/
├── pages/dashboard/
│   ├── profiles.tsx                 ← MODIFY (assignedModuleCount)
│   └── users.tsx                    (no change — ProfileSelector already built)
└── components/users/
    └── module-access-grid.tsx       (no change)
```

## Clean Architecture Compliance

| Layer | What | Dependency direction |
|-------|------|---------------------|
| Domain | `ProfileModulePermission` booleans | No change |
| Application | `profileToModuleAccess()`, `filterModuleAccess()`, 7 use cases | Use cases depend on PrismaService (infra) — follows existing pattern |
| Infrastructure | `PrismaService.getMasterClient()` | No change |
| Presentation | Controller → DTO validation (Zod) → Use Case | No change |

**No dependency rule violations.** The existing pattern where use cases inject `PrismaService` directly (not through a repository interface) is the project convention — we follow it.

## Error Handling Strategy

| Scenario | HTTP Status | Mechanism |
|----------|-------------|-----------|
| Non-existent profile GET/PATCH | 200 `{ data: null }` | Use case returns null → Interceptor wraps |
| Invalid UUID in permissions payload | 400 | Zod `.uuid()` validation in DTO → `ZodValidationPipe` |
| Non-existent profile PUT permissions | Prisma throws → 500 caught by AppExceptionFilter | Add explicit existence check in use case |
| Email already exists | 409 | `EmailAlreadyExistsError` extends `DomainError` → mapped in `AppExceptionFilter` |
| Missing USERS:CREATE permission | 403 | `RolesGuard` rejects before controller |
| Profile soft-delete on non-existent | 204 (no-op) | Use case returns `false`, controller returns 204 |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `profileToModuleAccess` conversion | Jest — test boolean→actions mapping, all-false exclusion |
| Unit | `filterModuleAccess` intersection | Jest — test creator module restriction |
| Integration | Profile CRUD endpoints (7 routes) | Supertest — existing `__tests__/` patterns |
| Integration | User create/update with profileId | Existing user test patterns |
| E2E | ProfileSelector pre-fill → manual override → clear | Manual or Cypress |

## Migration / Rollout

No migration required. The `Profile` and `ProfileModulePermission` tables already exist in the schema. The `User.profileId` column already exists. Seed data is updated via `upsert` — re-running seed is safe.

Re-running seed is idempotent: `upsert` on profile `id` fields will update names/permissions but not delete existing profiles created at runtime (they have different UUIDs).

## Open Questions

None. All spec scenarios map directly to existing code paths or the 5 identified changes.
