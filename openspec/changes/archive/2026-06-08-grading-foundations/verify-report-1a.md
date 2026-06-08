# Verify Report — grading-foundations Entrega 1a (Escalas de Notas)

> Fecha: 2026-06-08
> Alcance: T01-T27 (sub-batches 1a-A..1a-E) — solo escalas. 1b (períodos) fuera de alcance.
> Contexto: fresh, adversarial, independent judgment.

---

## Veredicto: PASS WITH WARNINGS

| Severidad | Cantidad |
|-----------|---------|
| CRITICAL  | 0       |
| WARNING   | 2       |
| SUGGESTION| 2       |

---

## Gate Results

| Gate | Resultado | Detalle |
|------|-----------|---------|
| `pnpm --filter @educandow/domain build` | PASS | 0 errores |
| `pnpm --filter @educandow/domain test` | PASS | 67 archivos, 768 tests |
| `pnpm --filter api typecheck` | PASS | 0 errores TypeScript |
| `pnpm --filter api lint` | PASS | 0 errores ESLint |
| `pnpm --filter api test` | PASS+PRE-EXISTING | 528 passed; 6 failed (pre-existing: postgres-admin×6, ensure-institution-levels×1 suite) |
| `pnpm --filter web lint` | PASS | tsc --noEmit + eslint clean |
| `pnpm --filter web test` | PASS | 14 archivos, 144 tests |

Pre-existing failures confirmadas: `postgres-admin.service.test.ts` (×6) y `ensure-institution-levels.test.ts` (suite TypeError). Sin regresiones nuevas.

---

## Cobertura de spec — solo escalas (REQ-1..REQ-3, REQ-7, REQ-8)

| REQ / Escenario | Implementado en | Estado |
|-----------------|-----------------|--------|
| REQ-1.1 — Crear escala válida → 201 | `grade-scale.use-cases.ts`, controller | OK |
| REQ-1.2 — Nombre duplicado → 409 | `ScaleNameDuplicateError`, exception.filter.ts:22 | OK |
| REQ-1.3 — Editar nombre → 200 | `UpdateGradeScaleUseCase` | OK |
| REQ-1.4 — Borrar sin valores → 200 | `DeleteGradeScaleUseCase`, softDelete | OK |
| REQ-1.5 — Borrar con valores activos → 409 | `ScaleHasActiveValuesError`, countActiveValues check | OK |
| REQ-2.1 — Crear valor válido → 201 | `CreateGradeScaleValueUseCase` | OK |
| REQ-2.2 — internalStatus fuera de enum → 422 | Zod z.enum captura → 400 (ver WARNING-1); INVALID_INTERNAL_STATUS → 422 vía domain path | WARNING |
| REQ-2.3 — Código duplicado → 409 | `ValueCodeDuplicateError`, exception.filter.ts:24 | OK |
| REQ-2.4 — Code alfanumérico libre | `GradeValueCode` VO: trim + no-vacío, sin restricción formato | OK |
| REQ-2.5 — Editar internalStatus | `UpdateGradeScaleValueUseCase` (test cubre label; internalStatus update no testeado explícitamente) | SUGGESTION |
| REQ-2.6 — Borrar valor → 200 | `DeleteGradeScaleValueUseCase` | OK |
| REQ-3.1 — Listar escalas con valores ordenados | `ListGradeScalesUseCase`, repo `list()` include values orderBy sortOrder | OK |
| REQ-3.2 — Filtrar por level y modality | Controller `@Query`, use case filters propagados | OK |
| REQ-3.3 — ID inexistente → 404 | `ScaleNotFoundError`, exception.filter.ts:23 | OK |
| REQ-7 — GRADING_CONFIG en seed | seed.ts:47; r-admin y r-director reciben el módulo | OK |
| REQ-7.1 — ROOT accede con ?institutionId | rootQueryParams en frontend; TenantMiddleware routing | OK |
| REQ-7.2 — DIRECTOR accede a su institución | @Roles({ module: 'GRADING_CONFIG', action }) en todos los métodos | OK |
| REQ-7.3 — Sin GRADING_CONFIG → 403 | Guard presente; test T19(g) no implementado | WARNING |
| REQ-8 — Mapeo HTTP | 201/200/204/404/409/422 presentes; 400 vs 422 para DTO validation | WARNING |

---

## Lógica crítica

### Enum GradeInternalStatus
- Schema: `api/prisma_tenant/schema.prisma:349-354` — `enum GradeInternalStatus {APROBADO, NO_APROBADO, EN_PROCESO, LIBRE}` ✓
- Dominio VO: `packages/domain/src/grading/value-objects/grade-internal-status.ts` — `create()` con Set validation, `reconstruct()`, `get()` ✓
- DTO: `api/src/presentation/grading/dto/create-grade-scale-value.dto.ts:6` — `z.enum(['APROBADO','NO_APROBADO','EN_PROCESO','LIBRE'])` ✓

### Migración — nullify + truncate
`api/prisma_tenant/migrations/20260608100000_grading_foundations_scales/migration.sql`:
1. `CREATE TYPE "GradeInternalStatus" AS ENUM (...)` ✓
2. `UPDATE "notas" SET "gradeScaleValueId" = NULL` (FK desvinculated before truncate) ✓
3. `TRUNCATE "grade_scale_values" CASCADE` → `TRUNCATE "grade_scales" CASCADE` ✓
4. `DROP COLUMN IF EXISTS "isApproved"`, `DROP COLUMN IF EXISTS "numericValue"` ✓
5. `ADD COLUMN "internalStatus" "GradeInternalStatus" NOT NULL` ✓
6. `DROP COLUMN IF EXISTS "minValue"`, `DROP COLUMN IF EXISTS "maxValue"`, `DROP COLUMN IF EXISTS "isConceptual"` ✓

### Drop de campos legacy
- `GradeScaleValue` en schema: sin isApproved, sin numericValue — solo internalStatus NOT NULL ✓
- `GradeScale` en schema: sin minValue/maxValue/isConceptual ✓
- Nota: `numericValue` (línea 421) y `isApproved` (línea 437) son del modelo `Nota` (snapshot histórico), no de GradeScaleValue — correcto ✓

### prisma-nota.repository: derivación de isApproved
`api/src/infrastructure/persistence/prisma/repositories/prisma-nota.repository.ts:47`:
```ts
isApproved = isApproved ?? (gsv.internalStatus === 'APROBADO');
```
Ya no lee `isApproved` directamente del GradeScaleValue — correcto ✓

### Permisos GRADING_CONFIG
- Seed: `{ id: 'm-grading-config', code: 'GRADING_CONFIG', name: 'Configuración de Calificación' }` en seed.ts:47 ✓
- r-admin: módulo incluido en roleModules (seed.ts:164) ✓
- r-director: módulo incluido en roleModules (seed.ts:172) ✓
- Controller: `@Roles('ROOT', { module: 'GRADING_CONFIG', action: '...' })` en todos los métodos de GradingScalesController ✓

### Selector ROOT en frontend
`web/src/pages/dashboard/grading-scales.tsx:115`:
```ts
const rootQueryParams = (isRoot && institutionId) ? { institutionId } : undefined;
```
Pasado a useApiList, useApiDelete, y todos los POST/PATCH/DELETE via `{ params: rootQueryParams }` ✓

### Mapeo HTTP (exception.filter.ts:19-25)
```
SCALE_NAME_DUPLICATE → 409
SCALE_NOT_FOUND      → 404
SCALE_HAS_ACTIVE_VALUES → 409
VALUE_CODE_DUPLICATE → 409
VALUE_NOT_FOUND      → 404
INVALID_INTERNAL_STATUS → 422
```
Todos correctos ✓

---

## Hallazgos

### WARNING-1 — ZodValidationPipe retorna 400, spec dice 422

**Archivo**: `api/src/presentation/shared/pipes/zod-validation.pipe.ts:19`
**Spec**: REQ-8 — "Payload inválido (enum, fechas, orden) → 422 Unprocessable Entity"; escenarios 2.2 y 8.3 explícitamente piden 422.
**Realidad**: ZodValidationPipe lanza `BadRequestException` (400) para toda validación DTO fallida.
**Contexto**: patrón pre-existente en toda la codebase — todos los módulos devuelven 400 para errores de validación Zod. No es una regresión introducida por 1a. La ruta `INVALID_INTERNAL_STATUS → 422` existe vía exception filter solo cuando el domain layer es invocado directamente, pero la capa Zod lo intercepta primero.
**Impacto**: bajo — el request ES rechazado; solo el código HTTP difiere del spec.

### WARNING-2 — T19(g) faltante: test de 403 sin GRADING_CONFIG

**Archivo**: `api/src/presentation/grading/__tests__/grading-scales.controller.test.ts`
**Spec**: T19 ítem (g) "GET 403 sin módulo GRADING_CONFIG".
**Realidad**: el test instancia el controller directamente (bypass de guards). El decorador `@Roles` está presente en todos los métodos pero no hay test case que verifique la denegación por falta de módulo.
**Impacto**: bajo — el guard funciona (mismo patrón que attendance-types); gap de cobertura de test.

### SUGGESTION-1 — Import eager de GradingScalesPage en App.tsx

**Archivo**: `web/src/App.tsx:42`
**Spec**: T26 dice "lazy import".
**Realidad**: `import GradingScalesPage from './pages/dashboard/grading-scales'` — eager.
**Contexto**: consistente con el patrón de todos los demás imports de página en App.tsx (ninguno es lazy). No afecta funcionalidad.

### SUGGESTION-2 — Escenario 2.5 no cubierto por test de use case

**Archivo**: `api/src/application/grading/__tests__/grade-scale.use-cases.test.ts`
**Spec**: Escenario 2.5 — editar internalStatus de EN_PROCESO a NO_APROBADO → 200 OK.
**Realidad**: `UpdateGradeScaleValueUseCase` solo testea update de `label`. El cambio de `internalStatus` no tiene test explícito.

---

## Alcance del diff

42 archivos, 5301 inserciones, 275 eliminaciones. Todos dentro del alcance esperado para 1a:
- `api/prisma_tenant/schema.prisma` ✓
- `api/prisma_tenant/migrations/20260608100000_grading_foundations_scales/migration.sql` ✓
- `api/prisma/seed.ts` ✓
- `api/src/app.module.ts` ✓
- `api/src/application/grading/` ✓
- `api/src/infrastructure/persistence/prisma/repositories/prisma-grade-scale.repository.ts` ✓
- `api/src/infrastructure/persistence/prisma/repositories/prisma-nota.repository.ts` ✓
- `api/src/presentation/grading/` ✓
- `api/src/presentation/shared/filters/exception.filter.ts` ✓
- `packages/domain/src/grading/` ✓
- `packages/domain/src/index.ts` ✓
- `packages/domain/src/pedagogy/` (stubs deprecated) ✓
- `web/src/pages/dashboard/grading-scales.tsx` ✓
- `web/src/App.tsx` ✓
- `web/src/components/layout/sidebar.tsx` ✓
- `openspec/changes/grading-foundations/` ✓

Sin archivos fuera de alcance.

---

## Calidad de tests

| Capa | Archivo | Tests | Calidad |
|------|---------|-------|---------|
| Domain VO | `grade-internal-status.test.ts` | 6 | Sustantivo: cada valor + rechazo de EXCELENTE + vacío |
| Domain VO | `grade-value-code.test.ts` | 4+ | Sustantivo: alfanumérico libre + vacío |
| Domain entity | `grade-scale.test.ts`, `grade-scale-value.test.ts` | 11+ | Sustantivo: invariantes, softDelete, reconstruct |
| Use cases | `grade-scale.use-cases.test.ts` | 28 | Sustantivo: todos los paths happy+error; fake repo in-memory |
| Repository | `prisma-grade-scale.repository.test.ts` | 10 | Sustantivo: internalStatus mapping, upsert, countActiveValues (deletedAt filter), existsByName con excludeId |
| Controller | `grading-scales.controller.test.ts` | 14 | Sustantivo; FALTA 403 case (WARNING-2) |
| DTO | `dto-scales.test.ts` | 17 | Sustantivo: todos los schemas + enum validation |
| Frontend | `grading-scales.test.tsx` | 15 | Sustantivo: ROOT selector, guard, 4-option select, POST submit, institutionId |

---

## Regresiones

Ninguna. Los 6 fallos de API test son pre-existentes y sin relación con el cambio.

---

## ready_for_1b

**true** — Entrega 1a completa y verificada. Los 2 warnings no bloquean el avance a 1b:
- WARNING-1 (400 vs 422) es comportamiento sistémico del pipe compartido, no algo que 1b empeore.
- WARNING-2 (test 403) es gap de cobertura menor; no afecta funcionalidad de escalas ni de períodos.
