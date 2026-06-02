# Proposal: Educational Level Route Guard

## Intent

Any authenticated user can hit any level's endpoints — a TEACHER with only INICIAL access can call `/secundario/cursos`. We need route-level authorization based on the user's assigned educational levels, enforced by a guard that mirrors the existing `RolesGuard` pattern.

Additionally, `RefreshTokenUseCase` drops `levels`/`userLevels` from JWTs — users who refresh silently lose level access. This MUST be fixed in the same change.

## Scope

### In Scope
- `LevelsGuard` + `@Levels()` decorator (mirrors `RolesGuard` / `@Roles()`)
- Apply `@Levels()` at class level to all 12 level-specific controllers across 4 módulos
- Register `LevelsGuard` as provider in auth module
- Fix `RefreshTokenUseCase` to include `levels` + `userLevels` in new JWT
- Unit tests for `LevelsGuard`

### Out of Scope
- `PedagogyController` — multi-level, needs data-level filtering via separate change
- Frontend changes (sidebar already filters by levels)
- Cross-level controllers (enrollments, students, teachers, course-cycles)

## Capabilities

### New Capabilities
- `level-route-guard`: Route-level authorization enforcing educational-level assignment via decorator-based guard

### Modified Capabilities
- `auth-access`: Add scenario "Refresh token preserves levels array" to JWT requirement

## Approach

Mirror `RolesGuard` exactly: `Reflector.getAllAndOverride` + `SetMetadata`. Guard logic: extract base level from composite codes (`Math.floor(c/10)`), check overlap with required levels, ROOT bypass. Default: `true` when no `@Levels()` metadata present.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `api/src/infrastructure/auth/guards/levels.guard.ts` | New | Guard checking `req.user.levels` vs metadata |
| `api/src/infrastructure/auth/decorators/levels.decorator.ts` | New | `@Levels(...codes)` decorator with `LEVELS_KEY` |
| `api/src/presentation/nivel-inicial/*.controller.ts` | Modified | Add `@Levels(INICIAL)` + `LevelsGuard` to 3 controllers |
| `api/src/presentation/nivel-primario/*.controller.ts` | Modified | Add `@Levels(PRIMARIO)` + `LevelsGuard` to 2 controllers |
| `api/src/presentation/nivel-secundario/*.controller.ts` | Modified | Add `@Levels(SECUNDARIO)` + `LevelsGuard` to 3 controllers |
| `api/src/presentation/nivel-terciario/*.controller.ts` | Modified | Add `@Levels(TERCIARIO)` + `LevelsGuard` to 4 controllers |
| `api/src/presentation/auth/auth.module.ts` | Modified | Export `LevelsGuard` provider |
| `api/src/application/auth/use-cases/refresh-token.use-case.ts` | Modified | Add `levels` + `userLevels` to `jwtAuthPort.sign()` call |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| RefreshTokenUseCase drops levels — valid users get 403 after token refresh | High (confirmed bug) | Fix in same change; add `levels: user.toLevels()` + `userLevels: user.toUserLevels()` to sign call |
| Backward compat — non-level controllers break | Low | Guard defaults to `true` when `@Levels()` absent; ROOT bypasses all |
| Performance overhead per request | Low | `Math.floor` + `Array.includes` — negligible |

## Rollback Plan

1. Remove `LevelsGuard` from `@UseGuards` chain on all 12 controllers
2. Remove `@Levels()` decorator annotations
3. Remove `LevelsGuard` provider from auth module
4. Revert `RefreshTokenUseCase` change (re-add `levels`/`userLevels` — no revert needed for the fix itself since it corrects a bug)

## Dependencies

None — self-contained change within existing auth infrastructure.

## Success Criteria

- [ ] `@Levels(INICIAL)` controller rejects user with only `levels: [20]` (PRIMARIO)
- [ ] `@Levels(PRIMARIO)` controller accepts user with `levels: [11, 20]` (INICIAL+PRIMARIO)
- [ ] ROOT user bypasses all `@Levels()` checks
- [ ] Controllers without `@Levels()` remain accessible to any authenticated user
- [ ] RefreshTokenUseCase produces JWT with `levels` + `userLevels` matching login tokens
- [ ] All existing tests pass, new `LevelsGuard` unit tests pass
