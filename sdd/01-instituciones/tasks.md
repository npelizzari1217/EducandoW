# Tasks: Institutions 25-Field Multi-Tenant

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 300–500 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1: Slices 1-2 (Domain + Config) → PR2: Slices 3-4 (Multi-Tenant + Endpoints) → PR3: Slice 5 (Frontend) |
| Delivery strategy | ask-on-risk |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

## Phase 1: Domain + Config (Slices 1 & 2)

- [x] 1.1 Add max 20 char validation to `Cue` VO in `packages/domain/src/institution/value-objects/cue.ts`
- [x] 1.2 Create unit tests for Cue VO (`packages/domain/src/institution/value-objects/__tests__/cue.test.ts`): valid, null, max-length exceeded
- [x] 1.3 Make ENCRYPTION_KEY check unconditional (remove production-only guard) in `api/src/infrastructure/config/env.config.ts`
- [x] 1.4 Create config bootstrap test (`api/src/infrastructure/config/__tests__/env.config.test.ts`): crash on missing/invalid key

## Phase 2: Multi-Tenant Creation (Slice 3)

- [x] 2.1 Create `PostgresAdminService` (`api/src/infrastructure/persistence/postgres-admin.service.ts`): `createDatabase()`, `dropDatabase()`, `runTenantMigrations()`
- [x] 2.2 Rewrite `CreateInstitutionUseCase` with 4-step atomic flow: master record → CREATE DATABASE → run migrations → create admin user (with rollback on each failure point)
- [x] 2.3 Create `CreateInstitutionAdminUseCase` (`api/src/application/institution/use-cases/create-institution-admin.use-case.ts`): hash password, insert into master.users
- [x] 2.4 Add `admin_email` to `CreateInstitutionFullDto` schema in `api/src/presentation/institution/dto/create-institution-full.dto.ts`
- [x] 2.5 Register `PostgresAdminService` provider in `api/src/app.module.ts`
- [x] 2.6 Create integration tests for institution creation with rollback scenarios (`api/src/application/institution/use-cases/__tests__/create-institution.test.ts`)

## Phase 3: Endpoints (Slice 4)

- [x] 3.1 Add `active?: boolean` param to `InstitutionRepository.findAll()` interface in `packages/domain/src/institution/repositories/institution-repository.ts`
- [x] 3.2 Implement conditional `?active` where clause in `PrismaInstitutionRepository.findAll()` (`api/src/infrastructure/persistence/prisma/repositories/prisma-institution.repository.ts`)
- [x] 3.3 Update `ListInstitutionsUseCase` to accept active filter and `UpdateInstitutionUseCase` to harden ADMIN cue restriction
- [x] 3.4 Update `InstitutionController`: list with `?active` query, create returns admin credentials, PATCH enforces ADMIN cue restriction

## Phase 4: Frontend (Slice 5)

- [x] 4.1 Add CSS theme variable application in `InstitutionContext` (`web/src/context/institution-context.tsx`): useEffect sets `--header-color`, `--body-text-color`, `--body-bg-color` on `:root`
- [x] 4.2 Add body_color, footer_color, footer_text_color fields to institution form in `web/src/pages/dashboard/institutions.tsx`
- [x] 4.3 Add ROOT role gate for SMTP/Branding/active sections in the institution form
- [x] 4.4 Handle admin credentials display from create response in the form
- [x] 4.5 Wire theme CSS vars in `theme-context.tsx` and `dashboard-layout.tsx`

## Phase 5: Verification

- [x] 5.1 Run `pnpm test` for domain tests (Cue VO)
- [x] 5.2 Run `pnpm test` for config tests (ENCRYPTION_KEY bootstrap)
- [x] 5.3 Run integration tests for create-institution flow
- [x] 5.4 Run `pnpm build` to verify no compilation errors
- [x] 5.5 Manual E2E: create institution → login as admin → verify /me returns theme colors
