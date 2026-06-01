# Design: Remove Deprecated User Fields

## Technical Approach

Pure deletion across all layers. Every consumer already uses `UserLevelEntry[]` from the `user_levels` junction table (introduced by `user-educational-levels`). The deprecated scalar `level`/`modality` fields were kept one release as no-op backward compat. Remove them now. TS compiler catches all missed sites.

**Implementation order** (inside-out by layer, `pnpm build` gate after each):
1. Domain entity → strip deprecated props, getters, no-op methods
2. Prisma schema → drop columns, run migration
3. API repository → remove from `UserRow`, `toDomain()`
4. API auth → JWT payload, guard, login
5. API DTOs → create, update, profile
6. Frontend → auth context, users page, print view

## Architecture Decisions

| Decision | Option A | Option B | Choice | Rationale |
|----------|----------|----------|--------|-----------|
| Removal strategy | Gradual | Single-pass | **B** | Consumers already use `levels[]`. TS strict catches misses. Dead code adds confusion. |
| `UserRow` duplication | Fix now | Defer | **A** | Remove fields from both copies. Extraction to shared location is a separate refactor. |
| `role` in login response | Keep (separate concern) | Remove now | **B** | Deprecated, trivial alongside `level`/`modality`. No consumer relies on `role` over `roles[]`. |
| Migration | Prisma auto | Manual SQL | **A** | `prisma migrate dev` generates safe `ALTER TABLE DROP COLUMN`. Nullable columns, no data risk. |
| `level`/`modality` in Update params | Keep in signature | Remove now | **B** | Write-only to removed columns. Consumers pass `levels[]`. Avoids dead code. |

## Data Flow

```
Before: User entity → level getter reads levels[0] ?? deprecatedProp
                        modality getter reads levels[0] ?? deprecatedProp
                        JWT carries level (first composite) + levels[]

After:  User entity → levels getter ONLY (UserLevelEntry[])
                      no scalar fallback
                      JWT carries levels[] + userLevels[], no level
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/domain/src/auth/entities/user.ts` | Modify | Remove `level?`/`modality?` from `UserProps`. Remove deprecated getters. Remove `assignLevel()`/`assignModality()` no-ops. Strip from constructor spread. |
| `api/prisma/schema_master.prisma` | Modify | Remove `level Int?` / `modality Int?` from `User` model. |
| `api/src/infrastructure/persistence/prisma/repositories/prisma-user.repository.ts` | Modify | Remove from `UserRow`. Update `toDomain()` to not pass scalar fields. Prisma queries unchanged (no explicit `level`/`modality` selects). |
| `api/src/application/users/use-cases/users.use-cases.ts` | Modify | Remove from `UserRow`. `userToResponse()` already only returns `levels` + `userLevels` — no change needed there. Remove `level`/`modality` from `UpdateUserUseCase.execute()` params. |
| `api/src/infrastructure/auth/jwt-auth-port.ts` | Modify | Remove `level?: number` from `JwtPayload`. |
| `api/src/infrastructure/auth/guards/auth.guard.ts` | Modify | Remove `level?: number` from `AuthenticatedUser`. Remove `level: payload.level` assignment. |
| `api/src/application/auth/use-cases/login.use-case.ts` | Modify | Remove `backCompatLevel`. Remove `level:` from JWT sign. Remove `role: user.role` from response (opportunistic). |
| `api/src/application/auth/use-cases/register-user.use-case.ts` | Modify | Remove `level:` and `modality:` from response. |
| `api/src/application/auth/dtos/user-profile.dto.ts` | Modify | Remove `level?: number` and `modality?: number`. |
| `api/src/presentation/users/dto/create-user.dto.ts` | Modify | Remove deprecated `level`/`modality` zod fields. Keep `levels` array. |
| `api/src/presentation/users/dto/update-user.dto.ts` | Modify | Remove deprecated `level`/`modality` zod fields. Keep `levels` array. |
| `web/src/context/auth-context.tsx` | Modify | Remove `level?: number` from `User` interface. |
| `web/src/pages/dashboard/users.tsx` | Modify | Remove `level`/`modality` from `UserRow`. Remove fallback logic: `u.level != null ? levelLabel(u.level) : '-'`. Remove `if (u.level != null) return levelLabel(u.level)` at line 562. |
| `web/src/components/reports/UserPrintView.tsx` | Modify | Replace `u.level` with levels-based display. The `UserRow` interface here is a local prop type — structure already matches: `level: string` is pre-computed in users.tsx at call site. |

## Interfaces / Contracts

**Removed** (no new interfaces):

```typescript
// JwtPayload: remove `level?: number`
// AuthenticatedUser: remove `level?: number`
// UserProps: remove `level?: EducationalLevelCode` and `modality?: EducationalModalityCode`
// User entity: remove `get level()`, `get modality()`, `assignLevel()`, `assignModality()`
// UserProfileDTO: remove `level?: number`, `modality?: number`
```

**Unchanged** (already correct):
- `User.levels: UserLevelEntry[]` — sole source of truth
- `JwtPayload.levels?: number[]` — composite codes
- `JwtPayload.userLevels?: { level: number; modality: number }[]` — detail

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| TS compiler | All call sites caught | `pnpm build` — 0 errors required |
| Existing tests | No regressions | `pnpm test` — full suite green |
| Migration | Columns dropped | Verify `\d users` shows no `level`/`modality` |

No new tests needed — this is pure removal with no new behavior.

## Migration / Rollout

1. Run `pnpm prisma migrate dev` to generate and apply column drop migration.
2. Deploy all packages together (domain, API, web changes are interdependent via types).
3. Stale JWTs with `level` field are harmless — `jsonwebtoken.verify()` ignores unknown fields.

**Rollback**: revert migration (`prisma migrate down`), revert all source changes. No data loss — `user_levels` data is untouched.

## Open Questions

None. All decisions are closure on previously-deprecated fields.
