# Tasks: Planes de Estudio

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 500–700 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Delivery strategy | ask-on-risk |
| Suggested split | PR 1 (schema+domain+infra) → PR 2 (app+presentation) → PR 3 (frontend+wiring) |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Schema models + domain entities + repository interface + Prisma impl | PR 1 | Base branch; no tests yet, compiles |
| 2 | Use cases + DTOs + controller + module + app.module registration | PR 2 | Depends on PR 1; controller tests |
| 3 | Frontend page + route + sidebar + print CSS | PR 3 | Depends on PR 2; form orchestration tests |

## Phase 1: Schema + Domain + Infrastructure

- [ ] 1.1 Add `StudyPlan`, `StudyPlanCourse`, `StudyPlanSubject` models to `api/prisma/schema_tenant.prisma` — StudyPlan has name, level, modality, academicYear, active, deletedAt; StudyPlanCourse joins StudyPlan↔CourseSection; StudyPlanSubject joins StudyPlanCourse↔Subject with optional hoursPerWeek
- [ ] 1.2 Run `prisma db push` against tenant DB to sync schema
- [ ] 1.3 Create `packages/domain/src/pedagogy/entities/study-plan.ts` — entity with `create()`, `reconstruct()`, `softDelete()`, props: id, name, level(Level), modality, academicYear, active, deletedAt
- [ ] 1.4 Create `packages/domain/src/pedagogy/entities/study-plan-course.ts` — junction entity: StudyPlan ↔ CourseSection, props: id, studyPlanId, courseSectionId
- [ ] 1.5 Create `packages/domain/src/pedagogy/entities/study-plan-subject.ts` — junction entity: StudyPlanCourse ↔ Subject, props: id, studyPlanCourseId, subjectId, hoursPerWeek?
- [ ] 1.6 Create `packages/domain/src/pedagogy/repositories/study-plan-repository.ts` — interface matching design contract: findById, findAll, findByIdWithCourses, save, delete, addCourse, removeCourse, addSubject, removeSubject
- [ ] 1.7 Update `packages/domain/src/pedagogy/index.ts` — export 3 entities + StudyPlanRepository interface
- [ ] 1.8 Update `packages/domain/src/index.ts` — re-export new pedagogy entities and repository type
- [ ] 1.9 Create `api/src/infrastructure/persistence/prisma/repositories/prisma-study-plan.repository.ts` — Prisma impl using TenantContext.getClient(), upsert for save, soft-delete for delete, Prisma include for findByIdWithCourses
- [ ] 1.10 Run `pnpm build` in packages/domain to verify compilation

## Phase 2: Application + Presentation

- [ ] 2.1 Create `api/src/application/study-plans/use-cases/study-plans.use-cases.ts` — 9 use cases: CreateStudyPlan, ListStudyPlans, GetStudyPlanDetail, UpdateStudyPlan, DeleteStudyPlan, AddCourseToPlan, RemoveCourseFromPlan, AddSubjectToPlanCourse, RemoveSubjectFromPlanCourse
- [ ] 2.2 Create `api/src/presentation/study-plans/dto/study-plan.dto.ts` — Zod schemas: CreateStudyPlanSchema (name 1-200, modality, academicYear, level), UpdateStudyPlanSchema (partial: name, modality, academicYear only), AddCourseSchema (courseSectionIds[]), AddSubjectSchema (subjectIds[], hoursPerWeek?)
- [ ] 2.3 Create `api/src/presentation/study-plans/study-plans.controller.ts` — endpoints: GET/POST/PATCH/DELETE /study-plans, POST/DELETE /study-plans/:id/courses, POST/DELETE /study-plan-courses/:id/subjects; AuthGuard+RolesGuard, ZodValidationPipe
- [ ] 2.4 Create `api/src/presentation/study-plans/study-plans.module.ts` — NestJS module wiring repos via useFactory, register 9 use cases
- [ ] 2.5 Update `api/src/app.module.ts` — import StudyPlansModule
- [ ] 2.6 Verify: `pnpm build` in api compiles without errors

## Phase 3: Frontend + Wiring

- [ ] 3.1 Create `web/src/pages/dashboard/study-plans.tsx` — StudyPlansPage with: plan list table + create/edit form, institution/level auto-fill from JWT (non-ROOT) or dropdown (ROOT), course association section (add/remove CourseSections), per-course subject association (add/remove Subjects), print button calling window.print()
- [ ] 3.2 Add `@media print` CSS to study-plans page — hide sidebar/nav/form controls, apply `page-break-inside: avoid` per course block
- [ ] 3.3 Update `web/src/components/layout/sidebar.tsx` — add `{ label: 'Planes de Estudio', path: '/study-plans', requiresLevel: true }` to navItems
- [ ] 3.4 Update `web/src/App.tsx` — import StudyPlansPage, add `<Route path="/study-plans" element={<StudyPlansPage />} />`
- [ ] 3.5 Verify: `pnpm build` in web compiles without errors

## Phase 4: Testing

- [ ] 4.1 Domain unit tests: `packages/domain/src/pedagogy/__tests__/entities/study-plan.test.ts` — entity create, reconstruct, softDelete
- [ ] 4.2 Controller integration tests: Supertest against POST /study-plans — validate 400 on missing fields, 201 on valid create, 403 on wrong role
- [ ] 4.3 Controller tests: DELETE /study-plans/:id returns 204, soft-deletes plan and cascades junction records
- [ ] 4.4 Controller tests: POST /study-plans/:id/courses — duplicate course silently skipped, returns 201
- [ ] 4.5 Frontend smoke: verify form renders with auto-filled institution/level for non-ROOT user, dropdowns visible for ROOT
