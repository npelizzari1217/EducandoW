# Design: CRUD de Ciclos Lectivos + Refactor de CourseCycle

## Technical Approach

Migrar `AcademicCycle` de entidad read-only (UUID PK, sin campos de bimestre) a entidad CRUD completa con Int PK + UUID público, 8 campos de bimestre opcionales, código único de 4 dígitos y soft-delete. En `CourseCycle`, los 8 campos de bimestre pasan a opcionales (nullable en DB); la herencia se resuelve en capa de presentación mediante `effectiveBimonthDates`. Se extiende `PedagogyModule`, no se crea módulo nuevo. Frontend: nueva página `academic-cycles.tsx` + sidebar item; `course-cycles.tsx` muestra fechas efectivas y formulario con bimester opcional.

## Architecture Decisions

| Decision | Options | Tradeoff | Choice |
|----------|---------|----------|--------|
| **ID strategy** | (A) Mantener UUID PK, (B) Int PK + UUID público | (A) simple pero rompe patrón CourseCycle y Enrollments (que referencian `cycleId: String`) (B) consistente con CourseCycle, FK a UUID sin cambios | **B** — mismo patrón CourseCycle |
| **Bimonth inheritance** | (A) Snapshot al crear, (B) null en DB + resolución en presentación | (A) desnormaliza, requiere re-sync si el ciclo cambia (B) fuente única de verdad, resuelve al vuelo | **B** — sin migración de datos, backward compat |
| **Code uniqueness** | (A) Solo DB unique constraint, (B) Validación en UC + DB | (A) error de BD genérico (B) error de dominio `CycleCodeAlreadyExistsError` previo al write | **B** — chequeo previo en UC con error semántico |
| **Módulo NestJS** | (A) Nuevo `AcademicCycleModule`, (B) Extender `PedagogyModule` | (A) más archivos, wiring duplicado (B) consistente con el resto de entidades de pedagogía | **B** — misma estructura que Subjects, StudyPlans |
| **Frontend page** | (A) Página separada `academic-cycles.tsx`, (B) Reusar `course-cycles.tsx` | (A) claridad de responsabilidad (B) página sobrecargada | **A** — el spec pide página independiente con tabla y formulario propios |

## Data Flow

```
POST /v1/academic-cycles
  DTO (Zod) → CreateAcademicCycleUC → CycleCode VO + BimonthPeriod VO → AcademicCycle.create()
    → repo.save() → Prisma upsert (insert, uuid generado, active=true)
    → Controller response { data: { uuid, code, name, ..., bimester dates } }

GET /v1/course-cycles (con herencia)
  ListCourseCyclesUC → repo.findAll() → CourseCycle[]
    → Controller toResponse(): si cc.firstBimonth es null → buscar academicCycle por cycleId
    → response incluye { ..., ownBimonthDates: null, effectiveBimonthDates: { ...del ciclo } }
```

## File Manifest

### Nuevos archivos

| File | Description |
|------|-------------|
| `packages/domain/src/pedagogy/value-objects/cycle-code.ts` | VO `CycleCode`: 4 dígitos numéricos, único |
| `packages/domain/src/pedagogy/value-objects/cycle-description.ts` | VO `CycleDescription`: rechaza empty/whitespace |
| `packages/domain/src/pedagogy/errors/academic-cycle.errors.ts` | Errores: `CycleCodeInvalidError`, `CycleDescriptionInvalidError`, `CycleCodeAlreadyExistsError`, `AcademicCycleNotFoundError` |
| `packages/domain/src/pedagogy/__tests__/value-objects/cycle-code.test.ts` | Tests unitarios de CycleCode |
| `packages/domain/src/pedagogy/__tests__/value-objects/cycle-description.test.ts` | Tests unitarios de CycleDescription |
| `api/src/presentation/pedagogy/dto/academic-cycle.dto.ts` | Schemas Zod: Create/Update/ListQuery + tipos inferidos |
| `web/src/pages/dashboard/academic-cycles.tsx` | Página CRUD con tabla filtrable + formulario create/edit |
| `web/src/hooks/useAcademicCycles.ts` | Hooks: list, create, update, delete, toggle-active |
| `web/src/types/academic-cycle.ts` | Tipos TS: AcademicCycle, CreateDto, UpdateDto, ListResponse |

### Archivos modificados

| File | Change |
|------|--------|
| `api/prisma/schema_tenant.prisma` | AcademicCycle: `id Int @id @default(autoincrement())`, agregar `uuid String @unique @default(uuid())`, `code String`, `description String?`, 8 campos bimestre nullable, `@@unique([code])`. CourseCycle: 8 campos bimestre → `DateTime?` |
| `packages/domain/src/pedagogy/entities/academic-cycle.ts` | Agregar props `uuid`, `numericId`, `code`, `description`, `firstBimonth`..`fourthBimonth`, `deletedAt`. Agregar `create()` y `update()` factory + soft-delete + toggle-active |
| `packages/domain/src/pedagogy/repositories/academic-cycle-repository.ts` | Agregar `save()`, `findByCode()`, `findAll(filters)`, `softDelete()` |
| `packages/domain/src/pedagogy/index.ts` | Exportar nuevos VOs, errores, `AcademicCycleFilters`, `PaginatedResult` |
| `api/src/infrastructure/persistence/prisma/repositories/prisma-academic-cycle.repository.ts` | Implementar nuevo contrato: toDomain con VOs, toPersistence, findAll con filtro/paginado, save (upsert), softDelete |
| `api/src/application/pedagogy/use-cases/pedagogy.use-cases.ts` | Reemplazar `ListAcademicCyclesUC` por: `CreateAcademicCycleUC`, `UpdateAcademicCycleUC`, `DeleteAcademicCycleUC`, `ToggleAcademicCycleActiveUC`, `GetAcademicCycleUC`, `ListAcademicCyclesUC` |
| `api/src/presentation/pedagogy/pedagogy.controller.ts` | 6 nuevos endpoints (POST, GET uuid, PATCH, DELETE, PATCH toggle-active, GET list con filtros). Refactor GET existente |
| `api/src/presentation/pedagogy/pedagogy.module.ts` | Wiring de 6 nuevos UCs + nuevos DTO schemas |
| `api/src/application/course-cycle/use-cases/course-cycle.use-cases.ts` | CreateCourseCycleUseCase: bimester fields opcionales (null si no se envían). GenerateCourseCyclesUseCase: bimester fields opcionales |
| `api/src/presentation/course-cycle/dto/course-cycle.dto.ts` | CreateCourseCycleSchema: bimester fields → `.optional()`. Agregar `CreateCourseCycleSchemaV2` |
| `api/src/presentation/course-cycle/course-cycle.controller.ts` | `toResponse()`: agregar `effectiveBimonthDates` (propios o heredados del ciclo) |
| `web/src/pages/dashboard/course-cycles.tsx` | Mostrar `effectiveBimonthDates` en tabla/form. Campos bimestre como opcionales en formulario |
| `web/src/types/course-cycle.ts` | Agregar `effectiveBimonthDates` y `ownBimonthDates` al tipo `CourseCycle`. Campos bimestre → opcionales en DTOs |
| `web/src/components/layout/sidebar.tsx` | Agregar item "Ciclos Lectivos" → `/academic-cycles` en grupo Académico, moduleCode `COURSES` |
| `web/src/App.tsx` | Agregar ruta `/academic-cycles` → `AcademicCyclesPage` |

### Testing — Nuevos archivos

| File | Description |
|------|-------------|
| `packages/domain/src/pedagogy/__tests__/entities/academic-cycle.test.ts` | Unit: create, update, softDelete, toggleActive, VO validation |
| `api/src/application/pedagogy/__tests__/academic-cycle.use-cases.test.ts` | Integration: UC con repo mockeado, test por cada UC |
| `api/src/presentation/pedagogy/__tests__/academic-cycle.controller.test.ts` | Integration: HTTP endpoints con supertest |
| `web/src/pages/dashboard/__tests__/academic-cycles.test.tsx` | E2E: renderizado de tabla, formularios, filtros |

## Interfaces / Contracts

### AcademicCycleRepository (nuevo contrato)

```ts
export interface AcademicCycleFilters {
  level?: number; active?: boolean; code?: string;
  page?: number; pageSize?: number;
}
export interface PaginatedResult<T> { data: T[]; page: number; pageSize: number; total: number; }

export interface AcademicCycleRepository {
  findById(id: number): Promise<AcademicCycle | null>;
  findByUuid(uuid: string): Promise<AcademicCycle | null>;
  findByCode(code: string): Promise<AcademicCycle | null>;
  findAll(filters: AcademicCycleFilters): Promise<PaginatedResult<AcademicCycle>>;
  save(cycle: AcademicCycle): Promise<void>;
  softDelete(uuid: string): Promise<void>;
}
```

### CourseCycle GET response (modificado)

```ts
{
  ...campos actuales,
  ownBimonthDates: {
    firstBimonthStart: string | null, firstBimonthEnd: string | null, // ...4 pares
  },
  effectiveBimonthDates: {
    firstBimonthStart: string, firstBimonthEnd: string, // ...4 pares (siempre resueltos)
  }
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (domain) | CycleCode, CycleDescription VOs; AcademicCycle.create/update/softDelete/toggleActive | Jest, sin dependencias externas |
| Integration (API) | Use cases con repo mockeado; controller con supertest | NestJS testing utilities |
| E2E (web) | Renderizado de tabla, formularios, filtros, herencia de bimestre en CourseCycle | React Testing Library |

## Migration / Rollout

- **Prisma migrate**: `npx prisma migrate dev --name academic_cycle_crud` genera migration con `id` Int autoincrement + `code` unique. Los 8 campos de CourseCycle pasan a `DateTime?` (no pierden datos — Prisma `ALTER COLUMN SET NOT NULL` no ejecuta si ya hay datos no-null).
- **Rollback**: revertir migration y código. Campos nuevos de AcademicCycle pueden quedar (no rompen GET existente). CourseCycle bimestre columns nunca se eliminan físicamente.

## Open Questions

- [ ] ¿Se necesita un endpoint `GET /v1/academic-cycles/check-code?code=2026` para validación asincrónica en el frontend? (no en spec, nice-to-have)
- [ ] ¿Las fechas de bimestre del ciclo deben validarse que no se solapen entre bimestres? (spec solo pide end > start por par, no cross-pair)
