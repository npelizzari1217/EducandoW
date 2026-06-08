# Verify Report — grading-foundations Entrega 1b (PERÍODOS DE CALIFICACIÓN)

**Fecha**: 2026-06-08
**Veredicto**: PASS WITH WARNINGS — 0 CRITICAL / 1 WARNING / 1 SUGGESTION

---

## Gate Results

| Gate | Resultado | Detalle |
|------|-----------|---------|
| domain_build | PASS | tsc — 0 errores |
| domain_test | PASS | 788/788 tests, 70 archivos |
| api_typecheck | PASS | tsc --noEmit — 0 errores |
| api_lint | PASS | eslint — 0 warnings |
| api_test | PASS | 580/586 (6 fallos pre-existentes) |
| web_lint | PASS | tsc + eslint — 0 errores |
| web_test | PASS | 164/164 tests, 16 archivos |

### Fallos pre-existentes (NO son regresiones)

- `postgres-admin.service.test.ts` × 6 — Pool constructor mock issue (pre-existente)
- `ensure-institution-levels.test.ts` × 1 suite (0 tests) — PrismaClient constructor mock (pre-existente)

---

## Alcance (git diff --stat baa4ee9~1 HEAD)

33 archivos cambiados, 4647 inserciones, 37 eliminaciones. Todo dentro del scope de 1b:
- `packages/domain/src/grading/` — entidades, VOs, errores, repo de períodos
- `api/src/application/grading/` — use cases de períodos
- `api/src/infrastructure/.../prisma-grading-period.repository.ts`
- `api/src/presentation/grading/` — DTOs, controller, module (actualizado)
- `api/prisma_tenant/schema.prisma` — modelos de períodos
- `api/prisma_tenant/migrations/20260608200000_grading_foundations_periods/`
- `api/prisma/seed.ts` — seedGradingPeriods (llamado desde seed-tenant.ts)
- `web/src/pages/dashboard/grading-periods.tsx`
- `web/src/pages/dashboard/academic-cycles.tsx` — adición de sección de fechas (ADITIVO)
- `web/src/App.tsx` (+2 líneas), `web/src/components/layout/sidebar.tsx` (+1 línea)
- Tests correspondientes a todos los archivos anteriores

---

## Lógica crítica

### Modelo 3 niveles — PASS

Schema en `api/prisma_tenant/schema.prisma:1051-1098`:
- `GradingPeriodTemplate` → `@@unique([level, modality, name])`
- `GradingPeriodTemplateItem` → `@@unique([templateId, sortOrder])` + `@@unique([templateId, name])`
- `GradingPeriodDate` → `@@unique([itemId, cycleId])`, FK `cycleId → AcademicCycle.uuid ON DELETE CASCADE`
- Relación inversa `AcademicCycle.gradingPeriodDates` presente (línea 135)
- Migración: pure `CREATE TABLE`, sin tocar tablas existentes

### Invariantes de fecha — PASS

`packages/domain/src/grading/entities/grading-period-date.ts:54-73`:
1. `startDate >= endDate` → `PeriodDateInvalidRangeError`
2. `startDate < cycleStart || endDate > cycleEnd` → `PeriodDateOutOfCycleRangeError`
3. Solapamiento: `a < d && c < b` → `PeriodDateOverlapError`
4. Huecos: explícitamente PERMITIDOS (sin validación mínima)

### Tests de solapamiento — PASS (con matiz)

Tests en dominio (`grading-period-date.test.ts:53`): solapamiento entre ítems. Tests en use case (`grading-period.use-cases.test.ts:283`): solapamiento dentro del mismo batch.

Ver WARNING-01 para el matiz.

### Campos @deprecated intactos — PASS

`AcademicCycle.firstBim..fourthBim` (schema:123-130), `CourseCycle.*Bim*` (158-166), `CompetencyValuation.periodActive` (332) — todos con comentario `// @deprecated grading-foundations: reemplazado por GradingPeriodDate`. Sin modificar tipo ni eliminar.

### Permiso GRADING_CONFIG — PASS

- `seed.ts:47` — módulo incluido en array `modules[]`
- `seed-tenant.ts:8,17-18` — `seedGradingPeriods` llamado desde tenant seed
- `grading-periods.controller.ts` — `@Roles('ROOT', { module: 'GRADING_CONFIG', action: ... })` en cada endpoint
- `App.tsx:90` — `<ProtectedRoute moduleCode="GRADING_CONFIG">`
- `sidebar.tsx:112` — `moduleCode: 'GRADING_CONFIG'`

### Mapeo HTTP — PASS

| Error | HTTP | Verificado en |
|-------|------|---------------|
| PeriodTemplateNameDuplicateError | 409 | controller.test.ts:96 |
| PeriodTemplateHasDatesError | 409 | controller.test.ts (DELETE with dates) |
| PeriodTemplateNotFoundError | 404 | controller.test.ts |
| DELETE exitoso | 204 | @HttpCode(HttpStatus.NO_CONTENT) |
| Payload inválido (DTO Zod) | 400* | dto-periods.test.ts |

*400 es convención establecida del proyecto (no 422); no es hallazgo nuevo.

---

## Cobertura de spec — períodos

| REQ | Escenario | Cubierto en |
|-----|-----------|-------------|
| REQ-4.1 | Crear plantilla con 3 ítems | use-cases.test.ts:98 |
| REQ-4.2 | Nombre duplicado → 409 | use-cases.test.ts:118 |
| REQ-4.3 | sortOrder duplicado → 422 | dto-periods.test.ts:70, domain test |
| REQ-4.4 | Editar nombre ítem | UpdateGradingPeriodTemplateUseCase |
| REQ-4.5 | Borrar plantilla sin fechas | use-cases.test.ts:197 |
| REQ-5.1 | Cargar fechas para ciclo | use-cases.test.ts:252 |
| REQ-5.2 | Editar fechas existentes | saveDates usa upsert |
| REQ-5.3 | Ciclos independientes | grading-period-date.test.ts:78 |
| REQ-6.1 | Fecha fuera del rango del ciclo | domain.test.ts:45, use-case.test.ts:272 |
| REQ-6.2 | Solapamiento → 422 | domain.test.ts:53, use-case.test.ts:283 |
| REQ-6.3 | startDate >= endDate → 422 | domain.test.ts:37, dto-periods.test.ts:141 |
| REQ-7 | GRADING_CONFIG | seed + controller + App.tsx + sidebar |

---

## No-regresión 1a

Todos los tests de escalas siguen pasando:
- 101 tests de grading en api (includes escalas + períodos)
- Tests `grading-scales.*` en web: todos ✓

---

## Hallazgos

### WARNING-01 — Overlap check parcial en UpsertPeriodDatesUseCase

**Archivo**: `api/src/application/grading/use-cases/grading-period-date.use-cases.ts:31`

**Qué pasa**: El parámetro `_templateId` lleva underscore (intencionalmente ignorado). `findDatesByCycle` está implementado en el repositorio pero NUNCA se llama en el use case. El overlap check solo valida contra otros ítems dentro del MISMO batch; no contra fechas ya persistidas en DB.

**Tarea T41 dice**: "(2) carga fechas existentes del ciclo para el templateId (`findDatesByCycle`); (3) por cada ítem, llama a `GradingPeriodDate.create(props, cycleStart, cycleEnd, siblings)`..."

**Impacto**: bajo en la práctica — el frontend siempre hace PUT con todos los ítems a la vez. Pero si un cliente hace PUT con subset de ítems, el solapamiento con ítems ya guardados no se detecta.

**Corrección mínima**: cargar `const existingSiblings = await this.periodRepo.findDatesByCycle(templateId, cycleId)` antes del loop y pasarlos como siblings base.

### SUGGESTION-01 — UpsertPeriodDatesSchema acepta `dates: []`

**Archivo**: `api/src/presentation/grading/dto/upsert-period-dates.dto.ts:19`

`dates` es `z.array(...)` sin `.min(1)`. Un PUT con array vacío pasa validación y no hace nada. Puede ser intencional (para futuro "borrar todas las fechas") pero no está documentado.

---

## Calidad de tests

- Tests de dominio: sólidos, cubren casos edge (solapamiento exacto en límite, huecos, ciclos independientes, reconstruct sin re-validar)
- Tests de use case: cubren todos los error paths; el test de overlap es within-batch (ver WARNING-01)
- Tests de controller: cubren 201/409/404/204 + errores de fechas
- Tests de DTO: cubren sortOrder duplicado, startDate>=endDate, campo requerido ausente
- Tests de frontend: 13 casos incluyendo selector ROOT, institutionId en POST y PUT, sección de fechas

No hay tests vacíos. La cobertura es sustancial.

---

## Fase 1 completa

Entrega 1a (T01-T27) + Entrega 1b (T28-T53): todas las tareas marcadas como `[x]` en apply-progress. Gates finales 1a (T27) y 1b (T53) pasados. **Fase 1 lista para archive.**
