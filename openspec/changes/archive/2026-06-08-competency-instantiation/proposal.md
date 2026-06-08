# Proposal — competency-instantiation (Fase 3)

## Intent
Instantiate the competency-grading model from the plan layer into the cycle (ciclo lectivo) layer so competencies can actually be graded per configurable period. Success: a student's competency can hold one grade per real grading period of its course cycle, using Fase 1 scales and internal status, with valuations auto-created when a cycle is instantiated.

## Problem
`CompetencyValuation` today is cycle-blind and flat: it hardcodes `valuation1..4 / modificable1..4 / imprimible1..4 / periodActive`. This is INCOMPATIBLE with Fase 1's configurable periods (trimestral=3, bimestral=4, cuatrimestral=2). It also has no `courseCycleId`, so the same student+competency cannot carry distinct data across cycles. Auto-creation fires from `SubjectAssignment` creation, which has no cycle context.

## Proposal
1. **Normalized two-table model.** `CompetencyValuation` becomes the parent (one per `studentId+competencyId+courseCycleId`): drop the flat slots, add `courseCycleId`, change UNIQUE to `(studentId, competencyId, courseCycleId)`. NEW child `CompetencyPeriodValuation` (one per graded period): `periodItemId`→`GradingPeriodTemplateItem`, nullable `gradeScaleValueId` FK + `gradeCode` snapshot + `internalStatus` (`GradeInternalStatus`), `modificable`/`imprimible` booleans, UNIQUE `(valuationId, periodItemId)`. Child rows are created LAZILY on first grade PATCH.
2. **No `SubjectCourseCycle` entity** — the Materia×Curso×Ciclo space is computed via the existing StudyPlan→StudyPlanCourse→StudyPlanSubject hierarchy plus `courseCycleId`.
3. **GradeScale snapshot** follows the existing `Nota` pattern (FK + `gradeCode` snapshot + `internalStatus` replacing `isApproved`).
4. **Trigger MOVE.** Auto-creation of parent valuations moves from `SubjectAssignment` creation (no cycle) to `CourseCycle` instantiation/generation (has `courseCycleId`). `AutoCreateCompetencyValuationsUC` receives `courseCycleId` explicitly; the `executeForSubjectAssignment` path is neutered/updated.
5. **Destructive migration** (tables empty, user-approved). FKs: `CourseCycle→CompetencyValuation` Restrict, `CompetencyValuation→CompetencyPeriodValuation` Cascade, `GradingPeriodTemplateItem→CompetencyPeriodValuation` Restrict.
6. **Grading endpoint**: PATCH a period valuation — lazy-create the child row + set grade (validation/business errors → 400, not-found → 404).

## Scope
**In:** schema migration, parent/child entities + repos, trigger move, `AutoCreateCompetencyValuationsUC` rewrite, cycle-instantiation hook, grading PATCH endpoint.
**Out (Fase 4):** explicit `Enrollment→CourseCycle` FK, libreta/boletín rendering, report-card generation.
**Front-end:** deferred — RECOMMEND Fase 3 ships backend-only; grading UI becomes a separate Fase-3b slice.

## Risks
- **Trigger move (highest coupling):** audit ALL `SubjectAssignment`/enrollment callers; derive `CourseCycle.uuid` from `(courseSectionId, cycleUuid)`.
- **GradingPeriodTemplate may not exist** at grading time → lazy child creation must handle gracefully (resolve-or-reject without crashing).

## Impact
Schema (`schema.prisma`), pedagogy use cases, course-cycle generation, new period-valuation repo + controller. Tables empty → no data backfill.
