# Proposal — competency-grading-ui (Fase 3b)

## Intent
Make Fase 3 usable end-to-end: give teachers a UI to grade competencies per period, per CourseCycle. Success = a teacher selects a CourseCycle + subject + period, sees enrolled students × competencies in a grid, and saves grades that persist through the existing Fase-3 backend.

## Problem
The Fase-3 write path (parent/child valuation model + `PATCH /competency-valuations/:uuid/periods/:periodItemId`) is complete but unreachable: there is no UI, the read endpoints the grid needs do not exist, and the old "Valoraciones por Alumno" tab in `competencies.tsx` is BROKEN — it still sends the legacy flat payload (`valoracion1..4`) the backend no longer accepts.

## Proposal
**Backend reads (first PR slice — blocks the UI):**
1. `GET /competency-valuations?courseCycleId=&studyPlanSubjectId=` → each parent valuation + its period children `{valuationId, studentId, competencyId, periodValuations[{periodItemId, gradeScaleValueId, gradeCode, internalStatus, modificable, imprimible}]}`. New repo read + use case. CRITICAL — blocks grid data.
2. `GET /course-cycles/:uuid/students` → enrolled students `{studentId, name}` for row headers; exposes the existing internal `findEnrolledStudentIds` logic as an API. CRITICAL — blocks rows. Low risk.
3. Add `modality` to `GET /course-cycles/:uuid`. MINOR.

**UI (second slice):**
- NEW page `/competency-grading` + "Calificación de Competencias" sidebar entry (Académico).
- NEW `CourseCycleSubjectSelector` emitting `{courseCycleId, studyPlanId, studyPlanSubjectId, level, modality}` (Fase-2 `PlanCourseSubjectSelector` is not reusable — no courseCycleId).
- NEW `CompetencyGradingGrid`: fixed single-period view; rows = enrolled students, columns = competencies, cell = `GradeScaleValue` dropdown. Period navigation at top. Locked cells (`modificable=false`) disabled + lock icon; `internalStatus` as colored badge reusing the `grading-scales.tsx` color map. Hybrid save: optimistic PATCH per cell + "Guardar todo" batch.
- Cleanup: remove the broken `ValuationsTab` from `competencies.tsx`.

## Scope
**In:** the 3 backend reads, new page + 2 components, sidebar/route wiring, ValuationsTab removal.
**Out (Fase 4):** explicit Enrollment→CourseCycle FK, libreta/boletín rendering, report cards. Student list here stays DERIVED (implicit enrollment), exactly as the backend already computes it.

## Risks
- The two CRITICAL GET endpoints must land before the UI can render — sequence them as PR slice 1. The bulk valuations GET needs a new repo read + UC (medium); the students-by-cycle endpoint reuses existing logic (low).
- Derived student list is intentional debt resolved in Fase 4; not a blocker now.

## Impact
- API: pedagogy + course-cycle controllers, one new UC + repo read.
- Web: 1 new page, 2 new components, App.tsx route, sidebar, competencies.tsx cleanup.
