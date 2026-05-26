# Proposal: Planes de Estudio

## Intent

Provide curricular management via **Study Plans** that group courses (CourseSections) and their associated subjects, with full CRUD and print support. Institution staff need to define and print curricular plans per level; ROOT admins need cross-institution visibility.

## Scope

### In Scope
- 3 models in tenant Prisma schema: `StudyPlan`, `StudyPlanCourse` (junction), `StudyPlanSubject` (junction)
- CRUD REST endpoints for Study Plans, including course/subject association management
- Auto-fill institution & level from user JWT for non-ROOT; dropdown selection for ROOT
- Print layout via `@media print` CSS
- Sidebar entry "Planes de Estudio"

### Out of Scope
- Academic validation (e.g., hours-per-week minimums, curricular compliance checks)
- Versioning or historical snapshots of study plans
- Export to PDF beyond browser print
- Bulk import/export
- CourseSection or Subject CRUD — those already exist independently

## Capabilities

### New Capabilities
- `study-plans`: Full CRUD for study plans with course/subject association and print output

### Modified Capabilities
None — new capability only.

## Approach

**Backend** (NestJS + Clean Architecture):
- 3 new models in `schema_tenant.prisma`. `StudyPlan` holds plan metadata; `StudyPlanCourse` joins to `CourseSection`; `StudyPlanSubject` joins to `Subject` via `StudyPlanCourse`.
- Domain: `StudyPlan` entity + repository port in `domain/`
- Application: use cases in `application/study-plans/`
- Infrastructure: Prisma repository in `infrastructure/persistence/prisma/repositories/`
- Presentation: controller + DTOs in `presentation/study-plans/`
- ROOT institution selection: query `GET /v1/institutions?active=true` from master DB; after selection, tenant context established for subsequent queries. Non-ROOT uses JWT's `institutionId` + `level` directly.

**Frontend** (React):
- `/planes-de-estudio` page following the existing `modules.tsx` pattern (Card + Table + inline form)
- Smart form: institution dropdown (ROOT only) + level auto-filled or dropdown + modality + academicYear
- Course association: multi-select or add-row UI within the form
- Subject association: per-course table with subject multi-select
- Print: `window.print()` with `@media print` hiding nav/sidebar/form controls
- Sidebar entry under "Gestión" section, guarded by module permission

**Architectural decision — ROOT cross-institution browsing**: ROOT users select an institution via dropdown (fetched from master DB `GET /v1/institutions`), which sets the tenant context for subsequent API calls. This follows the existing pattern from `smart-course-creation` spec where admin-level users get dropdown selection. No dedicated root-level endpoint needed.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `api/prisma/schema_tenant.prisma` | New | 3 models: StudyPlan, StudyPlanCourse, StudyPlanSubject |
| `api/src/domain/study-plans/` | New | Entity + repository port |
| `api/src/application/study-plans/` | New | Use cases |
| `api/src/infrastructure/persistence/prisma/repositories/` | New | PrismaStudyPlanRepository |
| `api/src/presentation/study-plans/` | New | Controller, DTOs, module |
| `api/src/app.module.ts` | Modified | Register StudyPlansModule |
| `web/src/pages/dashboard/study-plans.tsx` | New | Page component |
| `web/src/components/layout/sidebar.tsx` | Modified | Add sidebar entry |
| `web/src/App.tsx` | Modified | Add route |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| M:N association UX complexity — users may find per-course subject selection confusing | Medium | Follow existing `SubjectAssignment` UI patterns; iterate with inline add-row UX |
| ROOT institution selection forces tenant DB switch — edge case if ROOT has no institution assigned | Low | Frontend guard: if ROOT has no `institutionId`, show institution selector before rendering plans |
| Print layout across multiple courses may overflow pages | Low | Use CSS `page-break-inside: avoid` for each course block |

## Rollback Plan

1. Remove the 3 tables: `DROP TABLE study_plan_subjects, study_plan_courses, study_plans CASCADE` via migration down
2. Remove StudyPlans module registration from `app.module.ts`
3. Remove route and sidebar entry from frontend
4. No master DB changes — rollback is tenant-scoped only

## Dependencies

- `CourseSection` and `Subject` models already exist in `schema_tenant.prisma`
- `Institution` CRUD and `GET /v1/institutions` endpoint already exist (master DB)
- JWT must carry `institutionId`, `level`, and `dbName` (already implemented per `auth-access` spec)

## Success Criteria

- [ ] Study Plan CRUD: create, read, list, update, delete all work with correct tenant isolation
- [ ] ROOT can select institution from dropdown and browse/CRUD its plans
- [ ] Non-ROOT sees auto-filled institution/level, not editable
- [ ] Courses can be added to a study plan; subjects can be added per course
- [ ] Print produces clean paper output with plan name, courses, and subjects
- [ ] All endpoints enforce tenant isolation — no cross-tenant data leakage
