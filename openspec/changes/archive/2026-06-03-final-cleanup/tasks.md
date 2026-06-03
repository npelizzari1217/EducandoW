# Tasks: Final Audit Cleanup

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~140 (50 modified + 90 new) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Domain Foundation

- [x] 1.1 Create `packages/domain/src/shared/simple-event-bus.ts` — Map-based EventBus implementing `EventBus` interface
- [x] 1.2 Create `packages/domain/src/shared/__tests__/simple-event-bus.test.ts` — test publish, subscribe, multi-handler, error isolation

## Phase 2: API Type Cleanup — Catch Clauses

- [x] 2.1 `api/scripts/create-tenant-db.ts` — 3x `catch(error: any)` → `unknown`
- [x] 2.2 `api/scripts/diagnose-auth.ts` — 2x `catch(err: any)` → `unknown`
- [x] 2.3 `api/src/application/institution/use-cases/institution.use-cases.ts` — 1x `catch(error: any)` → `unknown` + line 215 `let` → `const`

## Phase 3: API Type Cleanup — Domain Types

- [x] 3.1 `api/src/application/profiles/use-cases/profiles.use-cases.ts` — add `[key: string]: boolean` index signature to `ProfilePermissionRow`, remove 2x `as any`
- [x] 3.2 `api/src/application/users/use-cases/users.use-cases.ts` — replace 11x `any`: level/modality cast to `EducationalLevelCode/EducationalModalityCode`, `createData` to `Prisma.UserCreateInput`, `profilePerms` to `ProfilePermissionRow[]`
- [x] 3.3 `api/src/application/course-cycle/use-cases/course-cycle.use-cases.ts` — replace 3x `any`: `updateData` typed, `planRef.level/.modality` typed
- [x] 3.4 `api/src/presentation/pedagogy/pedagogy.controller.ts` — replace 3x `c: any` with `AcademicCycle` type in `toCycleResponse` and map callbacks
- [x] 3.5 `api/src/infrastructure/.../prisma-academic-cycle.repository.ts` — replace 2x `as any` with `Prisma.AcademicCycleCreateInput/UpdateInput`
- [x] 3.6 `api/src/infrastructure/.../prisma-course-cycle.repository.ts` — replace 1x `as any` with `Id.reconstruct(String(record.id))`
- [x] 3.7 `api/src/presentation/institution/institution.controller.ts` — replace `body as any` with `as unknown as CreateInstitutionInput`

## Phase 4: Lint Errors Fix

- [x] 4.1 `api/test/integration/evaluaciones.test.ts` — remove unused `DeleteNotaUC` and `DeleteNotaTrimestralUC` imports
- [x] 4.2 Pre-existing: fix 4 `no-useless-escape` in `api/scripts/diagnose-auth.ts`
- [x] 4.3 Pre-existing: fix unused imports in `academic-cycle.use-cases.test.ts`, `users.use-cases.test.ts`, `prisma-user-repository.test.ts`

## Phase 5: Documentation

- [x] 5.1 Create `api/prisma/migrations_archive/README.md` — document grades table, refresh_tokens.role, cross-schema FKs

## Phase 6: Verification

- [x] 6.1 Run `pnpm test` — all suites pass (domain: 53 files/607 tests, api: 40 files/284 tests, web)
- [x] 6.2 Run `pnpm lint` — 0 warnings, 0 errors across all 3 packages
- [x] 6.3 Run `pnpm build` — domain and web build clean; api build has pre-existing errors from uncommitted domain VO migration (Id, EducationalLevel, etc.) — NOT caused by this cleanup
