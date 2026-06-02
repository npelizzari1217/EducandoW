# Tasks: Academic Cycle CRUD + CourseCycle Bimonth Inheritance

## Fase 1: Dominio + Schema

### T1.1 — Crear Value Objects nuevos [x]
### T1.2 — Ampliar entidad AcademicCycle [x]
### T1.3 — Errores de dominio [x]
### T1.4 — Schema Prisma [x]
### T1.5 — Barrel exports [x]
**Archivos**: `packages/domain/src/pedagogy/index.ts` (MODIFY)
**Criterio**: Exportar nuevos VOs, errores, `AcademicCycleFilters`, `PaginatedResult`.
**Dep**: T1.1-T1.3 | **~10 LOC**

## Fase 2: Infraestructura

### T2.1 — Repository interface [x]
**Archivos**: `packages/domain/src/pedagogy/repositories/academic-cycle-repository.ts` (MODIFY)
**Criterio**: Agregar `findByUuid()`, `findByCode()`, `findAll(filters)`, `save()`, `softDelete()`. Mantener métodos existentes.
**Dep**: T1.2 | **~30 LOC**

### T2.2 — Prisma repository [x]
**Archivos**: `api/src/infrastructure/persistence/prisma/repositories/prisma-academic-cycle.repository.ts` (MODIFY)
**Criterio**: Implementar nuevo contrato con `toDomain()` (VOs nuevos), `toPersistence()`, `findAll()` con filtros + paginado, `save()` upsert, `softDelete()`. Usa `TenantContext.getClient()`.
**Dep**: T1.4, T2.1 | **~120 LOC**

## Fase 3: Aplicación

### T3.1 — Use cases AcademicCycle [x]
**Archivos**: `api/src/application/pedagogy/use-cases/pedagogy.use-cases.ts` (MODIFY), `__tests__/academic-cycle.use-cases.test.ts` (NEW)
**Criterio**: 6 use cases: Create (valida code único), Update, Delete (soft), ToggleActive, Get (por UUID), List (filtros + paginado). Tests con repo mockeado.
**Dep**: T2.1, T2.2 | **~200 LOC**

### T3.2 — Modificar use cases CourseCycle [x]
**Archivos**: `api/src/application/course-cycle/use-cases/course-cycle.use-cases.ts` (MODIFY)
**Criterio**: `CreateCourseCycleInput` y `UpdateCourseCycleInput`: campos bimestre opcionales. `GenerateCourseCyclesUseCase`: hereda fechas del ciclo si no se envían. Si no se envían fechas → bimestres null (herencia en controller).
**Dep**: T2.2 | **~30 LOC**

## Fase 4: Presentación API

### T4.1 — DTOs AcademicCycle [x]
**Archivos**: `api/src/presentation/pedagogy/dto/academic-cycle.dto.ts` (NEW)
**Criterio**: Schemas Zod: Create (code 4 dígitos, name requerido, level requerido, bimestres opcionales), Update (parcial), ListQuery (level?, active?, page?, pageSize?).
**Dep**: T1.1 | **~60 LOC**

### T4.2 — Extender PedagogyController [x]
**Archivos**: `api/src/presentation/pedagogy/pedagogy.controller.ts` (MODIFY), `__tests__/academic-cycle.controller.test.ts` (NEW)
**Criterio**: 6 endpoints: POST, GET /:uuid, PATCH /:uuid, DELETE /:uuid, PATCH /:uuid/toggle-active, GET (list con filtros). E2E tests con supertest.
**Dep**: T3.1, T4.1 | **~150 LOC**

### T4.3 — Wiring del módulo [x]
**Archivos**: `api/src/presentation/pedagogy/pedagogy.module.ts` (MODIFY)
**Criterio**: Registrar 6 nuevos use cases, DTOs. Sin cambios en exports.
**Dep**: T3.1 | **~30 LOC**

### T4.4 — CourseCycle hereda fechas en response [x]
**Archivos**: `api/src/presentation/course-cycle/course-cycle.controller.ts` (MODIFY), `api/src/presentation/course-cycle/dto/course-cycle.dto.ts` (MODIFY)
**Criterio**: `toResponse()` agrega `effectiveBimonthDates` (propias o del ciclo). Create DTO: bimestres opcionales.
**Dep**: T3.2 | **~40 LOC**

## Fase 5: Frontend

### T5.1 — Tipos y hooks AcademicCycle [x]
**Archivos**: `web/src/types/academic-cycle.ts` (NEW), `web/src/hooks/useAcademicCycles.ts` (NEW)
**Criterio**: Tipos TS para AcademicCycle, CreateDto, UpdateDto. Hooks: list, create, update, delete, toggleActive.
**Dep**: T4.2 | **~80 LOC**

### T5.2 — Página academic-cycles.tsx [x]
**Archivos**: `web/src/pages/dashboard/academic-cycles.tsx` (NEW), `__tests__/academic-cycles.test.tsx` (NEW)
**Criterio**: Tabla con columnas: código, nombre, descripción, nivel, active (badge), fechas, acciones. Filtros: nivel, activo/inactivo. Formulario create/edit con todos los campos + fechas de bimestre. Usa hooks de T5.1.
**Dep**: T5.1 | **~250 LOC**

### T5.3 — Actualizar CourseCycle frontend [x]
**Archivos**: `web/src/pages/dashboard/course-cycles.tsx` (MODIFY), `web/src/types/course-cycle.ts` (MODIFY), `web/src/components/course-cycle/CourseCycleForm.tsx` (MODIFY)
**Criterio**: Tabla muestra `effectiveBimonthDates`. Formulario: campos bimestre opcionales. Tipo CourseCycle incluye `effectiveBimonthDates`.
**Dep**: T4.4 | **~50 LOC**

### T5.4 — Routing y sidebar [x]
**Archivos**: `web/src/App.tsx` (MODIFY), `web/src/components/layout/sidebar.tsx` (MODIFY)
**Criterio**: Ruta `/academic-cycles`. Sidebar: "Ciclos Lectivos" en grupo Académico.
**Dep**: T5.2 | **~10 LOC**

## Resumen

| Fase | Tareas | Archivos nuevos | Archivos modificados | ~LOC |
|------|--------|----------------|---------------------|------|
| F1: Dominio | 5 | 7 | 2 | 255 |
| F2: Infra | 2 | 0 | 2 | 150 |
| F3: Aplicación | 2 | 1 | 2 | 230 |
| F4: API | 4 | 2 | 4 | 280 |
| F5: Frontend | 4 | 4 | 5 | 390 |
| **Total** | **17** | **14** | **15** | **~1305** |
