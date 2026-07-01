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

- [ ] 1.2.1 Test: `GradingPhaseAuthorizerService.canGradeBimester/canGradeFinal` — delega en
      entidad vía `findByUuid`; nivel no Prim/Sec → `{allowed:true, reason:'NOT_APPLICABLE'}`;
      CC inexistente → deja pasar (404 lo resuelve el use-case llamador).
      `api/src/application/grading/grading-phase-authorizer.service.test.ts`
- [ ] 1.2.2 Impl: `GradingPhaseAuthorizerService`.
      `api/src/application/grading/grading-phase-authorizer.service.ts`
- [ ] 1.2.3 [P] Test: `GetGradingPhaseUseCase` / `SetGradingPhaseUseCase` — Get devuelve
      `gradingPhase|null`; Set rechaza nivel no Prim/Sec con `GradingPhaseNotApplicableError`
      (422), setea reversible, persiste vía `save`.
      `api/src/application/course-cycle/use-cases/grading-phase.use-cases.test.ts`
- [ ] 1.2.4 [P] Impl: `GetGradingPhaseUseCase`, `SetGradingPhaseUseCase`.
      `api/src/application/course-cycle/use-cases/grading-phase.use-cases.ts`
- [ ] 1.2.5 Test: `UpsertSubjectPeriodGradesUseCase` — por cada `(courseCycleId, periodOrdinal)`
      único invoca `canGradeBimester`; rechaza con `GradingPhaseViolationError` si `!allowed`
      (AC-A: NULL rechaza todo, BIM_n rechaza otros períodos); dedupe de queries.
      `api/src/application/grading/upsert-subject-period-grades.use-case.test.ts` (ampliar)
- [ ] 1.2.6 Impl: inyectar `GradingPhaseAuthorizerPort` en
      `UpsertSubjectPeriodGradesUseCase`, guard tras auth de asignación.
      `api/src/application/grading/upsert-subject-period-grades.use-case.ts`
- [ ] 1.2.7 Test: `UpsertSubjectFinalGradesUseCase` — por cada `courseCycleId` único invoca
      `canGradeFinal`; rechaza con `GradingPhaseViolationError` fuera de CIERRE (AC-A: notas
      especiales rechazadas fuera de CIERRE).
      `api/src/application/grading/upsert-subject-final-grades.use-case.test.ts` (ampliar)
- [ ] 1.2.8 Impl: inyectar `GradingPhaseAuthorizerPort` en `UpsertSubjectFinalGradesUseCase`.
      `api/src/application/grading/upsert-subject-final-grades.use-case.ts`

### 1.3 Infrastructure

- [ ] 1.3.1 Impl: schema tenant — enum `GradingPhase` + columna `gradingPhase GradingPhase?`
      en `CourseCycle` (legacy `activeGradingPeriod` intacto).
      `api/prisma_tenant/schema.prisma`
- [ ] 1.3.2 Impl: generar y aplicar migración tenant (`pnpm --filter api prisma:migrate:tenant`).
      `api/prisma_tenant/migrations/<timestamp>_grading_phase/`
- [ ] 1.3.3 Test: `PrismaCourseCycleRepository` — `toDomain` mapea enum Prisma → VO
      `GradingPhase|null`; `save` mapea VO → enum Prisma (incluye `null`).
      `api/src/infrastructure/persistence/prisma/repositories/prisma-course-cycle.repository.test.ts` (ampliar)
- [ ] 1.3.4 Impl: mapeo `gradingPhase` en `toDomain`/`save` del repo Prisma.
      `api/src/infrastructure/persistence/prisma/repositories/prisma-course-cycle.repository.ts`

### 1.4 Presentation

- [ ] 1.4.1 Impl: registrar `GRADING_PHASE_VIOLATION: 409` y `GRADING_PHASE_NOT_APPLICABLE: 422`
      en `DOMAIN_STATUS` (cubierto por los tests e2e/integración del filtro existentes; no
      requiere test nuevo si el filtro ya es genérico por code→status).
      `api/src/presentation/shared/filters/exception.filter.ts`
- [ ] 1.4.2 [P] Impl: DTO Zod `SetGradingPhaseSchema` (`z.enum([...]).nullable()`).
      `api/src/presentation/course-cycle/dto/grading-phase.dto.ts`
- [ ] 1.4.3 Test: `CourseCycleController` — `GET .../grading-phase` accesible con rol READ
      amplio; `PATCH .../grading-phase` responde 403/401 si rank < 40 (AC-A-1/2: rechazo
      explícito a PRECEPTOR/TEACHER), 200 + valor nuevo si Secretario+, 422 si nivel no
      Prim/Sec.
      `api/src/presentation/course-cycle/course-cycle.controller.test.ts` (ampliar)
- [ ] 1.4.4 Impl: endpoints GET/PATCH `grading-phase`, agregar `RankGuard` a
      `@UseGuards(AuthGuard, RolesGuard, RankGuard)` del controller, `@Rank(40)` en PATCH,
      agregar `gradingPhase` a `toResponse`.
      `api/src/presentation/course-cycle/course-cycle.controller.ts`
- [ ] 1.4.5 Impl: wiring de use-cases/repo/puerto nuevos.
      `api/src/presentation/course-cycle/course-cycle.module.ts`
- [ ] 1.4.6 [P] Test: `subject-grades` responses incluyen `gradingPhase` (para que el front
      deshabilite columnas sin round-trip extra).
      `api/src/application/grading/*get-subject-grades*use-case.test.ts` (ampliar según exista)
- [ ] 1.4.7 [P] Impl: agregar `gradingPhase` a `subject-grades.dto.ts` y wiring del puerto en
      `grading.module.ts` para los dos upsert use-cases.
      `api/src/presentation/grading/dto/subject-grades.dto.ts`,
      `api/src/presentation/grading/grading.module.ts`

---

## PR-2 — Front Fase de calificación (Capacidad A)

*Depende de:* PR-1 (endpoints + campo `gradingPhase` en respuestas). *Bloquea:* nada (B es
ortogonal). *Bloquea conceptualmente el orden de review:* precede a PR-3 en la cadena.

### 2.1 Types

- [ ] 2.1.1 Impl: agregar `gradingPhase: 'BIM_1'|'BIM_2'|'BIM_3'|'BIM_4'|'CIERRE'|null` al tipo
      `CourseCycle`.
      `web/src/types/course-cycle.ts`

### 2.2 Presentational / Container (web)

- [ ] 2.2.1 Test: hook `useGradingPhase` — GET trae el valor actual, PATCH persiste y
      actualiza estado local, maneja error 409/422 con mensaje.
      `web/src/hooks/useGradingPhase.test.ts`
- [ ] 2.2.2 Impl: hook `useGradingPhase` (GET/PATCH `course-cycles/:uuid/grading-phase`).
      `web/src/hooks/useGradingPhase.ts`
- [ ] 2.2.3 Test: `course-cycles.tsx` — botón "Fase de calificación" visible solo si
      `MANAGEMENT_ROLES` (Secretario+) y `level` ∈ {20,21,22,30,31,32}; oculto en
      Inicial/Terciario; popup guarda y refleja el nuevo valor.
      `web/src/pages/dashboard/course-cycles.test.tsx` (ampliar)
- [ ] 2.2.4 Impl: botón + popup (`useState<string|null>` + `Modal`, selector
      NULL|BIM_1..4|CIERRE).
      `web/src/pages/dashboard/course-cycles.tsx`
- [ ] 2.2.5 [P] Test: `subject-grading-by-course.tsx` — columnas de bimestre distinto al activo
      deshabilitadas; todas deshabilitadas si `gradingPhase` es NULL o CIERRE; notas especiales
      deshabilitadas salvo CIERRE.
      `web/src/pages/dashboard/subject-grading-by-course.test.tsx` (ampliar)
- [ ] 2.2.6 [P] Impl: deshabilitar columnas según `gradingPhase` (readonly + tooltip).
      `web/src/pages/dashboard/subject-grading-by-course.tsx`
- [ ] 2.2.7 [P] Test: `subject-grading-by-subject.tsx` — mismo comportamiento que 2.2.5.
      `web/src/pages/dashboard/subject-grading-by-subject.test.tsx` (ampliar)
- [ ] 2.2.8 [P] Impl: mismo que 2.2.6 para la vista por materia.
      `web/src/pages/dashboard/subject-grading-by-subject.tsx`

---

## PR-3 — Backend Cierre mensual de asistencia (Capacidad B)

*Depende de:* nada de A (ortogonal). Se encadena tras PR-2 solo por orden de revisión.
Cubre AC-B-1..15 (spec #1645), secciones B1–B5 (design #1646).

### 3.1 Domain

- [ ] 3.1.1 Test: entidad `AttendanceMonthStatus` — `monthOrdinal` (`year*12+month-1`),
      `isClosed()`, `canRecord()`, `close(userId)` setea `CLOSED/closedAt/closedBy`,
      `open(userId)` limpia `closedAt/closedBy`.
      `packages/domain/src/asistencia/entities/attendance-month-status.test.ts`
- [ ] 3.1.2 Impl: entidad `AttendanceMonthStatus` (`create`/`reconstruct`).
      `packages/domain/src/asistencia/entities/attendance-month-status.ts`
- [ ] 3.1.3 [P] Test: `MonthClosedError` (code `MONTH_CLOSED`), `PreviousMonthOpenError`
      (code `PREVIOUS_MONTH_OPEN`) — construcción y código.
      `packages/domain/src/asistencia/errors/month-closed-error.test.ts`,
      `packages/domain/src/asistencia/errors/previous-month-open-error.test.ts`
- [ ] 3.1.4 [P] Impl: los dos errores.
      `packages/domain/src/asistencia/errors/month-closed-error.ts`,
      `packages/domain/src/asistencia/errors/previous-month-open-error.ts`
- [ ] 3.1.5 [P] Impl (contrato, sin test unitario propio): puerto
      `AttendanceMonthStatusRepository` (`findOne`, `findLatestBefore`, `upsert`).
      `packages/domain/src/asistencia/repositories/attendance-month-status.repository.ts`
- [ ] 3.1.6 Impl: actualizar barrels de dominio.
      `packages/domain/src/index.ts` (y barrels intermedios)

### 3.2 Infrastructure

- [ ] 3.2.1 Impl: schema tenant — enum `AttendanceMonthState`, modelo
      `AttendanceMonthStatus` (`@@unique[courseCycleId,year,month]`, `onDelete: Restrict`),
      relación en `CourseCycle`.
      `api/prisma_tenant/schema.prisma`
- [ ] 3.2.2 Impl: generar y aplicar migración tenant.
      `api/prisma_tenant/migrations/<timestamp>_attendance_month_status/`
- [ ] 3.2.3 Test: `PrismaAttendanceMonthStatusRepository` — `findOne` por unique compuesta;
      `findLatestBefore` devuelve el mayor `(year,month)` estrictamente anterior (no el
      predecesor calendario, AC-B-8/9/10); `null` si no hay previo generado (exención primer
      mes); `upsert` no pisa `CLOSED` al registrar generación.
      `api/src/infrastructure/persistence/prisma/repositories/prisma-attendance-month-status.repository.test.ts`
- [ ] 3.2.4 Impl: `PrismaAttendanceMonthStatusRepository`.
      `api/src/infrastructure/persistence/prisma/repositories/prisma-attendance-month-status.repository.ts`

### 3.3 Application

- [ ] 3.3.1 Test: `RecordGeneralAttendanceDayUseCase` — rechaza con `MonthClosedError` si el
      mes está CLOSED, incondicional (AC-B-4/5/6: incluido admin/ROOT, sin bypass); permite si
      OPEN o sin fila (default abierto).
      `api/src/application/asistencia/record-general-attendance-day.use-case.test.ts` (ampliar)
- [ ] 3.3.2 Impl: guard `MONTH_CLOSED` en `RecordGeneralAttendanceDayUseCase` (antes de
      `setDay`, fuera de cualquier gate de `scope.isAdministrative`).
      `api/src/application/asistencia/record-general-attendance-day.use-case.ts`
- [ ] 3.3.3 Test: `RecordSubjectAttendanceDayUseCase` — mismo guard, resolviendo
      `courseCycleId` desde `materia.courseCycleId` (incluso cuando el flujo admin saltea
      Door2); rechaza a todos sin excepción.
      `api/src/application/asistencia/record-subject-attendance-day.use-case.test.ts` (ampliar)
- [ ] 3.3.4 Impl: guard `MONTH_CLOSED` en `RecordSubjectAttendanceDayUseCase`.
      `api/src/application/asistencia/record-subject-attendance-day.use-case.ts`
- [ ] 3.3.5 Test: `GenerateMonthlyAttendanceUseCase` — rechaza con `PreviousMonthOpenError` si
      `findLatestBefore` no es null y no está cerrado (AC-B-8); permite si es el primer mes
      (AC-B-9/10); tras materializar, hace `upsert` OPEN solo si no existe fila (no reabre
      CLOSED regenerado).
      `api/src/application/asistencia/generate-monthly-attendance.use-case.test.ts` (ampliar)
- [ ] 3.3.6 Impl: guard `PREVIOUS_MONTH_OPEN` + `upsert` de registro de generación en
      `GenerateMonthlyAttendanceUseCase`.
      `api/src/application/asistencia/generate-monthly-attendance.use-case.ts`
- [ ] 3.3.7 [P] Test: `GetAttendanceMonthStatusUseCase` / `SetAttendanceMonthStatusUseCase` —
      Get devuelve `OPEN` cuando no hay fila (default); Set con `CLOSED`→`close(userId)`,
      `OPEN`→`open(userId)`, reapertura siempre permitida sin chequear meses posteriores
      (regla del proposal).
      `api/src/application/asistencia/get-attendance-month-status.use-case.test.ts`,
      `api/src/application/asistencia/set-attendance-month-status.use-case.test.ts`
- [ ] 3.3.8 [P] Impl: `GetAttendanceMonthStatusUseCase`, `SetAttendanceMonthStatusUseCase`.
      `api/src/application/asistencia/get-attendance-month-status.use-case.ts`,
      `api/src/application/asistencia/set-attendance-month-status.use-case.ts`
- [ ] 3.3.9 Impl: exportar los use-cases nuevos.
      `api/src/application/asistencia/index.ts`

### 3.4 Presentation

- [ ] 3.4.1 Impl: registrar `MONTH_CLOSED: 409`, `PREVIOUS_MONTH_OPEN: 409` en `DOMAIN_STATUS`.
      `api/src/presentation/shared/filters/exception.filter.ts`
- [ ] 3.4.2 [P] Impl: DTO Zod `AttendanceMonthStatusQuerySchema`,
      `SetAttendanceMonthStatusSchema`.
      `api/src/presentation/asistencia/dto/asistencia.dto.ts`
- [ ] 3.4.3 Test: `AsistenciaController` — `GET .../asistencia-mensual/estado` accesible con
      rol READ; `PATCH .../estado` responde 403 si rank < 40 (AC-B-1/2/3), 200 + estado nuevo
      si Secretario+/ROOT; verificar que ROOT gestiona el candado pero NO tiene bypass de
      registro cuando está cerrado (distinción del spec).
      `api/src/presentation/asistencia/asistencia.controller.test.ts` (ampliar)
- [ ] 3.4.4 Impl: endpoints GET/PATCH `asistencia-mensual/estado`, `RankGuard` +
      `@Rank(40)` en PATCH.
      `api/src/presentation/asistencia/asistencia.controller.ts`
- [ ] 3.4.5 Impl: wiring de use-cases/repo nuevos.
      `api/src/presentation/asistencia/asistencia.module.ts`

---

## PR-4 — Front Cierre mensual de asistencia (Capacidad B)

*Depende de:* PR-3 (endpoints de estado).

### 4.1 Presentational / Container (web)

- [ ] 4.1.1 Test: hook `useAttendanceMonthStatus` — GET trae `isClosed`, PATCH cierra/reabre y
      actualiza estado local, surface del 409 `PREVIOUS_MONTH_OPEN` al generar.
      `web/src/hooks/useAttendanceMonthStatus.test.ts`
- [ ] 4.1.2 Impl: hook `useAttendanceMonthStatus` (GET/PATCH
      `course-cycles/:ccId/asistencia-mensual/estado`).
      `web/src/hooks/useAttendanceMonthStatus.ts`
- [ ] 4.1.3 Test: `asistencia-mensual.tsx` — con mes cerrado: banner visible, celdas de día
      read-only (texto plano, no `<select>`), botón "Generar" deshabilitado; botón
      "Cerrar"/"Reabrir" visible solo Secretario+; toast al recibir 409
      `PREVIOUS_MONTH_OPEN` en generar.
      `web/src/pages/dashboard/asistencia-mensual.test.tsx` (ampliar)
- [ ] 4.1.4 Impl: estado de mes (GET al seleccionar CC/mes), botón abrir/cerrar, read-only
      total + banner cuando cerrado, deshabilitar "Generar", toast de 409.
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
