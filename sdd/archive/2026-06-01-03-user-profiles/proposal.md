# Proposal: User Profiles — Permission Templates

## Intent

Manual module assignment via `ModuleAccessGrid` on every user creation is repetitive and error-prone. A Profile acts as a pre-configured permission template: select one, auto-fill modules. Profiles store booleans internally (`canRead`, `canCreate`…); on user assignment they convert to `String[] actions`.

## Scope

### In Scope
- `Profile` table (UUID, name, active, timestamps) + `ProfileModulePermission` junction (profileId, moduleId, 5 boolean columns, `@@unique`)
- CRUD: create, list with module count, get with full matrix, update, soft-delete
- `GET/PUT /profiles/:id/permissions` — query/upsert all 12 modules as booleans (default false)
- `profileId` on user create/update DTOs → loads profile, converts booleans → `String[] actions`, creates `UserModule` records
- `ProfileSelector` dropdown in user form — pre-fills `ModuleAccessGrid`
- Seed: Admin Completo, Docente Básico

### Out of Scope
- Profile-level role/level assignment, retroactive updates, inheritance

## Capabilities

### New Capabilities
- `user-profiles`: Full CRUD for profile templates + boolean permission matrix endpoints
- `profile-assignment`: Assign profile to user on create/update, auto-generate UserModule records via boolean→actions conversion

### Modified Capabilities
- `user-management`: Add optional `profileId` to CreateUser and UpdateUser DTOs; when provided, fetch profile permissions and convert to `moduleAccess` entries

## Approach

1. **DB**: Profile + ProfileModulePermission tables (existing junction pattern)
2. **API**: New profiles module (CRUD + matrix endpoints)
3. **API**: Modify CreateUser/UpdateUser use cases — if `profileId`, load permissions → convert to `UserModule` records before `filterModuleAccess()`
4. **Frontend**: ProfileSelector → user form; profiles CRUD page
5. **Seed**: Admin Completo, Docente Básico

**Conversion**: `canRead→'READ'`, `canCreate→'CREATE'`, `canEdit→'UPDATE'`, `canDelete→'DELETE'`, `canPrint→'PRINT'`. Filter false. Convert on copy.

## Affected Areas

| Area | Impact |
|------|--------|
| `api/prisma/schema_master.prisma` | New models |
| `api/src/modules/profiles/` | New module |
| `api/src/application/users/use-cases/` | Modified |
| `api/src/presentation/users/` | Modified DTOs |
| `web/src/pages/dashboard/` | New + modified pages |
| `api/prisma/seed.ts` | Modified |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Conversion gap if actions change | Low | Map only 5 known actions |
| Profile vs manual grid confusion | Med | Selector preview; clear button |

## Rollback Plan

Drop new tables, remove `profileId` from DTOs, revert frontend. No data loss — UserModule is source of truth.

## Dependencies

None — additive change, no existing tables modified.

## Success Criteria

- [ ] Profile assigned to new user → matching `user_modules` created
- [ ] `GET /profiles/:id/permissions` returns 12 modules with correct booleans
- [ ] `PUT /profiles/:id/permissions` upserts; unassigned modules default false
- [ ] Profile selector pre-fills grid; user can override
- [ ] Seed creates two default profiles
