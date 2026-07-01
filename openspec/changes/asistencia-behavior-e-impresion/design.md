# Design — asistencia-behavior-e-impresion

> Fuente de requisitos: engram #1655. Proposal: #1656.
> Arquitectura: Clean/Hexagonal + Screaming. Multitenant tenant-schema (`api/prisma_tenant`).
> Regla de dependencias: domain ← application ← infrastructure/presentation. El dominio NO conoce Prisma/Nest.

## 1. Enfoque arquitectónico

Dos partes independientes en capa pero encadenadas en entrega:

- **Parte 1 (behavior)**: enriquecer el agregado `AttendanceType` (tenant) con un clasificador semántico `behavior`. Es un cambio de MODELO: schema Prisma + VO de dominio + migración de datos + CRUD/DTO + UI. El flag `assignable` pasa a ser un espejo DERIVADO de `behavior` (no se dropea en este cambio).
- **Parte 2 (impresión)**: capacidad NUEVA `asistencia-reporting`. Reusa el stack de boletines (Puppeteer + Handlebars) pero agrega un **agregador mensual puro** (dominio) que hoy no existe para la grilla, endpoints server-side que devuelven PDF apaisado, y botones en el front.

Patrón transversal: **agregación pura en el dominio** (función sin dependencias) + **use-case de aplicación** que orquesta repos + template + PDF + **controller** que sólo traduce HTTP↔dominio. Result pattern para errores de dominio→HTTP.

## 2. Parte 1 — `behavior` en AttendanceType

### ADR-01 — Representación de `behavior`: enum nativo Prisma nombrado (NO Int)

**Decisión**: crear un enum nativo Postgres/Prisma `AttendanceBehavior` con 7 miembros nombrados, y un Value Object de dominio `AttendanceBehavior` que envuelve el enum y expone predicados semánticos.

Mapa canónico (nombre ↔ número de requisito):

| # req | Enum member            | Semántica                 |
|-------|------------------------|---------------------------|
| 1     | `AUSENTE_INJUSTIFICADO`| Ausente injustificado     |
| 2     | `AUSENTE_JUSTIFICADO`  | Ausente justificado       |
| 3     | `NO_ELEGIBLE`          | No elegible (ex-assignable=false) |
| 4     | `NO_COMPUTA`           | No considerar ausentismo (P) |
| 5     | `TARDE_INJUSTIFICADA`  | Tarde injustificada       |
| 6     | `TARDE_JUSTIFICADA`    | Tarde justificada         |
| 7     | `DIA_NO_HABIL`         | Día no hábil (feriado)    |

**Rationale**: los "1-7" son un ORDINAL del requisito, no una magnitud. Un enum nombrado (a) autodocumenta la DB y las queries, (b) valida a nivel motor (no entran valores fuera de rango), (c) hace ilegible-proof el código de agregación: el dominio expone `isTardeJustificada()`, `isAusenteInjustificado()`, `isDiaHabil()`, `isEligible()` en vez de comparar contra números mágicos. Un `Int` obligaría a repartir la semántica "3 = no elegible" por todo el código.

**Alternativa rechazada**: columna `Int` 1-7 con VO que valide el rango. Más simple para la aritmética de agrupación, pero pierde la autodocumentación de la DB y esparce magic numbers. Rechazada por legibilidad y seguridad de datos.

**VO de dominio** (`packages/domain/src/attendance-type/value-objects/attendance-behavior.ts`):
- `AttendanceBehavior.create(value: string): Result<AttendanceBehavior, ValidationError>` — valida contra los 7 miembros.
- Predicados: `isEligible()` (`!== NO_ELEGIBLE`), `isDiaHabil()` (`!== NO_ELEGIBLE && !== DIA_NO_HABIL`), `isTardeJustificada()`, `isTardeInjustificada()`, `isAusenteJustificado()`, `isAusenteInjustificado()`, `isNoComputa()`.
- `get(): AttendanceBehaviorValue` (string enum). Sigue el patrón de `AttendanceTypeCode`.

### ADR-02 — Migración de datos (RIESGO CRÍTICO A)

Migración en pasos idempotentes (una sola migración Prisma tenant con SQL de backfill):

1. `CREATE TYPE "AttendanceBehavior" AS ENUM (...)`.
2. `ALTER TABLE attendance_types ADD COLUMN behavior "AttendanceBehavior" NULL;` (nullable transitorio).
3. **Backfill determinístico (system types)**:
   - `P`   → `NO_COMPUTA` (4)
   - `SAB`, `DOM`, `X` → `NO_ELEGIBLE` (3)
4. **Backfill heurístico (custom types existentes)** — tabla de decisión desde `(assignable, absenceValue)`:
   - `assignable = false` → `NO_ELEGIBLE` (3)  *(espeja el comportamiento de SAB/DOM/X)*
   - `assignable = true AND absenceValue = 0` → `NO_COMPUTA` (4)  *(presente-like, no suma ausentismo)*
   - `assignable = true AND 0 < absenceValue < 1` → `AUSENTE_JUSTIFICADO` (2)  *(peso parcial → justificado por defecto)*
   - `assignable = true AND absenceValue >= 1` → `AUSENTE_INJUSTIFICADO` (1)  *(peso completo)*
   - fallback (nada matchea) → `NO_COMPUTA` (4)  *(el más seguro: no contamina totales)*
5. `ALTER TABLE attendance_types ALTER COLUMN behavior SET NOT NULL;`

**Rationale de la heurística**: los `behavior` de tarde (5/6) NO son derivables de `absenceValue` (una tarde puede pesar 0.25 igual que una media falta). Se los omite en la derivación y caen en los buckets de ausente/no-computa; el admin los reclasifica luego vía CRUD/UI. En prod probablemente **sólo existan los 4 system types** (el seed no crea customs: A/T/Feriado son manuales), así que la heurística casi no se dispara — riesgo real bajo. Backup de `attendance_types` por tenant antes de correr en prod (ya previsto en el rollback del proposal).

### ADR-03 — Destino de `assignable`: DERIVAR de `behavior`, NO dropear

**Decisión**: `assignable` deja de ser un campo de entrada; se DERIVA como `assignable = behavior.isEligible()` (`behavior !== NO_ELEGIBLE`). La columna se MANTIENE en el schema y se sigue persistiendo (espejo derivado). No se dropea en este cambio.

**Rationale**:
- Mantener la columna deja el rollback de PR1/PR2 válido (si se revierte behavior, `assignable` sigue vivo y la grilla legacy sigue funcionando).
- Un único source of truth (`behavior`) evita divergencia: nadie vuelve a setear `assignable` a mano.
- `isPresent` (campo solo-DB derivado en `save()` como `absenceValue===0 && assignable`) se mantiene INTACTO — lo consume `buildAsistencia` del boletín, que está OUT of scope. No lo tocamos.
- Se documenta `assignable` como legacy/derivado, candidato a eliminación en un cambio futuro.

**Impacto en el repo** (`prisma-attendance-type.repository.ts`): `save()` computa `assignable = entity.behavior.isEligible()` en vez de leer un `assignable` de entrada; sigue seteando `isPresent` con la fórmula actual. `toDomain()` lee `behavior` de la fila y reconstruye el VO.

### ADR-04 — CRUD y lock de system types

**Lock ya existe**: `AttendanceType.assertMutable()` lanza `SystemAttendanceTypeError` y los use-cases `Update`/`Delete` ya lo invocan → los system types (P/SAB/DOM/X) NO se pueden editar ni borrar. **No hay que agregar lock nuevo**; sólo verificar con tests que un intento de cambiar `behavior` de un system type siga bloqueado (queda cubierto porque el update entero se rechaza).

**Cambios CRUD**:
- Entidad `AttendanceType`: agregar prop `behavior: AttendanceBehavior` a `CreateAttendanceTypeInput`, `ReconstructAttendanceTypeProps`, `AttendanceTypeProps`, getter `behavior`. Quitar `assignable` de `CreateAttendanceTypeInput` (se deriva).
- Use-case `CreateAttendanceTypeUseCase`: input pasa a llevar `behavior` en vez de `assignable`.
- Use-case `UpdateAttendanceTypeUseCase`: `behavior` opcional en el input; al reconstruir usa `input.behavior ?? entity.behavior`. Quitar `assignable` del input.
- DTO create (`create-attendance-type.dto.ts`): reemplazar `assignable: z.boolean()` por `behavior: z.nativeEnum(AttendanceBehaviorValue)` (o `z.enum([...7])`). 
- DTO update (`update-attendance-type.dto.ts`): reemplazar `assignable` por `behavior` opcional.
- Controller `toResponse`: agregar `behavior: entity.behavior.get()`; mantener `assignable` en la respuesta (derivado) para no romper consumidores actuales durante la transición.

### ADR-05 — Grilla: filtrar por `behavior`, no por `assignable`

**Front** (`web/src/pages/dashboard/asistencia-mensual.tsx`):
- `AttendanceTypeItem`: agregar `behavior: string`.
- Línea ~439: combo de códigos seleccionables → `attendanceTypes.filter(t => t.active && t.behavior !== 'NO_ELEGIBLE')` (antes `t.assignable`).
- Línea ~677: `isLockedByCode = at?.behavior === 'NO_ELEGIBLE'` (antes `at?.assignable === false`).
- Feriado = tipo custom con `behavior = DIA_NO_HABIL (7)`, que ES seleccionable (no es NO_ELEGIBLE) → aparece en el combo y Secretaría lo marca día por día. Consistente con el filtro anterior.

**UI attendance-types.tsx**: agregar selector de `behavior` (dropdown con las 7 opciones etiquetadas) en el form de create/edit; deshabilitado/oculto para system types (ya no editables).

## 3. Parte 2 — Impresión mensual PDF apaisada

### ADR-06 — Agregador mensual PURO en el dominio (reutilizable general + materia)

**Decisión**: una función pura de dominio `computeAsistenciaMensualTotals` en `packages/domain/src/asistencia/utils/asistencia-totals.ts`, agnóstica de scope. Recibe el day-map de un alumno + un catálogo `code → { behavior, absenceValue }` y devuelve los 6 totales ponderados.

```
computeStudentTotals(days: Record<string,string>, catalog: Map<string,{behavior,absenceValue}>):
  tardesJust  = Σ absenceValue where behavior = TARDE_JUSTIFICADA (6)
  tardesInj   = Σ absenceValue where behavior = TARDE_INJUSTIFICADA (5)
  totalTardes = tardesJust + tardesInj
  ausJust     = Σ absenceValue where behavior = AUSENTE_JUSTIFICADO (2)
  ausInj      = Σ absenceValue where behavior = AUSENTE_INJUSTIFICADO (1)
  ausTotal    = ausJust + ausInj
```

Todos son SUMAS PONDERADAS por `absenceValue` (NO conteos). Códigos con behavior 3/4/7 no suman a ningún total.

**Rationale**: es lógica de negocio pura, sin I/O → vive en el dominio, testeable sin mocks, y se reutiliza idéntica para general y materia (única diferencia: la fuente de datos y el catálogo por nivel). No se toca `buildAsistencia` del boletín (histórico, general, semántica distinta — OUT of scope).

### ADR-07 — Días hábiles del mes (RIESGO B: sin doble conteo)

**Decisión**: `díasHábiles` es un escalar A NIVEL CURSO/MES (no por alumno). Se computa como:

```
díasHábiles = daysInMonth(year, month) − |{ d ∈ 1..daysInMonth : behavior(codeDelDía d) ∈ {NO_ELEGIBLE(3), DIA_NO_HABIL(7)} }|
```

La clave anti-doble-conteo es que se opera sobre un **Set de índices de día** (1..daysInMonth): cada día se evalúa UNA vez. Un día no-hábil puede venir de dos fuentes (calendario SAB/DOM/X → behavior 3, o feriado marcado → behavior 7); al ser membership sobre el índice de día, contar ambas fuentes nunca duplica.

El "código del día d" a nivel curso se toma de la fila general del curso (los días locked y feriados son uniformes para todo el curso; se usa `daysInMonth` de `calendar-utils`, ya existente). Para el reporte por materia se usa el day-map de la materia con el mismo criterio.

**Rationale**: separar el escalar mensual (course-level) de los totales por alumno evita mezclar granularidades. `calendar-utils.daysInMonth` ya es la fuente de verdad del calendario y es timezone-safe.

### ADR-08 — Use-case y endpoints de impresión

**Use-case** `GenerateAsistenciaMensualPdfUseCase` (application, capacidad `asistencia-reporting`), parametrizado por scope:
- `executeGeneral(courseCycleId, year, month): Promise<Buffer>`
- `executeMateria(materiaXCursoXCicloId, year, month): Promise<Buffer>`

Flujo de datos:
1. Resolver el `level` del curso (general: courseCycle→level; materia: materiaXCursoXCiclo→courseCycle→level).
2. Construir catálogo `code → {behavior, absenceValue}` con `attendanceType.findMany({ where:{ level } })` (mismo patrón que `buildAsistencia`).
3. Traer filas enriquecidas con nombre de alumno vía `findByScopeAndMonthEnriched` (YA EXISTE en ambos repos general y materia).
4. Por alumno: `computeStudentTotals`. A nivel curso: `díasHábiles` (ADR-07).
5. Armar el view-model, compilar el template Handlebars, `pdfGenerator.generatePdf(html, { landscape: true })`.
6. Devolver Buffer.

Errores de dominio→HTTP con Result/clase de error propia (`AsistenciaReportingError` con `httpStatus`, patrón `BoletinError`).

**Endpoints** (controller nuevo `AsistenciaReportingController`, montado en módulo nuevo `asistencia-reporting` que importa `PdfGeneratorService`):
- `GET /asistencia-mensual/general/:courseCycleId/print?year=&month=` → `application/pdf`.
- `GET /asistencia-mensual/materia/:materiaXCursoXCicloId/print?year=&month=` → `application/pdf`.
- Guards `AuthGuard + RolesGuard`, `@Roles('ROOT', { module: 'REPORTS' | 'ATTENDANCE', action: 'READ' })` (alinear con módulo de permisos existente de asistencia).
- Setean `Content-Type: application/pdf` + `Content-Disposition: attachment` (patrón `reportes.controller.ts`).

**Rationale**: controller/módulo separado = capacidad Screaming propia (`asistencia-reporting`), sin inflar `ReportesModule`. Reusa `PdfGeneratorService` (provider compartido).

### ADR-09 — PDF apaisado: parametrizar `generatePdf`

**Decisión**: extender `PdfGeneratorService.generatePdf(html, options?)` con `options?: { landscape?: boolean; margin?: {...} }`. Default portrait (backward-compatible con boletines/constancia). El use-case de asistencia pasa `{ landscape: true }` con márgenes reducidos para la grilla ancha.

**Rationale**: cambio mínimo, aditivo y no rompe los 3 consumidores actuales (boletines single/batch, constancia). Puppeteer `page.pdf({ landscape: true })` es la vía soportada.

### ADR-10 — Template Handlebars apaisado

Nuevo `api/src/infrastructure/reporting/html-templates/asistencia-mensual.hbs` (landscape A4):
- Header: institución, curso/materia, mes/año, **etiqueta Días hábiles**.
- Tabla: filas = alumnos (ordenados apellido, nombre — ya viene ordenado del repo); columnas = días `1..daysInMonth` (código como en pantalla) + 6 columnas de totales (Tardes Just / Tardes Inj / Total Tardes / Aus Just / Aus Inj / Aus Total).
- CSS `@page { size: A4 landscape }` + fuente chica y `table-layout: fixed` para 31 días + 6 totales.
- Compilación siguiendo el patrón de `generate-boletin.use-case.ts`: `fs.readFileSync` + `Handlebars.compile` en el constructor del use-case, con el mismo probe de `TEMPLATE_SUBPATH` (los `.hbs` no se copian a dist). Registrar helpers necesarios (ej. `eq`, `lookup` de día) si hiciera falta.

### ADR-11 — Front: botón Imprimir por módulo

`web/src/pages/dashboard/asistencia-mensual.tsx`: botón "Imprimir" en CADA módulo (general por curso + por materia). Al click: `apiClient.get(endpoint, { responseType: 'blob' })` con el `courseCycleId`/`materiaXCursoXCicloId` + `year`/`month` seleccionados, y disparar descarga (crear `blob` URL + `<a download>`). Sin html2pdf client-side.

## 4. Flujo de datos (resumen)

```
[Grilla mensual] --days JSON--> asistenciaX(Alumno|Materia)XCursoXCiclo (tenant)
AttendanceType(level, code, behavior, absenceValue) --catalog--> 
  computeStudentTotals(days, catalog)  [dominio puro]
     └─> 6 totales ponderados / alumno
  díasHábiles(daysInMonth, códigos del mes)  [dominio puro, Set de días]
     └─> escalar course-level
  ─> GenerateAsistenciaMensualPdfUseCase  [application]
     └─> Handlebars(asistencia-mensual.hbs) ─> PdfGeneratorService.generatePdf(html,{landscape}) ─> Buffer
        └─> AsistenciaReportingController ─> HTTP PDF
```

## 5. Archivos por capa (crear / modificar / eliminar)

### Domain (`packages/domain`)
- **CREAR** `src/attendance-type/value-objects/attendance-behavior.ts` (VO + enum de valores).
- **CREAR** `src/attendance-type/value-objects/__tests__/attendance-behavior.test.ts`.
- **MODIFICAR** `src/attendance-type/entities/attendance-type.ts` (prop `behavior`, quitar `assignable` de input Create, derivar).
- **MODIFICAR** `src/attendance-type/value-objects/index.ts` y `src/attendance-type/index.ts` (exports).
- **CREAR** `src/asistencia/utils/asistencia-totals.ts` (`computeStudentTotals`, `computeDiasHabiles`).
- **CREAR** `src/asistencia/utils/__tests__/asistencia-totals.test.ts`.
- **MODIFICAR** entidades de test existentes de attendance-type (agregar behavior).

### API — infrastructure (`api/src/infrastructure`)
- **MODIFICAR** `persistence/prisma/repositories/prisma-attendance-type.repository.ts` (`save` deriva assignable de behavior + persiste behavior; `toDomain` lee behavior).
- **MODIFICAR** `reporting/pdf-generator.service.ts` (opción `landscape`/margin).
- **CREAR** `reporting/html-templates/asistencia-mensual.hbs`.

### API — Prisma tenant
- **MODIFICAR** `api/prisma_tenant/schema.prisma` (enum `AttendanceBehavior` + campo `behavior` en `AttendanceType`).
- **CREAR** migración tenant (add enum + column nullable + backfill determinístico/heurístico + set NOT NULL). Down migration: drop column + drop type, sin borrar filas, sin tocar `assignable`.

### API — application (`api/src/application`)
- **MODIFICAR** `attendance-type/use-cases/attendance-type.use-cases.ts` (Create/Update: behavior en input, quitar assignable).
- **MODIFICAR** `attendance-type/use-cases/ensure-attendance-types-for-level.use-case.ts` (seed system types con `behavior`: P→NO_COMPUTA, SAB/DOM/X→NO_ELEGIBLE).
- **CREAR** `asistencia-reporting/generate-asistencia-mensual-pdf.use-case.ts` (+ `AsistenciaReportingError`).
- **CREAR** `asistencia-reporting/__tests__/generate-asistencia-mensual-pdf.use-case.test.ts`.

### API — presentation (`api/src/presentation`)
- **MODIFICAR** `attendance-type/dto/create-attendance-type.dto.ts` (behavior, quitar assignable).
- **MODIFICAR** `attendance-type/dto/update-attendance-type.dto.ts` (behavior opcional, quitar assignable).
- **MODIFICAR** `attendance-type/attendance-type.controller.ts` (`toResponse` con behavior; wiring inputs).
- **CREAR** `asistencia-reporting/asistencia-reporting.controller.ts`.
- **CREAR** `asistencia-reporting/asistencia-reporting.module.ts` (importa `PdfGeneratorService`, `PrismaService`, repos asistencia).
- **MODIFICAR** `app.module.ts` (registrar el módulo nuevo).

### Web (`web/src`)
- **MODIFICAR** `pages/dashboard/asistencia-mensual.tsx` (filtro combo por behavior, lock por behavior, `AttendanceTypeItem.behavior`, 2 botones Imprimir + descarga blob).
- **MODIFICAR** `pages/dashboard/attendance-types.tsx` (selector de `behavior` en el form; quitar toggle `assignable` como input).

### Scripts / seed
- **REVISAR** `api/scripts/backfill-system-attendance-types.ts` (si setea assignable, agregar behavior).

**ELIMINAR**: ninguno en este cambio (columna `assignable` se mantiene por rollback — ADR-03).

## 6. PRs encadenados (stacked, auto-chain, TDD estricto)

Orden por dependencias. Cada PR ≤ ~400 líneas objetivo; revertible.

- **PR1 — Base behavior (schema + dominio + migración)**  
  schema.prisma (enum + column), migración con backfill, VO `AttendanceBehavior`, entidad `AttendanceType` con behavior, repo `save/toDomain`, seed `ensure-attendance-types-for-level`. Tests de dominio + repo.  
  *Depende de*: nada. *Sensible*: la migración (Riesgo A). Rollback = drop column/type sin borrar filas.

- **PR2 — CRUD + UI tipos + filtrado de grilla**  
  DTOs create/update (behavior, quitar assignable), use-cases Create/Update, controller `toResponse`, `attendance-types.tsx` (selector behavior), `asistencia-mensual.tsx` (filtro/lock por behavior). Tests controller/DTO.  
  *Depende de*: PR1.

- **PR3 — Backend agregación + endpoint + template impresión**  
  `asistencia-totals.ts` (dominio), `GenerateAsistenciaMensualPdfUseCase`, `AsistenciaReportingError`, controller + módulo `asistencia-reporting`, `pdf-generator` landscape, `asistencia-mensual.hbs`. Tests use-case (general + materia) + totals puros.  
  *Depende de*: PR1 (necesita `behavior` en el catálogo). Independiente de PR2 en código, pero se apila detrás por orden lógico.

- **PR4 — Front botones impresión**  
  Botones "Imprimir" (general + materia) en `asistencia-mensual.tsx` + descarga blob contra los endpoints de PR3.  
  *Depende de*: PR3 (endpoints).

Cadena: **PR1 → PR2 → PR3 → PR4**. Conventional Commits, sin Co-Authored-By, coverage ≥ 80%.

## 7. Riesgos abiertos para tasks/apply

- **A (crítico)**: backfill de customs es heurístico; validar en un dump real de tenant antes de prod. Backup previo obligatorio.
- **B**: días hábiles depende de que los días locked/feriado sean uniformes a nivel curso; si un feriado se marcara sólo para algunos alumnos, revisar la fuente del "código del día". Mitigado por Set de índices.
- **C (esfuerzo)**: resolver `level` desde materiaXCursoXCiclo→courseCycle→level requiere confirmar la relación exacta en el schema tenant al implementar PR3.
- **Permisos**: confirmar el `module`/`action` correcto para los endpoints de impresión (¿REPORTS o ATTENDANCE?) contra el catálogo de permisos existente.
