# Tasks: User Profiles — Permission Templates (Spec Alignment)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 50–150 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Backend Spec Alignment

- [ ] 1.1 Map `_count.permissions` → `assignedModuleCount` in `ListProfilesUseCase` (`api/src/application/profiles/use-cases/profiles.use-cases.ts`)
- [ ] 1.2 Normalize `GetProfileUseCase` response to 12 entries (extract shared helper, absent modules → all-false)
- [ ] 1.3 Add non-existent check in `UpdateProfileUseCase` → return `{ data: null }` for unknown profile
- [ ] 1.4 Change `moduleId` validation in `UpdatePermissionsDto` from `z.string().min(1)` to `z.string().uuid()` (`api/src/presentation/profiles/dto/update-permissions.dto.ts`)
- [ ] 1.5 Pass `profileId: body.profileId` in `UsersController.create()` call to `createUC.execute()` (`api/src/presentation/users/users.controller.ts`)

## Phase 2: Seed Data

- [ ] 2.1 Rename "Docente" → "Docente Básico" with spec permissions (STUDENTS:READ, GRADES:READ+CREATE+UPDATE, ATTENDANCE:READ+CREATE+UPDATE) in `api/prisma/seed.ts`
- [ ] 2.2 Remove "Preceptor" profile from seed
- [ ] 2.3 Keep "Admin Completo" unchanged

## Phase 3: Frontend

- [ ] 3.1 Update profiles table to use `p.assignedModuleCount` instead of `p._count?.permissions` in `web/src/pages/dashboard/profiles.tsx`

## Phase 4: Verification

- [ ] 4.1 Run `pnpm test --filter=api` to verify profile and user tests pass
- [ ] 4.2 Run `pnpm build` to verify no compilation errors
- [ ] 4.3 Run `pnpm prisma:seed` to verify seed runs without errors and creates 2 profiles
- [ ] 4.4 Manual: create user with profile → verify UserModule rows generated; GET /profiles/:id → verify 12 entries
