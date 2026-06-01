# Design: User Profiles — Permission Templates

## Technical Approach

Add `Profile` + `ProfileModulePermission` tables as pre-configured permission templates. Profiles store booleans internally; on user assignment, convert booleans → `String[]` actions to create `UserModule` records. New `/v1/profiles` CRUD module + `/v1/profiles/:id/permissions` matrix endpoints follow existing NestJS patterns (`@Roles`, Zod validation, `PrismaService` injection).

## Architecture Decisions

| Decision | Choice | Rejected | Rationale |
|----------|--------|----------|-----------|
| Profile permissions storage | Boolean columns in junction table | Store `String[] actions` directly | Profiles are templates — booleans are clearer for UI grid rendering. Converted to actions only on user assignment to maintain consistency with existing `UserModule.actions` structure. |
| Profile-User relation | Optional FK `profileId` on User | Separate junction table | One profile per user is sufficient per current scope. Optional FK is non-destructive (new column, nullable). |
| Permission matrix endpoint | Return ALL 12 modules from `Module` table, default `false` for unassigned | Return only assigned modules | Guarantees frontend always receives 12 rows — simplifies grid rendering and avoids N+1 mapping. |
| Soft delete strategy | `active=false` + `deletedAt=now()` | Hard delete | Matches existing project convention (User, Module, Role all use this pattern). |
| PUT permissions upsert | Delete all + recreate rows | Individual upsert per row | Simpler, atomic within a transaction. Avoids tracking which rows to delete vs update. |

## Data Flow

```
POST /users (or PATCH)
  │
  ├─ profileId provided?
  │    └─ YES → fetch ProfileModulePermission rows (booleans)
  │              │
  │              └─ convert: canRead→READ, canCreate→CREATE, canEdit→UPDATE,
  │                           canDelete→DELETE, canPrint→PRINT
  │                           (skip rows where all booleans are false)
  │              │
  │              └─ array of { moduleCode, actions: String[] }
  │                   │
  │                   └─ delete existing user_modules → create new ones
  │                        │
  │                        └─ pass through filterModuleAccess() (security boundary)
  │
  └─ manual moduleAccess also provided?
       └─ manual overrides profile (profile applied first, then manual replaces)
```

```
GET /v1/profiles/:id/permissions
  │
  └─ LEFT JOIN ProfileModulePermission ON (Module.id = profile_module_permissions.moduleId AND profileId=:id)
       │
       └─ COALESCE(canRead, false) … per column
            │
            └─ returns [{ moduleId, moduleCode, moduleName, canRead, canCreate, canEdit, canDelete, canPrint }]
                 (always 12 rows in production)
```

## File Changes

### New Files

| File | Action | Description |
|------|--------|-------------|
| `api/src/presentation/profiles/profiles.module.ts` | Create | NestJS module — imports AuthModule, provides PrismaService + 6 use cases |
| `api/src/presentation/profiles/profiles.controller.ts` | Create | 7 REST endpoints: CRUD (5) + GET/PUT permissions matrix (2). Guarded by `@Roles('ROOT', { module: 'USERS', action: 'READ' })` |
| `api/src/presentation/profiles/dto/create-profile.dto.ts` | Create | `z.object({ name: z.string().min(1).max(100) })` |
| `api/src/presentation/profiles/dto/update-profile.dto.ts` | Create | `z.object({ name: z.string().min(1).max(100).optional() })` |
| `api/src/presentation/profiles/dto/update-permissions.dto.ts` | Create | Array of `{ moduleId, canRead, canCreate, canEdit, canDelete, canPrint }` with Zod uuid + boolean validation |
| `api/src/application/profiles/use-cases/profiles.use-cases.ts` | Create | 6 use cases: ListProfiles, GetProfile, CreateProfile, UpdateProfile, DeleteProfile, UpsertPermissions, GetProfilePermissions |

### Modified Files

| File | Action | Description |
|------|--------|-------------|
| `api/prisma/schema_master.prisma` | Modify | Add `Profile` model (with `@@map("profiles")`), `ProfileModulePermission` model (with `@@map("profile_module_permissions")`, `@@unique([profileId, moduleId])`), add `profileId String?` + relation to `User` |
| `api/src/app.module.ts` | Modify | Import `ProfilesModule` |
| `api/src/presentation/users/dto/create-user.dto.ts` | Modify | Add optional `profileId: z.string().uuid().optional()` |
| `api/src/presentation/users/dto/update-user.dto.ts` | Modify | Add optional `profileId: z.string().uuid().optional().nullable()` |
| `api/src/application/users/use-cases/users.use-cases.ts` | Modify | Add `profileId` to `CreateUserUseCase.execute()` and `UpdateUserUseCase.execute()` params. When present: fetch profile permissions, convert booleans→actions, create UserModule records. If `moduleAccess` also provided, it takes precedence (manual override). |
| `api/prisma/seed.ts` | Modify | Add profile seeds: "Admin Completo" (all modules, all actions), "Docente Básico" (STUDENTS:READ, GRADES:CREATE+READ, ATTENDANCE:CREATE+READ, CLASSROOMS:READ) |

## Interfaces / Contracts

**Boolean → actions conversion function** (new in profiles.use-cases.ts):
```ts
function profileToModuleAccess(permissions: {
  module: { code: string };
  canRead: boolean; canCreate: boolean; canEdit: boolean;
  canDelete: boolean; canPrint: boolean;
}[]): ModuleAccessItem[] {
  const ACTION_MAP: Record<string, string[]> = {
    canRead: ['READ'], canCreate: ['CREATE'], canEdit: ['UPDATE'],
    canDelete: ['DELETE'], canPrint: ['PRINT'],
  };
  return permissions
    .filter(p => Object.keys(ACTION_MAP).some(k => p[k]))
    .map(p => ({
      moduleCode: p.module.code,
      actions: Object.entries(ACTION_MAP)
        .filter(([k]) => p[k]).flatMap(([, v]) => v),
    }));
}
```

**Controller signature pattern** (matches existing convention):
```ts
@Controller('profiles')
@UseGuards(AuthGuard, RolesGuard)
export class ProfilesController {
  constructor(
    private readonly listUC: ListProfilesUseCase,
    private readonly getUC: GetProfileUseCase,
    private readonly createUC: CreateProfileUseCase,
    private readonly updateUC: UpdateProfileUseCase,
    private readonly deleteUC: DeleteProfileUseCase,
    private readonly getPermissionsUC: GetProfilePermissionsUseCase,
    private readonly upsertPermissionsUC: UpsertPermissionsUseCase,
  ) {}
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `profileToModuleAccess()` conversion | Vitest: verify boolean set → correct `String[] actions`, all-false row → excluded |
| Unit | DTO validation (Zod schemas) | Vitest: test valid/invalid payloads for create, update, permissions |
| Integration | Profiles CRUD endpoints | e2e: create → list (assert module count) → get (assert matrix) → update → soft delete → verify not-in-list |
| Integration | Permission matrix upsert + GET | e2e: PUT permissions → GET returns correct booleans; unassigned modules default false |
| Integration | User creation with profileId | e2e: create profile with permissions → create user with profileId → assert user_modules generated → assert filterModuleAccess still applies |
| Integration | User update with profileId | e2e: update user's profileId → assert old user_modules deleted, new ones created from new profile |
| Seed | Seed runs without errors | Verify `pnpm run seed` creates "Admin Completo" and "Docente Básico" profiles |

## Migration / Rollout

- Run `pnpm prisma migrate dev --name add-profiles` to generate migration
- No data migration required — new tables, new nullable column on User
- Rollback: `pnpm prisma migrate reset` (dev) or revert migration (prod)

## Open Questions

None — all design decisions are covered by user specs and existing codebase patterns.
