# Tasks — fase-bimestre-cierre-asistencia

> Checklist accionable derivado de spec (#1645) + design (#1646). TDD estricto: la tarea de
> test va SIEMPRE antes que la de implementación (rojo → verde). Numeración jerárquica
> `PR.capa.n`. `[P]` = paralelizable dentro de su capa; sin marca = secuencial (depende de la
> tarea anterior). `test_command: pnpm test`.

---

## PR-1 — Backend Fase de calificación (Capacidad A)

*Depende de:* nada. *Bloquea:* PR-2.
Cubre AC-A-1..14 (spec #1645), secciones A1–A6 (design #1646).

### 1.1 Domain

- [x] 1.1.1 Test: VO `GradingPhase.create()` — acepta `BIM_1..BIM_4|CIERRE`, rechaza otros
      strings, `isCierre()`, `isBimester()`, `bimesterOrdinal()`, `equals()`.
      `packages/domain/src/course-cycle/__tests__/value-objects/grading-phase.test.ts`
- [x] 1.1.2 Impl: VO `GradingPhase` self-validating.
      `packages/domain/src/course-cycle/value-objects/grading-phase.ts`
- [x] 1.1.3 [P] Test: errores `GradingPhaseViolationError` (code `GRADING_PHASE_VIOLATION`) y
      `GradingPhaseNotApplicableError` (code `GRADING_PHASE_NOT_APPLICABLE`) — construcción,
      código, mensaje.
      `packages/domain/src/grading/__tests__/errors/grading-phase.errors.test.ts`
- [x] 1.1.4 [P] Impl: los dos errores de dominio.
      `packages/domain/src/grading/errors/grading-phase.errors.ts`
- [x] 1.1.5 Test: `CourseCycle` — `requiresGradingPhase()` (true solo Prim 20-22/Sec 30-32),
      `canGradeBimester(ordinal)` (AC-A: NULL→false todos, BIM_n→solo ordinal n, CIERRE→false
      todos), `canGradeFinal()` (true solo si CIERRE), `setGradingPhase()` reversible + toca
      `lastModifiedAt`.
      `packages/domain/src/course-cycle/__tests__/entities/course-cycle.test.ts`
- [x] 1.1.6 Impl: agregar `gradingPhase` a `CourseCycleProps`, getter, `setGradingPhase()`,
      `requiresGradingPhase()`, `canGradeBimester()`, `canGradeFinal()` a la entidad.
      `packages/domain/src/course-cycle/entities/course-cycle.ts`
- [x] 1.1.7 [P] Impl (sin test unitario propio, es un contrato): puerto
      `GradingPhaseAuthorizerPort` + token `GRADING_PHASE_AUTHORIZER`.
      `packages/domain/src/grading/ports/grading-phase-authorizer.port.ts`
- [x] 1.1.8 Impl: actualizar barrels de dominio (exportar VO, errores, puerto nuevos).
      `packages/domain/src/index.ts` (y barrels intermedios que correspondan)

### 1.2 Application

- [x] 1.2.1 Test: `GradingPhaseAuthorizerService.canGradeBimester/canGradeFinal` — delega en
      entidad vía `findByUuid`; nivel no Prim/Sec → `{allowed:true, reason:'NOT_APPLICABLE'}`;
      CC inexistente → deja pasar (404 lo resuelve el use-case llamador).
      `api/src/application/grading/__tests__/grading-phase-authorizer.service.test.ts`
      (ruta real: `__tests__/`, no co-localizado — convención del repo, igual que PR-1a)
- [x] 1.2.2 Impl: `GradingPhaseAuthorizerService`.
      `api/src/application/grading/grading-phase-authorizer.service.ts`
- [x] 1.2.3 [P] Test: `GetGradingPhaseUseCase` / `SetGradingPhaseUseCase` — Get devuelve
      `gradingPhase|null`; Set rechaza nivel no Prim/Sec con `GradingPhaseNotApplicableError`
      (422), setea reversible, persiste vía `save`.
      `api/src/application/course-cycle/__tests__/grading-phase.use-cases.test.ts`
- [x] 1.2.4 [P] Impl: `GetGradingPhaseUseCase`, `SetGradingPhaseUseCase`.
      `api/src/application/course-cycle/use-cases/grading-phase.use-cases.ts`
- [x] 1.2.5 Test: `UpsertSubjectPeriodGradesUseCase` — por cada `(courseCycleId, periodOrdinal)`
      único invoca `canGradeBimester`; rechaza con `GradingPhaseViolationError` si `!allowed`
      (AC-A: NULL rechaza todo, BIM_n rechaza otros períodos); dedupe de queries.
      `api/src/application/grading/upsert-subject-period-grades.use-case.spec.ts` (ampliado;
      convención real del archivo es `.spec.ts`, no `.test.ts`)
- [x] 1.2.6 Impl: inyectar `GradingPhaseAuthorizerPort` en
      `UpsertSubjectPeriodGradesUseCase`, guard tras auth de asignación (dedupe por
      `(courseCycleId, periodOrdinal)` dentro del loop de validación por-ítem).
      `api/src/application/grading/upsert-subject-period-grades.use-case.ts`
- [x] 1.2.7 Test: `UpsertSubjectFinalGradesUseCase` — por cada `courseCycleId` único invoca
      `canGradeFinal`; rechaza con `GradingPhaseViolationError` fuera de CIERRE (AC-A: notas
      especiales rechazadas fuera de CIERRE).
      `api/src/application/grading/upsert-subject-final-grades.use-case.spec.ts` (ampliado)
- [x] 1.2.8 Impl: inyectar `GradingPhaseAuthorizerPort` en `UpsertSubjectFinalGradesUseCase`
      (guard tras resolución de `ccContexts`, dedupe por `courseCycleId`).
      `api/src/application/grading/upsert-subject-final-grades.use-case.ts`

### 1.3 Infrastructure

- [x] 1.3.1 Impl: schema tenant — enum `GradingPhase` + columna `gradingPhase GradingPhase?`
      en `CourseCycle` (legacy `activeGradingPeriod` intacto).
      `api/prisma_tenant/schema.prisma`
- [x] 1.3.2 Impl: migración tenant escrita a mano (`api/prisma_tenant/migrations/20260701120000_add_grading_phase_to_course_cycle/migration.sql`);
      `pnpm --filter api prisma:generate:tenant` corrido y verde (no requiere DB). El
      `migrate deploy` real queda pendiente para el entorno de deploy (no hay Postgres/Docker
      disponible en este WSL) — ver Learned en apply-progress.
      `api/prisma_tenant/migrations/20260701120000_add_grading_phase_to_course_cycle/`
- [x] 1.3.3 Test: `PrismaCourseCycleRepository` — `toDomain` mapea enum Prisma → VO
      `GradingPhase|null`; `save` mapea VO → enum Prisma (incluye `null`).
      `api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-course-cycle.repository.test.ts` (ampliado)
- [x] 1.3.4 Impl: mapeo `gradingPhase` en `toDomain`/`save` del repo Prisma.
      `api/src/infrastructure/persistence/prisma/repositories/prisma-course-cycle.repository.ts`

### 1.4 Presentation

- [x] 1.4.1 Impl: registrar `GRADING_PHASE_VIOLATION: 409` y `GRADING_PHASE_NOT_APPLICABLE: 422`
      en `DOMAIN_STATUS` (cubierto por los tests e2e/integración del filtro existentes; no
      requiere test nuevo si el filtro ya es genérico por code→status).
      `api/src/presentation/shared/filters/exception.filter.ts`
- [x] 1.4.2 [P] Impl: DTO Zod `SetGradingPhaseSchema` (`z.enum([...]).nullable()`) + test.
      `api/src/presentation/course-cycle/dto/grading-phase.dto.ts`,
      `api/src/presentation/course-cycle/__tests__/grading-phase.dto.test.ts`
- [x] 1.4.3 Test: `CourseCycleController` — `GET .../grading-phase` delega en el use-case;
      `@Rank(40)` metadata verificada en el handler PATCH (AC-A-1/2: rechazo explícito a
      PRECEPTOR/TEACHER — el comportamiento genérico de rank ya está cubierto por
      `rank.guard.test.ts`); 200 + valor nuevo; 422 (`GradingPhaseNotApplicableError`)
      propagado como throw.
      `api/src/presentation/course-cycle/__tests__/grading-phase.controller.spec.ts`
- [x] 1.4.4 Impl: endpoints GET/PATCH `grading-phase`, agregar `RankGuard` a
      `@UseGuards(AuthGuard, RolesGuard, RankGuard)` del controller, `@Rank(40)` en PATCH,
      agregar `gradingPhase` a `toResponse`.
      `api/src/presentation/course-cycle/course-cycle.controller.ts`
- [x] 1.4.5 Impl: wiring de use-cases/repo/puerto nuevos.
      `api/src/presentation/course-cycle/course-cycle.module.ts`,
      `api/src/presentation/grading/grading.module.ts`
- [x] 1.4.6 [P] Test: `subject-grades` responses incluyen `gradingPhase` (para que el front
      deshabilite columnas sin round-trip extra).
      `api/src/application/grading/get-subject-grades-by-subject.use-case.spec.ts`,
      `api/src/application/grading/get-subject-grades-by-student.use-case.spec.ts` (ambos
      ampliados)
- [x] 1.4.7 [P] Impl: agregar `gradingPhase` a las respuestas de
      `GetSubjectGradesBySubjectUseCase` / `GetSubjectGradesByStudentUseCase` (vía
      `ccRepo.findByUuid` / query raw respectivamente) y wiring de
      `GradingPhaseAuthorizerService` en `grading.module.ts` para los dos upsert use-cases.
      `api/src/application/grading/get-subject-grades-by-subject.use-case.ts`,
      `api/src/application/grading/get-subject-grades-by-student.use-case.ts`,
      `api/src/presentation/grading/grading.module.ts`

---

## PR-2 — Front Fase de calificación (Capacidad A)

*Depende de:* PR-1 (endpoints + campo `gradingPhase` en respuestas). *Bloquea:* nada (B es
ortogonal). *Bloquea conceptualmente el orden de review:* precede a PR-3 en la cadena.

### 2.1 Types

- [x] 2.1.1 Impl: agregar `gradingPhase: 'BIM_1'|'BIM_2'|'BIM_3'|'BIM_4'|'CIERRE'|null` al tipo
      `CourseCycle`.
      `web/src/types/course-cycle.ts`

### 2.2 Presentational / Container (web)

- [x] 2.2.1 Test: hook `useGradingPhase` — GET trae el valor actual, PATCH persiste y
      actualiza estado local, maneja error 409/422 con mensaje.
      `web/src/hooks/__tests__/useGradingPhase.test.ts` (ruta real: `__tests__/`, no
      co-localizado — misma convención de PR-1)
- [x] 2.2.2 Impl: hook `useGradingPhase` (GET/PATCH `course-cycles/:uuid/grading-phase`).
      `web/src/hooks/useGradingPhase.ts`
- [x] 2.2.2b [P] Test+Impl (no listado originalmente, prerequisito real de 2.2.5/2.2.7):
      helper compartido `grading-phase-utils` (`isPeriodGradeEditable`, `isFinalGradeEditable`,
      `GRADING_PHASE_OPTIONS`, `GRADING_PHASE_LABELS`, `gradingPhaseStatusLabel`) — evita
      duplicar la lógica de gating entre las 2 grillas.
      `web/src/pages/dashboard/components/grading-phase-utils.ts`,
      `web/src/pages/dashboard/components/__tests__/grading-phase-utils.test.ts`
- [x] 2.2.2c [P] Test+Impl (no listado originalmente, prerequisito real de 2.2.5/2.2.7):
      exponer `gradingPhase: string|null` en `useGradingGrid`/`useStudentGrades` (leen el
      campo top-level que PR-1b ya agregó a las respuestas de subject-grades).
      `web/src/pages/dashboard/components/use-grading-grid.ts` (+2 tests ampliados),
      `web/src/pages/dashboard/components/use-student-grades.ts` (+1 test ampliado)
- [x] 2.2.3 Test: `course-cycles.tsx` — botón "Fase de Calificación" visible solo si
      `isManagementUser` (Secretario+, reusa `MANAGEMENT_ROLES` de `types/materia-grupo.ts`) y
      `level` ∈ {20,21,22,30,31,32}; oculto en Inicial/Terciario y para roles no-management;
      popup guarda y refleja el nuevo valor.
      `web/src/pages/dashboard/__tests__/course-cycles.test.tsx` (ampliar — ruta real
      `__tests__/`, no co-localizado)
- [x] 2.2.4 Impl: botón + popup (`useState<string|null>` + `Modal`, 5 opciones activables
      BIM_1..4|CIERRE con la activa marcada vía `aria-pressed`; NULL es un estado — "Sin fase
      activada" — no una opción seleccionable, según instrucción explícita de esta sesión).
      `web/src/pages/dashboard/course-cycles.tsx`
- [x] 2.2.5 [P] Test: `subject-grading-by-course.tsx` — columnas de bimestre distinto al activo
      deshabilitadas; todas deshabilitadas si `gradingPhase` es NULL o CIERRE; notas especiales
      deshabilitadas salvo CIERRE; indicador visible de la fase activa.
      `web/src/pages/dashboard/__tests__/subject-grading-by-course.test.tsx` (ampliar)
- [x] 2.2.6 [P] Impl: deshabilitar columnas según `gradingPhase` (readonly + tooltip) +
      indicador `data-testid="grading-phase-indicator"`.
      `web/src/pages/dashboard/subject-grading-by-course.tsx`
- [x] 2.2.7 [P] Test: `subject-grading-by-subject.tsx` — mismo comportamiento que 2.2.5,
      incluye además PA/PPI/PP (bloqueados junto con la nota del mismo período — un solo ítem
      de upsert cubre toda la fila) y el select de Condición (gated igual que FINAL).
      `web/src/pages/dashboard/__tests__/subject-grading-by-subject.test.tsx` (ampliar)
- [x] 2.2.8 [P] Impl: mismo que 2.2.6 para la vista por materia (incluye PA/PPI/PP + Condición).
      `web/src/pages/dashboard/subject-grading-by-subject.tsx`

---

## PR-3 — Backend Cierre mensual de asistencia (Capacidad B)

*Depende de:* nada de A (ortogonal). Se encadena tras PR-2 solo por orden de revisión.
Cubre AC-B-1..15 (spec #1645), secciones B1–B5 (design #1646).

### 3.1 Domain

- [x] 3.1.1 Test: entidad `AttendanceMonthStatus` — `monthOrdinal` (`year*12+month-1`),
      `isClosed()`, `canRecord()`, `close(userId)` setea `CLOSED/closedAt/closedBy`,
      `open(userId)` limpia `closedAt/closedBy`. (ruta real:
      `packages/domain/src/asistencia/__tests__/entities/attendance-month-status.test.ts`
      — convención `__tests__/`, no co-localizado, igual que el resto del bounded context
      `asistencia` y que `grading-phase.errors.test.ts` de PR-1)
      `packages/domain/src/asistencia/entities/attendance-month-status.test.ts`
- [x] 3.1.2 Impl: entidad `AttendanceMonthStatus` (`create`/`reconstruct`). Incluye además
      `static canGenerate(previous: AttendanceMonthStatus|null): boolean` (exención primer
      mes / previo debe estar cerrado) — regla de dominio pura, sin acceso a repo.
      `packages/domain/src/asistencia/entities/attendance-month-status.ts`
- [x] 3.1.3 [P] Test: `MonthClosedError` (code `MONTH_CLOSED`), `PreviousMonthOpenError`
      (code `PREVIOUS_MONTH_OPEN`) — construcción y código. (ruta real: archivo combinado
      `packages/domain/src/asistencia/__tests__/errors/attendance-month-status.errors.test.ts`,
      igual convención combinada que `errors/__tests__/domain-errors.spec.ts` y
      `grading-phase.errors.test.ts`)
      `packages/domain/src/asistencia/errors/month-closed-error.test.ts`,
      `packages/domain/src/asistencia/errors/previous-month-open-error.test.ts`
- [x] 3.1.4 [P] Impl: los dos errores. (ruta real: archivo combinado
      `attendance-month-status.errors.ts`, misma convención que `grading-phase.errors.ts`)
      `packages/domain/src/asistencia/errors/month-closed-error.ts`,
      `packages/domain/src/asistencia/errors/previous-month-open-error.ts`
- [x] 3.1.5 [P] Impl (contrato, sin test unitario propio): puerto
      `AttendanceMonthStatusRepository` (`findOne`, `findLatestBefore`, `upsert`).
      `packages/domain/src/asistencia/repositories/attendance-month-status.repository.ts`
- [x] 3.1.6 Impl: actualizar barrels de dominio.
      `packages/domain/src/index.ts`, `packages/domain/src/asistencia/index.ts`

### 3.2 Infrastructure

*Nota de desviación (PR-3b, esta sesión): PR-3a (sesión previa) fue domain-only; 3.2.x
(infrastructure), 3.3.x (application) y 3.4.x (presentation) se completaron juntos en esta
sesión como PR-3b, no como PR-3a+PR-3b según el split original del Review Workload Forecast.*

- [x] 3.2.1 Impl: schema tenant — enum `AttendanceMonthState`, modelo
      `AttendanceMonthStatus` (`@@unique[courseCycleId,year,month]`, `onDelete: Restrict`),
      relación en `CourseCycle`.
      `api/prisma_tenant/schema.prisma`
- [x] 3.2.2 Impl: migración tenant escrita a mano (convención del repo, sin DB en WSL);
      `pnpm --filter api prisma:generate` corrido y verde.
      `api/prisma_tenant/migrations/20260701130000_add_attendance_month_status/`
- [x] 3.2.3 Test: `PrismaAttendanceMonthStatusRepository` — `findOne` por unique compuesta;
      `findLatestBefore` devuelve el mayor `(year,month)` estrictamente anterior (no el
      predecesor calendario, AC-B-8/9/10, incl. rollover de año); `null` si no hay previo
      generado (exención primer mes); `upsert` mapea closed↔status CLOSED/OPEN + attribution.
      `api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-attendance-month-status.repository.test.ts`
      (ruta real: `__tests__/`, no co-localizado — misma convención que el resto del repo)
- [x] 3.2.4 Impl: `PrismaAttendanceMonthStatusRepository`.
      `api/src/infrastructure/persistence/prisma/repositories/prisma-attendance-month-status.repository.ts`

### 3.3 Application

- [x] 3.3.1 Test: `RecordGeneralAttendanceDayUseCase` — rechaza con `MonthClosedError` si el
      mes está CLOSED, incondicional (AC-B-4/5/6: incluido admin/ROOT, sin bypass); permite si
      OPEN o sin fila (default abierto).
      `api/src/application/asistencia/__tests__/record-general-attendance-day.use-case.test.ts` (ampliado)
- [x] 3.3.2 Impl: guard `MONTH_CLOSED` en `RecordGeneralAttendanceDayUseCase` (antes de
      `setDay`, fuera de cualquier gate de `scope.isAdministrative`).
      `api/src/application/asistencia/record-general-attendance-day.use-case.ts`
- [x] 3.3.3 Test: `RecordSubjectAttendanceDayUseCase` — mismo guard, resolviendo
      `courseCycleId` desde `materia.courseCycleId` (incluso cuando el flujo admin saltea
      Door2); rechaza a todos sin excepción.
      `api/src/application/asistencia/__tests__/record-subject-attendance-day.use-case.test.ts` (ampliado)
- [x] 3.3.4 Impl: guard `MONTH_CLOSED` en `RecordSubjectAttendanceDayUseCase` (`checkDoor2`
      ahora retorna `courseCycleId`; nuevo helper `resolveCourseCycleId` para el path admin).
      `api/src/application/asistencia/record-subject-attendance-day.use-case.ts`
- [x] 3.3.5 Test: `GenerateMonthlyAttendanceUseCase` — rechaza con `PreviousMonthOpenError` si
      `findLatestBefore` no es null y no está cerrado (AC-B-8); permite si es el primer mes
      (AC-B-9/10); tras materializar, hace `upsert` OPEN solo si no existe fila (no reabre
      CLOSED regenerado; también se genera con enrollment cero).
      `api/src/application/asistencia/__tests__/generate-monthly-attendance.use-case.test.ts` (ampliado)
- [x] 3.3.6 Impl: guard `PREVIOUS_MONTH_OPEN` + `upsert` de registro de generación en
      `GenerateMonthlyAttendanceUseCase`.
      `api/src/application/asistencia/generate-monthly-attendance.use-case.ts`
- [x] 3.3.7 Test: `GetAttendanceMonthStatusUseCase` / `OpenAttendanceMonthUseCase` /
      `CloseAttendanceMonthUseCase` — Get devuelve OPEN por defecto cuando no hay fila; Close
      cierra (crea fila si no existe), Open reabre (limpia attribution) — ambas idempotentes;
      las 3 validan existencia de CourseCycle (NotFoundError); reapertura siempre permitida sin
      chequear meses posteriores. (Desviación deliberada: 1 caso de uso `Open` + 1 `Close`
      separados, en vez de un solo `Set` — pedido explícito de esta sesión; rank Secretario+ se
      aplica en el controller vía `@Rank(40)`, igual que `SetGradingPhaseUseCase`, no dentro del
      use-case.)
      `api/src/application/asistencia/__tests__/attendance-month-status.use-cases.test.ts`
- [x] 3.3.8 Impl: `GetAttendanceMonthStatusUseCase`, `OpenAttendanceMonthUseCase`,
      `CloseAttendanceMonthUseCase` (archivo combinado, misma convención que
      `grading-phase.use-cases.ts` de PR-1).
      `api/src/application/asistencia/attendance-month-status.use-cases.ts`
- [x] 3.3.9 Impl: exportar los use-cases nuevos — n/a como barrel separado; se importan
      directamente desde `attendance-month-status.use-cases.ts` en el controller/module, mismo
      patrón que el resto de `application/asistencia` (no existe `index.ts` barrel en esa
      carpeta).

### 3.4 Presentation

- [x] 3.4.1 Impl: registrar `MONTH_CLOSED: 409`, `PREVIOUS_MONTH_OPEN: 409` en `DOMAIN_STATUS`
      + test dedicado (`FILTER-6`).
      `api/src/presentation/shared/filters/exception.filter.ts`,
      `api/src/presentation/shared/filters/__tests__/exception.filter.spec.ts` (ampliado)
- [x] 3.4.2 [P] Test+Impl: DTO Zod `AttendanceMonthStatusQuerySchema`,
      `SetAttendanceMonthStatusSchema` (body `{year,month,status:'OPEN'|'CLOSED'}`).
      `api/src/presentation/asistencia/dto/asistencia.dto.ts`,
      `api/src/presentation/asistencia/__tests__/attendance-month-status.dto.test.ts`
- [x] 3.4.3 Test: `AsistenciaController` — `GET .../asistencia-mensual/estado` mapea
      OPEN/CLOSED+attribution; `PATCH .../estado` despacha a `closeMonthUC`/`openMonthUC` según
      `body.status` (rank<40 → 403 vía `RankGuard`, cubierto genéricamente por
      `rank.guard.test.ts`, no re-testeado aquí).
      `api/src/presentation/asistencia/__tests__/asistencia.controller.test.ts` (ampliado,
      CTR-T11/T12)
- [x] 3.4.4 Impl: endpoints GET/PATCH `asistencia-mensual/estado`, `RankGuard` agregado a
      `@UseGuards(AuthGuard, RolesGuard, RankGuard)` + `@Rank(40)` en PATCH.
      `api/src/presentation/asistencia/asistencia.controller.ts`
- [x] 3.4.5 Impl: wiring de use-cases/repo nuevos (+ inyección de
      `PrismaAttendanceMonthStatusRepository` en los 3 use-cases modificados de 3.3.x).
      `api/src/presentation/asistencia/asistencia.module.ts`

---

## PR-4 — Front Cierre mensual de asistencia (Capacidad B)

*Depende de:* PR-3 (endpoints de estado).

### 4.1 Presentational / Container (web)

- [x] 4.1.1 Test: hook `useAttendanceMonthStatus` — GET trae `isClosed`, PATCH cierra/reabre y
      actualiza estado local, surface del 409 `PREVIOUS_MONTH_OPEN` al generar.
      `web/src/hooks/__tests__/useAttendanceMonthStatus.test.ts` (ruta real: `__tests__/`, no
      sufijo plano `.test.ts` junto al hook — sigue convención de `useGradingPhase`)
- [x] 4.1.2 Impl: hook `useAttendanceMonthStatus` (GET/PATCH
      `course-cycles/:ccId/asistencia-mensual/estado`).
      `web/src/hooks/useAttendanceMonthStatus.ts`
- [x] 4.1.3 Test: `asistencia-mensual.tsx` — con mes cerrado: banner visible, celdas de día
      read-only (texto plano, no `<select>`) en general Y por materia, botón "Generar"
      deshabilitado; botón "Cerrar"/"Reabrir" visible solo Secretario+ (`isManagementUser`,
      rank≥40 — MANAGEMENT_ROLES); toast con mensaje claro en español al recibir 409
      `PREVIOUS_MONTH_OPEN` en generar (no expone el mensaje técnico en inglés del dominio).
      `web/src/pages/dashboard/__tests__/asistencia-mensual.test.tsx` (ampliado, +11 tests
      AM-1..AM-11)
- [x] 4.1.4 Impl: estado de mes (GET al seleccionar CC/mes vía `useAttendanceMonthStatus`),
      botón abrir/cerrar (Secretario+), read-only total + banner cuando cerrado (para TODOS
      los roles, sin excepción — AC-B-4/5/6), deshabilitar "Generar" cuando el mes
      seleccionado ya está cerrado, toast de 409 `PREVIOUS_MONTH_OPEN` mapeado a mensaje claro.
      `web/src/pages/dashboard/asistencia-mensual.tsx`

---

## Review Workload Forecast

Estimación de líneas netas por PR (código + tests, TDD estricto incluido). Presupuesto de
referencia: **≤400 líneas por PR** (`size:exception` si se excede sin plan de partición).

| PR | Contenido | Líneas est. (código+test) | Excede 400 | Riesgo |
|----|-----------|---------------------------|------------|--------|
| PR-1 | Backend fase (domain VO+entidad, puerto+servicio, 2 use-cases modificados, schema+migración, repo Prisma, 2 endpoints+DTO+guard+wiring) | ~850–950 | **Sí** | Alto |
| PR-2 | Front fase (types, botón+popup, 2 grillas deshabilitando columnas, hook) | ~320–380 | No (al límite) | Medio |
| PR-3 | Backend cierre-mes (domain entidad+2 errores+puerto, schema+migración, repo Prisma, 3 use-cases guardados + 2 use-cases nuevos, 2 endpoints+DTO+guard+wiring) | ~850–950 | **Sí** | Alto |
| PR-4 | Front cierre-mes (hook, estado+banner+read-only+toast en una vista) | ~280–330 | No | Bajo |

**Chained PRs recommended: Yes.**

**Decisión de entrega (ya resuelta, `delivery_strategy = auto-chain`):** no se pide
confirmación de partición — se ejecuta encadenado. Dado que PR-1 y PR-3 superan el
presupuesto de 400 líneas por sí solos (cada capacidad backend trae domain+application+
infra+presentation en un solo PR conceptual), se recomienda que `sdd-apply` materialice
PR-1 y PR-3 como **PRs apilados internos** (stacked, mismo work-unit encadenado) partidos
por capa, por ejemplo:
- PR-1a: domain + application (VO, entidad, errores, puerto, servicio, guards en los 2
  upsert use-cases) — ~450–550 líneas.
- PR-1b: infrastructure + presentation (schema/migración, repo Prisma, endpoints/DTO/wiring)
  — ~350–400 líneas.
- PR-3a: domain + infrastructure (entidad, errores, puerto, schema/migración, repo Prisma) —
  ~450–500 líneas.
- PR-3b: application + presentation (3 guards + 2 use-cases nuevos, endpoints/DTO/wiring) —
  ~400–450 líneas.

Esto mantiene el orden de dependencias (PR-1 completo antes de PR-2; PR-3 completo antes de
PR-4) sin violar el budget de revisión. PR-2 y PR-4 no requieren partición adicional.
