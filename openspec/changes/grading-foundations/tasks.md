# Tasks — grading-foundations (Fase 1 del épico de calificación)

> Checklist ejecutable dividido en dos sub-entregas independientes (1a y 1b).
> Cada una tiene su propia migración, batches ≤ ~400 líneas de código productivo, y GATE de verificación.
> Orden de ejecución: 1a completa → 1b.
> Todas las tareas siguen strict TDD (RED → GREEN → refactor).

---

## Leyenda

- `[RED]` → escribir tests primero (deben fallar)
- `[GREEN]` → implementar para que pasen
- `[GATE]` → verificación: build + lint + tests del sub-batch antes de continuar
- `→ REQ-N` → requisito del spec que cubre la tarea
- `⚠ dep` → depende de tarea anterior indicada
- `‖ paralelo` → puede ejecutarse en paralelo con la tarea indicada

---

## ENTREGA 1a — ESCALAS DE NOTAS

### Sub-batch 1a-A: Schema Prisma + Migración SQL + Seed (~190 líneas)

> Prerequisito estructural. Sin migration no compila el cliente Prisma.
> Dependencia: ninguna (es el punto de partida de 1a).

---

**[x] T01 — Agregar enum `GradeInternalStatus` y rediseñar modelos en schema tenant**
- Descripción: En `api/prisma_tenant/schema.prisma` agregar el enum `GradeInternalStatus {APROBADO, NO_APROBADO, EN_PROCESO, LIBRE}`. Rediseñar `GradeScale` (eliminar `minValue`, `maxValue`, `isConceptual`; conservar `id`, `name`, `level`, `modality`, `active`, `deletedAt`, timestamps; `@@unique([level, modality, name])`). Rediseñar `GradeScaleValue` (eliminar `isApproved`, `numericValue`; agregar `internalStatus GradeInternalStatus NOT NULL`; conservar `code`, `label`, `sortOrder`, `active`, `deletedAt`, timestamps; `@@unique([scaleId, code])`). Mantener relación `Nota.gradeScaleValueId` sin cambios (FK opcional existente). Marcar con `// @deprecated grading-foundations` los campos `AcademicCycle.firstBim..fourthBim`, `CourseCycle.*Bim* / activeGradingPeriod`, `MateriaCarrera.cuatrimestre`, `CompetencyValuation.periodActive`, `InformeEvolutivo.periodo` (solo comentarios, SIN modificar tipo ni borrar).
- Paths:
  - `api/prisma_tenant/schema.prisma`
- REQ: REQ-1, REQ-2, REQ-3 (modelo base)

**[x] T02 — Escribir migración SQL manual para escalas**
- Descripción: Crear archivo `api/prisma_tenant/migrations/YYYYMMDD_grading_foundations_scales/migration.sql` con el script de reemplazo limpio: (1) `CREATE TYPE "GradeInternalStatus" AS ENUM (...)`, (2) `UPDATE "notas" SET "gradeScaleValueId" = NULL` (desvincular FKs antes de TRUNCATE), (3) `TRUNCATE "grade_scale_values" CASCADE`, (4) `TRUNCATE "grade_scales" CASCADE`, (5) `ALTER TABLE "grade_scale_values" DROP COLUMN "isApproved"`, (6) `ALTER TABLE "grade_scale_values" DROP COLUMN "numericValue"`, (7) `ALTER TABLE "grade_scale_values" ADD COLUMN "internalStatus" "GradeInternalStatus" NOT NULL`, (8) `ALTER TABLE "grade_scales" DROP COLUMN "minValue"`, (9) `ALTER TABLE "grade_scales" DROP COLUMN "maxValue"`, (10) `ALTER TABLE "grade_scales" DROP COLUMN "isConceptual"`. NO crear las tablas de períodos en esta migración.
- Paths:
  - `api/prisma_tenant/migrations/YYYYMMDD_grading_foundations_scales/migration.sql`
- REQ: REQ-1, REQ-2 (persistencia)
- ⚠ dep: T01

**[x] T03 — Actualizar seed: módulo GRADING_CONFIG + seedGradeScales reescrito**
- Descripción: En `api/prisma/seed.ts`: (a) Agregar al array `modules[]` (línea ~46): `{ id: 'm-grading-config', code: 'GRADING_CONFIG', name: 'Configuración de Calificación' }`. El módulo queda incluido en `ALL_MODULE_IDS` → ROOT y Admin lo reciben automáticamente. (b) Reescribir completamente la función `seedGradeScales(prisma)` eliminando todos los campos obsoletos (`minValue`, `maxValue`, `isConceptual`, `numericValue`, `isApproved`) y usando en su lugar `internalStatus`. Mapeo de ejemplo: valores 6-10 → `APROBADO`, 1-5 → `NO_APROBADO`; cualitativa Inicial: DESTACADO/LOGRADO → `APROBADO`, EN_PROCESO → `EN_PROCESO`. Conservar los mismos IDs de escala y valores para compatibilidad de re-seed.
- Paths:
  - `api/prisma/seed.ts`
- REQ: REQ-7 (GRADING_CONFIG), REQ-1, REQ-2 (datos ejemplo)
- ⚠ dep: T01

**[x] T04 — [GATE 1a-A] Build schema + cliente Prisma tenant**
- Descripción: Ejecutar `cd api && npx prisma generate --schema=prisma_tenant/schema.prisma`. Verificar que el cliente TypeScript compilado incluye el enum `GradeInternalStatus` y los modelos rediseñados sin los campos eliminados. Ejecutar `cd api && npm run build` (o equivalente) y verificar que no hay errores de compilación relacionados con los cambios del schema. El gate bloquea el inicio de 1a-B.
- Paths: (ningún archivo nuevo, solo verificación)
- REQ: todos los de 1a-A
- ⚠ dep: T01, T02, T03

---

### Sub-batch 1a-B: Dominio escalas — entidades, VOs, errores, puerto (~375 líneas productivas)

> TDD estricto: primero los tests (T05), luego la implementación (T06-T11).
> IMPORTANTE: mover/reemplazar el `GradeScale` existente en pedagogy.
> ⚠ dep sub-batch: T04 (GATE 1a-A)

---

**[x] T05 — [RED] Tests unitarios de VOs y entidades de escalas**
- Descripción: Crear `packages/domain/src/grading/__tests__/value-objects/grade-internal-status.test.ts` (6 casos: cada valor del enum es válido; valor fuera del enum devuelve error; valor vacío devuelve error). Crear `packages/domain/src/grading/__tests__/value-objects/grade-value-code.test.ts` (4 casos: código alfanumérico libre aceptado — "10", "A+", "Logrado"; código vacío/solo-espacios devuelve error). Crear `packages/domain/src/grading/__tests__/entities/grade-scale.test.ts` (5 casos: crear escala válida; crear con name vacío falla; softDelete marca deletedAt; reconstruct preserva campos; invariante level 1-4). Crear `packages/domain/src/grading/__tests__/entities/grade-scale-value.test.ts` (6 casos: crear valor válido con APROBADO; internalStatus inválido devuelve error; code vacío devuelve error; sortOrder negativo acepta? no, ≥0 sí; softDelete; reconstruct). Todos deben fallar (RED) porque las implementaciones no existen aún.
- Paths:
  - `packages/domain/src/grading/__tests__/value-objects/grade-internal-status.test.ts`
  - `packages/domain/src/grading/__tests__/value-objects/grade-value-code.test.ts`
  - `packages/domain/src/grading/__tests__/entities/grade-scale.test.ts`
  - `packages/domain/src/grading/__tests__/entities/grade-scale-value.test.ts`
- REQ: REQ-1, REQ-2

**[x] T06 — [GREEN] VO `GradeInternalStatus`**
- Descripción: Crear `packages/domain/src/grading/value-objects/grade-internal-status.ts`. Implementar VO con método estático `create(raw: string): Result<GradeInternalStatus, InvalidInternalStatusError>` que valida pertenencia al set fijo `{APROBADO, NO_APROBADO, EN_PROCESO, LIBRE}`. Método `get()` para obtener el valor primitivo. Espejo de `AttendanceTypeCode` en el mismo repositorio. Los tests de T05 para este VO deben pasar.
- Paths:
  - `packages/domain/src/grading/value-objects/grade-internal-status.ts`
- REQ: REQ-2 (invariante internalStatus ∈ enum fijo)
- ⚠ dep: T05

**[x] T07 — [GREEN] VO `GradeValueCode`**
- Descripción: Crear `packages/domain/src/grading/value-objects/grade-value-code.ts`. VO que valida: trim, no-vacío (error si string vacío o solo espacios), sin restricción de formato (alfanumérico libre: acepta "10", "A+", "Logrado", "MB"). Los tests de T05 para este VO deben pasar.
- Paths:
  - `packages/domain/src/grading/value-objects/grade-value-code.ts`
- REQ: REQ-2 (escenario 2.4 — code alfanumérico libre)
- ⚠ dep: T05

**[x] T08 — [GREEN] Errores de dominio de escalas**
- Descripción: Crear `packages/domain/src/grading/errors/grade-scale.errors.ts` con las clases de error que extienden `DomainError`: `ScaleNameDuplicateError(level, modality, name)`, `ScaleNotFoundError(id)`, `ScaleHasActiveValuesError(id)`, `ValueCodeDuplicateError(scaleId, code)`, `ValueNotFoundError(id)`, `InvalidInternalStatusError(raw)`. Cada una con mensaje descriptivo y `statusCode` HTTP correspondiente (409/404/422).
- Paths:
  - `packages/domain/src/grading/errors/grade-scale.errors.ts`
- REQ: REQ-1 (1.2, 1.4, 1.5), REQ-2 (2.2, 2.3), REQ-8
- ⚠ dep: T06, T07

**[x] T09 — [GREEN] Entidades `GradeScale` y `GradeScaleValue` (reemplazo)**
- Descripción: Crear `packages/domain/src/grading/entities/grade-scale.ts` con las nuevas entidades usando el nuevo diseño (sin `minValue`, `maxValue`, `isConceptual`, `isApproved`, `numericValue`; con `internalStatus: GradeInternalStatus`). Patrón `create()` + `reconstruct()` + getters privados, idéntico a `AttendanceType`. `GradeScaleValue` con invariantes: code via `GradeValueCode`, internalStatus via `GradeInternalStatus`, sortOrder ≥ 0. Luego: **reemplazar** el archivo viejo `packages/domain/src/pedagogy/entities/grade-scale.ts` dejándolo como re-export hacia la nueva ubicación (o eliminarlo y actualizar el index de pedagogy para no exportar más esas clases desde ahí — preferir eliminación para no mantener doble fuente). Actualizar `packages/domain/src/pedagogy/index.ts` para eliminar los exports de `GradeScale`, `GradeScaleValue`, `GradeScaleProps`, `GradeScaleValueProps`, `GradeScaleRepository`. Actualizar `packages/domain/src/pedagogy/__tests__/entities/pedagogy.test.ts` eliminando/moviendo los tests de `GradeScale` y `GradeScaleValue` que ahora viven en `grading/__tests__/`. Los tests de T05 deben pasar con GREEN.
- Paths:
  - `packages/domain/src/grading/entities/grade-scale.ts` (NUEVO)
  - `packages/domain/src/pedagogy/entities/grade-scale.ts` (ELIMINAR o re-export temporal)
  - `packages/domain/src/pedagogy/repositories/grade-scale-repository.ts` (ELIMINAR o marcar deprecated)
  - `packages/domain/src/pedagogy/index.ts` (MODIFICAR: eliminar exports de GradeScale)
  - `packages/domain/src/pedagogy/__tests__/entities/pedagogy.test.ts` (MODIFICAR: eliminar tests GradeScale)
- REQ: REQ-1, REQ-2, REQ-3
- ⚠ dep: T06, T07, T08

**[x] T10 — [GREEN] Puerto `GradeScaleRepository` (interface)**
- Descripción: Crear `packages/domain/src/grading/repositories/grade-scale.repository.ts` con la interface `GradeScaleRepository` definida en el design: `findById`, `list(filters?)`, `existsByName`, `countActiveValues`, `save`, `softDelete`, `findValueById`, `saveValue`, `softDeleteValue`, `existsValueCode`. Tipos de retorno usando las nuevas entidades de `grading/`.
- Paths:
  - `packages/domain/src/grading/repositories/grade-scale.repository.ts`
- REQ: REQ-1, REQ-2, REQ-3
- ⚠ dep: T09

**[x] T11 — [GREEN] Index del módulo grading en domain**
- Descripción: Crear `packages/domain/src/grading/index.ts` exportando todos los VOs, entidades, errores y repositorios del módulo grading creados en T06-T10. Actualizar `packages/domain/src/index.ts` (root del paquete) para re-exportar desde `./grading`. Verificar que el paquete `@educandow/domain` exporta correctamente las nuevas clases.
- Paths:
  - `packages/domain/src/grading/index.ts` (NUEVO)
  - `packages/domain/src/index.ts` (MODIFICAR: agregar re-export grading)
- REQ: todos los de 1a-B
- ⚠ dep: T10

**[x] T12 — [GATE 1a-B] Tests dominio escalas + build package**
- Descripción: Ejecutar `cd packages/domain && npx jest --testPathPattern="grading"`. Todos los tests de T05 deben pasar. Ejecutar `cd packages/domain && npm run build` (o tsc). Verificar que no quedan referencias rotas a `GradeScale` desde pedagogy. El gate bloquea el inicio de 1a-C.
- Paths: (verificación)
- REQ: todos los de 1a-B
- ⚠ dep: T05 .. T11

---

### Sub-batch 1a-C: Aplicación + Infraestructura escalas (~420 líneas productivas)

> TDD: tests de use cases primero (T13), luego implementación (T14-T15). Tests de repo (T16), luego repo (T17).
> ⚠ dep sub-batch: T12 (GATE 1a-B)

---

**[x] T13 — [RED] Tests de use cases de escalas**
- Descripción: Crear `api/src/application/grading/__tests__/grade-scale.use-cases.test.ts` con repo fake en memoria. Casos mínimos: (a) `CreateGradeScaleUseCase` — crea escala exitosamente; rechaza con `ScaleNameDuplicateError` si nombre duplicado por level+modality. (b) `UpdateGradeScaleUseCase` — actualiza nombre; retorna `ScaleNotFoundError` si no existe. (c) `DeleteGradeScaleUseCase` — soft-delete exitoso; retorna `ScaleHasActiveValuesError` si tiene valores activos; `ScaleNotFoundError` si no existe. (d) `CreateGradeScaleValueUseCase` — crea valor; `ValueCodeDuplicateError` si code duplicado. (e) `DeleteGradeScaleValueUseCase` — soft-delete valor; `ValueNotFoundError` si no existe. Todos deben fallar (RED).
- Paths:
  - `api/src/application/grading/__tests__/grade-scale.use-cases.test.ts`
- REQ: REQ-1 (1.1-1.5), REQ-2 (2.1-2.6)

**[x] T14 — [GREEN] Use case `grade-scale.use-cases.ts`**
- Descripción: Crear `api/src/application/grading/use-cases/grade-scale.use-cases.ts` con `CreateGradeScaleUseCase`, `UpdateGradeScaleUseCase`, `DeleteGradeScaleUseCase` (chequea `countActiveValues > 0` → `ScaleHasActiveValuesError`), `ListGradeScalesUseCase`, `GetGradeScaleUseCase`. Patrón idéntico a `attendance-type.use-cases.ts`: `@Injectable`, `Result<T, DomainError>`, constructor recibe repository por token DI. Los tests de T13 para escalas deben pasar GREEN.
- Paths:
  - `api/src/application/grading/use-cases/grade-scale.use-cases.ts`
- REQ: REQ-1, REQ-3
- ⚠ dep: T13

**[x] T15 — [GREEN] Use case `grade-scale-value.use-cases.ts`**
- Descripción: Crear `api/src/application/grading/use-cases/grade-scale-value.use-cases.ts` con `CreateGradeScaleValueUseCase`, `UpdateGradeScaleValueUseCase`, `DeleteGradeScaleValueUseCase`. Validaciones: code duplicado via `existsValueCode`, `internalStatus` via `GradeInternalStatus.create()`. Los tests de T13 para valores deben pasar GREEN.
- Paths:
  - `api/src/application/grading/use-cases/grade-scale-value.use-cases.ts`
- REQ: REQ-2
- ⚠ dep: T13, T14

**[x] T16 — [RED] Tests del repositorio Prisma de escalas**
- Descripción: Crear `api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-grade-scale.repository.test.ts`. Test de integración mínimo con Nest Test module + `TenantContext` mockeado: verificar que `list()` mapea correctamente `internalStatus` a dominio; `save()` hace upsert; `countActiveValues()` filtra `deletedAt=null`. Deben fallar (RED).
- Paths:
  - `api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-grade-scale.repository.test.ts`
- REQ: REQ-1, REQ-2, REQ-3

**[x] T17 — [GREEN] `PrismaGradeScaleRepository`**
- Descripción: Crear `api/src/infrastructure/persistence/prisma/repositories/prisma-grade-scale.repository.ts`. Implementa `GradeScaleRepository`. Usa `TenantContext.getClient()` para obtener el cliente Prisma tenant (mismo patrón que `PrismaAttendanceTypeRepository`). Métodos: `findById` (include values ordenados por sortOrder), `list(filters)` (filtros level/modality/active, include values), `existsByName` (con excludeId opcional), `countActiveValues` (where deletedAt=null), `save` (upsert escala), `softDelete`, `findValueById`, `saveValue` (upsert value), `softDeleteValue`, `existsValueCode`. `toDomain()` y `toDomainValue()` privados. Los tests de T16 deben pasar GREEN.
- Paths:
  - `api/src/infrastructure/persistence/prisma/repositories/prisma-grade-scale.repository.ts`
- REQ: REQ-1, REQ-2, REQ-3
- ⚠ dep: T16

**[x] T18 — [GATE 1a-C] Tests aplicación + infra escalas + build api**
- Descripción: Ejecutar `cd api && npx jest --testPathPattern="grading"`. Todos los tests de T13 y T16 deben pasar. Ejecutar `cd api && npm run build`. Sin errores de compilación. El gate bloquea el inicio de 1a-D.
- Paths: (verificación)
- REQ: todos los de 1a-C
- ⚠ dep: T13 .. T17

---

### Sub-batch 1a-D: Presentación escalas (~400 líneas productivas)

> TDD: tests DTOs y controller primero (T19), luego implementación (T20-T22).
> ⚠ dep sub-batch: T18 (GATE 1a-C)

---

**[x] T19 — [RED] Tests DTOs de escalas + tests controller escalas**
- Descripción: Crear `api/src/presentation/grading/__tests__/dto-scales.test.ts`. Casos DTO: (a) `CreateGradeScaleDTO` válido pasa; (b) sin `name` devuelve 422; (c) sin `level` devuelve 422; (d) `level` fuera de rango (ej. 5) rechazado. (e) `CreateGradeScaleValueDTO`: `internalStatus` con valor fuera del enum devuelve 422 (escenario 2.2); `code` vacío devuelve 422 (escenario 8.3). Crear `api/src/presentation/grading/__tests__/grading-scales.controller.test.ts`. Casos controller (Nest test module + repo/use-cases mockeados): (a) POST 201 Created al crear escala válida; (b) POST 409 Conflict al duplicado; (c) GET 200 al listar; (d) GET 404 al ID inexistente; (e) DELETE 204 exitoso; (f) DELETE 409 con valores activos; (g) GET 403 sin módulo GRADING_CONFIG. Todos deben fallar (RED).
- Paths:
  - `api/src/presentation/grading/__tests__/dto-scales.test.ts`
  - `api/src/presentation/grading/__tests__/grading-scales.controller.test.ts`
- REQ: REQ-1 (1.1-1.5), REQ-2 (2.1-2.6), REQ-7 (7.3), REQ-8

**[x] T20 — [GREEN] DTOs Zod de escalas (4 DTOs)**
- Descripción: Crear los 4 DTOs Zod: `api/src/presentation/grading/dto/create-grade-scale.dto.ts` (campos: `name: z.string().min(1)`, `level: z.number().int().min(1).max(4)`, `modality: z.number().int().min(0).max(2).default(0)`), `api/src/presentation/grading/dto/update-grade-scale.dto.ts` (mismos campos opcionales), `api/src/presentation/grading/dto/create-grade-scale-value.dto.ts` (campos: `code: z.string().min(1)`, `label: z.string().min(1)`, `internalStatus: z.enum(['APROBADO','NO_APROBADO','EN_PROCESO','LIBRE'])`, `sortOrder: z.number().int().min(0).default(0)`), `api/src/presentation/grading/dto/update-grade-scale-value.dto.ts` (mismos opcionales). El `z.enum` en `internalStatus` genera automáticamente 422 vía `ZodValidationPipe`. Los tests de T19 para DTOs deben pasar GREEN.
- Paths:
  - `api/src/presentation/grading/dto/create-grade-scale.dto.ts`
  - `api/src/presentation/grading/dto/update-grade-scale.dto.ts`
  - `api/src/presentation/grading/dto/create-grade-scale-value.dto.ts`
  - `api/src/presentation/grading/dto/update-grade-scale-value.dto.ts`
- REQ: REQ-1, REQ-2, REQ-8
- ⚠ dep: T19

**[x] T21 — [GREEN] `GradingScalesController`**
- Descripción: Crear `api/src/presentation/grading/grading-scales.controller.ts`. Rutas: `POST /grading/scales` (201), `GET /grading/scales` (filtros `?level`, `?modality`, `?institutionId` para ROOT), `GET /grading/scales/:id` (200/404), `PATCH /grading/scales/:id` (200), `DELETE /grading/scales/:id` (204), `POST /grading/scales/:id/values` (201), `PATCH /grading/scales/:id/values/:valueId` (200), `DELETE /grading/scales/:id/values/:valueId` (204). Cada método con `@Roles('ROOT', { module: 'GRADING_CONFIG', action: '...' })` y `@UseGuards(AuthGuard, RolesGuard)`. `toResponse()` helper privado. Mapeo `result.isErr() → throw` siguiendo el filtro global de excepciones. Los tests de T19 para controller deben pasar GREEN.
- Paths:
  - `api/src/presentation/grading/grading-scales.controller.ts`
- REQ: REQ-1, REQ-2, REQ-3, REQ-7, REQ-8
- ⚠ dep: T19, T20

**[x] T22 — [GREEN] `GradingModule` (escalas) + registro en `AppModule`**
- Descripción: Crear `api/src/presentation/grading/grading.module.ts` con `imports: [AuthModule]`, `controllers: [GradingScalesController]`, `providers`: `PrismaService`, `PrismaGradeScaleRepository`, token `'GradeScaleRepository'`, use cases de escalas con `useFactory`. Mismo patrón que `attendance-type.module.ts`. Modificar `api/src/app.module.ts` para importar `GradingModule` (+3 líneas).
- Paths:
  - `api/src/presentation/grading/grading.module.ts`
  - `api/src/app.module.ts`
- REQ: REQ-1, REQ-2, REQ-3, REQ-7
- ⚠ dep: T21

**[x] T23 — [GATE 1a-D] Tests presentación + build API completo**
- Descripción: Ejecutar `cd api && npx jest --testPathPattern="grading"`. Todos los tests de T19 deben pasar. Ejecutar `cd api && npm run build`. Verificar endpoints vía smoke test opcional (`curl POST /grading/scales` en entorno local). El gate bloquea el inicio de 1a-E.
- Paths: (verificación)
- REQ: todos los de 1a-D
- ⚠ dep: T19 .. T22

---

### Sub-batch 1a-E: Frontend — Gestión de escalas (~390 líneas productivas)

> TDD: test de página primero (T24), luego implementación (T25-T26).
> ⚠ dep sub-batch: T23 (GATE 1a-D) para que la API esté disponible; puede iniciarse en paralelo con 1a-D si se mockea la API.

---

**[x] T24 — [RED] Test de la página `grading-scales.tsx`**
- Descripción: Crear `web/src/pages/dashboard/__tests__/grading-scales.test.tsx` con React Testing Library. Casos mínimos: (a) muestra mensaje "Seleccioná una institución" si usuario ROOT y no hay institución seleccionada; (b) renderiza tabla de escalas con columnas name/level/modality; (c) formulario de creación tiene campos name, level, modality; (d) el select de `internalStatus` en el formulario de valor tiene exactamente 4 opciones (`APROBADO`, `NO_APROBADO`, `EN_PROCESO`, `LIBRE`); (e) submit del formulario llama a `POST /grading/scales`; (f) tabla de valores de una escala muestra code, label, internalStatus ordenados por sortOrder. Todos deben fallar (RED).
- Paths:
  - `web/src/pages/dashboard/__tests__/grading-scales.test.tsx`
- REQ: REQ-1, REQ-2, REQ-3, REQ-7

**[x] T25 — [GREEN] Página `grading-scales.tsx`**
- Descripción: Crear `web/src/pages/dashboard/grading-scales.tsx`. Espejo exacto de `attendance-types.tsx` en estructura (selector ROOT al tope, `useApiList`, `useApiDelete`, guard "Seleccioná una institución", Card + Table). Diferencias específicas: (1) Filtros por nivel y modalidad. (2) Tabla expandible o sección inline por escala que muestra sus `GradeScaleValue` ordenados por `sortOrder` (code, label, internalStatus como badge, sortOrder). (3) Formulario de valor con `<select>` fijo de 4 opciones de `internalStatus`. (4) `?institutionId` en requests cuando usuario es ROOT (idéntico al patrón existente). Los tests de T24 deben pasar GREEN.
- Paths:
  - `web/src/pages/dashboard/grading-scales.tsx`
- REQ: REQ-1, REQ-2, REQ-3, REQ-7
- ⚠ dep: T24

**[x] T26 — [GREEN] Ruta `/grading-scales` + entrada menú lateral**
- Descripción: En `web/src/App.tsx` agregar ruta `<Route path="/grading-scales" element={<GradingScalesPage />} />` (lazy import). En `web/src/components/layout/sidebar.tsx` agregar ítem en el grupo **Sistema** (junto a "Tipos de asistencia"): `{ path: '/grading-scales', label: 'Escalas de Calificación', moduleCode: 'GRADING_CONFIG' }`. Verificar que el guard de visibilidad por módulo funciona (oculto para usuarios sin GRADING_CONFIG).
- Paths:
  - `web/src/App.tsx`
  - `web/src/components/layout/sidebar.tsx`
- REQ: REQ-7 (acceso por módulo en menú)
- ⚠ dep: T25

**[x] T27 — [GATE 1a-E] Tests front escalas + build web**
- Descripción: Ejecutar `cd web && npx vitest run --reporter=verbose`. Todos los tests de T24 deben pasar. Ejecutar `cd web && npm run build`. Sin errores TypeScript ni bundle. **GATE FINAL DE ENTREGA 1a**: la entrega está completa cuando este gate pasa. Puede abrirse PR de 1a de forma independiente.
- Paths: (verificación)
- REQ: todos los de 1a
- ⚠ dep: T24 .. T26

---

## ENTREGA 1b — PERÍODOS DE CALIFICACIÓN

> Prerequisito: Entrega 1a completa (GATE T27 pasado).
> 1b es independiente de 1a en modelo de datos pero comparte el mismo `GradingModule` de presentación.

---

### Sub-batch 1b-A: Schema Prisma + Migración SQL + Seed períodos (~150 líneas)

> Solo CREA tablas nuevas. No toca lo de 1a.
> ⚠ dep sub-batch: T27 (GATE final 1a)

---

**T28 — Agregar modelos de períodos en schema tenant**
- Descripción: En `api/prisma_tenant/schema.prisma` agregar los 3 modelos nuevos: `GradingPeriodTemplate` (`id`, `name`, `level: Int`, `modality: Int @default(0)`, `active: Boolean @default(true)`, `deletedAt DateTime?`, timestamps; `@@unique([level, modality, name])`; relación `items GradingPeriodTemplateItem[]`), `GradingPeriodTemplateItem` (`id`, `templateId String`, `name String`, `sortOrder Int ≥1`; `@@unique([templateId, sortOrder])`, `@@unique([templateId, name])`; `template` → `GradingPeriodTemplate`, `dates GradingPeriodDate[]`), `GradingPeriodDate` (`id`, `itemId String @map("template_item_id")`, `cycleId String` → `AcademicCycle.uuid`, `startDate DateTime @map("start_date")`, `endDate DateTime @map("end_date")`, timestamps; `@@unique([itemId, cycleId])`). Agregar relación inversa en `AcademicCycle`: `gradingPeriodDates GradingPeriodDate[]`. Los campos `firstBim..fourthBim` de `AcademicCycle` ya tienen comentario `@deprecated` de T01 — no modificar nada más.
- Paths:
  - `api/prisma_tenant/schema.prisma`
- REQ: REQ-4, REQ-5, REQ-6 (modelo base)

**T29 — Escribir migración SQL para períodos**
- Descripción: Crear `api/prisma_tenant/migrations/YYYYMMDD_grading_foundations_periods/migration.sql`. Crear las 3 tablas con sus columnas, constraints de FK (`template_item_id → grading_period_template_items.id ON DELETE CASCADE`, `cycle_id → academic_cycles.uuid ON DELETE CASCADE`), índices (`CREATE INDEX ON grading_period_dates (cycle_id)`, etc.) y constraints únicos (`UNIQUE(template_id, sort_order)`, `UNIQUE(template_item_id, cycle_id)`, etc.). Sin TRUNCATE ni ALTER de tablas existentes — solo CREATE TABLE.
- Paths:
  - `api/prisma_tenant/migrations/YYYYMMDD_grading_foundations_periods/migration.sql`
- REQ: REQ-4, REQ-5
- ⚠ dep: T28

**T30 — Agregar `seedGradingPeriods` al seed**
- Descripción: En `api/prisma/seed.ts` agregar la función `seedGradingPeriods(prisma: TenantPrismaClient)` que crea: plantilla `"Trimestral"` (level=2 Primario, modality=0) con ítems `["1° Trimestre"(1), "2° Trimestre"(2), "3° Trimestre"(3)]`; plantilla `"Trimestral Secundaria"` (level=3) con los mismos 3 ítems; plantilla `"Cuatrimestral Terciario"` (level=4) con ítems `["1° Cuatrimestre"(1), "2° Cuatrimestre"(2)]`. Sin cargar `GradingPeriodDate` (las fechas se cargan por ciclo). Llamar `seedGradingPeriods(prisma)` desde la función `main` del seed.
- Paths:
  - `api/prisma/seed.ts`
- REQ: REQ-4
- ⚠ dep: T28

**T31 — [GATE 1b-A] Build schema + cliente Prisma tenant (períodos)**
- Descripción: Ejecutar `cd api && npx prisma generate --schema=prisma_tenant/schema.prisma`. Verificar que los 3 nuevos modelos y la relación inversa de `AcademicCycle` están en el cliente generado. Ejecutar `cd api && npm run build` sin errores. El gate bloquea el inicio de 1b-B.
- Paths: (verificación)
- REQ: todos los de 1b-A
- ⚠ dep: T28, T29, T30

---

### Sub-batch 1b-B: Dominio períodos — entidades, VOs, errores, puerto (~415 líneas productivas)

> TDD estricto. T32 primero (RED), luego T33-T37 (GREEN).
> ⚠ dep sub-batch: T31 (GATE 1b-A)

---

**T32 — [RED] Tests unitarios de VOs y entidades de períodos**
- Descripción: Crear `packages/domain/src/grading/__tests__/value-objects/period-sort-order.test.ts` (3 casos: sortOrder ≥ 1 válido; sortOrder = 0 inválido; sortOrder negativo inválido). Crear `packages/domain/src/grading/__tests__/entities/grading-period-template.test.ts` (6 casos: crear plantilla válida con 3 ítems; ítems con sortOrder duplicado lanza `PeriodSortOrderDuplicateError`; ítems con name duplicado lanza error; plantilla vacía se puede crear; reconstruct preserva ítems; softDelete). Crear `packages/domain/src/grading/__tests__/entities/grading-period-date.test.ts` (6 casos: fechas válidas dentro del ciclo pasan; startDate ≥ endDate falla con `PeriodDateInvalidRangeError`; fecha fuera del rango del ciclo falla con `PeriodDateOutOfCycleRangeError`; solapamiento con otro período del mismo ciclo falla con `PeriodDateOverlapError`; huecos entre períodos son permitidos; ciclos distintos son independientes). Todos deben fallar (RED).
- Paths:
  - `packages/domain/src/grading/__tests__/value-objects/period-sort-order.test.ts`
  - `packages/domain/src/grading/__tests__/entities/grading-period-template.test.ts`
  - `packages/domain/src/grading/__tests__/entities/grading-period-date.test.ts`
- REQ: REQ-4 (4.1-4.3), REQ-5 (5.1-5.3), REQ-6 (6.1-6.3)

**T33 — [GREEN] VO `PeriodSortOrder`**
- Descripción: Crear `packages/domain/src/grading/value-objects/period-sort-order.ts`. Valida entero ≥ 1 (no acepta 0 ni negativos). Método `create(n)`: `Result<PeriodSortOrder, PeriodSortOrderInvalidError>`. Los tests de T32 para este VO deben pasar GREEN.
- Paths:
  - `packages/domain/src/grading/value-objects/period-sort-order.ts`
- REQ: REQ-4 (invariante 5: sortOrder ≥ 1)
- ⚠ dep: T32

**T34 — [GREEN] Errores de dominio de períodos**
- Descripción: Ampliar `packages/domain/src/grading/errors/` con `grading-period.errors.ts`: `PeriodTemplateNameDuplicateError(level, modality, name)`, `PeriodTemplateNotFoundError(id)`, `PeriodSortOrderDuplicateError(sortOrders)`, `PeriodTemplateHasDatesError(id)`, `PeriodDateOutOfCycleRangeError(date, cycleStart, cycleEnd)`, `PeriodDateOverlapError(item1, item2)`, `PeriodDateInvalidRangeError(startDate, endDate)`, `PeriodSortOrderInvalidError(value)`. Cada una con `statusCode` HTTP correspondiente.
- Paths:
  - `packages/domain/src/grading/errors/grading-period.errors.ts`
- REQ: REQ-4 (4.2-4.3), REQ-5, REQ-6 (6.1-6.3), REQ-8
- ⚠ dep: T33

**T35 — [GREEN] Entidades `GradingPeriodTemplate` y `GradingPeriodTemplateItem`**
- Descripción: Crear `packages/domain/src/grading/entities/grading-period-template.ts` con `GradingPeriodTemplate` (agregado raíz) y `GradingPeriodTemplateItem`. `GradingPeriodTemplate.create()` acepta `items[]` y llama a `assertItemsValid()` que verifica: sortOrder únicos entre ítems, sortOrder ≥ 1, names únicos. `reconstruct()` no re-valida. Los tests de T32 para templates deben pasar GREEN.
- Paths:
  - `packages/domain/src/grading/entities/grading-period-template.ts`
- REQ: REQ-4 (4.1, 4.3)
- ⚠ dep: T33, T34

**T36 — [GREEN] Entidad `GradingPeriodDate` con validación de fechas**
- Descripción: Crear `packages/domain/src/grading/entities/grading-period-date.ts` con `GradingPeriodDate`. Método estático `create(props, cycleStart, cycleEnd, siblings: GradingPeriodDate[])`: (1) `startDate < endDate` o lanza `PeriodDateInvalidRangeError`; (2) `startDate ≥ cycleStart && endDate ≤ cycleEnd` o lanza `PeriodDateOutOfCycleRangeError`; (3) no solapamiento con ningún elemento de `siblings` (lanza `PeriodDateOverlapError` si hay intersección). Los huecos entre períodos son explícitamente PERMITIDOS (no se validan). Lógica de solapamiento: dos rangos [a,b] y [c,d] se solapan si `a < d && c < b`. Los tests de T32 para fechas deben pasar GREEN.
- Paths:
  - `packages/domain/src/grading/entities/grading-period-date.ts`
- REQ: REQ-5 (5.1-5.3), REQ-6 (6.1-6.3)
- ⚠ dep: T34

**T37 — [GREEN] Puerto `GradingPeriodRepository` + actualizar index grading**
- Descripción: Crear `packages/domain/src/grading/repositories/grading-period.repository.ts` con la interface `GradingPeriodRepository`: `findTemplateById(id)` (con ítems), `listTemplates(filters?)`, `existsTemplateName(level, modality, name, excludeId?)`, `saveTemplate(t)` (upsert template + ítems en tx), `countDatesForTemplate(templateId)`, `softDeleteTemplate(id)`, `listDates(templateId, cycleId)`, `saveDates(itemId, cycleId, dates)`, `findDatesByCycle(templateId, cycleId)` (para overlap check). Actualizar `packages/domain/src/grading/index.ts` para exportar los nuevos VO, entidades, errores y puerto de períodos.
- Paths:
  - `packages/domain/src/grading/repositories/grading-period.repository.ts`
  - `packages/domain/src/grading/index.ts` (MODIFICAR: agregar exports períodos)
- REQ: REQ-4, REQ-5, REQ-6
- ⚠ dep: T35, T36

**T38 — [GATE 1b-B] Tests dominio períodos + build package**
- Descripción: Ejecutar `cd packages/domain && npx jest --testPathPattern="grading"`. Todos los tests de T05 (escalas) y T32 (períodos) deben pasar. Ejecutar `cd packages/domain && npm run build`. El gate bloquea el inicio de 1b-C.
- Paths: (verificación)
- REQ: todos los de 1b-B
- ⚠ dep: T32 .. T37

---

### Sub-batch 1b-C: Aplicación + Infraestructura períodos (~440 líneas productivas)

> TDD: tests use cases primero (T39), luego implementación (T40-T41). Tests repo (T42), repo (T43-T44).
> ⚠ dep sub-batch: T38 (GATE 1b-B)

---

**T39 — [RED] Tests de use cases de períodos**
- Descripción: Crear `api/src/application/grading/__tests__/grading-period.use-cases.test.ts` con repo fake en memoria y `AcademicCycleRepository` mockeado. Casos: (a) `CreateGradingPeriodTemplateUseCase` — crea plantilla con 3 ítems; `PeriodTemplateNameDuplicateError` si nombre duplicado; `PeriodSortOrderDuplicateError` si ítems con orden repetido. (b) `DeleteGradingPeriodTemplateUseCase` — soft-delete exitoso; `PeriodTemplateHasDatesError` si tiene fechas asociadas. (c) `UpsertPeriodDatesUseCase` — upsert exitoso; `PeriodDateInvalidRangeError` si startDate ≥ endDate; `PeriodDateOutOfCycleRangeError` si fecha fuera del rango del ciclo; `PeriodDateOverlapError` si solapamiento con período existente del mismo ciclo. Todos RED.
- Paths:
  - `api/src/application/grading/__tests__/grading-period.use-cases.test.ts`
- REQ: REQ-4 (4.1-4.5), REQ-5 (5.1-5.3), REQ-6 (6.1-6.3)

**T40 — [GREEN] Use case `grading-period-template.use-cases.ts`**
- Descripción: Crear `api/src/application/grading/use-cases/grading-period-template.use-cases.ts` con `CreateGradingPeriodTemplateUseCase`, `UpdateGradingPeriodTemplateUseCase`, `DeleteGradingPeriodTemplateUseCase` (chequea `countDatesForTemplate > 0` → `PeriodTemplateHasDatesError`), `ListGradingPeriodTemplatesUseCase`, `GetGradingPeriodTemplateUseCase`. Los tests de T39 para templates deben pasar GREEN.
- Paths:
  - `api/src/application/grading/use-cases/grading-period-template.use-cases.ts`
- REQ: REQ-4
- ⚠ dep: T39

**T41 — [GREEN] Use case `grading-period-date.use-cases.ts`**
- Descripción: Crear `api/src/application/grading/use-cases/grading-period-date.use-cases.ts` con `UpsertPeriodDatesUseCase` y `ListPeriodDatesUseCase`. `UpsertPeriodDatesUseCase.execute(templateId, cycleId, datesInput[])`: (1) carga el `AcademicCycle` via `AcademicCycleRepository` para obtener rango; (2) carga fechas existentes del ciclo para el templateId (`findDatesByCycle`); (3) por cada ítem, llama a `GradingPeriodDate.create(props, cycleStart, cycleEnd, siblings)` para validar; (4) guarda todas las fechas en transacción. Los tests de T39 para fechas deben pasar GREEN.
- Paths:
  - `api/src/application/grading/use-cases/grading-period-date.use-cases.ts`
- REQ: REQ-5, REQ-6
- ⚠ dep: T39, T40

**T42 — [RED] Tests del repositorio Prisma de períodos**
- Descripción: Crear `api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-grading-period.repository.test.ts`. Casos: `saveTemplate` hace upsert con transacción para template + items; `findDatesByCycle` retorna fechas filtradas por cycleId; `countDatesForTemplate` cuenta correctamente. Deben fallar (RED).
- Paths:
  - `api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-grading-period.repository.test.ts`
- REQ: REQ-4, REQ-5

**T43 — [GREEN] `PrismaGradingPeriodRepository`**
- Descripción: Crear `api/src/infrastructure/persistence/prisma/repositories/prisma-grading-period.repository.ts`. Implementa `GradingPeriodRepository`. Usa `TenantContext.getClient()`. `saveTemplate(t)`: upsert template + borrar-y-recrear ítems en `$transaction`. `findTemplateById`: include items ordenados por sortOrder. `findDatesByCycle(templateId, cycleId)`: join template_items para filtrar por templateId y cycleId. `saveDates`: upsert individual por `[itemId, cycleId]`. Los tests de T42 deben pasar GREEN.
- Paths:
  - `api/src/infrastructure/persistence/prisma/repositories/prisma-grading-period.repository.ts`
- REQ: REQ-4, REQ-5, REQ-6
- ⚠ dep: T42

**T44 — [GREEN] Ampliar `GradingModule` con períodos y ciclos**
- Descripción: Actualizar `api/src/presentation/grading/grading.module.ts` para agregar: `PrismaGradingPeriodRepository`, token `'GradingPeriodRepository'`, `PrismaAcademicCycleRepository` (ya existente en infra) con token `'AcademicCycleRepository'`, use cases de template y fechas con `useFactory`. El `AcademicCycleRepository` se necesita en `UpsertPeriodDatesUseCase` para validar rango del ciclo.
- Paths:
  - `api/src/presentation/grading/grading.module.ts`
- REQ: REQ-5, REQ-6
- ⚠ dep: T43

**T45 — [GATE 1b-C] Tests aplicación + infra períodos + build api**
- Descripción: Ejecutar `cd api && npx jest --testPathPattern="grading"`. Todos los tests de T13, T16, T39 y T42 deben pasar. Ejecutar `cd api && npm run build` sin errores. El gate bloquea el inicio de 1b-D.
- Paths: (verificación)
- REQ: todos los de 1b-C
- ⚠ dep: T39 .. T44

---

### Sub-batch 1b-D: Presentación períodos (~350 líneas productivas)

> TDD: tests primero (T46), luego implementación (T47-T48).
> ⚠ dep sub-batch: T45 (GATE 1b-C)

---

**T46 — [RED] Tests DTOs de períodos + tests controller períodos**
- Descripción: Crear `api/src/presentation/grading/__tests__/dto-periods.test.ts`. Casos DTO: (a) `CreatePeriodTemplateDTO` válido; (b) sin `name` → 422; (c) ítems con `sortOrder` duplicado → 422 (escenario 4.3); (d) `UpsertPeriodDatesDTO`: `startDate` posterior a `endDate` → 422 (escenario 6.3). Crear `api/src/presentation/grading/__tests__/grading-periods.controller.test.ts`. Casos: (a) POST 201 crear plantilla con 3 ítems; (b) POST 409 nombre duplicado; (c) PUT/POST fechas 201 exitoso; (d) fechas fuera de rango → 422; (e) solapamiento → 422; (f) DELETE plantilla con fechas → 409; (g) GET 403 sin GRADING_CONFIG. Todos RED.
- Paths:
  - `api/src/presentation/grading/__tests__/dto-periods.test.ts`
  - `api/src/presentation/grading/__tests__/grading-periods.controller.test.ts`
- REQ: REQ-4 (4.1-4.5), REQ-5 (5.1-5.3), REQ-6 (6.1-6.3), REQ-7, REQ-8

**T47 — [GREEN] DTOs Zod de períodos (3 DTOs)**
- Descripción: Crear `api/src/presentation/grading/dto/create-period-template.dto.ts` (campos: `name: z.string().min(1)`, `level: z.number().int().min(1).max(4)`, `modality: z.number().int().min(0).max(2).default(0)`, `items: z.array(z.object({ name: z.string().min(1), sortOrder: z.number().int().min(1) })).min(1)` con refinement de sortOrder únicos), `update-period-template.dto.ts` (mismos campos opcionales), `upsert-period-dates.dto.ts` (campos: `templateId: z.string().uuid()`, `cycleId: z.string().uuid()`, `dates: z.array(z.object({ itemId: z.string().uuid(), startDate: z.coerce.date(), endDate: z.coerce.date() }))` con refinement `startDate < endDate`). Los tests de T46 para DTOs deben pasar GREEN.
- Paths:
  - `api/src/presentation/grading/dto/create-period-template.dto.ts`
  - `api/src/presentation/grading/dto/update-period-template.dto.ts`
  - `api/src/presentation/grading/dto/upsert-period-dates.dto.ts`
- REQ: REQ-4, REQ-5, REQ-6, REQ-8
- ⚠ dep: T46

**T48 — [GREEN] `GradingPeriodsController`**
- Descripción: Crear `api/src/presentation/grading/grading-periods.controller.ts`. Rutas: `POST /grading/period-templates` (201), `GET /grading/period-templates` (con `?level`, `?modality`), `GET /grading/period-templates/:id`, `PATCH /grading/period-templates/:id`, `DELETE /grading/period-templates/:id` (204), `GET /grading/period-templates/:id/dates?cycleId=...` (200), `PUT /grading/period-templates/:id/dates` (upsert, 200/201). `@Roles('ROOT', { module: 'GRADING_CONFIG', action: '...' })` en cada método. Actualizar `grading.module.ts` para agregar `GradingPeriodsController` al array `controllers`. Los tests de T46 para controller deben pasar GREEN.
- Paths:
  - `api/src/presentation/grading/grading-periods.controller.ts`
  - `api/src/presentation/grading/grading.module.ts` (MODIFICAR: agregar controller)
- REQ: REQ-4, REQ-5, REQ-6, REQ-7, REQ-8
- ⚠ dep: T46, T47

**T49 — [GATE 1b-D] Tests presentación períodos + build API completo**
- Descripción: Ejecutar `cd api && npx jest`. Todos los tests de grading (T13, T16, T19, T39, T42, T46) deben pasar. Ejecutar `cd api && npm run build`. Sin errores. El gate bloquea el inicio de 1b-E.
- Paths: (verificación)
- REQ: todos los de 1b-D
- ⚠ dep: T46 .. T48

---

### Sub-batch 1b-E: Frontend — Gestión de períodos (~420 líneas productivas)

> TDD: test primero (T50), luego implementación (T51-T52).
> ⚠ dep sub-batch: T49 (GATE 1b-D)

---

**T50 — [RED] Test de la página `grading-periods.tsx`**
- Descripción: Crear `web/src/pages/dashboard/__tests__/grading-periods.test.tsx`. Casos mínimos: (a) renderiza lista de plantillas con columnas nombre/nivel/modalidad; (b) muestra "Seleccioná una institución" si ROOT sin selección; (c) formulario de plantilla tiene campo de nombre, nivel, modalidad y sección de ítems (nombre + sortOrder); (d) agregar ítem al formulario agrega una fila dinámica; (e) sección de fechas aparece cuando se selecciona un ciclo lectivo; (f) los campos de fecha por ítem (startDate, endDate) están presentes en el formulario de fechas; (g) submit de fechas llama a `PUT /grading/period-templates/:id/dates`. Todos RED.
- Paths:
  - `web/src/pages/dashboard/__tests__/grading-periods.test.tsx`
- REQ: REQ-4, REQ-5, REQ-7

**T51 — [GREEN] Página `grading-periods.tsx`**
- Descripción: Crear `web/src/pages/dashboard/grading-periods.tsx`. Estructura: (1) Selector ROOT de institución (idéntico a `grading-scales.tsx`). (2) Tabla de plantillas con columnas: nombre, nivel, modalidad, cantidad de ítems, acciones. (3) Card expandible o modal para gestionar ítems de una plantilla (nombre + sortOrder, agregar/eliminar ítems dinámicamente). (4) Sección de CARGA DE FECHAS por ciclo: selector `<select>` de `AcademicCycle` via `useApiList('/academic-cycles')`, y una fila por cada ítem de la plantilla con campos `startDate`/`endDate` (tipo `date`). El submit de fechas hace `PUT /grading/period-templates/:id/dates` con `{ cycleId, dates: [{itemId, startDate, endDate}, ...] }`. Los tests de T50 deben pasar GREEN.
- Paths:
  - `web/src/pages/dashboard/grading-periods.tsx`
- REQ: REQ-4, REQ-5, REQ-6, REQ-7
- ⚠ dep: T50

**T52 — [GREEN] Ruta `/grading-periods` + entrada menú lateral**
- Descripción: En `web/src/App.tsx` agregar ruta `<Route path="/grading-periods" element={<GradingPeriodsPage />} />` (lazy import). En `web/src/components/layout/sidebar.tsx` agregar ítem en el grupo **Sistema**: `{ path: '/grading-periods', label: 'Períodos de Calificación', moduleCode: 'GRADING_CONFIG' }`. Guard de visibilidad por módulo GRADING_CONFIG igual al ítem de escalas.
- Paths:
  - `web/src/App.tsx`
  - `web/src/components/layout/sidebar.tsx`
- REQ: REQ-7
- ⚠ dep: T51

**T53 — [GATE 1b-E] Tests front períodos + build web — GATE FINAL ENTREGA 1b**
- Descripción: Ejecutar `cd web && npx vitest run --reporter=verbose`. Todos los tests de T24 y T50 deben pasar. Ejecutar `cd web && npm run build`. Sin errores TypeScript ni bundle. **GATE FINAL DE ENTREGA 1b**: la entrega está completa cuando este gate pasa. Puede abrirse PR de 1b de forma independiente.
- Paths: (verificación)
- REQ: todos los de 1b
- ⚠ dep: T50 .. T52

---

## Mapa de dependencias completo

```
1a:
T01 → T02
T01 → T03
T01,T02,T03 → T04 [GATE 1a-A]
T04 → T05 → T06,T07
T06,T07 → T08 → T09 → T10 → T11
T05..T11 → T12 [GATE 1a-B]
T12 → T13 → T14 → T15
T13 → T16 → T17
T13..T17 → T18 [GATE 1a-C]
T18 → T19 → T20 → T21 → T22
T19..T22 → T23 [GATE 1a-D]
T23 → T24 → T25 → T26
T24..T26 → T27 [GATE FINAL 1a]

1b (requiere T27):
T27 → T28 → T29
T28 → T30
T28..T30 → T31 [GATE 1b-A]
T31 → T32 → T33 → T34 → T35,T36 → T37
T32..T37 → T38 [GATE 1b-B]
T38 → T39 → T40 → T41
T39 → T42 → T43 → T44
T39..T44 → T45 [GATE 1b-C]
T45 → T46 → T47 → T48
T46..T48 → T49 [GATE 1b-D]
T49 → T50 → T51 → T52
T50..T52 → T53 [GATE FINAL 1b]
```

Tareas que pueden correr en paralelo dentro del mismo sub-batch:
- `T06 ‖ T07` (VOs independientes) — ambos necesitan T05
- `T14 ‖ T15` (use cases independientes) — ambos necesitan T13
- `T35 ‖ T36` (entidades independientes) — ambos necesitan T34

---

## Review Workload Forecast

| Sub-batch | Líneas prod. | Líneas tests | Total | PR recomendado |
|---|---|---|---|---|
| 1a-A (Schema+Migración+Seed) | ~190 | 0 | ~190 | incluido en PR 1a |
| 1a-B (Dominio escalas) | ~375 | ~120 | ~495 | incluido en PR 1a |
| 1a-C (App+Infra escalas) | ~420 | ~150 | ~570 | incluido en PR 1a |
| 1a-D (Presentación escalas) | ~400 | ~130 | ~530 | incluido en PR 1a |
| 1a-E (Front escalas) | ~390 | ~80 | ~470 | incluido en PR 1a |
| **Subtotal 1a** | **~1775** | **~480** | **~2255** | **1 PR** |
| 1b-A (Schema+Migración+Seed períodos) | ~150 | 0 | ~150 | incluido en PR 1b |
| 1b-B (Dominio períodos) | ~415 | ~130 | ~545 | incluido en PR 1b |
| 1b-C (App+Infra períodos) | ~440 | ~150 | ~590 | incluido en PR 1b |
| 1b-D (Presentación períodos) | ~350 | ~120 | ~470 | incluido en PR 1b |
| 1b-E (Front períodos) | ~420 | ~80 | ~500 | incluido en PR 1b |
| **Subtotal 1b** | **~1775** | **~480** | **~2255** | **1 PR** |
| **TOTAL** | **~3550** | **~960** | **~4510** | **2 PRs** |

**Chained PRs recommended: Yes** — 2 PRs independientes: PR-1a (Escalas) → PR-1b (Períodos).
**Decision needed before apply: No** — el usuario ya eligió la estrategia de dos entregas secuenciales.
**400-line budget risk**: cada sub-batch individual supera ~400 líneas totales (prod+tests) pero el código productivo de cada uno se mantiene en ~350-440. Aceptable dado que los tests son parte obligatoria del batch (strict TDD).

---

## Resumen de archivos por entrega

### Entrega 1a — archivos nuevos
```
packages/domain/src/grading/value-objects/grade-internal-status.ts
packages/domain/src/grading/value-objects/grade-value-code.ts
packages/domain/src/grading/entities/grade-scale.ts
packages/domain/src/grading/errors/grade-scale.errors.ts
packages/domain/src/grading/repositories/grade-scale.repository.ts
packages/domain/src/grading/index.ts
packages/domain/src/grading/__tests__/value-objects/grade-internal-status.test.ts
packages/domain/src/grading/__tests__/value-objects/grade-value-code.test.ts
packages/domain/src/grading/__tests__/entities/grade-scale.test.ts
packages/domain/src/grading/__tests__/entities/grade-scale-value.test.ts
api/prisma_tenant/migrations/YYYYMMDD_grading_foundations_scales/migration.sql
api/src/application/grading/use-cases/grade-scale.use-cases.ts
api/src/application/grading/use-cases/grade-scale-value.use-cases.ts
api/src/application/grading/__tests__/grade-scale.use-cases.test.ts
api/src/infrastructure/persistence/prisma/repositories/prisma-grade-scale.repository.ts
api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-grade-scale.repository.test.ts
api/src/presentation/grading/dto/create-grade-scale.dto.ts
api/src/presentation/grading/dto/update-grade-scale.dto.ts
api/src/presentation/grading/dto/create-grade-scale-value.dto.ts
api/src/presentation/grading/dto/update-grade-scale-value.dto.ts
api/src/presentation/grading/grading-scales.controller.ts
api/src/presentation/grading/grading.module.ts
api/src/presentation/grading/__tests__/dto-scales.test.ts
api/src/presentation/grading/__tests__/grading-scales.controller.test.ts
web/src/pages/dashboard/grading-scales.tsx
web/src/pages/dashboard/__tests__/grading-scales.test.tsx
```

### Entrega 1a — archivos modificados
```
api/prisma_tenant/schema.prisma
api/prisma/seed.ts
api/src/app.module.ts
packages/domain/src/index.ts
packages/domain/src/pedagogy/index.ts
packages/domain/src/pedagogy/entities/grade-scale.ts  ← REEMPLAZAR/ELIMINAR
packages/domain/src/pedagogy/repositories/grade-scale-repository.ts  ← ELIMINAR
packages/domain/src/pedagogy/__tests__/entities/pedagogy.test.ts  ← LIMPIAR tests GradeScale
```

### Entrega 1b — archivos nuevos
```
packages/domain/src/grading/value-objects/period-sort-order.ts
packages/domain/src/grading/entities/grading-period-template.ts
packages/domain/src/grading/entities/grading-period-date.ts
packages/domain/src/grading/errors/grading-period.errors.ts
packages/domain/src/grading/repositories/grading-period.repository.ts
packages/domain/src/grading/__tests__/value-objects/period-sort-order.test.ts
packages/domain/src/grading/__tests__/entities/grading-period-template.test.ts
packages/domain/src/grading/__tests__/entities/grading-period-date.test.ts
api/prisma_tenant/migrations/YYYYMMDD_grading_foundations_periods/migration.sql
api/src/application/grading/use-cases/grading-period-template.use-cases.ts
api/src/application/grading/use-cases/grading-period-date.use-cases.ts
api/src/application/grading/__tests__/grading-period.use-cases.test.ts
api/src/infrastructure/persistence/prisma/repositories/prisma-grading-period.repository.ts
api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-grading-period.repository.test.ts
api/src/presentation/grading/dto/create-period-template.dto.ts
api/src/presentation/grading/dto/update-period-template.dto.ts
api/src/presentation/grading/dto/upsert-period-dates.dto.ts
api/src/presentation/grading/grading-periods.controller.ts
api/src/presentation/grading/__tests__/dto-periods.test.ts
api/src/presentation/grading/__tests__/grading-periods.controller.test.ts
web/src/pages/dashboard/grading-periods.tsx
web/src/pages/dashboard/__tests__/grading-periods.test.tsx
```

### Entrega 1b — archivos modificados
```
api/prisma_tenant/schema.prisma
api/prisma/seed.ts
api/src/presentation/grading/grading.module.ts
packages/domain/src/grading/index.ts
web/src/App.tsx
web/src/components/layout/sidebar.tsx
```
