# Apply Plan: Multiple Educational Levels for Users

**Change**: `user-educational-levels`
**Date**: 2026-06-01
**Strategy**: stacked-to-main (3 PRs)
**Author**: sdd-apply agent

---

## 1. Impact Analysis

### 1.1 Files Touched by Contract Change

The change cascades from a single point — `User` entity dropping the scalar `level`/`modality` in favor of `levels[]` — and ripples through every layer that reads these fields. Below is the full blast radius, classified by contract severity.

#### Domain Layer (1 file)

| File | Change | Impact |
|------|--------|--------|
| `packages/domain/src/auth/entities/user.ts` | `UserProps`: `level?`/`modality?` → `levels: UserLevelEntry[]`. New `UserLevelEntry` type. New `addLevel()`/`hasLevel()`/`hasEducationalLevel()` methods. `level` getter becomes backward-compat wrapper. | Core contract — every consumer affected |
| `packages/domain/src/index.ts` | Export new `UserLevelEntry` type | Minimal |

#### Database Layer (1 file)

| File | Change | Impact |
|------|--------|--------|
| `api/prisma/schema_master.prisma` | New `UserLevel` model + `userLevels` relation on `User`. Keep old columns nullable. | Migration required. `@prisma/client` types change. |

#### Repository Layer (1 file)

| File | Change | Impact |
|------|--------|--------|
| `api/src/infrastructure/persistence/prisma/repositories/prisma-user.repository.ts` | `UserRow` gets `userLevels`. `toDomain()` maps to `UserLevelEntry[]`. `save()` uses `deleteMany + create` upsert pattern. Old `level`/`modality` fields stop being written. | All user queries change |

#### Use Case Layer (3 files)

| File | Change | Impact |
|------|--------|--------|
| `api/src/application/users/use-cases/users.use-cases.ts` | `UserRow` + `userLevels`. `userToResponse()` returns `levels` (composite) + `userLevels` (detail). New `validateLevelsSubset()`. Create/Update handle `levels[]` array. | Response shape changes — frontend consumers break |
| `api/src/application/auth/use-cases/login.use-case.ts` | Query includes `userLevels`. Map to composite codes. JWT payload gets `levels[]`. Login result gets `levels[]` + `userLevels[]`. | JWT size increases slightly. Old JWT field `level` kept as fallback. |
| `api/src/application/auth/use-cases/register-user.use-case.ts` | `UserProfileDTO` gets `levels`/`userLevels`. Legacy `level`/`modality` removed. | Not in task list — GAP |

#### Auth Infrastructure (2 files)

| File | Change | Impact |
|------|--------|--------|
| `api/src/infrastructure/auth/jwt-auth-port.ts` | `JwtPayload` gets `levels?: number[]`. Old `level?` kept for backward compat. | All JWT consumers |
| `api/src/infrastructure/auth/guards/auth.guard.ts` | `AuthenticatedUser` gets `levels?: number[]`. Extract from JWT. | All guarded routes |

#### Presentation Layer (3 files)

| File | Change | Impact |
|------|--------|--------|
| `api/src/presentation/users/dto/create-user.dto.ts` | Add `levels: z.array(z.object({level: int, modality: int})).optional()`. Keep old fields. | API contract change |
| `api/src/presentation/users/dto/update-user.dto.ts` | Same as create | API contract change |
| `api/src/presentation/users/users.controller.ts` | Pass `body.levels` to create/update. | Routing change |
| `api/src/presentation/auth/auth.controller.ts` | `/auth/me` must return `levels[]` + `userLevels[]`. Currently returns raw JWT payload — needs DB fetch. | Not in task list — GAP |

#### DTO Layer (1 file)

| File | Change | Impact |
|------|--------|--------|
| `api/src/application/auth/dtos/user-profile.dto.ts` | Add `levels?: number[]` and `userLevels?: UserLevelEntry[]` | Register response changes |

#### Frontend (5+ files)

| File | Change | Impact |
|------|--------|--------|
| `web/src/context/auth-context.tsx` | `User` type: add `levels?: number[]` | All `useAuth()` consumers |
| `web/src/components/layout/sidebar.tsx` | `baseLevels` source: `config.levels` → `user.levels` (with institution fallback). ROOT bypass unchanged. Warning message updated. | Core UX change |
| `web/src/pages/dashboard/users.tsx` | Level dropdown → checkbox grid. Form sends `levels[]`. Table displays levels as tags. `UserRow` type updated. | Full form rewrite |
| `web/src/components/reports/UserPrintView.tsx` | `level: string` → levels display | Minor — format change |
| `web/src/pages/dashboard/study-plans.tsx` | Reads `user?.level` for pre-selection (line 135) | Not in task list — MUST AUDIT |
| `web/src/pages/dashboard/course-sections.tsx` | Reads `user?.level` for pre-selection (line 58) | Not in task list — MUST AUDIT |

### 1.2 Consumer Map: All Reads of `user.level`

| File | Line | Usage | After Change |
|------|------|-------|--------------|
| `users.use-cases.ts` → `userToResponse()` | 35 | `level: u.level` | `levels: [...composites]`, `userLevels: [...]` |
| `users.use-cases.ts` → Create | 143 | `level: input.level` | `userLevels: { create: [...] }` nest |
| `users.use-cases.ts` → Update | 284 | `data.level = input.level` | `userLevels: { deleteMany, create }` nest |
| `prisma-user.repository.ts` → `save()` | 92-93, 105-106 | `level: user.level` | Removed from direct props; `userLevels` handled separately |
| `prisma-user.repository.ts` → `toDomain()` | 200-201 | `level: record.level` | `levels: record.userLevels.map(...)` |
| `login.use-case.ts` → JWT payload | 74 | `level: user.level` | `levels: user.levels.map(...)` (composite codes) |
| `login.use-case.ts` → LoginResult | 96 | `level: user.level` | `levels` + `userLevels` |
| `auth.guard.ts` | 40 | `level: payload.level` | `levels: payload.levels` |
| `auth.controller.ts` → `/me` | 109 | `level?: number` | `levels?: number[]` + needs DB fetch for `userLevels` |
| `register-user.use-case.ts` | 65-66 | `level: saved.level`, `modality: saved.modality` | `levels`, `userLevels` |
| `auth-context.tsx` | 4 | `level?: number` | `levels?: number[]` |
| `sidebar.tsx` | 111-112 | Uses `config.levels` (institution, NOT user!) | Uses `user.levels` primary, `config.levels` fallback |
| `users.tsx` | 203, 218, 239, 267, 368, 464 | Read/write `level` | Read/write `levels[]` |
| `study-plans.tsx` | 135 | `const userLevel = user?.level` | Backward-compat getter returns first level — WORKS but only shows first |
| `course-sections.tsx` | 58 | `const userLevel = user?.level` | Same as study-plans |
| `UserPrintView.tsx` | 62 | `{u.level \|\| '-'}` | Needs format update for multi-level |

---

## 2. Risk Assessment

### 2.1 Risk Matrix

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| **JWT payload breaking change** | HIGH | MEDIUM | Keep `level` field alongside `levels` for one release. Guard extracts both. Frontend prefers `levels`, falls back to `level`. |
| **Sidebar empty for admins** | HIGH | MEDIUM | Institution fallback (`config.levels`) when `user.levels` is empty. ROOT bypass preserved. |
| **JWT size bloat** | LOW | LOW | Composite codes are small integers. 12 entries = ~48 bytes extra. |
| **Migration data loss** | MEDIUM | LOW | Old columns kept nullable. Data migration verified. |
| **Backend rejects valid levels** | MEDIUM | LOW | `validateLevelsSubset()` follows institution convention. ROOT bypass. |
| **Frontend pre-selection broken** | MEDIUM | HIGH | `study-plans.tsx` and `course-sections.tsx` read `user.level` (backward compat getter returns first entry). Functionally works but limits to first level — degraded UX for multi-level users. |
| **`/auth/me` no longer returns detail** | MEDIUM | HIGH | Currently returns raw JWT payload. For `userLevels` detail array, needs DB fetch. Not in task list. |
| **Race condition on level replacement** | LOW | LOW | `deleteMany + createMany` is atomic enough at the use case level within a single request. |

### 2.2 Riskiest Change

**#1: JWT payload** — The JWT is the primary identity carrier across the entire system. Every guarded route, every frontend component, every permission check reads from it. Changing the payload shape while maintaining backward compat with existing tokens requires surgical precision. Old tokens without `levels` will circulate until they expire (up to `expiresIn`), so both `level` and `levels` must coexist in extraction logic.

**#2: Sidebar source of truth** — Currently the sidebar filters by `config.levels` (institution's available levels). This change flips it to `user.levels` (what the authenticated user can see). This is semantically correct BUT the institution fallback must work perfectly or admins who haven't been assigned levels will see an empty sidebar. The ROOT bypass must be preserved. The warning message changes from "configure your institution levels" to something about the user's levels.

**#3: User form checkbox grid** — The current form is a simple dropdown (level 1-4 + 9). The new form is a 12-entry checkbox grid grouped by base level. This is a full UI rewrite of the most complex form on the page. The form already handles `roles`, `moduleAccess`, `institutionId` — adding `levels` is another dimension.

---

## 3. Contract Changes

### 3.1 Domain Contracts

```typescript
// NEW type (packages/domain/src/auth/entities/user.ts)
export interface UserLevelEntry {
  level: EducationalLevelCode;   // 1-4, 9
  modality: EducationalModalityCode; // 0-2, 9
}

// UserProps — CHANGED
// BEFORE: level?: EducationalLevelCode; modality?: EducationalModalityCode;
// AFTER:
levels: UserLevelEntry[];

// User entity — NEW methods
addLevel(level: EducationalLevelCode, modality: EducationalModalityCode): void;
hasLevel(level: EducationalLevelCode, modality?: EducationalModalityCode): boolean;
hasEducationalLevel(levelCode: EducationalLevelCode): boolean;

// User entity — BACKWARD COMPAT (deprecated, one-release only)
get level(): EducationalLevelCode | undefined;  // returns first entry or undefined
get modality(): EducationalModalityCode | undefined;
```

### 3.2 JWT Payload

```typescript
// JwtPayload — CHANGED
// BEFORE: level?: number;
// AFTER: (both fields, one release)
levels?: number[];  // composite codes [10, 20, 31]
level?: number;     // kept for backward compat

// AuthenticatedUser — CHANGED
// BEFORE: level?: number;
// AFTER:
levels?: number[];
```

### 3.3 API Request/Response

```typescript
// CreateUserDTO / UpdateUserDTO — NEW FIELD
levels?: { level: number; modality: number }[];  // optional

// userToResponse() — CHANGED
// BEFORE: { level: number | null, modality: number | null, ... }
// AFTER:
{
  levels: number[];              // composite codes [20, 31]
  userLevels: UserLevelEntry[];  // detail [{level:2,modality:0}, {level:3,modality:1}]
  // level: removed from response
}

// LoginResult.user — CHANGED
// BEFORE: { level?: number, ... }
// AFTER:
{
  levels?: number[];
  userLevels?: UserLevelEntry[];
  // level: removed
}

// /auth/me response — CHANGED
// BEFORE: { userId, roles, institutionId, level?, dbName? }
// AFTER:
{
  userId, roles, institutionId, dbName?,
  levels: number[],       // from JWT
  userLevels: UserLevelEntry[] // from DB fetch
}
```

### 3.4 Frontend Types

```typescript
// auth-context.tsx User type — CHANGED
// BEFORE: level?: number;
// AFTER: levels?: number[];

// users.tsx UserRow — CHANGED
// BEFORE: level: number | null; modality: number | null;
// AFTER:
levels: number[];
userLevels: { level: number; modality: number }[];

// Sidebar filter — CHANGED
// BEFORE: baseLevels = Set(config.levels.map(c => Math.floor(c/10)))
// AFTER:
// baseLevels = user.levels?.length
//   ? Set(user.levels.map(c => Math.floor(c/10)))
//   : Set(config.levels.map(c => Math.floor(c/10)))
```

---

## 4. Execution Order

### Stacked PR Strategy: `stacked-to-main`

```
main ←── PR1 (domain+DB) ←── PR2 (backend) ←── PR3 (frontend)
```

Each PR targets the previous PR's branch. PR1 targets `main`. After PR1 merges, PR2 rebases onto `main` and so on.

### 4.1 PR1: Domain + Database Foundation

**Target branch**: `feat/user-educational-levels-domain` → `main`

| # | Task | File(s) | Action | Est. lines |
|---|------|---------|--------|------------|
| 1.1 | `UserLevelEntry` + entity methods | `packages/domain/src/auth/entities/user.ts` | Add type. Modify `UserProps`, `User.create()`, add getters + methods. | ~40 |
| 1.1b | Export new type | `packages/domain/src/index.ts` | Add `UserLevelEntry` export. | ~1 |
| 1.2 | `UserLevel` Prisma model | `api/prisma/schema_master.prisma` | Add model + relation. Keep old columns nullable. | ~20 |
| 1.3 | Prisma migration | — | `pnpm prisma:migrate` → `user_levels` table. | — |
| 1.3b | Data migration script | `api/prisma/migrations/.../data-migration.sql` | `INSERT INTO user_levels SELECT ... FROM users WHERE level IS NOT NULL`. | ~10 |
| 1.4 | Domain unit tests | `packages/domain/src/auth/__tests__/user.test.ts` | `User.create` with levels, `addLevel`, `hasLevel`, `hasEducationalLevel`, compat `level` getter, empty levels. | ~50 |

**PR1 total**: ~120 lines changed + migration

### 4.2 PR2: Backend Wiring

**Target branch**: `feat/user-educational-levels-backend` → `feat/user-educational-levels-domain` (or `main` after PR1 merge)

| # | Task | File(s) | Action | Est. lines |
|---|------|---------|--------|------------|
| 2.1 | Repository | `prisma-user.repository.ts` | Include `userLevels` in queries. `toDomain()` maps. `save()` uses `deleteMany + create`. Stop writing `level`/`modality` scalar. | ~50 |
| 2.2 | Use cases + validation | `users.use-cases.ts` | `UserRow` + `userLevels`. `userToResponse()` returns `levels` + `userLevels`. `validateLevelsSubset()`. Create/Update handle `levels[]`. | ~70 |
| 2.3 | Create DTO | `create-user.dto.ts` | Add `levels` Zod schema. Keep `level`/`modality` deprecated. | ~10 |
| 2.4 | Update DTO | `update-user.dto.ts` | Same as create. | ~10 |
| 2.5 | Controller | `users.controller.ts` | Pass `body.levels` to create/update. Stop passing `level`/`modality` separately. | ~5 |
| 3.1 | JWT port | `jwt-auth-port.ts` | Add `levels?: number[]` to `JwtPayload`. | ~2 |
| 3.2 | Login use case | `login.use-case.ts` | Include `userLevels` in query. Map to composites. Set `levels` in JWT. Update `LoginResult` interface. | ~30 |
| 3.3 | Auth guard | `auth.guard.ts` | Add `levels` to `AuthenticatedUser`. Extract from JWT. | ~5 |
| + | Auth controller `/me` | `auth.controller.ts` | Return `levels` from `AuthenticatedUser`. **Also fetch user from DB** to include `userLevels` detail. | ~20 |
| + | UserProfileDTO | `user-profile.dto.ts` | Add `levels?: number[]`, `userLevels?: UserLevelEntry[]`. | ~3 |
| + | Register use case | `register-user.use-case.ts` | Return `levels`/`userLevels` instead of `level`/`modality`. | ~5 |
| 5.1 | Integration tests | `api/src/.../users/__tests__/` | CRUD with `levels[]`: create, create empty, create without field, update replace, update clear, update no-op. Subset validation rejection. Response shape. | ~80 |
| 5.2 | Integration tests | `api/src/.../auth/__tests__/` | Login/me with `levels`. JWT contains `levels`. User with no levels gets `[]`. | ~40 |

**PR2 total**: ~330 lines changed

### 4.3 PR3: Frontend

**Target branch**: `feat/user-educational-levels-frontend` → `feat/user-educational-levels-backend` (or `main` after PR2 merge)

| # | Task | File(s) | Action | Est. lines |
|---|------|---------|--------|------------|
| 4.1 | Auth context | `web/src/context/auth-context.tsx` | `User` type: add `levels?: number[]`. | ~2 |
| 4.2 | Sidebar | `web/src/components/layout/sidebar.tsx` | Derive `baseLevels` from `user.levels` (primary) / `config.levels` (fallback). Update warning message. ROOT bypass unchanged. | ~15 |
| 4.3 | User form | `web/src/pages/dashboard/users.tsx` | Dropdown → checkbox grid. Import `LEVEL_CATALOG`/`LEVEL_LABELS`. Update `UserRow` type. Form sends `levels: [{level, modality}]`. Display as tags in table. | ~120 |
| + | Print view | `web/src/components/reports/UserPrintView.tsx` | `level: string` → levels display. `UserRow.level` → multi-level format. | ~10 |
| + | Study plans audit | `web/src/pages/dashboard/study-plans.tsx` | `user?.level` still works via backward compat getter. Document limitation: only shows first level for multi-level users. | ~5 (doc comment) |
| + | Course sections audit | `web/src/pages/dashboard/course-sections.tsx` | Same as study-plans. | ~5 (doc comment) |
| 5.3 | E2E test | `web/e2e/` | Sidebar filters by user levels. Login as user with Primario only → see Primario items. ROOT sees all. | ~40 |
| 5.4 | Full test suite | — | `pnpm test` — all existing pass. | — |

**PR3 total**: ~197 lines changed

---

## 5. Pre-flight Checklist

### Before starting any code

- [ ] Confirm branch naming convention with team: `feat/user-educational-levels-{domain,backend,frontend}`
- [ ] Verify `pnpm prisma:migrate` works locally (existing migration tooling)
- [ ] Confirm Prisma client regeneration command (`pnpm prisma:generate`)
- [ ] Check if `packages/domain` has tests setup (Vitest? Jest?) — task 1.4 requires TDD
- [ ] Verify `/v1/auth/me` should fetch from DB or just return JWT payload + `levels`
- [ ] Confirm `study-plans.tsx` and `course-sections.tsx` `user.level` → `user.levels[0]` is acceptable for now

### Database safety

- [ ] BACK UP database before running data migration
- [ ] Verify migration rollback: dropping `user_levels` table and restoring old columns works
- [ ] Validate data migration: count users with `level IS NOT NULL` and verify same count has `user_levels` rows

### Backward compat checklist

- [ ] JWT carries BOTH `level` AND `levels` for one release
- [ ] Auth guard extracts BOTH fields
- [ ] Domain `User.level` getter returns first entry (backward compat)
- [ ] Old `level`/`modality` columns kept nullable
- [ ] Old DTO fields `level`/`modality` kept with deprecation comment
- [ ] Frontend `User` type keeps `level` alongside `levels`

### Gaps in task list (unassigned but needed)

| # | File | Issue | Severity | Recommendation |
|---|------|-------|----------|----------------|
| G1 | `auth.controller.ts` `/me` | Currently returns raw JWT. Needs DB fetch for `userLevels` detail. | **HIGH** | Add to PR2: either create a `GetMeUseCase` or fetch in controller. |
| G2 | `register-user.use-case.ts` | Response includes `level`/`modality` — must emit `levels`/`userLevels`. | **MEDIUM** | Add to PR2 task 3.2. |
| G3 | `study-plans.tsx` | Reads `user?.level` for default level pre-selection. | **LOW** | Backward compat getter returns first level. Works but limits UX for multi-level users. Document limitation. |
| G4 | `course-sections.tsx` | Same as G3. | **LOW** | Same treatment. |
| G5 | `UserPrintView.tsx` | `level: string` field — needs multi-level display. | **LOW** | Add to PR3: format as comma-separated labels. |
| G6 | Pre-existing integration tests | No tests in `api/src/application/users/__tests__/` or `api/src/application/auth/__tests__/` directories. | **MEDIUM** | Tasks 5.1 and 5.2 create new tests. No existing tests to update — green field. |

---

## 6. Pre-existing Tests and Code Needing Updates

### Tests to Update

| Test file | What changes | Why |
|-----------|-------------|-----|
| `api/src/presentation/institution/__tests__/to-response.test.ts` | `levels` field in institution response | Institution response format includes `levels` — verify it's NOT affected by user-levels change |
| `api/src/application/institution/__tests__/get-me-and-soft-delete.test.ts` | `i.levels.length` assertion | Institution levels — NOT affected, but audit to confirm |
| `web/src/context/__tests__/institution-context.test.tsx` | `config.levels` assertions | Institution config levels — NOT affected, but sidebar now reads from user first |

### No Pre-existing Tests Found For

- `users.use-cases.ts` — no `__tests__` directory exists. Task 5.1 creates from scratch.
- `login.use-case.ts` — no `__tests__` directory exists. Task 5.2 creates from scratch.
- `prisma-user.repository.ts` — no tests. Repository tests not in scope.
- `sidebar.tsx` — no component tests. E2E test (5.3) covers.

### Code That WILL Break Without Update

| File | Line | What | Fix in |
|------|------|------|--------|
| `users.use-cases.ts` → `userToResponse` | 35-36 | `level: u.level`, `modality: u.modality` | PR2 |
| `users.use-cases.ts` → Create | 143-144 | `level: input.level`, `modality: input.modality` | PR2 |
| `users.use-cases.ts` → Update | 284-285 | `data.level`, `data.modality` | PR2 |
| `prisma-user.repository.ts` → `save()` | 92-93, 105-106 | `level: user.level`, `modality: user.modality` | PR2 |
| `prisma-user.repository.ts` → `toDomain()` | 200-201 | `level: record.level`, `modality: record.modality` | PR2 |
| `login.use-case.ts` | 74, 96 | `level: user.level` | PR2 |
| `auth.guard.ts` | 40 | `level: payload.level` | PR2 |
| `auth.controller.ts` → `/me` | 109 | `level?: number` in param type | PR2 |
| `register-user.use-case.ts` | 65-66 | `level: saved.level`, `modality: saved.modality` | PR2 |
| `auth-context.tsx` | 4 | `level?: number` in `User` | PR3 |
| `sidebar.tsx` | 111-112 | `config.levels` as sole source | PR3 |
| `users.tsx` | 203, 218, 239, 267, 368, 464 | All `level` refs | PR3 |

---

## 7. Summary

| Metric | Value |
|--------|-------|
| **Risk level** | **MEDIUM** |
| **Total files changed** | 16-18 files |
| **Estimated lines changed** | ~650 across 3 PRs |
| **Pre-existing tests found** | 0 directly affected; 3 audit-only |
| **New tests required** | Domain unit (1.4), API integration (5.1, 5.2), E2E (5.3) |
| **Gaps identified** | 6 (1 HIGH, 2 MEDIUM, 3 LOW) |
| **Backward compat window** | 1 release (keep `level` field in JWT, DB, Domain getter) |

### Go / No-Go

**GO** — with conditions:
1. **G1 must be resolved**: `/auth/me` needs a DB fetch strategy. Recommend creating a lightweight `GetMeUseCase` or adding `userLevels` include to a direct Prisma query in the controller.
2. **G2 should be included**: `register-user.use-case.ts` response update is small but necessary.
3. **G3-G5 can be deferred**: `study-plans.tsx`, `course-sections.tsx`, and `UserPrintView.tsx` work with backward compat getter. Document as known limitation for multi-level users.
4. **Database backup** before migration is non-negotiable.
