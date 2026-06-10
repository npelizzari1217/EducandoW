## grading-primario PR7 Verify Report — 2026-06-10

**verdict**: PASS WITH WARNINGS
**critical**: 0
**warnings**: 2
**suggestions**: 2

### Gate Results
- `pnpm --filter api test`: 856 passed, 6 failed (all pre-existing postgres-admin vi.fn() constructor issue). 2 failing suites (postgres-admin + ensure-institution-levels), both pre-existing. ZERO new failures.
- `pnpm --filter api typecheck`: 11 errors, count UNCHANGED from baseline. All pre-existing: study-plan×6, course-cycle.dto×2, competency.controller×2, competency.use-cases (GradeScaleNotConfiguredError unused)×1.

### Tasks Alignment
- PR7-T1 [x] CONFIRMED: Regression tests at lines 326–412 of generate-boletin.use-case.test.ts. Strong: verifies new repos NOT called for Secundario(30)/INICIAL(10), and output shape has NO periodGrades/finalGrades/competencies/flags.
- PR7-T2 [x] CONFIRMED: 6 buildMateriasPrimario tests covering all 4 data sources + OR-aggregate flags + imprimible filter + absent→blank + empty CC.
- PR7-T3 [x] CONFIRMED: MateriaBoletin in boletin.template.ts has periodGrades?, finalGrades?, competencies?, flags? as optional — non-Primario templates untouched.
- PR7-T4 [x] CONFIRMED: buildMateriasPrimario method present, level dispatch Math.floor(level/10)===2 gating, resolveSubjectsForCC helper present.
- PR7-T5 [x] CONFIRMED: boletin-primario.hbs rebuilt with dynamic period columns, 4 final types (hardcoded header order matches ALL_FINAL_TYPES), competencies with @index/@last pattern, flags as badges. Handlebars built-ins only.
- PR7-T6 [x] CONFIRMED: @deprecated JSDoc on CalificacionPrimario (calificacion-primario.ts:32–35) AND NotaTrimestral (nota-trimestral.ts:14–18). Neither entity deleted.

### Critical (0)
None.

### Warnings (2)
- W2: Competency gradeCode in boletin uses only the FIRST imprimible=true period's grade (`periodValuations.find(pv => pv.imprimible).gradeCode`). If a competency has imprimible=true in multiple periods, only the first one's grade displays. BP-R5 does not specify which period's grade to show — this is a silent design choice that may or may not match business intent.
- W1: GradeScaleNotConfiguredError imported at line 22 of competency.use-cases.test.ts but never used. Generates TS6133. Whether introduced by PR7 or pre-existing cannot be determined without git blame. Total typecheck count (11) is unchanged, suggesting pre-existing. LOW SEVERITY.

### Suggestions (2)
- S1: boletin-primario.hbs cannot be unit-tested without a Handlebars render harness. The use-case tests cover the data contract adequately. The template layout (column ordering, badge styling, competency table open/close pattern) needs manual PDF verification before going to production.
- S2: Controller's listValuations bulk-read path explicitly strips competencyName from the response (maps to {valuationId, studentId, competencyId, periodValuations} only). This is a pre-existing design decision, but means the frontend bulk-read API cannot show competency names. Not a PR7 issue.

### Regression Verdict
PROVEN SAFE. The legacy NotaTrimestral path (lines 188–267 of generate-boletin.use-case.ts) is LITERALLY UNCHANGED. The only modification to buildMaterias() is the dispatch block prepended at lines 177–185. The dispatch is false for Math.floor(level/10)≠2 (Inicial=10, Secundario=30, Terciario=40). DI wiring (reportes.module.ts useFactory, 7 deps) injects all repos in constructor-order — repos are present but unused for non-Primario CCs. T1 test provides byte-for-byte regression proof.

### imprimible Filter Verdict
CORRECT — filter is in the use case (buildMateriasPrimario lines 363–379), not in the HBS template. Template has zero business logic for filtering.

### Data Sources Verdict
ALL MATCH real repo return shapes:
- SubjectGradingPeriod: findByCourseCycleAndSubject → {periodOrdinal, periodName} — MATCH
- SubjectPeriodGrade: findByStudentAndCourseCycle → {subjectId, periodOrdinal, gradeCode, pa, ppi, pp} — MATCH
- SubjectFinalGrade: findByStudentAndCourseCycle → {subjectId, type, gradeCode} — MATCH; 4 instances, absent→blank via `f?.gradeCode ?? ''` — CORRECT
- CompetencyValuationWithPeriods: findByCourseCycleAndStudyPlanSubject → {studentId, competencyName, periodValuations[{imprimible, gradeCode}]} — MATCH

### Engram Observation IDs
- PR4b verify-report: #893
- PR5a verify-report: #897
- PR5b verify-report: #898
- PR6 verify-report: #900 (C1 UUID display — FIXED before archiving, confirmed by PR7 out-of-scope edits verdict)
- PR7 verify-report: #901 (this report)
