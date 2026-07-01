# Archive Report — fase-bimestre-cierre-asistencia

- **Change name:** `fase-bimestre-cierre-asistencia`
- **Archived:** 2026-07-01
- **Store:** hybrid (engram `sdd/fase-bimestre-cierre-asistencia/archive-report` + este archivo)
- **Status: CLOSED.** Verified PASS, merged to `main` (PR #92, commit `305b27b`).

## Traceability (Engram observation IDs)

| Artifact | Observation ID | Topic key |
|----------|-----------------|-----------|
| Proposal | #1644 | `sdd/fase-bimestre-cierre-asistencia/proposal` |
| Spec | #1645 | `sdd/fase-bimestre-cierre-asistencia/spec` |
| Design | #1646 | `sdd/fase-bimestre-cierre-asistencia/design` |
| Tasks | #1647 | `sdd/fase-bimestre-cierre-asistencia/tasks` |
| Apply progress | #1648 | `sdd/fase-bimestre-cierre-asistencia/apply-progress` |
| Verify report | #1649 (PASS) | `sdd/fase-bimestre-cierre-asistencia/verify-report` |
| Archive report (this doc) | — | `sdd/fase-bimestre-cierre-asistencia/archive-report` |

## Summary

Un cambio, dos capacidades ortogonales, entregado en 4 PRs encadenados (auto-chain), consolidados
en main vía **PR #92** (`Merge pull request #92 from npelizzari1217/feat/cierre-backend`, más
PR #91 `feat/cierre-front` y el fix previo PR #87 `fix/build-prisma-guardian`):

- **Capacidad A — Fase de bimestre** (PRIMARIO + SECUNDARIO): campo `gradingPhase` en
  `CourseCycle` (`NULL | BIM_1..BIM_4 | CIERRE`), activable solo por Secretario+ (rank >= 40),
  gatea ÚNICAMENTE la calificación (`SubjectPeriodGrade`/`SubjectFinalGrade`), reversible,
  nunca lee ni afecta asistencia. Legacy `activeGradingPeriod` queda intacto y sin relación.
- **Capacidad B — Cierre mensual de asistencia** (TODOS los niveles): entidad tenant
  `AttendanceMonthStatus` por `(courseCycleId, year, month)`, default abierto, cierre/apertura
  solo Secretario+, mes cerrado bloquea registro de asistencia (general y por materia) para
  TODOS los roles sin excepción — incluidos ADMIN y ROOT, sin bypass — y solo permite
  lectura/impresión. Generar mes exige que el mes previo generado esté cerrado (primer mes
  exento). Nunca lee `gradingPhase`.

## Acceptance criteria — verified (29/29, per verify-report #1649)

- **Cap. A (AC-A-1..14):** todas verificadas contra código real (no solo contra apply-progress).
  Highlights: `@Rank(40)` en `SetGradingPhaseUseCase`; `requiresGradingPhase()` gatea
  INICIAL/TERCIARIO con 422; columna nullable única = una sola fase activa por diseño;
  reversibilidad CIERRE→bimestre testeada; `canGradeBimester`/`canGradeFinal` en
  `course-cycle.ts` implementan BIM_n=solo período n, NULL=bloquea todo, CIERRE=solo
  `SubjectFinalGrade`; wiring confirmado en `upsert-subject-period-grades.use-case.ts` y
  `upsert-subject-final-grades.use-case.ts`.
- **Cap. B (AC-B-1..15):** todas verificadas. Highlights: guard `monthStatus.isClosed()` en
  `record-general-attendance-day.use-case.ts:76-81` y `record-subject-attendance-day.use-case.ts:84-89`
  corre INCONDICIONALMENTE, fuera del bloque `if (!scope.isAdministrative)` — confirmado
  línea por línea que NO hay bypass, ni para ROOT; `AttendanceMonthStatus.canGenerate(previous)`
  implementa "previo generado debe estar cerrado" + primer mes exento; `open()`/`close()`
  reversibles sin guard extra.
- **Ortogonalidad (AC-A-14, AC-B-15):** confirmada estructuralmente vía grep negativo — ningún
  archivo de Cap. A lee `AttendanceMonthStatus`/su repo; ningún archivo de Cap. B lee
  `GradingPhase`/`gradingPhase`.

## Tests / Build (al momento de verify)

- `pnpm test`: domain 108/1243, api 191/1918, web 49/582 — 3743 tests, todo verde.
- `pnpm build`: domain OK, web OK. `api` con 3 errores TS preexistentes en
  `prisma-student-guardian.repository.ts:59-60` (confirmado byte-idéntico contra
  `origin/main`, NO introducido por este cambio — CRITICAL de proceso, no de este change).
- Coverage: todos los archivos nuevos/tocados ≥80% statements/lines; excepciones puntuales
  (branch en hook web, página `asistencia-mensual.tsx`, controllers grandes) confirmadas como
  código preexistente no relacionado, no bloqueantes.

## WARNING no bloqueante (housekeeping recomendado, no re-abre el change)

No existe un test de integración explícito que arme un escenario combinado y assert el cruce
NEGATIVO de ortogonalidad end-to-end (ej. "`gradingPhase=CIERRE` no bloquea
`record-general-attendance-day` si el mes está OPEN"). La ortogonalidad estructural (ausencia de
acoplamiento en imports/lecturas) SÍ está confirmada por grep negativo y por los tests unitarios
de cada guard por separado. Recomendado para un change futuro de housekeeping de tests, no
bloqueante para este archive.

## Incidente de proceso durante el ciclo (housekeeping ya resuelto)

Durante `apply`, `proposal.md`/`design.md`/`specs/` habían quedado reportados como "untracked"
en una sesión intermedia (modo hybrid con archivo local sin `git add`). Confirmado en
`sdd-verify` (#1649) que, para el momento del verify, ya estaban trackeados en git
(`git ls-files` los listaba) — no llegó a afectar el archive. Sin acción adicional requerida.

## Consolidación en main

- Branch de trabajo: `feat/fase-bimestre-cierre-asistencia` (sin push directo — se consolidó
  vía PRs de GitHub).
- PRs mergeados a `main`: #87 (`fix/build-prisma-guardian`, fix preexistente no relacionado),
  #91 (`feat/cierre-front`), #92 (`feat/cierre-backend`).
- `main` actual en el momento de este archive: `305b27b` (Merge PR #92).
- Este archive NO modifica código de la feature (ya mergeado) — solo consolida artefactos
  openspec y el registro en engram.

## Migraciones pendientes de deploy (checkpoint humano — CRITICAL antes de producción)

Dos migraciones tenant fueron creadas y validadas solo vía `prisma:generate` (regenera clientes)
y tests con mocks/in-memory — **NO se corrieron contra una base de datos real** (sin Postgres
disponible en el entorno de desarrollo WSL):

1. `20260701120000_add_grading_phase_to_course_cycle` (Capacidad A — columna `gradingPhase`
   nullable en `CourseCycle`, tenant schema).
2. `20260701130000_add_attendance_month_status` (Capacidad B — tabla nueva
   `AttendanceMonthStatus`, tenant schema, `@@unique[courseCycleId, year, month]`).

**Acción requerida antes de desplegar a cualquier ambiente con datos reales:** aplicar ambas
migraciones tenant en orden contra la base real y validar manualmente el comportamiento (en
particular el cutover duro de Capacidad A: `gradingPhase = NULL` bloquea toda calificación
Prim/Sec hasta activación manual de una fase por Secretaría). Ambas migraciones son aditivas
y no destruyen datos; el rollback (revertir código primero, limpieza de schema opcional después)
está documentado en proposal.md §Rollback.

## Merge de specs canónicas (delta → main, sin pérdida)

El delta spec (`specs/spec.md`, 29 escenarios G/W/T) se integró como nuevos "Requirement" en 4
archivos de spec canónicos, cada uno con blockquote de trazabilidad al change y fecha, siguiendo
la convención ya usada en este repo (ver `course-cycle/spec.md` — "Pase por Egreso", y
`attendance-recording/spec.md` — "ADR cross-reference"):

| Spec canónica | Requirement agregado | Cubre |
|----------------|----------------------|-------|
| `openspec/specs/course-cycle/spec.md` | Requirement: Grading Phase — cierre de bimestre (GPH-E1..E8) | AC-A-1..7, AC-A-14, edge cases |
| `openspec/specs/subject-period-grades/spec.md` | SPG-R13 — Grading phase guard on period-grade writes (SPG-S18, SPG-S19) | AC-A-8, AC-A-9, AC-A-10 |
| `openspec/specs/subject-final-grades/spec.md` | SFG-R14 — Grading phase guard — CIERRE-only writes (SFG-S20, SFG-S21) | AC-A-11, AC-A-12, AC-A-13 |
| `openspec/specs/attendance-recording/spec.md` | ATR-R10 — Monthly attendance closure — read-only lock with no bypass (ATR-S63..S70) | AC-B-1..15 |

Ningún archivo de spec canónico perdió contenido — todos crecieron en tamaño (verificado por
línea de archivo antes/después):

| Archivo | Antes | Después |
|---------|-------|---------|
| `course-cycle/spec.md` | 950 líneas | 1016 líneas |
| `attendance-recording/spec.md` | 591 líneas | 662 líneas |
| `subject-period-grades/spec.md` | 238 líneas | 267 líneas |
| `subject-final-grades/spec.md` | 254 líneas | 280 líneas |

El campo legacy `activeGradingPeriod` (documentado en `openspec/specs/grading-periods/spec.md`)
NO fue tocado ni referenciado por ningún guard nuevo — se dejó explícito el cross-reference de
no-relación en el nuevo Requirement de `course-cycle/spec.md`.

## Archivo movido

`openspec/changes/fase-bimestre-cierre-asistencia/` →
`openspec/changes/archive/2026-07-01-fase-bimestre-cierre-asistencia/` (vía `git mv`, contenido
verbatim: `design.md`, `proposal.md`, `specs/spec.md`, `tasks.md`, `verify-report.md`, más este
`archive-report.md`). La carpeta activa ya NO existe en `openspec/changes/`.

## Next steps

Ninguno pendiente para este change — ciclo SDD completo (`proposal → spec → design → tasks →
apply → verify → archive`). Único pendiente real es operacional (no de código): aplicar las 2
migraciones tenant en el ambiente de deploy antes de que Secretaría empiece a usar las nuevas
capacidades en producción.
