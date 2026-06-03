# Proposal: Course Cycle Generate Improvements

**Pedagogical level**: ALL

## Intent

`POST /v1/course-cycles/generate` usa `createMany` con skip de duplicados — no actualiza nombres de cursos existentes cuando el plan cambia. Hardcodea `level: buildLevel('PRIMARIO')` en vez de derivarlo del plan. El frontend requiere un modal innecesario cuando los filtros de página ya tienen la info. Necesitamos UPSERT, derivación correcta de nivel, y simplificar el flujo UI.

## Scope

### In Scope
- UPSERT por curso: `findByPair` + update `courseName` si existe, create si no
- `studyPlanId` opcional: si ausente, procesa TODOS los planes del nivel
- Fix `buildLevel('PRIMARIO')` → `Level.fromParts(plan.level, plan.modality)`
- Result type: `{ created, updated, total }` (reemplaza `{ created, skipped, total }`)
- Frontend: eliminar `GenerateCourseCyclesModal` y botón "Nuevo Curso por Ciclo"
- Frontend: "Generar Cursos" valida filtros Nivel + Ciclo Lectivo; agrega filtro Plan de Estudio opcional

### Out of Scope
- Migración retroactiva de registros existentes
- Eliminación del endpoint (solo cambia comportamiento)
- Otros endpoints de CourseCycle

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `course-cycle`: "Bulk Generate CourseCycles" cambia de createMany+skip a UPSERT con studyPlanId opcional y derivación vía `Level.fromParts`. "Frontend CRUD Page" cambia: botón Generar usa filtros de página en vez de modal; se agrega filtro Plan de Estudio opcional.

## Approach

1. **Use case**: iterar cursos del plan → `findByPair(courseId, cycleId)` → si existe: update `courseName`; si no: create. Cuando `studyPlanId` es null, buscar planes por `level` y procesar todos.
2. **Level**: `Level.fromParts(plan.level, plan.modality)` — `level * 10 + modality`.
3. **Frontend**: eliminar modal. Agregar combobox Plan de Estudio (opcional). Botón "Generar Cursos" valida Nivel + Ciclo, envía `{ studyPlanId?, cycleId }`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `api/src/application/course-cycle/use-cases/` | Modified | UPSERT, optional studyPlanId, level fix |
| `api/src/presentation/course-cycle/controller.ts` | Modified | DTO actualizado |
| `api/src/presentation/course-cycle/dto/` | Modified | GenerateDto: studyPlanId opcional |
| `packages/domain/src/course-cycle/` | Modified | Result type + `updated` |
| `web/src/pages/dashboard/course-cycles.tsx` | Modified | Filtro Plan, eliminar modal |
| `web/src/components/course-cycle/GenerateCourseCyclesModal.tsx` | Removed | Ya no se necesita |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| UPSERT concurrente puede colisionar | Low | Constraint UNIQUE `(courseId, cycleId)` protege el create; update es idempotente |
| Planes sin modalidad rompen `Level.fromParts` | Low | `modality` es required en StudyPlan |
| Usuarios extrañan el modal | Med | El nuevo flujo es más directo; documentar con tooltip |

## Rollback Plan

Revertir commits. El endpoint mantiene ruta — solo cambia DTO y lógica interna. Frontend: restaurar modal del historial git. Sin migraciones de BD involucradas.

## Dependencies

Ninguna externa. `StudyPlanRepository` y `CourseCycleRepository` ya existen.

## Success Criteria

- [ ] UPSERT: curso existente actualiza nombre; curso nuevo se crea
- [ ] `studyPlanId` opcional → procesa todos los planes del nivel
- [ ] `Level.fromParts` produce nivel correcto para cada combinación level+modality
- [ ] Frontend: "Generar Cursos" funciona con filtros de página; modal eliminado
- [ ] `pnpm test` pasa sin regresiones en api/ y web/
