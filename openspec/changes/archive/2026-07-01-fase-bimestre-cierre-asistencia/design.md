# Design — fase-bimestre-cierre-asistencia

> Arquitectura del cambio (el CÓMO a nivel de arquitectura). Un cambio, dos capacidades
> ortogonales. Clean Arch estricta: `domain → application → infrastructure → presentation`.
> Enforcement en dos capas: front (UX) + guards backend (verdad). Multitenant: TODO modelo
> nuevo vive en `api/prisma_tenant/schema.prisma`.

## Principios rectores

1. **Ortogonalidad estricta.** El guard de fase de calificación NUNCA lee `AttendanceMonthStatus`
   y el guard de cierre de asistencia NUNCA lee `gradingPhase`. Son dos ejes de control
   independientes que comparten solo la entidad `CourseCycle` como raíz.
2. **La lógica de reglas vive en el dominio.** Los use-cases orquestan; la decisión
   (¿puede calificar este bimestre? ¿está cerrado el mes?) la resuelve una entidad/VO de dominio.
3. **Los puertos de autorización de fase/cierre son SEPARADOS de la autorización de asignación.**
   No se toca `AssignmentAuthorizerPort` ni su impl — la fase es un segundo gate que corre
   ADEMÁS del gate de asignación existente.
4. **Aditivo y no destructivo.** Columna nullable + tabla nueva default abierto. Revertir código
   restaura el comportamiento previo sin tocar datos.

---

## Capacidad A — Fase de calificación por curso (bimestre)

### A1. Forma de `gradingPhase` — enum Prisma (no String)

**Decisión:** enum Prisma `GradingPhase { BIM_1, BIM_2, BIM_3, BIM_4, CIERRE }` + columna
`gradingPhase GradingPhase?` (nullable) en `CourseCycle`. `NULL` = fase sin activar (bloqueado).

**Rationale:**
- El tenant schema YA usa enums Prisma para dominios cerrados (`RolCurso`, `TurnoCurso`,
  `GradeInternalStatus`, `SubjectFinalGradeType`, `SubjectFinalGradeCondicion`,
  `MateriaPreviaStatus`). Usar enum es la convención establecida, no una innovación.
- Validación a nivel de base de datos: Postgres rechaza valores fuera del enum. Un `String`
  admitiría basura (`'BIM_9'`, `'bimestre1'`) y trasladaría toda la validación a la app.
- `NULL` es semánticamente correcto para "sin activar" (cutover duro): distinto de cualquier
  fase activa, y default de columna nueva sin backfill.

**Rechazado — String:** sin integridad referencial, inconsistente con el resto del schema,
obliga a duplicar el catálogo de valores en Zod + dominio + DB.

**Schema (tenant), en el modelo `CourseCycle` (~línea 328, junto al legacy):**
```prisma
enum GradingPhase {
  BIM_1
  BIM_2
  BIM_3
  BIM_4
  CIERRE
}

// dentro de model CourseCycle:
gradingPhase GradingPhase? @map("grading_phase")
// relación nueva (Capacidad B):
attendanceMonthStatuses AttendanceMonthStatus[]
```
El legacy `activeGradingPeriod Int?` se deja INTACTO. Ningún path nuevo lo lee para gatear.

### A2. VO de dominio + métodos en la entidad

**VO `GradingPhase`** — `packages/domain/src/course-cycle/value-objects/grading-phase.ts`
(inmutable, self-validating). Representa una fase ACTIVA (`BIM_1..BIM_4 | CIERRE`); la ausencia
(`null`) se modela como ausencia del VO en la entidad, no como un valor del VO.

```ts
export type GradingPhaseCode = 'BIM_1' | 'BIM_2' | 'BIM_3' | 'BIM_4' | 'CIERRE';

export class GradingPhase {
  private constructor(private readonly value: GradingPhaseCode) {}
  static create(v: string): Result<GradingPhase, ValidationError>;  // valida contra el catálogo
  get code(): GradingPhaseCode;
  isCierre(): boolean;                    // value === 'CIERRE'
  isBimester(): boolean;                  // BIM_1..BIM_4
  bimesterOrdinal(): number | null;       // 1..4 para BIM_n, null para CIERRE
  equals(o: GradingPhase): boolean;
}
```

**Métodos en `CourseCycle`** (`packages/domain/src/course-cycle/entities/course-cycle.ts`) —
agregar `gradingPhase: GradingPhase | null` a `CourseCycleProps`, getter, y:

```ts
get gradingPhase(): GradingPhase | null;
setGradingPhase(phase: GradingPhase | null): void;   // reversible; toca lastModifiedAt

/** Solo Primario (20-22) y Secundario (30-32) están sujetos a fase. */
requiresGradingPhase(): boolean;   // this.level.belongsToLevel(2) || belongsToLevel(3)

/** ¿Se puede calificar el bimestre `ordinal` (1..4) ahora? */
canGradeBimester(ordinal: number): boolean;
//   true  ⟺ gradingPhase != null && gradingPhase.isBimester() && bimesterOrdinal() === ordinal
//   false para NULL (cutover), para otro bimestre, y para CIERRE

/** ¿Se pueden editar notas especiales (SubjectFinalGrade) ahora? */
canGradeFinal(): boolean;
//   true  ⟺ gradingPhase != null && gradingPhase.isCierre()
```

`requiresGradingPhase()` usa `Level.belongsToLevel(EducationalLevelCode)` (ya existe en el VO
`Level`, base 2 = Primario, base 3 = Secundario). Inicial/Terciario devuelven `false` → sin gating.

### A3. Puerto de autorización de fase (separado del de asignación)

**Decisión:** nuevo puerto de dominio `GradingPhaseAuthorizerPort` + impl de aplicación, en el
mismo estilo que `AssignmentAuthorizerPort`. La fase es un SEGUNDO gate; el gate de asignación
(`canWriteGrades`) queda tal cual.

**Port** — `packages/domain/src/grading/ports/grading-phase-authorizer.port.ts`:
```ts
export const GRADING_PHASE_AUTHORIZER = 'GradingPhaseAuthorizerPort' as const;

export type PhaseDecisionReason =
  | 'ALLOWED' | 'NO_PHASE' | 'WRONG_BIMESTER' | 'IS_CIERRE'
  | 'NOT_CIERRE' | 'NOT_APPLICABLE';   // NOT_APPLICABLE = nivel no Prim/Sec → allowed

export interface PhaseDecision { allowed: boolean; reason: PhaseDecisionReason; }

export interface GradingPhaseAuthorizerPort {
  canGradeBimester(courseCycleId: string, periodOrdinal: number): Promise<PhaseDecision>;
  canGradeFinal(courseCycleId: string): Promise<PhaseDecision>;
}
```

**Impl** — `api/src/application/grading/grading-phase-authorizer.service.ts`. Carga la entidad
`CourseCycle` vía `CourseCycleRepository.findByUuid(courseCycleId)` (ya devuelve la entidad
completa; solo hay que mapear el nuevo campo en el repo Prisma — ver A6) y delega en los métodos
de dominio. Si `!cc.requiresGradingPhase()` → `{ allowed: true, reason: 'NOT_APPLICABLE' }`
(Inicial/Terciario nunca se gatean). Si CC no existe → dejar que el use-case resuelva el 404
(el port devuelve `NOT_APPLICABLE`/allowed y el 404 lo cubre la validación de existencia previa).

**Rationale de puerto separado:** el proposal pidió explícitamente "puerto tipo
AssignmentAuthorizerPort". Mantiene la ortogonalidad (este port NO conoce asistencia), es
testeable en aislamiento con mock, y no contamina `AssignmentAuthorizer` (que resuelve
grupos/docentes, otra responsabilidad).

### A4. Dónde se inyecta el guard de calificación

Solo dos use-cases escriben notas y ya reciben `userId/userRoles` y validan existencia de CC:

- **`UpsertSubjectPeriodGradesUseCase`** (`api/src/application/grading/upsert-subject-period-grades.use-case.ts`):
  agregar el port. Tras la auth de asignación (paso 1b) y la carga del contexto de CC (paso 2,
  ya llama `findGradingContextByUuid`), por cada `(courseCycleId, subjectId)` group y por cada
  `periodOrdinal` presente, invocar `phaseAuthorizer.canGradeBimester(courseCycleId, periodOrdinal)`.
  Si `!allowed` → `return err(new GradingPhaseViolationError(...))`. Una verificación por
  `(courseCycleId, periodOrdinal)` único (dedupe) para no repetir queries.
- **`UpsertSubjectFinalGradesUseCase`** (`upsert-subject-final-grades.use-case.ts`): tras la auth
  (paso 0) y la carga de contexto (paso 1), por cada `courseCycleId` único invocar
  `phaseAuthorizer.canGradeFinal(courseCycleId)`. Si `!allowed` → `return err(new GradingPhaseViolationError(...))`.

**No se duplica** la autorización de asignación: el gate de asignación decide QUIÉN escribe;
el gate de fase decide CUÁNDO se puede escribir. Corren en secuencia, independientes.

### A5. Error de dominio + mapeo HTTP (409 vs 422)

Dos errores nuevos en `packages/domain/src/grading/errors/grading-phase.errors.ts`:

- **`GradingPhaseViolationError`** (code `GRADING_PHASE_VIOLATION`) → **HTTP 409 Conflict**.
  Se lanza al intentar calificar en una fase que no lo permite (NULL, bimestre equivocado,
  o notas especiales fuera de CIERRE). **Rationale 409:** el request está bien formado; lo que
  falla es el ESTADO del recurso (la fase actual del curso conflictúa con la operación). Es
  exactamente el precedente ya usado en el filtro: `COURSE_CYCLE_CLOSED = 409`,
  `ACADEMIC_CYCLE_CLOSED = 409`. Un 422 implicaría que el payload es semánticamente inválido,
  y no lo es — es el momento el que está mal.
- **`GradingPhaseNotApplicableError`** (code `GRADING_PHASE_NOT_APPLICABLE`) → **HTTP 422**.
  Se lanza SOLO al intentar SETEAR una fase (PATCH grading-phase) sobre un curso que no es
  Prim/Sec. **Rationale 422:** aquí sí el request es semánticamente improcesable para ese
  recurso (un Inicial/Terciario no tiene concepto de fase de bimestre). Distingue claramente
  el "momento equivocado" (409) del "recurso que no admite la operación" (422).

Registrar en `api/src/presentation/shared/filters/exception.filter.ts` (`DOMAIN_STATUS`):
```ts
GRADING_PHASE_VIOLATION: 409,
GRADING_PHASE_NOT_APPLICABLE: 422,
```

### A6. Endpoints, DTO, guard y restricción de nivel

**Repo Prisma** (`api/src/infrastructure/persistence/prisma/repositories/prisma-course-cycle.repository.ts`):
mapear `gradingPhase` en `toDomain` (Prisma enum → VO `GradingPhase | null`) y en `save`
(VO → Prisma enum). Añadir método si hace falta, pero `findByUuid`/`save` ya cubren el flujo.

**Use-cases** — `api/src/application/course-cycle/use-cases/grading-phase.use-cases.ts` (archivo
nuevo, hermano del existente `grading-period.use-cases.ts` que queda intacto para el legacy):
- `GetGradingPhaseUseCase.execute(uuid)` → `Result<{ gradingPhase: GradingPhaseCode | null }, NotFoundError>`.
- `SetGradingPhaseUseCase.execute(uuid, { gradingPhase })` →
  carga CC → si `!cc.requiresGradingPhase()` → `err(GradingPhaseNotApplicableError)` →
  `cc.setGradingPhase(phase | null)` → `save` → devuelve el nuevo valor.
  **Aquí se valida el nivel PRIM/SEC** (en la capa de aplicación, usando el predicado de dominio).

**DTO Zod** — `api/src/presentation/course-cycle/dto/grading-phase.dto.ts`:
```ts
export const SetGradingPhaseSchema = z.object({
  gradingPhase: z.enum(['BIM_1','BIM_2','BIM_3','BIM_4','CIERRE']).nullable(),
});
```

**Endpoints** en `CourseCycleController` (`api/src/presentation/course-cycle/course-cycle.controller.ts`):
- `GET /course-cycles/:uuid/grading-phase` — `@Roles('ROOT', { module: 'COURSE_CYCLES', action: 'READ' })`.
  Lectura amplia (los graders necesitan la fase para renderizar la grilla). Devuelve `{ gradingPhase }`.
- `PATCH /course-cycles/:uuid/grading-phase` — `@Rank(40)` (Secretario+) + `@Roles(... UPDATE)`.
  Guard de rango: **agregar `RankGuard` a `@UseGuards(AuthGuard, RolesGuard, RankGuard)`** del
  controller (hoy solo tiene los dos primeros). El decorador `@Rank` y `RankGuard` ya existen.

**Exposición de la fase en las grillas:** para que el front deshabilite columnas sin round-trips
extra, agregar `gradingPhase` al `toResponse` de `CourseCycleController` (campo nuevo, junto a
`activeGradingPeriod`) y devolverlo también en las respuestas de
`GetSubjectGradesBySubjectUseCase` / `GetSubjectGradesByStudentUseCase` (DTO `subject-grades.dto.ts`).

---

## Capacidad B — Cierre mensual de asistencia por curso

Aplica a TODOS los niveles (no solo Prim/Sec). Control por `(courseCycle, year, month)`,
compartido entre asistencia general Y por materia (la generación es por curso, y el estado
también → cierran juntas). La fase de bimestre es INDIFERENTE aquí.

### B1. Modelo `AttendanceMonthStatus` (tenant)

```prisma
enum AttendanceMonthState {
  OPEN
  CLOSED
}

model AttendanceMonthStatus {
  id            String               @id @default(uuid())
  courseCycleId String               @map("course_cycle_id")   // → CourseCycle.uuid
  year          Int
  month         Int                                            // 1..12
  status        AttendanceMonthState @default(OPEN)
  closedAt      DateTime?            @map("closed_at")
  closedBy      String?              @map("closed_by")          // userId que cerró (auditoría mínima)

  courseCycle CourseCycle @relation(fields: [courseCycleId], references: [uuid], onDelete: Restrict)

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt      @map("updated_at")

  @@unique([courseCycleId, year, month], map: "attendance_month_status_cc_year_month_key")
  @@index([courseCycleId, year, month])
  @@map("attendance_month_status")
}
```

**Decisiones:**
- `enum AttendanceMonthState { OPEN, CLOSED }` (no `Boolean closed`): auto-documentado,
  consistente con la convención de enums del schema, y extensible.
- `default(OPEN)` + **ausencia de fila = mes abierto** (sin fricción de cutover; no se backfillea).
- `onDelete: Restrict` en la FK a `CourseCycle` (consistente con `AlumnosXCursoXCiclo`, owner ADR).
- `closedBy`/`closedAt`: auditoría mínima de quién consolidó (barato, útil, no es reportería).

### B2. Entidad de dominio + reglas

`packages/domain/src/asistencia/entities/attendance-month-status.ts`:
```ts
export type AttendanceMonthState = 'OPEN' | 'CLOSED';

export class AttendanceMonthStatus {
  // props: id, courseCycleId, year, month, status, closedAt, closedBy, createdAt, updatedAt
  static create(input): AttendanceMonthStatus;         // status default OPEN
  static reconstruct(props): AttendanceMonthStatus;

  get monthOrdinal(): number;   // year * 12 + (month - 1) — orden calendario total
  isClosed(): boolean;          // status === 'CLOSED'
  canRecord(): boolean;         // !isClosed()
  close(userId: string): void;  // status=CLOSED, closedAt=now, closedBy=userId
  open(userId: string): void;   // status=OPEN, closedAt=null, closedBy=null (reapertura)
}
```

`canGenerate(previo)` NO es método de esta entidad (la regla cruza dos filas) — vive en el
use-case de generación (B4), que usa `previo?.isClosed()`.

**Errores** — `packages/domain/src/asistencia/errors/`:
- `MonthClosedError` (code `MONTH_CLOSED`) → **HTTP 409**. Se lanza en record-day cuando el mes
  destino está CERRADO. Rechaza a TODOS (incluido admin/Secretario). Precedente: estado que
  bloquea la operación → 409.
- `PreviousMonthOpenError` (code `PREVIOUS_MONTH_OPEN`) → **HTTP 409**. Se lanza en generate
  cuando el último mes generado anterior no está cerrado.

Registrar en `exception.filter.ts`: `MONTH_CLOSED: 409`, `PREVIOUS_MONTH_OPEN: 409`.

### B3. Repositorio — port + impl Prisma

**Port** — `packages/domain/src/asistencia/repositories/attendance-month-status.repository.ts`:
```ts
export interface AttendanceMonthStatusRepository {
  findOne(courseCycleId: string, year: number, month: number): Promise<AttendanceMonthStatus | null>;
  /** El ÚLTIMO mes GENERADO estrictamente anterior al objetivo (mayor monthOrdinal < target). */
  findLatestBefore(courseCycleId: string, year: number, month: number): Promise<AttendanceMonthStatus | null>;
  upsert(status: AttendanceMonthStatus): Promise<AttendanceMonthStatus>;   // open/close + registro de generación
}
```

**Impl** — `api/src/infrastructure/persistence/prisma/repositories/prisma-attendance-month-status.repository.ts`.
- `findOne`: `findUnique` por `@@unique(courseCycleId, year, month)`.
- `findLatestBefore`: `findFirst({ where: { courseCycleId, OR: [{ year: { lt: y } }, { year: y, month: { lt: m } }] }, orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 1 })`.
- `upsert`: por `@@unique`. Para open/close actualiza `status/closedAt/closedBy`; para el
  registro de generación (B4) crea con `OPEN` solo si no existe (no pisa un CLOSED).

**Definición PRECISA de "mes previo generado" (ADR clave):**
El mes previo para el guard de generación es **el último mes con fila de estado registrada,
estrictamente anterior al objetivo en orden calendario** (`findLatestBefore`) — NO el predecesor
calendario inmediato. Un mes "existe/está generado" ⟺ tiene fila en `AttendanceMonthStatus`
(la generación crea la fila). **Rationale:** las escuelas pueden no generar todos los meses
(p.ej. generan Marzo y luego Mayo, saltando Abril que nunca se materializó). Exigir que el mes
calendario inmediato anterior esté cerrado bloquearía falsamente cuando ese mes nunca se generó.
Usar "el último generado" garantiza la regla real de integridad: *"no podés abrir un mes nuevo
sin consolidar el último registro que abriste"*. **Exención del primer mes:** si `findLatestBefore`
devuelve `null` → no hay mes previo generado → se permite generar.

### B4. Dónde se inyectan los guards

- **`RecordGeneralAttendanceDayUseCase`** (`record-general-attendance-day.use-case.ts`): tras hallar
  la fila (ADR-4) y ANTES de `setDay`, cargar `statusRepo.findOne(courseCycleId, year, month)`.
  Si `status?.isClosed()` → `throw new MonthClosedError(...)`. **La verificación NO se gatea tras
  `scope.isAdministrative`**: corre incondicional, para rechazar también a admin/Secretario
  (read-only total; solo impresión). Reabrir es el único camino a editar.
- **`RecordSubjectAttendanceDayUseCase`** (`record-subject-attendance-day.use-case.ts`): mismo
  guard, pero primero resolver `courseCycleId` desde `materia.courseCycleId` (lookup raw Prisma,
  ya se hace en `checkDoor2`; para admins que saltean Door2 hay que hacer el lookup igual). El
  estado del mes está keyeado por `courseCycleId` (el mismo CC de la materia) → general y materia
  cierran juntas, coherente con que la generación es por CC.
- **`GenerateMonthlyAttendanceUseCase`** (`generate-monthly-attendance.use-case.ts`): tras el gate
  D3 admin y la verificación de existencia de CC, y ANTES de materializar:
  `const previo = await statusRepo.findLatestBefore(cc, year, month);`
  `if (previo && !previo.isClosed()) throw new PreviousMonthOpenError(...);`
  Tras materializar con éxito: `statusRepo.upsert(AttendanceMonthStatus.create({cc,year,month}))`
  creando la fila `OPEN` solo si no existe (registra el mes como generado; idempotente; no reabre
  un mes CLOSED regenerado). **Reabrir**: no hay guard extra — Secretario+ reabre siempre, aun con
  mes siguiente ya generado (regla del proposal).

### B5. Endpoints, DTO, guard

**Use-cases** — `api/src/application/asistencia/`:
- `GetAttendanceMonthStatusUseCase.execute({ courseCycleId, year, month })` →
  `{ status: 'OPEN'|'CLOSED', closedAt, closedBy }` (fila ausente → `OPEN`).
- `SetAttendanceMonthStatusUseCase.execute({ courseCycleId, year, month, status, userId })` →
  carga o crea la fila; `status==='CLOSED'` → `entity.close(userId)`; `'OPEN'` → `entity.open(userId)`;
  `upsert`. Reapertura siempre permitida (sin chequear meses posteriores).

**DTO Zod** — en `api/src/presentation/asistencia/dto/asistencia.dto.ts`:
```ts
export const AttendanceMonthStatusQuerySchema = z.object({ year: z.coerce.number(), month: z.coerce.number().min(1).max(12) });
export const SetAttendanceMonthStatusSchema   = z.object({ year: z.number(), month: z.number().min(1).max(12), status: z.enum(['OPEN','CLOSED']) });
```

**Endpoints** en `AsistenciaController`:
- `GET /course-cycles/:ccId/asistencia-mensual/estado?year=&month=` —
  `@Roles('ROOT', { module: 'ATTENDANCE', action: 'READ' })`. Devuelve el estado (para render read-only).
- `PATCH /course-cycles/:ccId/asistencia-mensual/estado` —
  `@Rank(40)` (Secretario+) + `@Roles(... CREATE)`. Body `{ year, month, status }`.
  **Agregar `RankGuard`** a `@UseGuards(AuthGuard, RolesGuard, RankGuard)` del `AsistenciaController`.

---

## Front (ambas capacidades)

### Capacidad A
- `web/src/types/course-cycle.ts`: agregar `gradingPhase: 'BIM_1'|'BIM_2'|'BIM_3'|'BIM_4'|'CIERRE'|null`.
- `web/src/pages/dashboard/course-cycles.tsx`: botón **"Fase de calificación"** por fila,
  visible SOLO si `MANAGEMENT_ROLES` (Secretario+; ya existe la constante en `types/materia-grupo.ts`)
  Y `cc.level` ∈ {20,21,22,30,31,32}. Patrón existente: `useState<string|null>` = `cc.uuid` +
  `<Modal>`. Popup con selector NULL|BIM_1..4|CIERRE (valor actual `cc.gradingPhase`); guardar →
  `PATCH /course-cycles/:uuid/grading-phase`. Reversible. Hook nuevo `useGradingPhase` (GET/PATCH)
  o inline con `apiClient` (mismo patrón que `handleBulkCascade`).
- `web/src/pages/dashboard/subject-grading-by-course.tsx` y `subject-grading-by-subject.tsx`:
  leer `gradingPhase` de la respuesta de grades. Deshabilitar (readonly + tooltip):
  columnas de bimestre distintas al `BIM_n` activo; TODAS las de bimestre si fase = CIERRE o NULL;
  columnas de notas especiales (SubjectFinalGrade) salvo fase = CIERRE. UX pura; el guard backend
  es la verdad.

### Capacidad B
- `web/src/pages/dashboard/asistencia-mensual.tsx`:
  - `GET .../estado?year=&month=` al seleccionar CC/mes → estado `isClosed`.
  - Botón **"Cerrar mes" / "Reabrir mes"** visible solo Secretario+ → `PATCH .../estado`.
  - Si `isClosed`: banner "Mes cerrado — solo lectura. Reabrí para editar."; celdas de día en
    read-only (render texto plano, no `<select>`); botón "Generar" deshabilitado. Impresión sigue.
  - El 409 `PREVIOUS_MONTH_OPEN` al generar se surface como toast (además de deshabilitar preventivo).

---

## Archivos por capa (creados / modificados / eliminados)

### Domain (`packages/domain/src/`)
**Crear:**
- `course-cycle/value-objects/grading-phase.ts` (VO)
- `grading/ports/grading-phase-authorizer.port.ts`
- `grading/errors/grading-phase.errors.ts`
- `asistencia/entities/attendance-month-status.ts`
- `asistencia/repositories/attendance-month-status.repository.ts`
- `asistencia/errors/month-closed-error.ts`, `asistencia/errors/previous-month-open-error.ts`

**Modificar:**
- `course-cycle/entities/course-cycle.ts` (props + getter + set/can/requires métodos)
- `index.ts` de dominio (barrels: exportar lo nuevo)

### Application (`api/src/application/`)
**Crear:**
- `grading/grading-phase-authorizer.service.ts`
- `course-cycle/use-cases/grading-phase.use-cases.ts` (Get/Set)
- `asistencia/get-attendance-month-status.use-case.ts`, `.../set-attendance-month-status.use-case.ts`

**Modificar:**
- `grading/upsert-subject-period-grades.use-case.ts` (inyectar phase authorizer)
- `grading/upsert-subject-final-grades.use-case.ts` (inyectar phase authorizer)
- `asistencia/record-general-attendance-day.use-case.ts` (guard MONTH_CLOSED)
- `asistencia/record-subject-attendance-day.use-case.ts` (guard MONTH_CLOSED)
- `asistencia/generate-monthly-attendance.use-case.ts` (guard PREVIOUS_MONTH_OPEN + upsert estado)
- `asistencia/index.ts` (exportar use-cases nuevos)

### Infrastructure (`api/src/infrastructure/`)
**Crear:**
- `persistence/prisma/repositories/prisma-attendance-month-status.repository.ts`

**Modificar:**
- `persistence/prisma/repositories/prisma-course-cycle.repository.ts` (mapear `gradingPhase`)
- `api/prisma_tenant/schema.prisma` (enum `GradingPhase`, col `gradingPhase`, enum
  `AttendanceMonthState`, modelo `AttendanceMonthStatus`, relación en `CourseCycle`)
- migración tenant nueva (`prisma:migrate:tenant`)

### Presentation (`api/src/presentation/`)
**Crear:**
- `course-cycle/dto/grading-phase.dto.ts`

**Modificar:**
- `course-cycle/course-cycle.controller.ts` (GET/PATCH grading-phase, `RankGuard`, `gradingPhase` en `toResponse`)
- `course-cycle/course-cycle.module.ts` (wire use-cases + repo + port)
- `grading/subject-grades.controller.ts` (sin cambios de firma; el error 409 lo mapea el filtro)
- `grading/dto/subject-grades.dto.ts` (agregar `gradingPhase` a las respuestas de lectura)
- `grading/grading.module.ts` (wire `GRADING_PHASE_AUTHORIZER` en los upsert use-cases)
- `asistencia/asistencia.controller.ts` (GET/PATCH estado, `RankGuard`)
- `asistencia/asistencia.module.ts` (wire use-cases + repo)
- `asistencia/dto/asistencia.dto.ts` (schemas de estado)
- `shared/filters/exception.filter.ts` (4 códigos nuevos)

### Web (`web/src/`)
**Modificar:**
- `types/course-cycle.ts` (`gradingPhase`)
- `pages/dashboard/course-cycles.tsx` (botón + popup fase)
- `pages/dashboard/subject-grading-by-course.tsx`, `.../subject-grading-by-subject.tsx` (deshabilitar columnas)
- `pages/dashboard/asistencia-mensual.tsx` (botón abrir/cerrar + read-only + estado)

**Crear (opcional):**
- `hooks/useGradingPhase.ts`, `hooks/useAttendanceMonthStatus.ts`

**Eliminar:** ninguno (cambio 100% aditivo).

---

## Propuesta de 4 PRs encadenados (orden de dependencias)

Regla: backend antes que front dentro de cada capacidad; las dos capacidades son independientes
entre sí, pero se encadenan para revisión incremental. Cada PR ≤ ~400 líneas (auto-chain).

1. **PR-1 · Backend Fase (Capacidad A).**
   Schema (enum `GradingPhase` + col) + migración · VO `GradingPhase` + métodos de entidad ·
   port + impl `GradingPhaseAuthorizer` · errores + mapeo filtro · guard en los 2 upsert use-cases ·
   endpoints GET/PATCH grading-phase + DTO + `RankGuard` + validación de nivel · exposición de
   `gradingPhase` en respuestas. TDD estricto (test primero).
   *Depende de:* nada. *Base para:* PR-2.

2. **PR-2 · Front Fase (Capacidad A).**
   `types/course-cycle.ts` · botón+popup en `course-cycles.tsx` · deshabilitar columnas en las
   dos grillas de grading · hook.
   *Depende de:* PR-1 (endpoints + campo en respuestas).

3. **PR-3 · Backend Cierre-mes (Capacidad B).**
   Schema (enum `AttendanceMonthState` + modelo `AttendanceMonthStatus` + relación) + migración ·
   entidad + errores + mapeo filtro · port + impl repo (`findOne`/`findLatestBefore`/`upsert`) ·
   guards en record-general, record-subject, generate · endpoints GET/PATCH estado + DTO +
   `RankGuard`. TDD estricto.
   *Depende de:* nada de A (ortogonal). Puede ir en paralelo a PR-1/2, pero se encadena tras PR-2.

4. **PR-4 · Front Cierre-mes (Capacidad B).**
   `asistencia-mensual.tsx`: estado del mes, botón abrir/cerrar (Secretario+), read-only total
   cuando cerrado, surface de 409 al generar · hook.
   *Depende de:* PR-3 (endpoints).

**Checkpoint humano único:** mostrar el estado final ANTES del deploy (el usuario deploya).
**Cutover A:** coordinar con Secretaría — tras deploy de PR-1, TODO curso Prim/Sec queda
bloqueado para calificar hasta activar fase una por una.
