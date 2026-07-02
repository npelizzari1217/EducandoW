# Tasks — asistencia-autollenado-p

> Checklist accionable derivado de spec (#1678) + design (#1679). TDD estricto: la tarea de
> test va SIEMPRE antes que la de implementación (rojo → verde). Numeración jerárquica
> `PR.capa.n`. `[P]` = paralelizable dentro de su capa; sin marca = secuencial (depende de la
> tarea anterior). `test_command: pnpm test` · `build_command: pnpm build` · coverage ≥80%.
>
> **Reconciliación spec↔design (obligatoria):** el design (ADR-2), verificando el código real
> (`ensure-attendance-types-for-level.use-case.ts` + `@@unique(level,code)` + que el tipo
> sistema "P" es el único con `isSystem:true && isPresent:true` por nivel, protegido contra
> duplicación por `ATTENDANCE_TYPE_SYSTEM_PROTECTED`), demostró que la resolución de Presente
> por nivel es **unívoca** filtrando `isPresent && isSystem`. Esto reemplaza la heurística de
> 4 pasos de ATR-R11.5 del spec ("P" > único NO_COMPUTA > ambiguo 422 > not-found 422). Las
> tasks de abajo implementan `findPresenteByLevel(level)` con ese filtro simple y **cierran
> Q3 del proposal de forma unívoca**: no existe branch de ambigüedad estructuralmente posible,
> por lo tanto **`PresenteTypeAmbiguousError` / `PRESENTE_TYPE_AMBIGUOUS` NO se implementa**
> (diverge del spec ATR-R11.5.3 — dejar constancia en el archive). Solo se implementa
> `PresenteTypeNotFoundError` / `PRESENTE_TYPE_NOT_FOUND` (nivel sin tipo Presente, caso real
> y alcanzable si un admin desactiva/soft-deletea el "P" del nivel).

---

## PR-1 — Domain: helper puro + error + puerto

*Depende de:* nada. *Bloquea:* PR-2, PR-3.
Cubre ATR-R11.1..R11.4, R11.7 (helper); ATR-R11.5 revisado (ver nota arriba); parte de ATR-S71..S78, S82.

### 1.1 Domain — calendar-utils

- [x] 1.1.1 [P] Test: `fillHabilVacios(days, presenteCode, year, month)` — grilla vacía: todos
      los días hábiles (lun-vie existentes) reciben `presenteCode`; SAB/DOM/X (vía
      `buildLockedDayMap`) NUNCA reciben `presenteCode`; key hábil ya presente (P/A/T/custom/
      FERIADO) se preserva sin importar su valor; inmutable (no muta `days` de entrada);
      idempotente (correr 2 veces da el mismo resultado); funciona con 28/29/30/31 días.
      `packages/domain/src/asistencia/utils/__tests__/calendar-utils.spec.ts`
- [x] 1.1.2 Impl: `fillHabilVacios` — reusa `buildLockedDayMap(year, month)` para derivar el
      set de días hábiles (todo `d` en `1..daysInMonth` que NO está en el locked map), copia
      inmutable de `days`, setea `presenteCode` solo en keys hábiles ausentes.
      `packages/domain/src/asistencia/utils/calendar-utils.ts`

### 1.2 Domain — error

- [x] 1.2.1 [P] Test: `PresenteTypeNotFoundError` — extiende `DomainError`, `code ===
      'PRESENTE_TYPE_NOT_FOUND'`, mensaje incluye `level` y `courseCycleId` (mismo patrón que
      `PreviousMonthOpenError`).
      `packages/domain/src/attendance-type/__tests__/errors/presente-type-not-found-error.test.ts`
- [x] 1.2.2 Impl: `PresenteTypeNotFoundError extends DomainError`, constructor
      `(level: number, courseCycleId: string)`.
      `packages/domain/src/attendance-type/errors/presente-type-not-found-error.ts`

### 1.3 Domain — puerto

- [x] 1.3.1 Impl (sin test unitario propio, es un contrato de interfaz): agregar
      `findPresenteByLevel(level: number): Promise<AttendanceType | null>` a
      `AttendanceTypeRepository`. Doc: filtra `isPresent === true && isSystem === true &&
      active === true && deletedAt === null`; unívoco por construcción (ver nota de
      reconciliación arriba).
      `packages/domain/src/attendance-type/repositories/attendance-type-repository.ts`
- [x] 1.3.2 Impl: actualizar barrels de dominio (exportar `fillHabilVacios`,
      `PresenteTypeNotFoundError` si no se exportan ya por wildcard).
      `packages/domain/src/index.ts` (y barrels intermedios que correspondan)

---

## PR-2 — Infraestructura: resolución de Presente + flip del merge a fill-only

*Depende de:* PR-1. *Bloquea:* PR-3.
Cubre ATR-R11.3 (invariante de no-sobrescritura) del lado de infra; implementa ADR-1 del
design (flip `mergeLocked` → fill-only).

### 2.1 Infra — PrismaAttendanceTypeRepository

- [x] 2.1.1 [P] Test: `findPresenteByLevel(level)` — devuelve el `AttendanceType` con
      `isPresent:true && isSystem:true` del nivel; `null` si el nivel no tiene ninguno (tipo
      "P" desactivado/soft-deleted); ignora tipos `isSystem:false` con `isPresent` derivado
      true (custom con `absenceValue===0 && assignable`) — nunca los devuelve.
      `api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-attendance-type.repository.test.ts`
- [x] 2.1.2 Impl: `findPresenteByLevel` — `findFirst({ where: { level, isPresent: true,
      isSystem: true, active: true, deletedAt: null } })` → `toDomain` o `null`.
      `api/src/infrastructure/persistence/prisma/repositories/prisma-attendance-type.repository.ts`

### 2.2 Infra — merge fill-only (eje general)

- [x] 2.2.1 Test: actualizar `mergeLocked` (o renombrar a `mergeFillOnly` si se prefiere
      claridad — decisión de apply, mantener nombre exportado consistente en ambos repos) para
      invertir precedencia: `{ ...incoming, ...existing }` en vez de `{ ...existing,
      ...incoming }`. **Actualizar el test existente `'corrects legacy P to SAB because locked
      keys win'` (línea ~89 del spec actual) — este comportamiento se INVIERTE**: con
      fill-only, una key `existing` ya presente (aunque sea un legacy "P" en una key SAB)
      NUNCA es pisada por `incoming`. Agregar caso nuevo: key hábil ausente en `existing` +
      presente en `incoming` (con `presenteCode` ya resuelto por el use-case vía
      `fillHabilVacios`) → `incoming` gana SOLO ahí.
      `api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-asistencia-general.repository.spec.ts`
- [x] 2.2.2 Impl: invertir el merge en `generateMany` (fill-only, ADR-1). El `days` que llega
      desde el use-case ya es `fillHabilVacios(lockedMap, presenteCode, year, month)` (no solo
      el locked map), así que las filas nuevas (`createMany`) siguen recibiendo el JSON
      completo tal cual, y las filas existentes solo reciben las keys ausentes.
      `api/src/infrastructure/persistence/prisma/repositories/prisma-asistencia-general.repository.ts`

### 2.3 Infra — merge fill-only (eje materia) [P respecto a 2.2, mismo patrón]

- [x] 2.3.1 [P] Test: mismo ajuste que 2.2.1 mirror en el repo de materia — verificar
      `mergeLocked`/símbolo espejo invertido a fill-only; actualizar cualquier test que asuma
      "locked wins" para reflejar "existing wins".
      `api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-asistencia-materia.repository.spec.ts`
- [x] 2.3.2 [P] Impl: mismo cambio que 2.2.2 en el repo de materia.
      `api/src/infrastructure/persistence/prisma/repositories/prisma-asistencia-materia.repository.ts`

---

## PR-3 — Application: integrar autollenado en el use-case de Generar

*Depende de:* PR-1, PR-2. *Bloquea:* PR-4.
Cubre ATR-R11.1, R11.2, R11.4, R11.5 (resolución + error), R11.6 (mes CERRADO), R11.7
(idempotencia). Migra el use-case a `Result` (ADR-3 del design).

### 3.1 Application

- [x] 3.1.1 Test: `GenerateMonthlyAttendanceUseCase.execute` devuelve
      `Result<GenerationResult, PresenteTypeNotFoundError>` (ya no throwea para este caso
      nuevo). Casos:
      - resuelve `findPresenteByLevel(level)` una sola vez por invocación (no N+1);
      - nivel sin Presente → `err(PresenteTypeNotFoundError)`, **sin escritura parcial**
        (ni general ni materia — verificar que ninguno de los dos repos recibe llamada, o que
        si la recibe no persiste nada, según el punto exacto del guard elegido en apply);
      - `days` de cada fila general/materia pasa por `fillHabilVacios(lockedMap, presenteCode,
        year, month)` antes de llegar al repo — ambos ejes reusan el mismo helper (ATR-R11.4,
        sin divergencia General vs Materia);
      - mes CERRADO (`existingStatus.isClosed()` ya leído en el paso 2c existente) → el paso
        de autollenado es no-op: no se invoca `generateMany` con datos de autollenado /
        se preserva el comportamiento preexistente de Generar sobre CLOSED intacto
        (ATR-R11.6 — ningún nuevo error code, ningún nuevo bypass);
      - throws legacy intactos: `ForbiddenError`, `NotFoundError`, `PreviousMonthOpenError`
        siguen siendo `throw`, no `Result` (ADR-3 — no uniformizar todo el use-case, solo el
        camino nuevo).
      `api/src/application/asistencia/__tests__/generate-monthly-attendance.use-case.test.ts`
- [x] 3.1.2 Impl: inyectar `AttendanceTypeRepository` (puerto) en el use-case; resolver
      `findPresenteByLevel(courseCycle.level)` (requiere leer `level` del `CourseCycle` —
      ampliar el `select` del paso 2 si no lo trae hoy); si `null` →
      `return err(new PresenteTypeNotFoundError(level, courseCycleId))` antes de cualquier
      escritura; si existe, pasar `presenteCode` a `fillHabilVacios` al construir `days` de
      `generalRows` y `subjectRows` (reemplaza el `days: lockedMap` plano actual); envolver el
      `return` final en `ok(...)`; guard de mes CERRADO usando `existingStatus.isClosed()`
      (ya leído en 2c) para saltear el autollenado sin alterar el resto del flujo existente.
      `api/src/application/asistencia/generate-monthly-attendance.use-case.ts`

---

## PR-4 — Presentation + wiring + tests de integración

*Depende de:* PR-3. *Bloquea:* nada (última capa).
Cubre el borde HTTP (422), wiring del módulo, y los escenarios de integración ATR-S71..S82
contra DB real.

### 4.1 Presentation — controller + exception filter

- [ ] 4.1.1 [P] Test: `AsistenciaController.generateMonthly` — cuando el use-case devuelve
      `Result`, el controller desenvuelve: `isOk()` → `{ data: result.value }` (sin cambio de
      shape); `isErr()` → `throw result.error` (deja que `AppExceptionFilter` lo mapee a 422),
      igual patrón que los throws legacy ya manejados en el `catch` del método.
      `api/src/presentation/asistencia/__tests__/asistencia.controller.test.ts` (crear si no
      existe co-localizado, o el archivo de test real del controller si ya existe)
- [ ] 4.1.2 Impl: en `generateMonthly`, tras `await this.generateMonthlyUC.execute(...)`
      (ahora `Result<GenerationResult, PresenteTypeNotFoundError>`), desenvolver con
      `result.unwrap()` dentro del mismo `try` (así el `catch` existente sigue cubriendo
      `ForbiddenError`; `PresenteTypeNotFoundError` cae al `throw err;` final del catch, que
      el filtro global mapea por `code`).
      `api/src/presentation/asistencia/asistencia.controller.ts`
- [ ] 4.1.3 [P] Test: `AppExceptionFilter` — `PresenteTypeNotFoundError` (code
      `PRESENTE_TYPE_NOT_FOUND`) mapea a HTTP 422.
      `api/src/presentation/shared/filters/__tests__/exception.filter.spec.ts`
- [ ] 4.1.4 Impl: agregar entrada `PRESENTE_TYPE_NOT_FOUND: 422` a `DOMAIN_STATUS`.
      `api/src/presentation/shared/filters/exception.filter.ts`

### 4.2 Wiring

- [ ] 4.2.1 Impl: agregar `PrismaAttendanceTypeRepository` al `inject`/`useFactory` del
      provider `GenerateMonthlyAttendanceUseCase` (el repo ya está registrado como provider
      en el módulo — solo falta inyectarlo en este use-case).
      `api/src/presentation/asistencia/asistencia.module.ts`

### 4.3 Frontend — verificación (sin cambios de lógica esperados)

- [ ] 4.3.1 Verificar `asistencia-mensual.tsx`: `handleGenerate` no requiere cambios de lógica
      — la respuesta mantiene el mismo shape (`{ data: GenerationResult }` en éxito) y ya
      recarga la grilla; el único cambio observable es que la grilla recargada viene con
      Presente autollenado. **Fuera de alcance / opcional:** toast específico para
      `code === 'PRESENTE_TYPE_NOT_FOUND'` en el manejo de error — no bloquea el resto del
      change, se puede omitir sin abrir un PR aparte si el error genérico actual ya es
      aceptable para UX.
      `web/src/**/asistencia-mensual.tsx` (o ruta real equivalente — confirmar en apply)

### 4.4 Integration tests (DB real) — ATR-S71..S82

- [ ] 4.4.1 [P] Ampliar/arreglar `generate-monthly.db.test.ts`: **nota pre-existente** — el
      archivo instancia `new GenerateMonthlyAttendanceUseCase(...)` con 5 args, pero el
      use-case actual (previo a este change) ya requiere 6 (`monthStatusRepo`); este drift es
      anterior a este SDD change y debe corregirse igual (agregar `monthStatusRepo` +, para
      este feature, `attendanceTypeRepo`) para que el archivo compile/corra.
      Agregar escenarios:
      - ATR-S71/S82 (`GEN-DB-01`/`02` ampliados): grilla nueva → todos los hábiles quedan en
        "P"; 2da corrida (idempotencia) no altera nada;
      - ATR-S74/S75/S76 (**crítico, invariante de no-sobrescritura**): día con valor cargado a
        mano (A/T/custom/FERIADO) antes de regenerar permanece igual tras Generar; SAB/DOM
        nunca reciben Presente;
      - ATR-S72/S74 vs materia: correr el mismo escenario contra `PrismaAsistenciaMateriaRepository`
        y verificar comportamiento idéntico al eje general (ATR-R11.4);
      - ATR-S80: nivel sin tipo Presente (desactivar/soft-delete el "P" del nivel en el seed)
        → 422 `PRESENTE_TYPE_NOT_FOUND`, cero filas escritas (ni general ni materia);
      - ATR-S81: mes CERRADO → Generar no autollena ninguna celda (comportamiento preexistente
        de Generar sobre CLOSED intacto).
      `api/test/integration/asistencia/generate-monthly.db.test.ts`

---

## Notas para `sdd-verify` / `sdd-archive`

- **Divergencia spec→implementación (documentar en archive):** `PresenteTypeAmbiguousError` /
  `PRESENTE_TYPE_AMBIGUOUS` (ATR-R11.5.3 del spec) NO se implementa — la resolución univoca
  por `isPresent && isSystem` hace la ambigüedad estructuralmente imposible. Ver nota de
  reconciliación al inicio de este archivo.
- Preguntas abiertas para el usuario (no bloquean el desglose de tasks, sí pueden mover
  detalles de implementación dentro de PR-3/PR-4 — ver contrato de resultado del agente):
  1. ADR-3 del design: `Result` solo para el camino nuevo (`PresenteTypeNotFoundError`) vs.
     migrar TODO el use-case (`ForbiddenError`/`NotFoundError`/`PreviousMonthOpenError`) a
     `Result` de una — mixing parcial es más chico pero deja el use-case con dos estilos de
     error conviviendo.
  2. ADR-1 del design: confirmar que ningún flujo productivo dependía de la corrección
     "locked wins" de `mergeLocked` (el test que se flippea en 2.2.1 prueba que SÍ había un
     caso cubierto — corrección de un legacy "P" mal cargado en una key SAB/DOM/X — hay que
     confirmar con el usuario si ese caso es alcanzable en producción hoy o era solo defensivo).
