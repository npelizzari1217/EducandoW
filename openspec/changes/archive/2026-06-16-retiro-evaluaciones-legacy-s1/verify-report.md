# Verify Report — retiro-evaluaciones-legacy-s1

**Branch**: `feat/retiro-evaluaciones-legacy-s1`
**Date**: 2026-06-16
**Verdict**: PASS
**CRITICAL**: 0 | **WARNING**: 0 | **SUGGESTION**: 1

---

## 1. Test Suite Results

| Suite | Files | Tests | Result |
|-------|-------|-------|--------|
| `pnpm --filter api test` | 127 | 1201 | ALL GREEN |
| `pnpm --filter web test` | 37 | 394 | ALL GREEN |
| `pnpm --filter @educandow/domain test` | 92 | 1036 | ALL GREEN |
| `pnpm --filter api typecheck` | — | 11 errors | ALL PRE-EXISTING (0 new) |
| `pnpm build` (turbo) | — | 3 tasks | PASS (3 cached) |
| `vite build` (web) | — | — | PASS (only pre-existing chunk-size warnings) |

---

## 2. Spec Requirement Verification

### REQ-F1/F2/F3 — Frontend legacy surface removed

- `web/src/pages/dashboard/evaluation-pages.tsx`: DELETED ✓
- `web/src/App.tsx`: 4 legacy routes removed (`/evaluaciones`, `/evaluaciones/notas`, `/notas-trimestrales`, any periodos sub-path). No legacy route strings present. ✓
- `web/src/pages/dashboard/pedagogy-pages.tsx`: `SubjectAssignmentsPage` export removed ✓
- `web/src/components/layout/sidebar.tsx`: `/evaluaciones` nav entry (`Notas y Calificaciones`) removed ✓
- No legacy symbols found anywhere in `web/src/` ✓

### REQ-B1/B2/B3/B4 — API legacy endpoints retired

- 5 infra repos deleted: `prisma-subject-assignment`, `prisma-evaluacion`, `prisma-nota`, `prisma-periodo-evaluacion`, `prisma-nota-trimestral` ✓
- `pedagogy.module.ts`: repos[] and tokens[] both trimmed to 7 (lock-step). No dangling tokens. All 15 legacy UC providers removed. ✓
- `pedagogy.use-cases.ts`: 15 UC classes removed (SubjectAssignment×3, Evaluacion×3, Nota×3, PeriodoEvaluacion×3, NotaTrimestral×3). Imports from `@educandow/domain` trimmed to remove the 5 legacy repo interfaces and 5 entity classes. ✓
- `pedagogy.controller.ts`: 5 route groups removed. Only non-legacy content remains. ✓
- `register.request.ts`: 5 legacy Zod schema blocks removed (-48 lines). File otherwise intact (non-legacy schemas untouched). ✓
- `pedagogy.dto.ts`: 5 legacy re-exports removed. Non-legacy re-exports preserved. ✓
- 2 test files deleted: `subject-assignment.use-cases.test.ts`, `evaluaciones.test.ts` ✓

### REQ-N1/N2/N3 — New grading system unaffected

- `/grading-periods` → `GradingPeriodsPage` in `App.tsx` ✓
- `/competency-grading` → `SubjectGradingBySubjectPage` in `App.tsx` ✓
- `/grading/by-course` → `SubjectGradingByCoursePage` in `App.tsx` ✓
- `evaluacion-*.strategy.ts` files intact at `api/src/application/shared/strategies/` ✓
- Competency-valuation routes (`GET/PATCH competency-valuations`) in controller intact ✓
- All new grading UC providers in `pedagogy.module.ts` untouched ✓

### REQ-D1/D2/D3 — Schema/data preserved (HARD REQUIREMENT)

- `git diff main -- '*.prisma'`: **0 lines changed** ✓
- Both `prisma_tenant/schema.prisma` and `prisma_master/schema.prisma` unchanged ✓
- Legacy models still present in schema: `SubjectAssignment` (l.465), `Evaluacion` (l.611), `Nota` (l.631), `PeriodoEvaluacion` (l.663), `NotaTrimestral` (l.680) ✓
- No migration files created ✓

### REQ-BL1/BL2/BL3 — Boletin non-regression

- `generate-boletin.use-case.ts`: **unchanged** (`git diff main` = 0 lines) ✓
- Raw-client calls confirmed intact:
  - `client.subjectAssignment.findMany` (lines 223, 324, 525)
  - `client.periodoEvaluacion.findMany` (line 233)
  - `client.notaTrimestral.findMany` (line 240)
- Boletin tests: all passing within the 127-file, 1201-test green suite ✓

### REQ-TC1/TC2/TC3/TC4 — Build clean

- `tsc --noEmit`: 11 errors, all pre-existing baseline (study-plan, competency, course-cycle tests). **0 new errors**. ✓
- `vite build`: PASS. Chunk-size warning is pre-existing and unrelated. ✓
- `pnpm build` (turbo): 3 tasks successful ✓

### REQ-T1/T2/T3 — Tests

- Deleted-code tests correctly deleted. No remaining test references removed classes. ✓
- All remaining tests green across all 3 packages (1201 + 394 + 1036 = 2631 tests). ✓

---

## 3. DI Integrity

`pedagogy.module.ts` repos/tokens arrays:

```
repos[7]: PrismaSubjectRepo, PrismaCourseSectionRepo, PrismaAttendanceRepo,
          PrismaAcademicCycleRepository, PrismaStudyPlanRepository,
          PrismaSubjectCompetencyRepo, PrismaCompetencyValuationRepo
tokens[7]: 'SubjectRepository', 'CourseSectionRepository', 'AttendanceRepository',
           'AcademicCycleRepository', 'StudyPlanRepository',
           'SubjectCompetencyRepository', 'CompetencyValuationRepository'
```

Index alignment is correct. No dangling tokens. The 4 new grading repos (CompetencyPeriodValuation, GradeScale, GradingPeriod, CourseCycle) are registered via direct `useExisting` pattern outside the arrays — also correct.

---

## 4. Dangling Reference Sweep

- `web/src/`: zero references to `EvaluacionesPage`, `NotasPage`, `PeriodosPage`, `NotasTrimestralesPage`, `SubjectAssignmentsPage`, `evaluation-pages`, `/evaluaciones`, `/notas-trimestrales`, `/periodos`
- `api/src/`: zero references to removed UC classes, removed repo classes, or removed schemas
- `api/src/presentation/pedagogy/pedagogy.controller.ts` line 379: one comment `// Pre-resolve studentId for boletin invalidation (same pattern as deleteNotaTrimestral)` — this is a historical comment, not a symbol reference. Harmless.
- No orphan barrel exports in index files

---

## 5. Apply Deviations — Confirmed

**Deviation A**: Legacy DTO schemas were actually in `register.request.ts` (not in a single-line `pedagogy.dto.ts`). Both files were correctly updated:
- `register.request.ts`: 5 schema blocks removed cleanly, non-legacy schemas untouched
- `pedagogy.dto.ts`: 5 corresponding re-exports removed from the barrel

**Deviation B**: `sidebar.test.tsx` had 4 assertions removed, all for `'Notas y Calificaciones'` (the legacy `/evaluaciones` nav label). No new-grading nav assertions were lost. The new grading nav items (`Alumnos por Materia`, `Alumnos por Curso`) have their own test section ("Teacher grading access — layered gate", 6 tests) which remains fully intact and passing.

---

## 6. Findings

### SUGGESTION (1)

**S-1**: `pedagogy.controller.ts` line 379 contains a comment `// Pre-resolve studentId for boletin invalidation (same pattern as deleteNotaTrimestral)`. The reference to a removed handler is benign but can be misleading. Consider updating the comment to remove the `deleteNotaTrimestral` reference in a follow-up cleanup. Non-blocking.

---

## 7. Changed Files Summary

18 files changed vs `main` (all expected, no surprises):
- 8 deleted: 5 infra repos + 2 test files + 1 page file
- 10 edited: App.tsx, pedagogy-pages.tsx, sidebar.tsx, sidebar.test.tsx, pedagogy.module.ts, pedagogy.use-cases.ts, pedagogy.controller.ts, register.request.ts, pedagogy.dto.ts, tasks.md
- 0 schema/migration files
- 0 unexpected files

---

## 8. Verdict

**PASS**

The implementation fully satisfies all 8 acceptance scenarios from the spec. The legacy grading surface (4 frontend pages, 5 API route groups, 15 use-cases, 5 repos, 5 DTO schemas) is cleanly retired. The new grading system is unaffected. Schema and data are preserved. Boletin pipeline is intact. All 2631 tests pass, 0 new typecheck errors, all builds pass.

**Siguiente Paso Recomendado**: `sdd-archive`
