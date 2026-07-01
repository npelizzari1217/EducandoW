# Verify Report — fase-bimestre-cierre-asistencia

Branch: `feat/fase-bimestre-cierre-asistencia` (4 PRs / 6 slices, sin push/PR — checkpoint humano único antes de deploy)
Fecha: 2026-07-01

## Status: PASS (con 1 bloqueo preexistente de build, no introducido por este cambio, y 1 WARNING de cobertura de test)

## 1. Test suite (`pnpm test`, forzado sin cache)

| Workspace | Files | Tests | Resultado |
|---|---|---|---|
| @educandow/domain | 108 | 1243 | ✓ verde |
| api | 191 | 1918 | ✓ verde |
| web | 49 | 582 | ✓ verde |

Total: 348 archivos / 3743 tests, todos verdes.

## 2. Build (`pnpm build`)

- `@educandow/domain`: OK.
- `web` (`tsc -b && vite build`): OK, 0 errores.
- `api` (`nest build` → typecheck): **FALLA** con 3 errores TS en
  `api/src/infrastructure/persistence/prisma/repositories/prisma-student-guardian.repository.ts`
  (líneas 59-60, conversión `Error` → `Record<string,unknown>` y acceso a `.meta.target`).

**Confirmado PREEXISTENTE**: `git diff origin/main -- api/src/infrastructure/persistence/prisma/repositories/prisma-student-guardian.repository.ts`
da diff vacío (archivo byte-idéntico a `origin/main`). Este cambio no lo introdujo ni lo tocó.

**CRITICAL (bloqueo de proceso, no del cambio)**: estos 3 errores bloquean `pnpm build` completo
y por ende cualquier pipeline de deploy que dependa de `pnpm build` en verde, aunque no sean
responsabilidad de `fase-bimestre-cierre-asistencia`. Deben arreglarse en un fix aparte antes de
poder deployar cualquier cambio, incluido este. `pnpm --filter web build` en aislado sí compila y
buildea 100% limpio; el `api` build también fallaría para cualquier otro cambio hasta que se
resuelva ese archivo.

## 3. Verificación AC por AC (contra código real, no contra apply-progress)

### Capacidad A — Fase bimestre (PRIM/SEC)

| AC | Verificado | Evidencia |
|---|---|---|
| AC-A-1/2 (Secretario+, rank≥40, rechazo PRECEPTOR/TEACHER) | ✓ | `@Rank(40)` en `course-cycle.controller.ts:310` (setGradingPhase) + `RankGuard` genérico (rank.guard.ts, ROOT bypass explícito de gestión, umbral `userRank >= requiredRank`) |
| Sin acceso en INICIAL/TERCIARIO (422) | ✓ | `SetGradingPhaseUseCase.execute` → `cc.requiresGradingPhase()` → `GradingPhaseNotApplicableError` si false; `course-cycle.ts` test `requiresGradingPhase()` false para INICIAL/TERCIARIO |
| Una sola fase activa | ✓ (por diseño de datos) | Columna nullable única `gradingPhase` en `CourseCycle` — no hay colección, activar otra sobreescribe la anterior estructuralmente |
| CIERRE reversible a bimestre | ✓ | `course-cycle.test.ts:385` "is reversible: CIERRE back to a bimester" |
| BIM_n permite solo período n | ✓ | `canGradeBimester(ordinal)` compara `phase.bimesterOrdinal() === ordinal`; test `rejects all bimesters during CIERRE` |
| NULL rechaza todo (cutover duro) | ✓ | `canGradeBimester`: `if (!phase ...) return false`; `canGradeFinal`: `phase !== null && phase.isCierre()` |
| CIERRE permite solo SubjectFinalGrade | ✓ | `canGradeFinal()` true solo si `phase.isCierre()`; wired en `UpsertSubjectFinalGradesUseCase` vía `phaseAuthorizer.canGradeFinal` |
| Notas especiales rechazadas fuera de CIERRE | ✓ | mismo guard anterior, inverso |
| AC-A-14 ortogonalidad (fase NULL no bloquea asistencia) | ✓ estructural / WARNING test explícito (ver §5) | `GradingPhaseAuthorizerService` y `CourseCycle` no importan ni leen `AttendanceMonthStatus`/`AttendanceMonthStatusRepository` en ningún punto (grep negativo confirmado) |

### Capacidad B — Cierre mensual asistencia (TODOS los niveles)

| AC | Verificado | Evidencia |
|---|---|---|
| Abrir/cerrar/reabrir mes solo Secretario+ | ✓ | `@Rank(40)` en `asistencia.controller.ts:274` (PATCH estado) |
| **Mes cerrado rechaza registro para TODOS incl. ROOT/ADMIN, sin bypass** | ✓ **confirmado incondicional** | `record-general-attendance-day.use-case.ts:76-81` y `record-subject-attendance-day.use-case.ts:84-89`: el check `monthStatus.isClosed()` corre SIEMPRE, fuera y después del bloque `if (!scope.isAdministrative)`, nunca anidado dentro de él — comentario explícito en código "Never placed behind scope.isAdministrative — no bypass exists" |
| Generar mes rechazado si el previo generado no está cerrado | ✓ | `generate-monthly-attendance.use-case.ts:99-102`: `AttendanceMonthStatus.canGenerate(previousStatus)` vía `findLatestBefore` (ordinal estricto, no predecesor calendario) |
| Primer mes exento | ✓ | `AttendanceMonthStatus.canGenerate(null) → true` (domain entity, línea 125-130) + test dedicado |
| Reabrir permitido con mes siguiente generado, sin afectarlo | ✓ | `open()` solo muta la fila propia; ningún guard adicional en `Open...UseCase` |
| Default abierto sin fila | ✓ | guards usan `if (monthStatus && monthStatus.isClosed())` — ausencia de fila ⇒ no bloquea |
| Aplica a TODOS los niveles (AC-B-14) | ✓ | ningún guard de Capacidad B referencia `level`/`EducationalLevelCode` (grep negativo confirmado) |
| AC-B-15 ortogonalidad (CIERRE bimestre no bloquea asistencia) | ✓ estructural / WARNING test explícito (ver §5) | `AttendanceMonthStatus` y los 3 use-cases de asistencia no importan `GradingPhase`/`gradingPhase` en ningún punto |

## 4. Coverage (archivos nuevos/tocados del cambio, ≥80% threshold)

| Archivo | Stmts | Branch | Funcs | Lines |
|---|---|---|---|---|
| `grading-phase-authorizer.service.ts` | 100% | 100% | 100% | 100% |
| `course-cycle/use-cases/grading-phase.use-cases.ts` | 100% | 100% | 100% | 100% |
| `course-cycle/value-objects/grading-phase.ts` (domain) | 91.66% | 100% | 100% | 91.66% |
| `course-cycle/entities/course-cycle.ts` (domain, tocado) | 92.3% | 88.09% | 100% | 92.3% |
| `grading/errors/grading-phase.errors.ts` (domain) | 100% | 100% | 100% | 100% |
| `attendance-month-status.use-cases.ts` | 97.43% | 90% | 100% | 97.22% |
| `generate-monthly-attendance.use-case.ts` (tocado) | 98% | 80% | 100% | 97.91% |
| `record-general-attendance-day.use-case.ts` (tocado) | 93.47% | 90.9% | 100% | 93.18% |
| `record-subject-attendance-day.use-case.ts` (tocado) | 91.93% | 85.36% | 100% | 91.52% |
| `prisma-attendance-month-status.repository.ts` | 93.33% | 87.5% | 100% | 100% |
| `attendance-month-status.ts` (domain entity) | 100% | 100% | 100% | 100% |
| `attendance-month-status.errors.ts` (domain) | 100% | 100% | 100% | 100% |
| `web/src/hooks/useAttendanceMonthStatus.ts` | 94.59% | 75% | 100% | 97.14% |

Todos ≥80% en statements y lines. Dos casos con métrica puntual bajo 80% con excepción verificada:

- `web/src/hooks/useAttendanceMonthStatus.ts` branch 75%: única rama sin cubrir es el early-return
  `if (!ccId) return false` en `setStatus` (edge case defensivo, no crítico).
- `web/src/pages/dashboard/asistencia-mensual.tsx`: stmts 83.15%/lines 86.78% (✓) pero branch
  78.66%/funcs 76.59% (bajo 80%). **Verificado con `git diff origin/main`**: las líneas sin cubrir
  (745-756, handlers `onClick` de dismiss de toast genérico y `onClose` del `AlertModal` de "sin
  curso asignado") NO aparecen en el diff de esta rama — son código preexistente no tocado por
  este cambio. No es un gap de testing introducido por `fase-bimestre-cierre-asistencia`.

Dos controllers grandes (`asistencia.controller.ts` branch 57.69%; `course-cycle.controller.ts`
stmts 72.27%/funcs 57.89%) muestran promedios de archivo bajos, pero **verificado línea por línea
vía el reporte HTML de coverage** que el código NUEVO de este cambio (endpoints GET/PATCH estado,
GET/PATCH grading-phase, mapeo `gradingPhase` en `toResponse`) está 100% cubierto (`cline-yes` en
todas las líneas nuevas); el déficit del promedio de archivo es 100% atribuible a rutas
preexistentes no relacionadas — mismo patrón de excepción ya documentado en apply-progress para
PR-3b.

## 5. WARNING — cruce negativo de ortogonalidad sin test explícito

Se verificó la ortogonalidad **estructuralmente** (grep negativo: ningún archivo de Capacidad A
lee `AttendanceMonthStatus`/`AttendanceMonthStatusRepository`, y ningún archivo de Capacidad B lee
`GradingPhase`/`gradingPhase`). Esto es evidencia fuerte de que las dos capacidades no están
acopladas.

Sin embargo, **no existe un test de integración explícito** que arme un escenario combinado y
assert el cruce negativo, por ejemplo:
- "con `gradingPhase = CIERRE` (o `NULL`) en un CourseCycle, `record-general-attendance-day`
  sigue funcionando normalmente si el mes está OPEN" (prueba AC-A-14 end-to-end).
- "con el mes CLOSED, `upsert-subject-period-grades` sigue evaluando el guard de fase
  independientemente" (prueba AC-B-15 end-to-end).

Este es el mismo riesgo que tasks.md ya había señalado explícitamente. La ausencia de test
explícito no invalida el comportamiento (la ausencia de acoplamiento en el código es la garantía
real), pero es una brecha de trazabilidad spec→test que conviene cerrar antes o después del
archive.

**Clasificación: WARNING** (no bloquea archive, se recomienda agregar como tarea de housekeeping
post-archive o en un fix menor).

## 6. Tasks checklist

`openspec/changes/fase-bimestre-cierre-asistencia/tasks.md`: 66/66 checkboxes en `[x]`, 0 en `[ ]`.
Coincide con apply-progress (#1648): PR-1, PR-2, PR-3 (domain+infra+app+presentation), PR-4 completos.

## 7. Housekeeping / notas menores

- apply-progress (#1648) señalaba que `proposal.md`/`design.md`/`specs/` seguían untracked en git
  pese al modo hybrid. **Verificado ahora**: `git ls-files` los muestra TRACKEADOS — ya no es un
  problema (se resolvió en algún punto entre sesiones, posiblemente por un commit intermedio no
  documentado en apply-progress).
- Migraciones tenant (`20260701120000_add_grading_phase_to_course_cycle`,
  `20260701130000_add_attendance_month_status`) existen como archivos de migración pero **no se
  aplicaron contra una DB real** (sin Postgres en el entorno de desarrollo). Confirmado presentes
  en `api/prisma_tenant/migrations/`. El checkpoint humano único antes de deploy (aplicar ambas
  migraciones en orden + smoke test manual) sigue pendiente, tal como registrado en apply-progress.

## Result Contract

- **status**: PASS
- **executive_summary**: 0 CRITICAL del cambio (el único CRITICAL es un bloqueo de build
  preexistente y no relacionado, confirmado por diff vacío contra origin/main), 1 WARNING
  (falta test explícito del cruce negativo de ortogonalidad, aunque la ortogonalidad estructural
  está confirmada por grep), 0 SUGGESTION adicionales.
- **artifacts**: `sdd/fase-bimestre-cierre-asistencia/verify-report` (engram),
  `openspec/changes/fase-bimestre-cierre-asistencia/verify-report.md`
- **next_recommended**: `sdd-archive` (el cambio cumple contrato; el bloqueo de build es
  preexistente y ajeno, no debe frenar el archive de este SDD, pero SÍ debe frenar cualquier
  deploy hasta arreglarse aparte, y las migraciones tenant deben aplicarse manualmente antes de
  ese deploy)
- **risks**:
  1. (bloqueante de DEPLOY, no de archive) `prisma-student-guardian.repository.ts` con 3 errores
     de typecheck preexistentes rompe `pnpm build` — arreglar en un fix aparte antes de deployar
     cualquier cosa, incluido este cambio.
  2. (no bloqueante) Falta test de integración explícito del cruce negativo de ortogonalidad
     (Cap. A no bloquea asistencia / Cap. B no bloquea calificación) — recomendado como
     housekeeping.
  3. (checkpoint conocido, ya documentado) Migraciones tenant sin aplicar contra DB real — aplicar
     manualmente antes del deploy.
- **skill_resolution**: injected
