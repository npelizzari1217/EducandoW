# Design: Cursos Inteligentes — Creación con Contexto Automático

## Technical Approach

Extender el `PedagogyController` existente con `GET /academic-cycles` (nuevo endpoint de solo-lectura sobre la tabla `academic_cycles` ya migrada) y modificar `POST /course-sections` para aceptar `name` e `institutionId` opcionales. El use case de creación auto-genera `name` como `{grade} {division}` y el controller auto-completa `institutionId` desde el JWT. En el frontend, `CourseSectionsPage` pasa de `GenericPage` a un componente custom que consume `useAuth()` y `useInstitution()` para campos contextuales.

## Architecture Decisions

| Decision | Option A | Option B | Choice | Rationale |
|---|---|---|---|---|
| D1: Endpoint `/academic-cycles` | Nuevo `AcademicCycleController` | Agregar a `PedagogyController` | **B** | El codebase usa un solo controller monolítico para pedagogía. Crear otro rompería el patrón existente sin beneficio. |
| D2: `AcademicCycle` en dominio | Crear `packages/domain/src/pedagogy/entities/academic-cycle.ts` | Mantener como tipo de infraestructura plano | **A** | Clean Arch exige interfaces de dominio. Se crea entidad mínima (id, name, level, modality, startDate, endDate, active) con `reconstruct()` — sin `create()` porque es solo lectura. |
| D3: Auto-generación de `name` | Backend — en `CreateCourseSectionUC` | Frontend — preview visual | **A** | Una sola fuente de verdad. Si el frontend falla o cambia, el backend garantiza consistencia. Frontend PUEDE mostrar preview, pero el backend DEBE generarlo. |
| D4: `institutionId` en DTO | Obligatorio como hoy | Opcional → auto-completado desde JWT | **B** | El usuario nunca debería tipear un UUID. `req.user.institutionId` del JWT es la fuente autoritativa. El DTO lo acepta como fallback para compatibilidad. |
| D5: Filtro de ciclos por `institutionId` | Incluir `institutionId` en query params | Solo filtrar por `level` | **B** | `AcademicCycle` no tiene columna `institutionId` en el schema tenant. Cada tenant DB es una institución — el filtro es implícito por el tenant context. |
| D6: Conversión `user.level` → nombre | Frontend usa `LEVEL_LABELS` del catálogo | Backend expone endpoint de lookup | **A** | `LEVEL_LABELS` (de `@educandow/domain`) ya existe y es la fuente canónica. Un endpoint adicional sería redundante. |

## Data Flow

```
┌─ FRONTEND ────────────────────────────────────┐
│ useAuth() → user.level (1-4|9)               │
│ useInstitution() → config.name (readonly)     │
│ useEffect() → GET /academic-cycles?level=2    │
│   └→ auto-selecciona el ciclo activo actual   │
│                                                │
│ Form: [grade] [division] [level=readonly|sel] │
│       [inst=name readonly] [cycle=readonly]   │
│ POST /course-sections { grade, division }     │
│   (sin name, sin institutionId)               │
└───────────────┬───────────────────────────────┘
                │
┌─ BACKEND ────▼────────────────────────────────┐
│ PedagogyController.postSection(@Req() req)    │
│   enrich: institutionId ← req.user.instId     │
│   enrich: level ← req.user.level (si ausente) │
│                                               │
│ CreateCourseSectionUC.execute(input)          │
│   if !input.name && input.grade && input.div: │
│     name = `${grade} ${division}`              │
│   CourseSection.create({...})                 │
│   repo.save(section)                          │
└───────────────────────────────────────────────┘
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/domain/src/pedagogy/entities/academic-cycle.ts` | Create | Entidad mínima con `reconstruct()` — solo lectura |
| `packages/domain/src/pedagogy/repositories/academic-cycle-repository.ts` | Create | Interfaz `findByLevel(level, modality?)` |
| `packages/domain/src/pedagogy/index.ts` | Modify | Re-exportar `AcademicCycle` + `AcademicCycleRepository` |
| `api/src/infrastructure/persistence/prisma/repositories/prisma-academic-cycle.repository.ts` | Create | Implementación Prisma con `findByLevel` |
| `api/src/application/pedagogy/use-cases/pedagogy.use-cases.ts` | Modify | +`ListAcademicCyclesUC`; modificar `CreateCourseSectionUC` para auto-generar `name` |
| `api/src/presentation/pedagogy/pedagogy.controller.ts` | Modify | +`GET /academic-cycles`; modificar `POST /course-sections` para leer `req.user` |
| `api/src/presentation/auth/dto/register.request.ts` | Modify | `name` → `.optional()`; `institutionId` → `.optional()` en `CreateCourseSectionSchema` |
| `api/src/presentation/pedagogy/pedagogy.module.ts` | Modify | Registrar `PrismaAcademicCycleRepo` + `ListAcademicCyclesUC` |
| `web/src/pages/dashboard/course-sections.tsx` | Create | Componente custom CourseSectionsPage |
| `web/src/pages/dashboard/pedagogy-pages.tsx` | Modify | Reemplazar `CourseSectionsPage` basado en `GenericPage` por import del nuevo componente |

## Interfaces / Contracts

```typescript
// Domain
export interface AcademicCycleRepository {
  findByLevel(level: EducationalLevelCode, modality?: EducationalModalityCode): Promise<AcademicCycle[]>;
}

// GET /v1/academic-cycles?level=2&modality=0
// Response: { data: { id, name, level, modality, startDate, endDate, active }[] }

// POST /v1/course-sections — name ahora optional
// Body: { grade, division, level, modality, academicYear }  (institutionId optional)
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Domain | `AcademicCycle.reconstruct()` | Unit — Vitest, mock props |
| Application | `ListAcademicCyclesUC` (mock repo) | Unit — Vitest, verificar filtro level |
| Application | `CreateCourseSectionUC` — name auto-gen | Unit — Vitest, casos: name ausente + grade+div presentes; name presente; grade sin div |
| Infrastructure | `PrismaAcademicCycleRepo.findByLevel` | Integration — Vitest con Prisma mock o in-memory |
| Presentation | `GET /academic-cycles` controller | E2E — supertest, verificar formato de respuesta, roles permitidos |
| Frontend | `CourseSectionsPage` — level readonly vs dropdown, ciclo auto-select | Unit — Vitest + React Testing Library, mock `useAuth`/`useInstitution` |

## Migration / Rollout

No migration required. La tabla `academic_cycles` ya existe (migración `20260522095306`). El cambio es aditivo: nuevo endpoint + modificación de formulario. Rollback: revertir `CourseSectionsPage` a `GenericPage`, eliminar endpoint y archivos nuevos, restaurar `name` como requerido en el DTO.

## Open Questions

- [ ] ¿Qué pasa si `academic_cycles` está vacía para un tenant? La propuesta sugiere fallback al año corriente. ¿Se debe crear un ciclo por defecto o solo mostrar advertencia?
- [ ] ¿El endpoint `/academic-cycles` debe filtrar también por `active=true` por defecto? Asumo que sí — solo ciclos activos.
