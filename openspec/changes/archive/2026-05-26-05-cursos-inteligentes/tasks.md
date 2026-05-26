# Tasks: Cursos Inteligentes — Creación con Contexto Automático

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~350-450 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR (backend + frontend are independent slices) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Backend: domain + infra + app + controller | PR 1 | base branch; tests included |
| 2 | Frontend: CourseSectionsPage + routing | PR 2 | depends on PR 1 for API contract |

## Phase 1: Domain Foundation

- [ ] 1.1 Create `packages/domain/src/pedagogy/entities/academic-cycle.ts` — minimal read-only entity with `reconstruct()` only (id, name, level, modality, startDate, endDate, active)
- [ ] 1.2 Create `packages/domain/src/pedagogy/repositories/academic-cycle-repository.ts` — interface with `findByLevel(level: EducationalLevelCode, modality?: EducationalModalityCode): Promise<AcademicCycle[]>`
- [ ] 1.3 Modify `packages/domain/src/pedagogy/index.ts` — export `AcademicCycle`, `AcademicCycleProps`, `AcademicCycleRepository`

## Phase 2: Infrastructure + Application

- [ ] 2.1 Create `api/src/infrastructure/persistence/prisma/repositories/prisma-academic-cycle.repository.ts` — `PrismaAcademicCycleRepo` implementing `AcademicCycleRepository` using tenant Prisma client, filtering by active + deletedAt IS NULL
- [ ] 2.2 Modify `api/src/application/pedagogy/use-cases/pedagogy.use-cases.ts` — add `ListAcademicCyclesUC` (injects AcademicCycleRepository, calls findByLevel)
- [ ] 2.3 Modify `api/src/application/pedagogy/use-cases/pedagogy.use-cases.ts` — update `CreateCourseSectionUC.execute()` to auto-generate `name = \`${grade} ${division}\`` when name absent and grade present; return error if neither name nor grade provided
- [ ] 2.4 Modify `api/src/presentation/auth/dto/register.request.ts` — make `name` `.optional()` and `institutionId` `.optional()` in `CreateCourseSectionSchema`; add `.refine()` that requires at least `name` or `grade`

## Phase 3: Presentation Wiring

- [ ] 3.1 Modify `api/src/presentation/pedagogy/pedagogy.controller.ts` — add `GET academic-cycles` endpoint with `@Query('level')` and `@Query('modality')`, roles ADMIN/MANAGER/TEACHER; inject `listCyclesUC`
- [ ] 3.2 Modify `api/src/presentation/pedagogy/pedagogy.controller.ts` — update `POST course-sections` to enrich body with `institutionId` from `req.user.institutionId` and `level` from `req.user.level` when absent
- [ ] 3.3 Modify `api/src/presentation/pedagogy/pedagogy.module.ts` — register `PrismaAcademicCycleRepo`, provide `AcademicCycleRepository` token, wire `ListAcademicCyclesUC` factory

## Phase 4: Frontend Implementation

- [ ] 4.1 Create `web/src/pages/dashboard/course-sections.tsx` — `CourseSectionsPage` component with: `useAuth()` for level/institutionId, `useInstitution()` for name, `useEffect` → GET /academic-cycles, grade input (required), division input (optional), level readonly if user.level 1-4 or dropdown if 9/absent, institution readonly, academic cycle readonly with fallback to current year
- [ ] 4.2 Modify `web/src/pages/dashboard/pedagogy-pages.tsx` — replace `CourseSectionsPage` GenericPage one-liner with `export { CourseSectionsPage } from './course-sections'`
- [ ] 4.3 Modify `web/src/App.tsx` — update import to include new `CourseSectionsPage` from `course-sections.tsx` (no route change needed, same path)

## Phase 5: Testing

- [ ] 5.1 Create `packages/domain/src/pedagogy/__tests__/entities/academic-cycle.test.ts` — unit test `AcademicCycle.reconstruct()` with valid props
- [ ] 5.2 Create `api/src/application/pedagogy/use-cases/__tests__/list-academic-cycles.test.ts` — unit test `ListAcademicCyclesUC` with mocked repo, verify level filter
- [ ] 5.3 Create `api/src/application/pedagogy/use-cases/__tests__/create-course-section.test.ts` — unit test name auto-generation: (a) name absent + grade+div → auto-gen, (b) name present → use as-is, (c) neither name nor grade → error
- [ ] 5.4 Create `api/src/presentation/pedagogy/__tests__/academic-cycles.controller.test.ts` — e2E with supertest: GET returns cycles, 401 without auth, 403 for STUDENT
- [ ] 5.5 Create `web/src/pages/dashboard/__tests__/course-sections.test.tsx` — RTL tests: readonly level for PRIMARIO user, dropdown for ADMIN user, cycle auto-select, missing institution disables submit
