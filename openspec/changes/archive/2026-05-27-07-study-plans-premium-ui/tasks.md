# Tasks: Study Plans Premium UI

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 350-450 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR (backend + frontend tightly coupled) |
| Delivery strategy | exception-ok |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Backend PATCH endpoints + DTO fixes + enriched courses response | PR 1 | Self-contained, testable independently |
| 2 | Frontend premium UI rewrite + sidebar cleanup | PR 2 | Depends on PR 1 for PATCH endpoints |

## Phase 1: Backend — PATCH endpoints + DTO fixes

- [x] 1.1 Add `UpdateSubjectUC` in `api/src/application/pedagogy/use-cases/pedagogy.use-cases.ts` with correct props spread via `Subject.reconstruct()`
- [x] 1.2 Add `UpdateCourseSectionUC` in same file with auto-name generation (`{grade} {division}` when name absent)
- [x] 1.3 Add `UpdateSubjectSchema` and `UpdateCourseSectionSchema` in `api/src/presentation/auth/dto/register.request.ts` with correct casing transforms
- [x] 1.4 Add `PATCH /subjects/:id` controller endpoint in `api/src/presentation/pedagogy/pedagogy.controller.ts`
- [x] 1.5 Add `PATCH /course-sections/:id` controller endpoint in same controller
- [x] 1.6 Update DI registration in `PedagogyModule` for new UCs
- [x] 1.7 Enrich `StudyPlanCourseDto` in `packages/domain/src/pedagogy/repositories/study-plan-repository.ts` with `courseGrade`/`courseDivision` fields
- [x] 1.8 Update `PrismaStudyPlanRepository` in `api/src/infrastructure/.../prisma-study-plan.repository.ts` to populate new fields from `courseSection.grade` and `courseSection.division`
- [x] 1.9 Expand `GET /study-plans/:id/courses` response in controller to include `courseGrade` and `courseDivision`

## Phase 2: DTO casing fixes

- [x] 2.1 Add `textField` transform (trim only, no uppercase) for subject names in `register.request.ts`
- [x] 2.2 Add `gradeField` transform (trim only) for course grades in same file
- [x] 2.3 Update `CreateSubjectSchema` to use `textField` for name validation
- [x] 2.4 Update `CreateCourseSectionSchema` grade field to use `gradeField`
- [x] 2.5 Keep `division` on `codeField` (uppercase + trim) — verify existing behavior

## Phase 3: Frontend — Premium UI rewrite

- [x] 3.1 Implement accordion with `Set<string>` state in `web/src/pages/dashboard/study-plans.tsx` — collapsed by default
- [x] 3.2 Visual hierarchy: Plan card (left border indigo `#6366f1` 4px), Course row (lighter border `#a5b4fc` 3px, indented), Subject items (compact, bg `#f8fafc`, double-indented)
- [x] 3.3 Level badges with color coding: INICIAL=green, PRIMARIO=blue, SECUNDARIO=amber, TERCIARIO=purple, border-radius 20px
- [x] 3.4 Subject count badges ("8 materias") per course
- [x] 3.5 Inline edit forms for courses (grade + division) and subjects (name) with selective refetch
- [x] 3.6 Inline create forms with context inheritance (plan → course → subject)
- [x] 3.7 Add existing course/subject dropdowns for association
- [x] 3.8 Print CSS with `.no-print` class and `break-inside: avoid` / `page-break-inside: avoid`
- [x] 3.9 Error handling with alert on mutation failure

## Phase 4: Sidebar cleanup

- [x] 4.1 Remove Materias, Cursos, Asignaciones entries from sidebar navigation component
- [x] 4.2 Remove corresponding routes from `App.tsx`

## Phase 5: Verification

- [x] 5.1 Domain build passes (`pnpm --filter @educandow/domain build`)
- [x] 5.2 API build passes (`pnpm --filter api build`)
- [x] 5.3 Web build passes (`pnpm --filter web build`)
- [x] 5.4 Domain tests pass (227/227)
