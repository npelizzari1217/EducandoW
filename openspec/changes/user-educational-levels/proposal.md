# Proposal: Multiple Educational Levels for Users

**Level**: ALL

## Intent

Users hold a single `level` while institutions support multiple via `institution_levels`. The sidebar filters by institution levels, not user levels — a user with `level: 1` (Inicial) sees Secundario panels. Fix: multi-level users like institutions, carried in JWT, filtering sidebar.

## Scope

### In Scope
- `user_levels` junction table (mirrors `institution_levels`)
- User entity: `levels[]` replaces single `level`
- JWT payload: `levels: number[]` (composite codes)
- Sidebar: filter by user levels, not institution levels
- User form: checkbox grid replaces dropdown
- Migration: existing `User.level` → `user_levels` rows

### Out of Scope
- Institution-level model changes
- Institution → user level propagation
- Backend level-based guards (beyond subset validation)

### Changed from Out of Scope
- ~~Institution → user level propagation~~ → Moved IN: `user_levels` MUST be a subset of `institution_levels` for the user's institution. Invalid levels rejected with validation error.

## Capabilities

### Modified Capabilities
- `user-management`: single `level` → `{ level, modality }[]`. DTOs accept `levels[]`. Response includes `levels` (composite codes) + `userLevels` detail.
- `auth-access`: JWT `level: number` → `levels: number[]`. Auth guard extracts `levels`.
- `sidebar-navigation`: filter by user `levels` instead of institution `config.levels`. ROOT bypass preserved.

## Approach

1. **Domain**: User entity gets `levels: { level, modality }[]`, drops `level?`, `modality?`
2. **DB**: `user_levels` table. Migration copies old columns, keeps them nullable for rollback
3. **API**: DTOs accept `levels[]`. Response: composite codes + detail array
4. **JWT**: Include `levels: number[]` from `user_levels`
5. **Frontend**: AuthContext → `levels`. Sidebar → user `baseLevels`. Form → checkbox grid

## Affected Areas

| Area | Impact |
|------|--------|
| `domain/.../user.ts` | `level?` → `levels[]` |
| `prisma/schema_master.prisma` | New `user_levels` table |
| `presentation/users/dto/` | `levels[]` in create/update |
| `application/users/use-cases/` | Parse, persist, return levels |
| `infrastructure/auth/jwt-auth-port.ts` | Payload `levels[]` |
| `application/auth/.../login.use-case.ts` | JWT with `levels[]` |
| `web/.../auth-context.tsx` | User type |
| `web/.../sidebar.tsx` | Filter by user levels |
| `web/.../users.tsx` | Checkbox grid |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| JWT size increase | Low | Small integers |
| Existing JWT invalid after deploy | Med | Keep `level` fallback one release |
| Migration data loss | Low | Old columns nullable; validate count |

## Rollback Plan

1. Drop `user_levels`, repopulate `User.level` from backup
2. Redeploy previous API/frontend
3. Old columns kept nullable during transition
4. JWT `level` field kept as fallback

## Success Criteria

- [ ] Multi-level users via `user_levels`
- [ ] JWT `levels: number[]`; `/auth/me` returns levels
- [ ] Sidebar filters by user levels
- [ ] User form: checkbox grid
- [ ] Existing `User.level` → `user_levels` migration correct
- [ ] ROOT sees all panels (unchanged)
- [ ] All tests pass
