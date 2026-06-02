# Tasks: Curso por Ciclo (CourseCycle)

## Fase 1: Dominio + Schema (Foundation)

### T1.1 — Crear Value Objects [x]

**Archivos**:
- `packages/domain/src/course-cycle/value-objects/course-name.ts` (NEW)
- `packages/domain/src/course-cycle/value-objects/passing-grade.ts` (NEW)
- `packages/domain/src/course-cycle/value-objects/bimonth-period.ts` (NEW)
- `packages/domain/src/course-cycle/value-objects/index.ts` (NEW)
- `packages/domain/src/course-cycle/__tests__/value-objects/course-name.test.ts` (NEW)
- `packages/domain/src/course-cycle/__tests__/value-objects/passing-grade.test.ts` (NEW)
- `packages/domain/src/course-cycle/__tests__/value-objects/bimonth-period.test.ts` (NEW)

**Criterio**: Tests pasan — `CourseName` normaliza a mayúscula y rechaza vacío; `PassingGrade` acepta 1-10 y rechaza fuera de rango; `BimonthPeriod` acepta end > start y rechaza end ≤ start.

**Dependencias**: Ninguna
**Estimación**: ~120 líneas

---

### T1.2 — Crear entidad CourseCycle [x]

**Archivos**:
- `packages/domain/src/course-cycle/entities/course-cycle.ts` (NEW)
- `packages/domain/src/course-cycle/entities/index.ts` (NEW)
- `packages/domain/src/course-cycle/__tests__/entities/course-cycle.test.ts` (NEW)

**Criterio**: Tests pasan — factory `CourseCycle.create()` con todos los campos; `ensureActive()` lanza `CourseCycleClosedError` si active=false; `softDelete()` setea deletedAt; `activate()` y `deactivate()` togglean el estado.

**Dependencias**: T1.1
**Estimación**: ~100 líneas

---

### T1.3 — Crear interfaz CourseCycleRepository (puerto) [x]

**Archivos**:
- `packages/domain/src/course-cycle/repositories/course-cycle-repository.ts` (NEW)
- `packages/domain/src/course-cycle/repositories/index.ts` (NEW)

**Criterio**: Interfaz con métodos `findById`, `findByPair`, `findAll`, `save`, `createMany`, `softDelete`. Sin implementación.

**Dependencias**: T1.2
**Estimación**: ~40 líneas

---

### T1.4 — Crear errores de dominio [x]

**Archivos**:
- `packages/domain/src/course-cycle/errors.ts` (NEW)

**Criterio**: Clases exportadas: `CourseCycleClosedError`, `CourseCycleAlreadyExistsError`, `CourseCycleNotFoundError`, `BimonthPeriodInvalidError`.

**Dependencias**: Ninguna
**Estimación**: ~30 líneas

---

### T1.5 — Agregar modelo Prisma + migración [x]

**Archivos**:
- `api/prisma/schema_tenant.prisma` (MODIFY — agregar modelo `CourseCycle`)

**Criterio**: `pnpm prisma migrate dev` genera migración sin errores. Modelo con todos los campos del design, unique constraint en `(courseId, cycleId)`, índices en `cycleId`, `studyPlanId`, `level`.

**Dependencias**: Ninguna (puede correr en paralelo con T1.1-T1.4)
**Estimación**: ~30 líneas

---

### T1.6 — Barrel exports del dominio [x]

**Archivos**:
- `packages/domain/src/course-cycle/index.ts` (NEW)
- `packages/domain/src/index.ts` (MODIFY — agregar export de course-cycle)

**Criterio**: `import { CourseCycle, CourseName, ... } from '@educandow/domain'` funciona.

**Dependencias**: T1.1, T1.2, T1.3, T1.4
**Estimación**: ~10 líneas

---

## Fase 2: Infraestructura

### T2.1 — Implementar PrismaCourseCycleRepository [x]

**Archivos**:
- `api/src/infrastructure/persistence/prisma/repositories/prisma-course-cycle.repository.ts` (NEW)
- `api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-course-cycle.repository.test.ts` (NEW)

**Criterio**: Tests de integración pasan — `save` persiste; `findByPair` detecta duplicados; `createMany` con skipDuplicates funciona; `softDelete` setea deletedAt; `findAll` con filtros (level, cycleId, active) + paginado.

**Dependencias**: T1.3, T1.5
**Estimación**: ~150 líneas

---

### T2.2 — Registrar en módulo NestJS [x]

**Archivos**:
- `api/src/presentation/course-cycle/course-cycle.module.ts` (NEW)
- `api/src/app.module.ts` (MODIFY — importar CourseCycleModule)

**Criterio**: La app arranca sin errores de inyección. `CourseCycleRepository` se resuelve como `PrismaCourseCycleRepository`.

**Dependencias**: T2.1
**Estimación**: ~20 líneas

---

## Fase 3: Aplicación (Use Cases)

### T3.1 — Crear use cases [x]

**Archivos**:
- `api/src/application/course-cycle/use-cases/course-cycle.use-cases.ts` (NEW)
- `api/src/application/course-cycle/__tests__/course-cycle.use-cases.test.ts` (NEW)

**Use cases incluidos**:
- `CreateCourseCycleUseCase` — valida FK (CourseSection, StudyPlan, AcademicCycle), chequea duplicado, crea
- `UpdateCourseCycleUseCase` — `ensureActive()`, actualiza campos
- `DeleteCourseCycleUseCase` — `ensureActive()`, soft delete
- `ToggleCourseCycleActiveUseCase` — toggle active (único que no llama ensureActive)
- `GetCourseCycleUseCase` — por UUID
- `ListCourseCyclesUseCase` — filtros combinables + paginado
- `GenerateCourseCyclesUseCase` — obtiene cursos del plan, crea en batch, skip duplicados, valida ciclo activo

**Criterio**: Tests unitarios pasan con repos mockeados — cada use case cubre happy path + error paths (closed, duplicate, not found, invalid FK).

**Dependencias**: T1.1-T1.6, T2.1
**Estimación**: ~350 líneas

---

## Fase 4: Presentación (API)

### T4.1 — Crear DTOs y Zod schemas [x]

**Archivos**:
- `api/src/presentation/course-cycle/dto/course-cycle.dto.ts` (NEW)

**DTOs**:
- `CreateCourseCycleDto` — todos los campos requeridos + zod validation
- `UpdateCourseCycleDto` — campos opcionales (Partial)
- `GenerateCourseCyclesDto` — `{ studyPlanId, cycleId }`
- `CourseCycleListQueryDto` — `{ level?, cycleId?, active?, page?, pageSize? }`
- `CourseCycleResponseDto` — mapeo de entidad a response (usa `uuid`, no `id`)

**Criterio**: Schemas de zod validan correctamente. `courseName` se transforma a uppercase en el schema.

**Dependencias**: T1.1
**Estimación**: ~80 líneas

---

### T4.2 — Crear CourseCycleController [x]

**Archivos**:
- `api/src/presentation/course-cycle/course-cycle.controller.ts` (NEW)
- `api/src/presentation/course-cycle/__tests__/course-cycle.controller.test.ts` (NEW)

**Endpoints** (8):
- `GET /v1/course-cycles` — list con query filters
- `GET /v1/course-cycles/:uuid` — get by UUID
- `POST /v1/course-cycles` — create
- `PATCH /v1/course-cycles/:uuid` — update (blocked if closed)
- `DELETE /v1/course-cycles/:uuid` — soft delete (blocked if closed)
- `PATCH /v1/course-cycles/:uuid/deactivate` — close
- `PATCH /v1/course-cycles/:uuid/activate` — reopen
- `POST /v1/course-cycles/generate` — bulk generate

**Criterio**: E2E tests pasan — todos los endpoints responden con status codes correctos (200, 201, 400, 404, 409). Errores de dominio mapeados correctamente.

**Dependencias**: T3.1, T4.1
**Estimación**: ~200 líneas

---

### T4.3 — Registrar errores en exception filter [x]

**Archivos**:
- `api/src/presentation/shared/filters/exception.filter.ts` (MODIFY)

**Criterio**: `DOMAIN_STATUS` incluye `COURSE_CYCLE_ALREADY_EXISTS: 409`, `COURSE_CYCLE_CLOSED: 409`, `ACADEMIC_CYCLE_CLOSED: 409`.

**Dependencias**: T1.4
**Estimación**: ~5 líneas

---

## Fase 5: Frontend

### T5.1 — Tipos y hooks [x]

**Archivos**:
- `web/src/lib/types/course-cycle.ts` (NEW)
- `web/src/hooks/useCourseCycles.ts` (NEW)

**Criterio**: Tipos TypeScript para `CourseCycle`, `CreateCourseCycleDto`, `GenerateCourseCyclesDto`. Hooks: `useCourseCycles(filters)`, `useCreateCourseCycle()`, `useUpdateCourseCycle()`, `useDeleteCourseCycle()`, `useToggleCourseCycleActive()`, `useGenerateCourseCycles()`. Siguen el patrón de `useApiList`/`useApiCreate` existentes.

**Dependencias**: T4.2 (API debe estar funcionando)
**Estimación**: ~100 líneas

---

### T5.2 — Componentes de formulario y modal [x]

**Archivos**:
- `web/src/components/course-cycle/CourseCycleForm.tsx` (NEW)
- `web/src/components/course-cycle/GenerateCourseCyclesModal.tsx` (NEW)

**Criterio**: `CourseCycleForm` — formulario completo con todos los campos. Combobox para CourseSection, StudyPlan, AcademicCycle. Date pickers para bimestres. `GenerateCourseCyclesModal` — modal con selector de plan + ciclo + botón confirmar. Muestra resultado `{ created, skipped, total }` como toast.

**Dependencias**: T5.1
**Estimación**: ~200 líneas

---

### T5.3 — Página course-cycles.tsx [x]

**Archivos**:
- `web/src/pages/dashboard/course-cycles.tsx` (NEW)

**Criterio**: Página con:
- `PremiumHeader` ("Cursos por Ciclo")
- Filtros: combobox nivel, combobox ciclo lectivo, toggle activo/inactivo
- Botón "Generar cursos" (abre `GenerateCourseCyclesModal`)
- Tabla con columnas: courseName, level, ciclo, active (badge), passingGrade, acciones (editar, toggle active)
- Formulario de edición en Card toggleable
- NUNCA muestra IDs internos
- `courseName` siempre en mayúscula en la UI

**Dependencias**: T5.2
**Estimación**: ~250 líneas

---

### T5.4 — Routing y sidebar [x]

**Archivos**:
- `web/src/App.tsx` (MODIFY — agregar ruta `/course-cycles`)
- `web/src/components/layout/sidebar.tsx` (MODIFY — agregar "Cursos por Ciclo")

**Criterio**: La ruta carga la página. El sidebar muestra el ítem en el grupo "Académico".

**Dependencias**: T5.3
**Estimación**: ~10 líneas

---

## Fase 6: Testing Frontend

### T6.1 — Tests de página y componentes [x]

**Archivos**:
- `web/src/pages/dashboard/__tests__/course-cycles.test.tsx` (NEW)

**Criterio**: Tests Vitest + RTL — renderiza tabla, filtros disparan re-fetch, modal se abre/cierra, submit de generación muestra toast.

**Dependencias**: T5.3
**Estimación**: ~100 líneas

---

## Resumen

| Fase | Tareas | Archivos nuevos | Archivos modificados | ~LOC |
|------|--------|----------------|---------------------|------|
| F1: Dominio | 6 (T1.1-T1.6) | 14 | 1 | 330 |
| F2: Infra | 2 (T2.1-T2.2) | 2 | 1 | 170 |
| F3: Aplicación | 1 (T3.1) | 2 | 0 | 350 |
| F4: API | 3 (T4.1-T4.3) | 3 | 1 | 285 |
| F5: Frontend | 4 (T5.1-T5.4) | 5 | 2 | 560 |
| F6: Test FE | 1 (T6.1) | 1 | 0 | 100 |
| **Total** | **17** | **27** | **5** | **~1795** |
