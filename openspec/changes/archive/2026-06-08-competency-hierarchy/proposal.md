# Proposal — competency-hierarchy (Fase 2)

## Intent
Re-connect competency definitions into the real pedagogical hierarchy **Plan → Curso → Materia**, and repair the live-broken competencies UI. Success: a competency is defined against a concrete `StudyPlanSubject`, the front-end loads through a Plan→Course→Subject drill-down, and the auto-creation of valuations navigates the StudyPlan path instead of fragile column matching.

## Problem
`SubjectCompetency` hangs off the **global `Subject`** (`unique(subjectId, name)`), so it carries no plan/course context — contradicting the master-plan hierarchy decision. The UI in `web/src/pages/dashboard/competencies.tsx` calls two **non-existent routes** (`GET /subjects/:id/competencies`, `GET /students/:id/competency-valuations`), so both tabs are dead today. `AutoCreateCompetencyValuationsUC` finds students by matching `Enrollment.{level,grade,division,academicYear}` against `CourseSection` columns — brittle and breaks on naming drift.

## Proposal (the re-model)
1. **Re-scope** `SubjectCompetency` from `Subject` to **`StudyPlanSubject`** (the Plan×Curso×Materia tuple): drop `subjectId`, add `studyPlanSubjectId` FK with `onDelete: Cascade`; unique becomes `(studyPlanSubjectId, name)`. Tables are nearly empty → clean migration. Different courses of the same plan keep distinct competency sets (intentional).
2. **Rewire** `AutoCreateCompetencyValuationsUC` to navigate `CourseCycle → StudyPlan → StudyPlanCourse → StudyPlanSubject → SubjectCompetency`, dropping the Enrollment↔CourseSection column match.
3. **Fix the front-end**: point both tabs at the real routes (`/subject-competencies`, `/competency-valuations`) and replace the flat subject selector with a Plan→Course→Subject drill-down, plus a "copy competencies from another course" shortcut.
4. **Propagate** the new scope through domain entity, repository port + impl (`findActiveByStudyPlanSubject`, `findByStudyPlanSubjectAndName`), DTOs, controller route, and tests. Remove the deprecated `periodActive` from `SubjectCompetency`.

## Scope
**In**: schema re-scope + migration; domain/application/infra/presentation rewiring; AutoCreate UC navigation fix; front-end route fix + drill-down; tests.
**Out (deferred to Fase 3)**: `CompetencyValuation` gaining `courseCycleId`, changing its UNIQUE, GradeScale integration (free value + internal-status enum), and removing its `periodActive`. **Fase 2 leaves `CompetencyValuation` structurally as-is.**

## Risks
- `CompetencyValuation.UNIQUE(studentId, competencyId)` **blocks multi-cycle grading**. Add a schema comment marker now so Fase 3 changes it **before** populating data — do not lock data under the old unique.
- AutoCreate rewire must keep current trigger (`CreateSubjectAssignmentUC`) behaviour; cover with tests.

## Impact
Schema, `packages/domain/src/pedagogy/`, `api/src/{application,infrastructure,presentation}/pedagogy/`, and `web/.../competencies.tsx`. Restores a dead UI and aligns competencies with the hierarchy. Clean-arch boundaries unchanged; repository stays the single port per aggregate.
