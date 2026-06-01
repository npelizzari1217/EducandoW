# Design: User Educational Levels

## Technical Approach

Mirror `institution_levels` pattern exactly: replace single `User.level`/`User.modality` with `user_levels` junction table. JWT carries composite codes `levels: number[]`. Sidebar filters by user levels (institution fallback when none). User form: checkbox grid replaces dropdown.

## Architecture Decisions

| Decision | Option A | Option B | Choice | Rationale |
|----------|----------|----------|--------|-----------|
| Level entry type | Reuse `InstitutionLevelEntry` from institution domain | Define `UserLevelEntry` in `auth/entities/user.ts` | **B** | Clean Arch: auth must not import from institution. Identical shape, no coupling. |
| DB storage | JSON column on `users` | Separate `user_levels` table | **B** | Mirrors `institution_levels`. `@@unique`, FK cascade, queryable. Established convention. |
| JWT format | Objects `{level,modality}[]` | Composite codes `number[]` | **B** | Compact JWT. Matches `InstitutionConfig.levels` convention. Sidebar decomposes via `Math.floor(c/10)`. |
| Migration | Delete old columns | Copy → `user_levels`, keep columns nullable | **B** | Zero data loss. Clean break: new code reads `userLevels` only. |
| Sidebar source | User levels only | User levels PRIMARY, institution FALLBACK | **B** | Admins may lack personal levels. Institution fallback prevents blank sidebar. ROOT bypass unchanged. |
| Backward compat | Immediate removal | Keep `level`/`modality` one release | **B** | JWT carries both. Frontend prefers `levels`. Remove follow-up. |

## Data Flow

```
Login → JWT { levels: [10, 20, 31] } → AuthContext stores user.levels
Sidebar → baseLevels = Set(user.levels.map(c => c/10∣0))
          fallback to config.levels when user.levels empty
User form → checkbox grid (PEDAGOGICAL_LEVELS) → POST { levels: [{level,modality}] }
Backend → validateLevelsSubset(levels, institution.levels) → reject invalid
         → client.user.create({ userLevels: { create: [...] } })
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/domain/src/auth/entities/user.ts` | Modify | Add `UserLevelEntry` type. Replace `level?`/`modality?` with `levels[]`. Keep `level` getter as compat. Add `addLevel`/`hasLevel` methods. |
| `api/prisma/schema_master.prisma` | Modify | Add `UserLevel` model (mirrors `InstitutionLevel`). Add `userLevels UserLevel[]` relation to `User`. |
| `api/src/infrastructure/persistence/prisma/repositories/prisma-user.repository.ts` | Modify | Include `userLevels` in queries. `toDomain()` maps to `UserLevelEntry[]`. `save()` nests `userLevels.create`. |
| `api/src/infrastructure/auth/jwt-auth-port.ts` | Modify | Add `levels?: number[]` to `JwtPayload`. |
| `api/src/infrastructure/auth/guards/auth.guard.ts` | Modify | Extract `levels` from JWT into `AuthenticatedUser`. |
| `api/src/application/auth/use-cases/login.use-case.ts` | Modify | Map `user.levels` → composite codes for JWT. Include in `LoginResult.user`. |
| `api/src/application/users/use-cases/users.use-cases.ts` | Modify | `UserRow` + `userLevels`. `userToResponse` returns `levels` (composite) + `userLevels` (detail). Create/Update writes via `userLevels.create`. |
| `api/src/presentation/users/dto/create-user.dto.ts` | Modify | Add `levels: z.array(z.object({level:int,modality:int})).optional()`. |
| `api/src/presentation/users/dto/update-user.dto.ts` | Modify | Add `levels` field (same shape). |
| `api/src/presentation/users/users.controller.ts` | Modify | Pass `body.levels` to create/update use cases. |
| `web/src/context/auth-context.tsx` | Modify | Add `levels?: number[]` to `User` type. |
| `web/src/components/layout/sidebar.tsx` | Modify | Compute `baseLevels` from `user.levels`. Fallback to `config.levels`. Update warning message. |
| `web/src/pages/dashboard/users.tsx` | Modify | Level dropdown → checkbox grid (reuse `PEDAGOGICAL_LEVELS` + `LEVEL_CATALOG` full 12-level pattern from institutions.tsx). `UserRow` + `levels`/`userLevels`. |
| `api/src/application/users/use-cases/users.use-cases.ts` | Modify | Add `validateLevelsSubset(userLevels, institutionLevels)` — rejects levels not in institution. ROOT bypass. |

## Interfaces / Contracts

```typescript
// Domain (auth/entities/user.ts)
export interface UserLevelEntry {
  level: EducationalLevelCode;   // 1-4, 9
  modality: EducationalModalityCode; // 0-2, 9
}

// JWT payload (new field)
levels?: number[];  // [10, 20, 31]

// API response (added to userToResponse)
levels: number[];              // composite codes
userLevels: UserLevelEntry[];  // detail for editing
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Domain unit | `User.addLevel`, `hasLevel`, `levels` getter, compat `level` | Vitest, TDD |
| Integration | `PrismaUserRepository` save/load with `userLevels` | Vitest |
| Integration | Login: JWT includes `levels` | Supertest |
| Integration | User CRUD: create/update with `levels[]`, response validation | Supertest |
| E2E | Sidebar filters by user levels | Playwright |

## Migration / Rollout

1. Prisma migrate: add `UserLevel` table. Keep `level`/`modality` nullable.
2. Data migration: `INSERT INTO user_levels SELECT id, level, COALESCE(modality,0) FROM users WHERE level IS NOT NULL`.
3. Deploy backend + frontend together. JWT carries both `level` and `levels`.
4. Monitor + validate: no users with missing levels post-migration.
5. Next release: drop `level`/`modality` columns, remove JWT `level`.

## Open Questions

- [x] Should ADMINISTRACION (90) and TODOS (99) be assignable? → **YES**. Checkbox grid shows full `LEVEL_CATALOG` (12 levels). Non-pedagogical levels allow admin-role users.
- [x] Validate `user_levels` ⊆ `institution_levels`? → **YES**. Backend MUST reject levels not in the user's institution. ROOT bypasses. No institutionId → skip validation.
