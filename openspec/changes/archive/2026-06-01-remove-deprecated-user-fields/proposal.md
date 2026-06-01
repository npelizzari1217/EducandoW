# Proposal: Remove Deprecated User Fields

**Level**: ALL

## Intent

After `user-educational-levels`, the old scalar `User.level`/`User.modality` were kept with `@deprecated` for one-release backward compatibility. Remove them now — all consumers already use `user.levels: UserLevelEntry[]` and `user_levels` join table.

## Scope

### In Scope
- Remove `UserProps.level?` / `UserProps.modality?` from domain entity
- Remove `user.level` / `user.modality` deprecated getters
- Remove `assignLevel()` / `assignModality()` no-op methods
- Drop `User.level` / `User.modality` columns from Prisma schema + migration
- Remove `level?: number` from JWT payload (`JwtPayload`) and `AuthenticatedUser`
- Remove `level: backCompatLevel` from login JWT sign
- Remove `level?` / `modality?` from `UserProfileDTO` and `register-user` response
- Remove `level` / `modality` zod fields from create/update-user DTOs
- Remove `level` / `modality` from both `UserRow` types (repository + use cases)
- Remove `level?: number` from frontend `User` interface (auth-context)
- Remove `u.level` fallbacks in `users.tsx` and `UserPrintView.tsx`
- Clean up `EducationalLevelCode` / `EducationalModalityCode` unused imports where applicable

### Out of Scope
- `user.role` deprecated scalar — separate concern, leave for another change
- `level`/`modality` in institution entities (`InstitutionLevel`) — different purpose
- `level`/`modality` in pedagogy entities (`Subject`, `CourseSection`, `StudyPlan`) — different context
- `role` field in `register-user.use-case.ts` — separate concern
- Frontend form data shapes — already use `levels[]`, only scalar zod fields removed

## Capabilities

### Modified Capabilities
None. Specs (`user-management`, `auth-access`) were already updated by `user-educational-levels` to describe `levels[]` without scalar fields. This change removes dead code only.

## Approach

Pure removal — no new logic. Delete deprecated fields, getters, columns, and DTO properties across all layers. Generate a Prisma migration to drop the columns. The approach is drill-down by layer:

1. **Domain**: Strip `level`/`modality` from `UserProps`, getters, `create()`, no-op methods
2. **Schema**: Drop `level Int?` and `modality Int?` columns, run migration
3. **Infrastructure**: Remove from `JwtPayload`, `AuthenticatedUser`, `UserRow`, `toDomain()`
4. **Application**: Remove from `login.use-case`, `register-user.use-case`, `UserRow`, `userToResponse`
5. **Presentation**: Remove deprecated zod fields from DTOs
6. **Frontend**: Remove from `User` interface, fallback logic, print view

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/domain/.../user.ts` | Modified | Remove deprecated fields, getters, methods |
| `api/prisma/schema_master.prisma` | Modified | Drop `level`/`modality` from `User` |
| `api/src/infrastructure/auth/jwt-auth-port.ts` | Modified | Remove `level?` from `JwtPayload` |
| `api/src/infrastructure/auth/guards/auth.guard.ts` | Modified | Remove `level?` from `AuthenticatedUser` + assignment |
| `api/src/application/auth/use-cases/login.use-case.ts` | Modified | Remove `backCompatLevel`, `level: ...` from JWT sign |
| `api/src/application/auth/use-cases/register-user.use-case.ts` | Modified | Remove `level`/`modality` from response |
| `api/src/application/auth/dtos/user-profile.dto.ts` | Modified | Remove `level?`/`modality?` |
| `api/src/presentation/users/dto/create-user.dto.ts` | Modified | Remove deprecated `level`/`modality` zod fields |
| `api/src/presentation/users/dto/update-user.dto.ts` | Modified | Remove deprecated `level`/`modality` zod fields |
| `api/src/infrastructure/.../prisma-user.repository.ts` | Modified | Remove `level`/`modality` from `UserRow` |
| `api/src/application/users/use-cases/users.use-cases.ts` | Modified | Remove `level`/`modality` from `UserRow` |
| `web/src/context/auth-context.tsx` | Modified | Remove `level?: number` from `User` |
| `web/src/pages/dashboard/users.tsx` | Modified | Remove `u.level` fallbacks (2 sites) |
| `web/src/components/reports/UserPrintView.tsx` | Modified | Replace `u.level` with levels-based display |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Stale JWT with `level` field causes TS errors | Low | `JwtPayload.level?` is optional; removing it won't break deserialization — the field is ignored |
| Frontend still reads `level` from API response | Low | API already returns `levels` + `userLevels`; frontend uses those; only removed fallback code paths |
| Prisma migration drops data | Low | Data already migrated to `user_levels`; old columns have been null/write-only since prior change |
| Runtime error if any consumer still accesses `user.level` | Low | TS compiler catches all call sites; `pnpm build` verified |

## Rollback Plan

1. Revert the migration (`prisma migrate down`) — restores columns
2. Revert all source changes — deprecated fields were no-ops anyway
3. Existing `user_levels` data unaffected — rollback means re-adding dead columns, not data loss

## Dependencies

- `user-educational-levels` (applied and archived 2026-06-01) — prerequisite
- Prisma migration tooling (`pnpm prisma migrate dev`)

## Success Criteria

- [ ] `pnpm build` passes (0 TS errors) across all packages
- [ ] `pnpm test` passes (full test suite green)
- [ ] `User.level` / `User.modality` columns not present in Prisma schema
- [ ] `grep -r "level.*deprecated\|deprecated.*level" packages/domain api/src web/src` returns 0 matches
- [ ] JWT emitted by login contains `levels: number[]` without scalar `level`
- [ ] `/auth/me` response contains `levels` + `userLevels`, no scalar `level`/`modality`
- [ ] Users table and print view render educational levels from `userLevels` array only
