# Diseño técnico — grading-foundations (Fase 1 de 5)

> HOW arquitectónico de la fundación de calificación. Implementa el spec
> `openspec/changes/grading-foundations/spec.md` sobre la propuesta homónima.
> Convenciones reales tomadas de `attendance-type` (hexagonal + tenant DB).

---

## 0. Aclaración estructural que condiciona todo el diseño

El spec modela las entidades con `@@unique([institutionId, level, modality, name])`.
En EducandoW **la institución ES la base de datos** (multi-tenant por schema): el
`TenantMiddleware` resuelve un `PrismaClient` por institución y NO existe columna
`institutionId` en la tenant DB (lo confirman `attendance_types` y el `GradeScale`
actual, que usan `@@unique([level, modality, name])`).

**Decisión**: la unicidad real es `[level, modality, name]`. "Por institución" se
satisface por aislamiento de schema, no por columna. El selector `?institutionId`
de ROOT es exclusivamente de enrutamiento del middleware, no un filtro de query.
Esto aplica a `GradeScale` y a `GradingPeriodTemplate`.

---

## 1. Enfoque técnico

Replicar EXACTAMENTE el patrón hexagonal de `attendance-type` para dos agregados
nuevos (Escalas y Períodos), reusando `TenantContext.getClient()` para CRUD
request-scoped y el bypass ROOT con `?institutionId` ya existente en el middleware.

```
packages/domain/src/grading/        ← entidades, VOs, invariantes, errores, puertos
api/src/application/grading/         ← use cases (orquestan repos, devuelven Result)
api/src/infrastructure/.../repositories/  ← repos Prisma tenant (toDomain/save)
api/src/presentation/grading/        ← controllers + DTOs zod + module DI
api/prisma_tenant/schema.prisma      ← rediseño de modelos + enum + nuevos modelos
api/prisma/seed.ts                   ← módulo GRADING_CONFIG + seeds de ejemplo
web/src/pages/dashboard/             ← 2 pantallas espejo de Instituciones + ROOT selector
```

Flujo de datos (idéntico al resto del sistema):

```
HTTP → Controller(@Roles GRADING_CONFIG) → ZodValidationPipe(DTO)
     → UseCase(Result<T,DomainError>) → Repository(port)
     → PrismaTenantRepo(TenantContext.getClient()) → tenant DB
```

---

## 2. Modelo de datos (tenant) + migración

### 2.1 Escalas — rediseño limpio

```prisma
enum GradeInternalStatus {
  APROBADO
  NO_APROBADO
  EN_PROCESO
  LIBRE
}

model GradeScale {
  id        String  @id @default(uuid())
  name      String                 // "Cualitativa", "Numérica 1-10"
  level     Int                    // EducationalLevelCode 1..4
  modality  Int     @default(0)    // EducationalModalityCode 0..2
  active    Boolean @default(true)
  deletedAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  values GradeScaleValue[]

  @@unique([level, modality, name])
  @@index([level])
  @@map("grade_scales")
}
// ELIMINADOS: minValue, maxValue, isConceptual (fuera de scope; estado lo da el enum)

model GradeScaleValue {
  id             String              @id @default(uuid())
  scaleId        String
  code           String              // alfanumérico libre: "10", "A+", "Logrado"
  label          String              // "Muy Bueno"
  internalStatus GradeInternalStatus // reemplaza isApproved bool
  sortOrder      Int      @default(0)
  active         Boolean  @default(true)
  deletedAt      DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  scale GradeScale @relation(fields: [scaleId], references: [id], onDelete: Cascade)
  notas Nota[]

  @@unique([scaleId, code])
  @@index([scaleId])
  @@map("grade_scale_values")
}
// ELIMINADOS: isApproved (→ internalStatus), numericValue
```

**FK `Nota.gradeScaleValueId`** (schema:426): se PRESERVA tal cual (`String?`,
relación opcional). La migración no la toca; solo cambia columnas internas de
`grade_scale_values`. El snapshot inmutable de `Nota` (`gradeCode`, `gradeLabel`,
`isApproved`, schema:430-432) NO se modifica — sigue siendo el registro histórico.

### 2.2 Períodos — plantilla (3 niveles)

Se elige **padre + ítems + fechas** (no aplanar) porque el spec REQ-4/REQ-5 e
invariantes 5-7 separan claramente la definición reutilizable (ítems con orden)
de la materialización por ciclo (fechas).

```prisma
model GradingPeriodTemplate {
  id        String  @id @default(uuid())
  name      String                 // "Trimestral Primaria"
  level     Int
  modality  Int     @default(0)
  active    Boolean @default(true)
  deletedAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  items GradingPeriodTemplateItem[]

  @@unique([level, modality, name])
  @@index([level])
  @@map("grading_period_templates")
}

model GradingPeriodTemplateItem {
  id         String @id @default(uuid())
  templateId String
  name       String                 // "1° Trimestre"
  sortOrder  Int                    // ≥ 1, único dentro de la plantilla

  template GradingPeriodTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  dates    GradingPeriodDate[]

  @@unique([templateId, sortOrder])
  @@unique([templateId, name])
  @@index([templateId])
  @@map("grading_period_template_items")
}

model GradingPeriodDate {
  id         String   @id @default(uuid())
  itemId     String   @map("template_item_id")
  cycleId    String                 // → AcademicCycle.uuid
  startDate  DateTime @map("start_date")
  endDate    DateTime @map("end_date")
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  item  GradingPeriodTemplateItem @relation(fields: [itemId], references: [id], onDelete: Cascade)
  cycle AcademicCycle             @relation(fields: [cycleId], references: [uuid], onDelete: Cascade)

  @@unique([itemId, cycleId])
  @@index([cycleId])
  @@map("grading_period_dates")
}
```

Materialización: la plantilla define QUÉ períodos hay (ítems + orden, reusable
entre ciclos); `GradingPeriodDate` ancla CUÁNDO para un `AcademicCycle` concreto.
Cargar fechas = crear N `GradingPeriodDate` (uno por ítem) para un `cycleId`.

`AcademicCycle` recibe la relación inversa `gradingPeriodDates GradingPeriodDate[]`.

### 2.3 Campos obsoletos (NO se eliminan)

Marcar con comentario `// @deprecated grading-foundations: reemplazado por GradingPeriodDate`
sin alterar tipo ni borrar (el front actual los lee):
- `AcademicCycle.firstBim..fourthBim` (schema:123-130)
- `CourseCycle.*Bim*` + `activeGradingPeriod` (157-165)
- `MateriaCarrera.cuatrimestre` (900), `Calificacion*.trimestre` (744/794),
  `CompetencyValuation.periodActive` (331), `InformeEvolutivo.periodo` (643)

### 2.4 Migración (reemplazo limpio, SQL a mano)

`prisma migrate dev` no puede convertir `isApproved Boolean` → enum NOT NULL ni
dropear columnas con datos sin pérdida; por eso SQL manual:

```sql
-- 1. Crear enum
CREATE TYPE "GradeInternalStatus" AS ENUM ('APROBADO','NO_APROBADO','EN_PROCESO','LIBRE');

-- 2. Desvincular notas de valores que se van a regenerar (FK opcional, sin pérdida de snapshot)
UPDATE "notas" SET "gradeScaleValueId" = NULL;

-- 3. Reemplazo limpio de valores (volumen despreciable)
TRUNCATE "grade_scale_values" CASCADE;
TRUNCATE "grade_scales" CASCADE;

-- 4. Reescritura de grade_scale_values
ALTER TABLE "grade_scale_values" DROP COLUMN "isApproved";
ALTER TABLE "grade_scale_values" DROP COLUMN "numericValue";
ALTER TABLE "grade_scale_values" ADD COLUMN "internalStatus" "GradeInternalStatus" NOT NULL;

-- 5. grade_scales: drop columnas conceptuales
ALTER TABLE "grade_scales" DROP COLUMN "minValue";
ALTER TABLE "grade_scales" DROP COLUMN "maxValue";
ALTER TABLE "grade_scales" DROP COLUMN "isConceptual";

-- 6. Crear tablas de períodos (3) con sus FKs e índices
-- 7. Re-seed vía seed.ts
```

El paso 2 garantiza que la FK `Nota → GradeScaleValue` no quede colgada tras el
TRUNCATE. Las notas conservan su snapshot histórico; solo pierden el puntero vivo
(esperado en un reemplazo limpio).

---

## 3. Backend hexagonal

### 3.1 Dominio (`packages/domain/src/grading/`)

VOs / enum:
- `GradeInternalStatus` (VO guard): `create(raw)` valida pertenencia al set fijo,
  devuelve `Result<GradeInternalStatus, InvalidInternalStatusError>`. Espejo de
  `AttendanceTypeCode`.
- `GradeValueCode` (VO): trim, no-vacío, sin tope de formato (alfanumérico libre).
- `PeriodSortOrder` (VO): entero ≥ 1.

Entidades (factory `create` + `reconstruct` + getters, igual que `AttendanceType`):
- `GradeScale` — invariante: name no vacío, level ∈ {1..4}.
- `GradeScaleValue` — invariantes: code no vacío, internalStatus válido, sortOrder ≥ 0.
- `GradingPeriodTemplate` (agregado raíz con ítems) — invariante: sortOrder únicos
  y ≥ 1 entre ítems (`assertItemsValid()`).
- `GradingPeriodTemplateItem`, `GradingPeriodDate` — invariante fechas:
  `assertDatesValid(cycleStart, cycleEnd, siblings)` → startDate < endDate, dentro
  del rango del ciclo, sin solapamiento con otros períodos del mismo ciclo.

Errores de dominio (extienden el patrón `*Error` existente):
`ScaleNameDuplicateError`, `ScaleNotFoundError`, `ScaleHasActiveValuesError`,
`ValueCodeDuplicateError`, `ValueNotFoundError`, `InvalidInternalStatusError`,
`PeriodTemplateNameDuplicateError`, `PeriodTemplateNotFoundError`,
`PeriodSortOrderDuplicateError`, `PeriodTemplateHasDatesError`,
`PeriodDateOutOfCycleRangeError`, `PeriodDateOverlapError`, `PeriodDateInvalidRangeError`.

Puertos (interfaces, implementadas en infra):
```ts
interface GradeScaleRepository {
  findById(id): Promise<GradeScale | null>;
  list(filters?: { level?; modality?; active? }): Promise<GradeScale[]>; // incluye values ordenados
  existsByName(level, modality, name, excludeId?): Promise<boolean>;
  countActiveValues(scaleId): Promise<number>;
  save(scale): Promise<void>;
  softDelete(id): Promise<void>;
  // valores
  findValueById(id); saveValue(v); softDeleteValue(id);
  existsValueCode(scaleId, code, excludeId?): Promise<boolean>;
}
interface GradingPeriodRepository {
  findTemplateById(id): Promise<GradingPeriodTemplate | null>; // con items
  listTemplates(filters?): Promise<GradingPeriodTemplate[]>;
  existsTemplateName(level, modality, name, excludeId?): Promise<boolean>;
  saveTemplate(t): Promise<void>;       // upsert template + items en tx
  countDatesForTemplate(templateId): Promise<number>;
  softDeleteTemplate(id): Promise<void>;
  // fechas
  listDates(templateId, cycleId): Promise<GradingPeriodDate[]>;
  saveDates(itemId, cycleId, range): Promise<void>;
  findDatesByCycle(templateId, cycleId): Promise<GradingPeriodDate[]>; // para overlap
}
```

### 3.2 Aplicación (`api/src/application/grading/use-cases/`)

Archivos por agregado (mismo estilo que `attendance-type.use-cases.ts`):
- `grade-scale.use-cases.ts`: Create/Update/Delete/List/Get (Delete chequea
  `countActiveValues > 0` → `ScaleHasActiveValuesError`).
- `grade-scale-value.use-cases.ts`: Create/Update/Delete (chequeo duplicado de code).
- `grading-period-template.use-cases.ts`: Create/Update/Delete/List/Get
  (valida sortOrder únicos; Delete chequea `countDatesForTemplate`).
- `grading-period-date.use-cases.ts`: UpsertDates/ListDates por `(templateId, cycleId)`;
  carga `AcademicCycle` para validar rango + solapamiento.

Todos devuelven `Result<T, DomainError>` y se inyectan vía token string DI.

### 3.3 Presentación (`api/src/presentation/grading/`)

- `grading.controller.ts`: rutas `'/grading/scales'`, `'/grading/scales/:id/values'`,
  `'/grading/period-templates'`, `'/grading/period-templates/:id/dates'`. Cada
  método `@Roles('ROOT', { module: 'GRADING_CONFIG', action: '...' })`,
  `@UseGuards(AuthGuard, RolesGuard)`, mapeo `Result.isErr → throw`. (Se evalúa
  dividir en `grading-scales.controller.ts` + `grading-periods.controller.ts` si
  supera ~150 líneas — ver batches.)
- `dto/`: zod schemas — `create-grade-scale.dto.ts`, `update-grade-scale.dto.ts`,
  `create-grade-scale-value.dto.ts`, `update-grade-scale-value.dto.ts`,
  `create-period-template.dto.ts`, `update-period-template.dto.ts`,
  `upsert-period-dates.dto.ts`. `internalStatus` como `z.enum([...])` → 422 nativo.
- `grading.module.ts`: providers con `useFactory` + tokens
  `'GradeScaleRepository'` / `'GradingPeriodRepository'`, igual que el module de
  attendance-type.

Errores de dominio → HTTP: mapear en los use cases/controller siguiendo REQ-8
(`*DuplicateError`→409, `*NotFoundError`→404, validación enum/fechas/orden→422,
`*HasActiveValues/HasDates`→409). Reusar el filtro de excepciones global existente.

### 3.4 Seed (`api/prisma/seed.ts`)

- Agregar a `modules[]` (línea ~46): `{ id: 'm-grading-config', code: 'GRADING_CONFIG', name: 'Configuración de Calificación' }`.
  Queda incluido en `ALL_MODULE_IDS` → ROOT y perfil Admin lo reciben automáticamente.
- Reescribir `seedGradeScales` (línea ~398): quitar `minValue/maxValue/isConceptual/
  numericValue/isApproved`; cada valor con `internalStatus`. Mapeo de ejemplo:
  numéricas 6-10 → `APROBADO`, 1-5 → `NO_APROBADO`; cualitativa Inicial
  DESTACADO/LOGRADO → `APROBADO`, EN_PROCESO → `EN_PROCESO`.
- Nueva `seedGradingPeriods(prisma)`: plantilla "Trimestral" (3 ítems) para nivel
  Primario/Secundario y "Cuatrimestral" para Terciario; sin fechas (se cargan por ciclo).

---

## 4. Frontend (`web/src/pages/dashboard/`)

- `grading-scales.tsx`: espejo de `attendance-types.tsx` (selector ROOT idéntico,
  `useApiList`/`useApiDelete`, guard "seleccioná institución", form Card, Table).
  Maneja escala + edición inline de sus valores (code, label, `internalStatus`
  como `<select>` de 4 opciones fijas, sortOrder). Filtros por nivel/modalidad.
- `grading-periods.tsx`: gestión de plantillas (nombre + nivel/modalidad + ítems
  con orden). La carga de FECHAS por ciclo se integra acá con un selector de
  `AcademicCycle` (reusa `useAcademicCycles`) que despliega los ítems para cargar
  startDate/endDate — alternativa rechazada: meterlo en la página de academic
  cycles (acopla dos dominios). Decisión: vive en `grading-periods.tsx`.
- `App.tsx`: 2 rutas nuevas (`/grading-scales`, `/grading-periods`).
- `sidebar.tsx`: grupo **Sistema** (junto a "Tipos de asistencia", línea 110) con
  `moduleCode: 'GRADING_CONFIG'`. Recomendado Sistema (no Académico) porque es
  configuración institucional, igual que attendance-types.

---

## 5. Manifiesto de archivos

### Dominio (`packages/domain/src/grading/`) — NUEVOS
| Archivo | Líneas |
|---|---|
| value-objects/grade-internal-status.ts | 35 |
| value-objects/grade-value-code.ts | 25 |
| value-objects/period-sort-order.ts | 25 |
| entities/grade-scale.ts | 90 |
| entities/grade-scale-value.ts | 95 |
| entities/grading-period-template.ts | 110 |
| entities/grading-period-date.ts | 95 |
| errors/*.ts (13 errores) | 130 |
| repositories/grade-scale-repository.ts | 40 |
| repositories/grading-period-repository.ts | 45 |
| index.ts + sub-index | 40 |
| **Modificado** packages/domain/src/index.ts | +15 |

Subtotal dominio: ~745 + 15.

### Backend api — NUEVOS
| Archivo | Líneas |
|---|---|
| application/grading/use-cases/grade-scale.use-cases.ts | 150 |
| application/grading/use-cases/grade-scale-value.use-cases.ts | 110 |
| application/grading/use-cases/grading-period-template.use-cases.ts | 140 |
| application/grading/use-cases/grading-period-date.use-cases.ts | 120 |
| infrastructure/.../prisma-grade-scale.repository.ts | 160 |
| infrastructure/.../prisma-grading-period.repository.ts | 180 |
| presentation/grading/grading-scales.controller.ts | 130 |
| presentation/grading/grading-periods.controller.ts | 130 |
| presentation/grading/dto/*.ts (7 DTOs) | 140 |
| presentation/grading/grading.module.ts | 70 |
| prisma_tenant/migrations/xxxx_grading_foundations/migration.sql | 90 |

### Backend api — MODIFICADOS
| Archivo | Líneas |
|---|---|
| prisma_tenant/schema.prisma (enum + 2 rediseños + 3 modelos + @deprecated + inversa AcademicCycle) | ~110 |
| prisma/seed.ts (módulo + seedGradeScales reescrito + seedGradingPeriods) | ~120 |
| app.module.ts (registrar GradingModule) | +3 |

### Frontend — NUEVOS / MODIFICADOS
| Archivo | Acción | Líneas |
|---|---|---|
| web/src/pages/dashboard/grading-scales.tsx | Nuevo | 380 |
| web/src/pages/dashboard/grading-periods.tsx | Nuevo | 420 |
| web/src/App.tsx | Modif | +6 |
| web/src/components/layout/sidebar.tsx | Modif | +4 |

### Tests (strict TDD) — NUEVOS
Espejo de `__tests__` de attendance-type: VOs, entidades (invariantes), use cases,
controller, dto-validation, páginas front. ~900 líneas agregadas.

**Totales (sin tests):** ~17 archivos nuevos backend/dominio + 4 front nuevos;
~6 modificados. **Líneas estimadas (sin tests): ~2.870.** Con tests: ~3.770.

### Batches sugeridos (cada uno ≤ ~400 líneas de cambio productivo)
1. **Schema + migración + seed** (~320) — modelos, enum, SQL, seed module/escalas/períodos.
2. **Dominio escalas** (~360) — VOs estado/code, entidades GradeScale/Value, errores, puerto + tests.
3. **Dominio períodos** (~360) — VO sortOrder, template/item/date, errores, puerto + tests.
4. **App + infra escalas** (~330) — use cases + repo Prisma escalas + tests.
5. **App + infra períodos** (~360) — use cases + repo Prisma períodos (validación rango/overlap) + tests.
6. **Presentación** (~370) — controllers + DTOs + module + tests controller/dto.
7. **Front escalas** (~390) — grading-scales.tsx + ruta/menú + test.
8. **Front períodos** (~420) — grading-periods.tsx + integración ciclos + test.

8 batches. Cada uno entregable y testeable de forma independiente (cumple ≤400).

---

## 6. ADRs

### ADR-1 — Estado interno como enum Prisma fijo
**Choice**: `enum GradeInternalStatus {APROBADO,NO_APROBADO,EN_PROCESO,LIBRE}` +
VO guard en dominio, reemplazando `isApproved Boolean`.
**Alternativas**: (a) tabla configurable de estados; (b) seguir con boolean.
**Rationale**: el spec fija 4 estados no configurables; enum da validación en DB +
422 nativo en zod + exhaustividad en TS. Tabla configurable es over-engineering
para un set cerrado del sistema.

### ADR-2 — Períodos en 3 niveles (plantilla → ítems → fechas)
**Choice**: `GradingPeriodTemplate` (reusable) + `GradingPeriodTemplateItem`
(orden/nombre) + `GradingPeriodDate` (fechas por `AcademicCycle`).
**Alternativas**: (a) plantilla con campos de fecha directos; (b) períodos atados
1:1 al ciclo (como `firstBim`).
**Rationale**: separa definición reutilizable de materialización temporal; permite
mismas plantillas en múltiples ciclos con fechas distintas (REQ-5.3) sin duplicar
estructura. Aplanar rompería la independencia entre ciclos.

### ADR-3 — `AcademicCycle.firstBim..fourthBim` quedan obsoletos, no se borran
**Choice**: comentario `@deprecated`, mantener columnas; nueva fuente = `GradingPeriodDate`.
**Alternativas**: borrarlos ya.
**Rationale**: el front de ciclos/cursos los lee hoy; borrarlos rompería esas
pantallas fuera de scope. Se eliminan en la fase que los reemplace funcionalmente.
Riesgo asumido: doble fuente de verdad transitoria (mitigado: nada nuevo escribe
en los viejos).

### ADR-4 — FK `Nota → GradeScaleValue`: nullify antes de TRUNCATE
**Choice**: `UPDATE notas SET gradeScaleValueId = NULL` antes del reemplazo limpio.
**Alternativas**: cambiar onDelete a SetNull; conservar valores viejos.
**Rationale**: la FK es opcional y `Nota` ya guarda snapshot histórico
(`gradeCode/gradeLabel/isApproved`), por lo que perder el puntero vivo no pierde
información. Volumen despreciable → reemplazo limpio es lo más simple y seguro.

### ADR-5 — Permiso combinado `GRADING_CONFIG`
**Choice**: un solo módulo para escalas + períodos.
**Alternativas**: `GRADE_SCALES` + `GRADING_PERIODS` separados.
**Rationale**: ambas son configuración de calificación gestionada por el mismo
rol (DIRECTOR/ADMIN); separar duplica administración de permisos sin beneficio.
Decisión cerrada en la propuesta.

### ADR-6 — Unicidad por `[level, modality, name]` (sin institutionId)
**Choice**: ignorar el `institutionId` del modelo conceptual del spec.
**Alternativas**: agregar columna `institutionId`.
**Rationale**: multi-tenant por schema — la tenant DB ya aísla institución (ver §0);
agregar la columna sería redundante e inconsistente con todo el resto de la tenant DB.

---

## 7. Estrategia de testing

| Capa | Qué | Cómo |
|---|---|---|
| Unit dominio | VOs (enum, code no vacío, sortOrder), invariantes de entidad (fechas, solapamiento, orden) | Jest puro, sin mocks |
| Unit aplicación | use cases con repo mock (duplicados, has-values, has-dates, rango fechas) | repo fake en memoria |
| Integración API | controller + zod (201/200/404/409/422/403) por REQ-8 | Nest test module + repo mock |
| Front | render, selector ROOT, guard institución, submit, validación enum | React Testing Library |

Strict TDD: test primero en cada batch (rojo → verde → refactor).

---

## 8. Riesgos abiertos para validación del usuario

1. **Modelo de 3 niveles de períodos** (ADR-2): confirmar que se quiere
   `template → items → dates` y no un modelo más plano. Es la decisión de mayor
   impacto estructural.
2. **Nullify de `Nota.gradeScaleValueId`** (ADR-4): confirmar que NO hay notas
   productivas que dependan del puntero vivo (el snapshot se conserva igual).
3. **`isConceptual`/`minValue`/`maxValue` eliminados de `GradeScale`**: confirmar
   que ninguna pantalla actual de notas los consume (búsqueda previa recomendada).
4. **Alcance de @deprecated**: confirmar que en esta fase NO se toca ningún front
   que lea `firstBim`, `trimestre`, `periodActive`, etc.
5. **Validación de solapamiento de fechas**: confirmar si debe ser estricta
   (sin huecos ni solapes) o solo sin solapes (el spec REQ-6 pide solo sin solapes;
   se permiten huecos).
6. **Ubicación de carga de fechas**: confirmar que va en `grading-periods.tsx` y
   no integrada en la pantalla de `AcademicCycle`.

---

## 9. Open questions

- [ ] ¿La modalidad es siempre relevante o algunos niveles usan solo `modality=0`?
      (afecta UX del filtro, no el modelo).
- [ ] ¿`GradingPeriodDate` debe permitir carga parcial (algunos ítems sin fecha) o
      exige las N fechas juntas? (REQ-5.1 sugiere conjunto completo; el modelo lo
      permite parcial — definir regla de negocio en use case).
