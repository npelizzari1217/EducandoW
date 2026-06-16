# Archive Report: retiro-evaluaciones-legacy-s1

> Archived: 2026-06-16
> Branch: feat/retiro-evaluaciones-legacy-s1 (merged into main via PR)
> Verify verdict: PASS — 0 CRITICAL, 0 WARNING, 1 SUGGESTION (fixed in commit bdd6b4b)
> Engram artifact IDs: proposal #1049 · spec #1050 · design #1051 · tasks #1052 · verify-report #1054

---

## What Was Removed

### Frontend surface

| Artifact | Action |
|---|---|
| `web/src/pages/dashboard/evaluation-pages.tsx` | Deleted entirely (EvaluacionesPage, NotasPage, PeriodosPage, NotasTrimestralesPage + local types/ConfirmModal) |
| `web/src/App.tsx` | Removed 4 route imports + 4 route registrations (`/evaluaciones`, `/evaluaciones/notas`, `/notas-trimestrales`, SubjectAssignments admin route) |
| `web/src/pages/dashboard/pedagogy-pages.tsx` | Removed `SubjectAssignmentsPage` export only; other exports intact |
| `web/src/components/layout/sidebar.tsx` | Removed `/evaluaciones` nav entry ("Notas y Calificaciones"); `/grading-periods` entry preserved |

### Backend surface

| Artifact | Action |
|---|---|
| `api/src/presentation/pedagogy/pedagogy.controller.ts` | Removed 14 handlers (subject-assignments, evaluaciones, notas, periodos, notas-trimestrales) + 15 constructor injections |
| `api/src/application/pedagogy/use-cases/pedagogy.use-cases.ts` | Removed 15 legacy UC classes (SubjectAssignment/Evaluacion/Nota/PeriodoEvaluacion/NotaTrimestral CRUD) |
| `api/src/presentation/pedagogy/dto/pedagogy.dto.ts` (also `register.request.ts`) | Removed legacy schema/DTO blocks |
| `api/src/presentation/pedagogy/pedagogy.module.ts` | Removed 5 repo imports, trimmed repos[]/tokens[] lock-step, removed 15 UC providers |
| `api/src/infrastructure/repositories/prisma-subject-assignment.repository.ts` | Deleted |
| `api/src/infrastructure/repositories/prisma-evaluacion.repository.ts` | Deleted |
| `api/src/infrastructure/repositories/prisma-nota.repository.ts` | Deleted |
| `api/src/infrastructure/repositories/prisma-periodo-evaluacion.repository.ts` | Deleted |
| `api/src/infrastructure/repositories/prisma-nota-trimestral.repository.ts` | Deleted |
| `api/src/application/pedagogy/__tests__/subject-assignment.use-cases.test.ts` | Deleted (tests of deleted code) |
| `api/test/integration/evaluaciones.test.ts` | Deleted (tests of deleted code) |

---

## What Was Preserved (Hard Requirements — All Met)

| Item | Status |
|---|---|
| `api/prisma_tenant/schema.prisma` | Untouched — models SubjectAssignment, Evaluacion, NotaTrimestral, PeriodoEvaluacion, Nota remain |
| All data rows in those tables | Intact — no migration was created or applied |
| `generate-boletin.use-case.ts` | Unchanged — reads via raw Prisma client (`client.subjectAssignment.findMany`, `client.notaTrimestral.findMany`); not routed through the deleted repos |
| Domain entities + repo interfaces (`@educandow/domain`) | Preserved — removal is S2 |
| New grading system (subject-period-grades, subject-final-grades, competency-valuations) | Unaffected — pages, routes, endpoints, use-cases all intact |
| `/grading-periods` sidebar entry and route | Preserved — confirmed distinct from retired `/periodos` (different repo: PrismaGradingPeriodRepository vs PrismaPeriodoEvaluacionRepo) |
| `Teacher`, `/teachers`, `MesaExamen`, `ActaExamen` | Untouched — Teacher track decisions pending |

---

## Verify Results (PASS)

| Gate | Result |
|---|---|
| api tests (Vitest) | 127 files / 1 201 tests GREEN |
| web tests (Vitest) | 37 files / 394 tests GREEN |
| domain tests (Vitest) | 92 files / 1 036 tests GREEN |
| Typecheck (`tsc --noEmit`) | 11 errors, ALL pre-existing (0 new) |
| `vite build` (web) | PASS |
| `pnpm build` (turbo) | 3 tasks PASS |
| `git diff main -- *.prisma` | 0 lines changed |
| Dangling refs (web/src, api/src) | 0 found |

SUGGESTION-1: stale comment in pedagogy.controller.ts L379 referencing `deleteNotaTrimestral` — fixed in commit `bdd6b4b`.

---

## Key Design Decisions

1. **R1 resolved (PeriodosPage)**: `/periodos` is LEGACY → removed. The NEW grading uses `/grading-periods` (distinct route, repo, model). No overlap.
2. **pedagogy.module repos[]/tokens[] invariant**: arrays are parallel-indexed; both trimmed lock-step to preserve DI mapping.
3. **pedagogy.dto.ts is minified**: edits done via exact-substring replacement.
4. **Boletin uses raw Prisma client** (not repo interface) → deleting the infra repos is safe; boletin continues to work.
5. **evaluacion-*.strategy.ts** files are part of the NEW grading evaluación strategies — NOT legacy; untouched.

---

## Canonical Spec Changes

| Spec | Change |
|---|---|
| `openspec/specs/evaluation-frontend/spec.md` | Added RETIRED notice at top — all 4 legacy page requirements superseded by this change. Data preserved, remaining work tracked in umbrella. |

No other canonical specs were modified. The legacy grading surface had no separate canonical spec for the API layer (the controller was part of `pedagogy.module` which serves multiple bounded contexts); the retirement is fully documented in this archive report and the retired `evaluation-frontend` spec.

---

## Remaining Roadmap (Umbrella: retiro-teacher-legacy)

| Slice | Scope | Blocker |
|---|---|---|
| **S2 — Boletin migration** | Replace `subjectAssignment.findMany({include:{teacher}})` in `generate-boletin.use-case.ts` with DocenteXCiclo → userId → User lookup; retire SubjectAssignment domain entity + repo interface | None (safe to start) |
| **S3 — Data archival + schema drop** | Archive/drop Evaluacion, NotaTrimestral, SubjectAssignment rows and models; drop PeriodoEvaluacion | Requires product decision #1 (historial de notas legacy: borrar vs archivar) |
| **Teacher track — MesaExamen/ActaExamen migration** | Migrate `presidenteId` FK from Teacher to User or DocenteXCiclo; resolve 4 Restrict FKs | Requires product decisions #2 (MesaExamen) + #3 (página /teachers) |
| **Teacher track — homeroomTeacherId drop** | Refactor homeroom nav to AsignacionCursoXCiclo TITULAR; remove findByHomeroomTeacher | Requires S3 + decision #3 |

Product decisions still open (from umbrella explore):
1. Evaluacion/NotaTrimestral historial: borrar, archivar a tabla cold, o conservar permanentemente.
2. MesaExamen/ActaExamen `presidenteId`: migrar a User/DocenteXCiclo, o mantener Teacher como registro permanente solo para mesas.
3. Página `/teachers`: retirar (reemplazada por gestión de usuarios) o mantener como vista legacy.
