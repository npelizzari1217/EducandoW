# Tasks: User Educational Levels

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 350-500 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Delivery strategy | ask-on-risk |
| Suggested split | PR1: domain+DB → PR2: backend wiring → PR3: frontend |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Domain + DB foundation | PR 1 | User entity, UserLevel table, migration. ~120 lines. |
| 2 | Backend wiring | PR 2 | Repository, use cases, JWT, DTOs, guard. Depends on PR1. ~200 lines. |
| 3 | Frontend | PR 3 | AuthContext, sidebar filtering, user form. Independent of PR2 internals. ~180 lines. |

## Phase 1: Foundation — Domain + Database

- [x] 1.1 Define `UserLevelEntry` type in `packages/domain/src/auth/entities/user.ts` — `{ level: EducationalLevelCode, modality: EducationalModalityCode }`. Add `levels: UserLevelEntry[]` to `UserProps`. Add `addLevel()`, `hasLevel()`, `hasEducationalLevel()` methods. Keep `level` getter as backward compat (returns first entry or undefined). [Spec: user-management Create/Update]

- [x] 1.2 Add `UserLevel` model to `api/prisma/schema_master.prisma` — mirrors `InstitutionLevel`: `id String @id @default(uuid())`, `userId String`, `level Int`, `modality Int`, `@@unique([userId, level, modality])`, `@@map("user_levels")`. Add `userLevels UserLevel[]` relation to `User` model. Keep `level`/`modality` columns nullable. [Spec: auth-access JWT levels]

- [x] 1.3 Generate Prisma migration: `pnpm prisma:migrate` (creates `user_levels` table). Run data migration script: copy `User.level`/`User.modality` → `user_levels` rows for non-null old values. [Spec: user-management migration correctness]

- [x] 1.4 Write domain unit tests: `User.create` with `levels[]`, `addLevel`, `hasLevel`, `hasEducationalLevel`, `level` compat getter, empty levels. TDD: RED first. [Spec: user-management Create/Update scenarios]

## Phase 2: Core — Backend Logic

- [x] 2.1 Update `api/src/infrastructure/persistence/prisma/repositories/prisma-user.repository.ts`: include `userLevels` in Prisma queries. `toDomain()` maps `userLevels` → `UserLevelEntry[]`. `save()` uses `userLevels: { deleteMany: {}, create: [...] }` upsert pattern (mirrors institution repository). [Spec: user-management Create/Update persist]

- [x] 2.2 Update `api/src/application/users/use-cases/users.use-cases.ts`: `userToResponse()` returns `levels: number[]` (composite codes) + `userLevels: UserLevelEntry[]`. Add `validateLevelsSubset(userLevels, institutionLevels)` pure function — rejects if any entry not in institution's set. ROOT bypass. Wire into create/update. [Spec: user-management Create/Update/List, subset validation]

- [x] 2.3 Update `api/src/presentation/users/dto/create-user.dto.ts`: add `levels: z.array(z.object({level: z.number().int().min(1).max(9), modality: z.number().int().min(0).max(9)})).optional()`. [Spec: user-management Create]

- [x] 2.4 Update `api/src/presentation/users/dto/update-user.dto.ts`: add same `levels` field with `.optional()`. [Spec: user-management Update]

- [x] 2.5 Update `api/src/presentation/users/users.controller.ts`: pass `body.levels` to create/update use cases. Update `toResponse` or mapping. [Spec: user-management Create/Update]

## Phase 3: Auth — JWT + Guard

- [x] 3.1 Update `api/src/infrastructure/auth/jwt-auth-port.ts`: add `levels?: number[]` to `JwtPayload`. Keep `level?` for backward compat. [Spec: auth-access JWT levels]

- [x] 3.2 Update `api/src/application/auth/use-cases/login.use-case.ts`: query user with `userLevels` include. Map to composite codes `level * 10 + modality`. Set `levels` in JWT payload. Include `levels` + `userLevels` in login response. Keep `level` field as fallback. [Spec: auth-access Login, /me]

- [x] 3.3 Update `api/src/infrastructure/auth/guards/auth.guard.ts`: extract `levels` from JWT into `AuthenticatedUser`. [Spec: auth-access guard extraction]

- [x] 3.4 (GAP) Update `api/src/presentation/auth/auth.controller.ts` — `/auth/me`: return `levels` + `userLevels` from JWT payload (included in JWT to avoid DB fetch). [Spec: auth-access /me]

- [x] 3.5 (GAP) Update `api/src/application/auth/use-cases/register-user.use-case.ts` + `user-profile.dto.ts`: response includes `levels` + `userLevels`. Keep backward-compat `level`/`modality` as first entry fallback. [Spec: user-management Create]

## Phase 4: Frontend

- [x] 4.1 Update `web/src/context/auth-context.tsx`: add `levels?: number[]` to `User` type. Store from login/me response. [Spec: auth-access /me, sidebar-navigation]

- [x] 4.2 Update `web/src/components/layout/sidebar.tsx`: derive `baseLevels` from `user.levels` (via auth context). Fallback to `config.levels` when `user.levels` is empty. ROOT bypass unchanged. Remove institution-only filtering. [Spec: sidebar-navigation all scenarios]

- [x] 4.3 Update `web/src/pages/dashboard/users.tsx`: replace level dropdown with checkbox grid. Use full `LEVEL_CATALOG` (12 levels: 10 pedagogical + ADMINISTRACION + TODOS). Group by base level. On create/edit, send `levels: [{level, modality}]`. Display levels as tags in table. [Spec: user-management Create/Update form]

## Phase 5: Testing — Verification

- [ ] 5.1 Integration tests: user CRUD with `levels[]` — create with levels, create with empty, create without levels field, update replace, update clear, update no-op. Subset validation rejection. Response validation (levels + userLevels). [Spec: user-management all scenarios]

- [ ] 5.2 Integration tests: login/me with levels — JWT contains `levels`, `/auth/me` returns both arrays. User with no levels gets `[]`. [Spec: auth-access all scenarios]

- [ ] 5.3 E2E test: sidebar filters by user levels — login as user with Primario only → see Primario items, not others. ROOT sees all. [Spec: sidebar-navigation all scenarios]

- [ ] 5.4 Run full test suite: `pnpm test`. All existing tests must pass. [Spec: success criteria — all tests pass]

## Phase 6: Cleanup

- [ ] 6.1 Verify data migration: no users with `level IS NOT NULL` but zero `user_levels` rows. Log discrepancies. [Spec: migration correctness]

- [ ] 6.2 Mark old `level`/`modality` columns as `@deprecated` in Prisma schema comments. Add TODO for next-release removal. [Design: backward compat one release]
