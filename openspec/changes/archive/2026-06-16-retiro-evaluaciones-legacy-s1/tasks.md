# Tasks: retiro-evaluaciones-legacy-s1

> Phase: sdd-tasks · Store: hybrid · 2026-06-16
> Delivery: auto-chain (single PR — design §7 confirmed)
> TDD mode: strict-TDD adapted for deletion (remove covering tests + verify green per unit)

---

## Review Workload Forecast

| Metric | Value |
|---|---|
| Estimated changed lines | ~1 105 (>95 % pure deletion) |
| Lines added / modified for review | ~40 (import trims + array edits) |
| 400-line budget risk | **LOW** — reviewer scans deletions against the design keep/remove table; cognitive load is low |
| Chained PRs recommended | **No** — design §7 explicitly confirmed single PR |
| Decision needed before apply | **No** — delivery_strategy = auto-chain, design ADRs already resolved |

---

## Dependency Graph

```
T1 (web)  ─────────────────────────────────┐
T2 (infra repos) → T3 (module DI) ──┐      ├──→ T8 (sweep) → T9 (gates)
                    T7 (del tests) ──┘      │                        │
                         T4 (UCs) ──────────┘                   T10 (schema)
                         T5 (controller)
                         T6 (DTOs)
```

T1 and T2 are parallel-safe (independent subsystems).
T3 must follow T2.
T4 → T5 → T6 must be sequential after T3.
T7 can be done any time after T2 but must complete before T8.
T8 must follow T1, T3-T7.
T9 follows T8; T10 can run in parallel with T9.

---

## [x] T1 — Frontend: remove legacy surface (web layer)

**Parallel with**: T2
**Spec**: REQ-F1, REQ-F2, REQ-F3
**Design**: rows `evaluation-pages.tsx` (REMOVE), `pedagogy-pages.tsx` SubjectAssignmentsPage (REMOVE), `App.tsx` imports+4 routes (REMOVE), `sidebar.tsx` line 58 (REMOVE)

### Actions
1. **Delete** `web/src/pages/dashboard/evaluation-pages.tsx` (entire file: `EvaluacionesPage`, `NotasPage`, `PeriodosPage`, `NotasTrimestralesPage`, local types, `ConfirmModal`).
2. **Edit** `web/src/App.tsx`:
   - Remove import block for `{ EvaluacionesPage, NotasPage, PeriodosPage, NotasTrimestralesPage }` (lines 23-28).
   - Remove 4 route definitions: `/evaluaciones`, `/evaluaciones/notas`, `/periodos`, `/notas-trimestrales` (lines 74-77).
   - Do NOT touch `AttendancePage`, `/attendance`, or any new-grading route.
3. **Edit** `web/src/pages/dashboard/pedagogy-pages.tsx`:
   - Remove only the `SubjectAssignmentsPage` export (line 56). Keep `SubjectsPage`, `CourseSectionsPage`, `AttendancePage`, `GenericPage`.
4. **Edit** `web/src/components/layout/sidebar.tsx`:
   - Remove the single entry for `/evaluaciones` "Notas y Calificaciones" (line 58). Keep `/grading-periods` (line 112) and all other entries.

### Acceptance
- `vite build` exits 0.
- `pnpm --filter web test` green (no test references deleted components).
- Grep: 0 matches for `EvaluacionesPage|NotasPage|PeriodosPage|NotasTrimestralesPage|SubjectAssignmentsPage` in `web/src`.
- Grep: 0 matches for `/evaluaciones|/notas-trimestrales|/periodos` as route paths in `web/src` (excluding comments).

---

## [x] T2 — API infra: delete 5 legacy repository files

**Parallel with**: T1
**Spec**: REQ-B1, REQ-B2, REQ-B3 (implied: repos serve only deleted endpoints)
**Design**: 5 REMOVE (archivo) rows in keep/remove table; ADR-1

### Actions
Delete these files completely:
1. `api/src/infrastructure/repositories/prisma-subject-assignment.repository.ts`
2. `api/src/infrastructure/repositories/prisma-evaluacion.repository.ts`
3. `api/src/infrastructure/repositories/prisma-nota.repository.ts`
4. `api/src/infrastructure/repositories/prisma-periodo-evaluacion.repository.ts`
5. `api/src/infrastructure/repositories/prisma-nota-trimestral.repository.ts`

**Do NOT delete**: `api/src/application/reportes/generate-boletin.use-case.ts` — it reads `client.subjectAssignment.findMany` and `client.notaTrimestral.findMany` via raw Prisma client, not via these repos.

### Acceptance
- Files no longer exist on disk.
- `pnpm --filter api typecheck` will fail at this point (module still imports them) — this is expected; T3 resolves it.

---

## [x] T3 — API module: surgical DI rewiring in `pedagogy.module.ts`

**Follows**: T2
**Spec**: REQ-B4
**Design**: `pedagogy.module.ts` REMOVE rows; §3 (DI lock-step invariant)

### Actions
Edit `api/src/presentation/pedagogy/pedagogy.module.ts`:

1. **Remove imports** (lines 9-13): `PrismaSubjectAssignmentRepo`, `PrismaEvaluacionRepo`, `PrismaNotaRepo`, `PrismaPeriodoEvaluacionRepo`, `PrismaNotaTrimestralRepo`.
2. **Trim `repos` array** (line 24): remove the 5 legacy repo entries. Result: `[PrismaSubjectRepo, PrismaCourseSectionRepo, PrismaAttendanceRepo, PrismaAcademicCycleRepository, PrismaStudyPlanRepository, PrismaSubjectCompetencyRepo, PrismaCompetencyValuationRepo]`.
3. **Trim `tokens` array** (line 25): remove the 5 legacy token entries in the SAME index positions as step 2. Result: `['SubjectRepository', 'CourseSectionRepository', 'AttendanceRepository', 'AcademicCycleRepository', 'StudyPlanRepository', 'SubjectCompetencyRepository', 'CompetencyValuationRepository']`.
   - CRITICAL: repos[i] must map to tokens[i] after trimming — verify order.
4. **Remove 15 UC providers** (lines 42-56): all `{ provide: UC.Create/List/Delete{SubjectAssignment,Evaluacion,Nota,Periodo,NotaTrimestral}UC, useClass: ... }` entries.
5. Keep: Subject/CourseSection/Attendance/AcademicCycle/StudyPlan/Competency providers, grading repos, `exports` block — untouched.

### Acceptance
- `pnpm --filter api typecheck` passes (0 new errors vs the 11 pre-existing baseline).
- No `SubjectAssignmentRepository|EvaluacionRepository|NotaRepository|PeriodoEvaluacionRepository|NotaTrimestralRepository` tokens remain in module.

---

## [x] T4 — API use-cases: remove 15 legacy UC classes

**Follows**: T3
**Spec**: REQ-B2, REQ-B3
**Design**: `pedagogy.use-cases.ts` REMOVE rows (15 classes + 5 import trims)

### Actions
Edit `api/src/application/pedagogy/use-cases/pedagogy.use-cases.ts`:

1. **Remove 15 UC classes**:
   - `CreateSubjectAssignmentUC`, `ListSubjectAssignmentsUC`, `DeleteSubjectAssignmentUC` (lines 263-279)
   - `CreateEvaluacionUC`, `ListEvaluacionesUC`, `DeleteEvaluacionUC` (lines 281-287)
   - `CreateNotaUC`, `ListNotasUC`, `DeleteNotaUC` (lines 289-295)
   - `CreatePeriodoUC`, `ListPeriodosUC`, `DeletePeriodoUC` (lines 297-303)
   - `CreateNotaTrimestralUC`, `ListNotasTrimestralUC`, `DeleteNotaTrimestralUC` (lines 305-311)

2. **Trim imports** (lines 3-4): remove unused types/entities now that their classes are gone:
   - From type imports: remove `SubjectAssignmentRepository`, `EvaluacionRepository`, `NotaRepository`, `PeriodoEvaluacionRepository`, `NotaTrimestralRepository`.
   - From entity imports: remove `SubjectAssignment`, `Evaluacion`, `Nota`, `PeriodoEvaluacion`, `NotaTrimestral`.
   - Keep: `Id`, `ok`, `SubjectRepository`, `CourseSectionRepository`, `AttendanceRepository`, `AcademicCycleRepository`, `StudyPlanRepository`, and all remaining entities — they are still used by the surviving UC classes.

### Acceptance
- `pnpm --filter api typecheck` passes.
- Grep: 0 matches for `SubjectAssignmentUC|EvaluacionUC|NotaUC|PeriodoUC|NotaTrimestralUC` as class definitions in the use-cases file.

---

## [x] T5 — API controller: remove 15 injections + 5 route groups

**Follows**: T4
**Spec**: REQ-B1
**Design**: `pedagogy.controller.ts` REMOVE rows (constructor + handlers)

### Actions
Edit `api/src/presentation/pedagogy/pedagogy.controller.ts`:

1. **Remove 15 constructor parameter injections** (lines 23-27): all `@Inject(...)` parameters for `createAssignUC`/`listAssignUC`/`deleteAssignUC`, `create/list/deleteEvaluacionUC`, `create/list/deleteNotaUC`, `create/list/deletePeriodoUC`, `create/list/deleteNotaTrimestralUC`.
2. **Remove 5 route groups** (lines 157-220):
   - `/subject-assignments` handlers (POST/GET/DELETE, lines 157-165)
   - `/evaluaciones` handlers (POST/GET/DELETE, lines 167-175)
   - `/notas` handlers (POST/GET/DELETE, lines 177-185)
   - `/periodos` handlers (POST/GET/DELETE, lines 187-195)
   - `/notas-trimestrales` handlers (POST/GET/DELETE, lines 197-220)

3. **Keep**: `boletinInvalidation`, `TenantContext` injections (used by `gradePeriod` and study-plan handlers); all non-legacy route groups.

### Acceptance
- `pnpm --filter api typecheck` passes.
- Grep: 0 matches for `subject-assignments|/evaluaciones|/notas-trimestrales|/periodos` as route decorators in `pedagogy.controller.ts` (excluding `/evaluaciones` if it appears in a comment).

---

## [x] T6 — API DTOs: remove 5 legacy schema blocks

**Follows**: T5
**Spec**: REQ-B2, REQ-B3 (DTOs are part of use-case surface)
**Design**: `pedagogy.dto.ts` REMOVE row; §5 (minified line — exact-substring edit)

### Actions
Edit `api/src/presentation/pedagogy/dto/pedagogy.dto.ts`:

- **IMPORTANT**: This file is a single minified line. Do NOT edit by line number. Use exact-substring replacement.
- Remove these 5 schema/DTO blocks by their exact string content:
  - `CreateSubjectAssignmentSchema` + `CreateSubjectAssignmentDTO`
  - `CreateEvaluacionSchema` + `CreateEvaluacionDTO`
  - `CreateNotaSchema` + `CreateNotaDTO`
  - `CreatePeriodoSchema` + `CreatePeriodoDTO`
  - `CreateNotaTrimestralSchema` + `CreateNotaTrimestralDTO`
- Keep all other schemas in the file.

### Acceptance
- `pnpm --filter api typecheck` passes.
- File still parses as valid TypeScript.
- Grep: 0 matches for `SubjectAssignmentSchema|EvaluacionSchema|NotaSchema|PeriodoSchema|NotaTrimestralSchema` in `pedagogy.dto.ts`.

---

## [x] T7 — Delete legacy test files

**Parallel-safe with**: T4, T5, T6 (can be batched with any of them)
**Spec**: REQ-T1, REQ-T2
**Design**: §6 (DELETE row for both files)

### Actions
1. **Delete** `api/src/application/pedagogy/__tests__/subject-assignment.use-cases.test.ts`.
2. **Delete** `api/test/integration/evaluaciones.test.ts`.

**Do NOT delete**: `academic-cycle.use-cases.test.ts`, `study-plan.use-cases.test.ts`, `competency.use-cases.test.ts` — these cover surviving code.

### Acceptance
- Files no longer exist.
- `pnpm --filter api test` exits 0 with all remaining tests green.
- No test references `CreateSubjectAssignmentUC`, `ListSubjectAssignmentsUC`, `DeleteSubjectAssignmentUC`, `CreateEvaluacionUC`, `CreateNotaTrimestralUC`.

---

## [x] T8 — Dangling reference sweep

**Follows**: T1, T3, T4, T5, T6, T7 (all deletions complete)
**Spec**: REQ-TC4, REQ-N1, REQ-N2, REQ-N3
**Design**: §5 (Plan de barrido de referencias colgantes)

### Actions
Run grep sweeps and fix any remaining references:

**Web sweeps** (search in `web/src`):
```
EvaluacionesPage|NotasPage|PeriodosPage|NotasTrimestralesPage
SubjectAssignmentsPage
/evaluaciones|/notas-trimestrales|/periodos|/subject-assignments
```
Expected: 0 matches (excluding any comments). Fix any barrel re-exports or lazy-import references found.

**API sweeps** (search in `api/src` and `api/test`, excluding `schema.prisma` and `generate-boletin.use-case.ts`):
```
PrismaSubjectAssignmentRepo|PrismaEvaluacionRepo|PrismaNotaRepo|PrismaPeriodoEvaluacionRepo|PrismaNotaTrimestralRepo
CreateSubjectAssignmentUC|ListSubjectAssignmentsUC|DeleteSubjectAssignmentUC
CreateEvaluacionUC|CreateNotaUC|CreatePeriodoUC|CreateNotaTrimestralUC
SubjectAssignmentRepository|EvaluacionRepository|NotaRepository|PeriodoEvaluacionRepository|NotaTrimestralRepository
```
Expected: 0 matches (excluding `@educandow/domain` package files, which are intentionally kept per ADR-2).

**Boletin preservation check**:
```
client.subjectAssignment.findMany
client.notaTrimestral.findMany
```
Expected: matches present in `generate-boletin.use-case.ts` — confirms boletin raw-client path is untouched.

### Acceptance
- All sweep greps return 0 hits for removed symbols (in non-exempt files).
- Boletin grep returns ≥ 1 match each (raw client calls intact).
- No new TypeScript errors introduced.

---

## [x] T9 — Final verification gate

**Follows**: T8
**Spec**: REQ-TC1, REQ-TC2, REQ-TC3, REQ-TC4, REQ-T2, REQ-T3
**Design**: §5 gates + §7 single-PR conclusion

### Actions
Run all gates in order:

1. `pnpm --filter api typecheck` → must exit 0, must have 0 NEW errors (baseline: 11 pre-existing errors are acceptable if unchanged).
2. `pnpm --filter api test` (Vitest) → must exit 0, all tests green, no failures.
3. `pnpm --filter web test` → must exit 0.
4. `vite build` (web workspace) → must exit 0.
5. `pnpm build` (monorepo root via Turbo) → must exit 0 for all workspaces.

### Acceptance
- All 5 commands exit 0.
- No regressions introduced.
- Scenario 7 from spec (build/typecheck clean) is satisfied.

---

## [x] T10 — Schema integrity + boletin regression confirmation

**Parallel-safe with**: T9
**Spec**: REQ-D1, REQ-D2, REQ-D3, REQ-BL1, REQ-BL2, REQ-BL3
**Design**: ADR-3 (schema intacto), §8 (integration points)

### Actions
1. Run `git diff --stat` — verify `schema.prisma` (both master and tenant) does NOT appear in the diff.
2. Verify no new migration files exist in `api/prisma_master/migrations/` or `api/prisma_tenant/migrations/`.
3. Verify `generate-boletin.use-case.ts` is unchanged: `git diff api/src/application/reportes/generate-boletin.use-case.ts` shows no changes.
4. If boletin integration tests exist: run them and confirm green. If none exist, manually note that the boletin raw-client paths (`client.subjectAssignment.findMany`, `client.notaTrimestral.findMany`) are intact per T8 sweep.
5. Verify `@educandow/domain` package files for `SubjectAssignment(Repository)`, `Evaluacion(Repository)`, `Nota(Repository)`, `PeriodoEvaluacion(Repository)`, `NotaTrimestral(Repository)` are unchanged (ADR-2).

### Acceptance
- `git diff --stat` shows 0 changes to any `schema.prisma` file.
- No migration files created (Scenario 5 from spec: data rows survive, schema diff = 0).
- `generate-boletin.use-case.ts` unchanged (Scenario 6 from spec).
- Domain entities and repo interfaces for the 5 legacy models are present and unmodified.

---

## Task Summary

| ID | Description | Parallel? | Sequential after | Spec req |
|---|---|---|---|---|
| T1 | Web: delete evaluation-pages, update App.tsx, pedagogy-pages, sidebar | Parallel with T2 | — | REQ-F1, F2, F3 |
| T2 | API: delete 5 infra repository files | Parallel with T1 | — | REQ-B1, B2, B3 |
| T3 | API: surgical DI rewiring in pedagogy.module.ts | Sequential | T2 | REQ-B4 |
| T4 | API: remove 15 legacy UC classes + trim imports | Sequential | T3 | REQ-B2, B3 |
| T5 | API: remove 15 constructor injections + 5 route groups from controller | Sequential | T4 | REQ-B1 |
| T6 | API: remove 5 schema/DTO blocks from pedagogy.dto.ts (minified) | Sequential | T5 | REQ-B2, B3 |
| T7 | Delete 2 legacy test files | Parallel with T4-T6 | T2 | REQ-T1, T2 |
| T8 | Dangling reference sweep (grep + fix any stragglers) | Sequential | T1, T3-T7 | REQ-TC4, N1-N3 |
| T9 | Final verification gate (typecheck + tests + build) | Sequential | T8 | REQ-TC1-TC4, T2-T3 |
| T10 | Schema integrity + boletin regression confirmation | Parallel with T9 | T8 | REQ-D1-D3, BL1-BL3 |

**Total tasks**: 10 (2 parallel pairs + 1 sequential chain of 6 + 1 sweep + 2 final gates)
