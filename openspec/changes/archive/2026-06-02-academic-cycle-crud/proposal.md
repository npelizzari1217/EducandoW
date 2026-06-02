# Proposal: CRUD de Ciclos Lectivos + Refactor de CourseCycle

## Intent

AcademicCycle es read-only (solo GET), sin descripción, código, fechas de bimestre ni ID autonumérico. CourseCycle tiene los 8 campos de bimestre, pero deberían vivir en el ciclo y heredarse. Este cambio da CRUD completo a AcademicCycle, mueve las fechas de bimestre al ciclo, y hace que CourseCycle las herede opcionalmente, preservando datos existentes.

## Scope

**Nivel pedagógico**: ALL

### In Scope
- Schema: 5 nuevos campos en AcademicCycle (`description`, `numericId`, `code`, 4 pares bimestre); 8 campos de bimestre de CourseCycle pasan a opcionales
- Domain: entidad AcademicCycle con create/update, VOs para código (4 dígitos) y bimestre, repositorio CRUD
- API: endpoints POST/GET/PATCH/DELETE `/v1/academic-cycles` + DTOs + use cases
- API: refactor CourseCycle para heredar fechas (snapshot al crear, opcional al actualizar)
- Web: página `/academic-cycles` (tabla filtrable + formulario create/edit)
- Auth: `@Roles('ROOT', { module: 'COURSES', action: '*' })` por endpoint
- Testing: unit (domain), integration (API), e2e (web)

### Out of Scope
- Migración automática de datos existentes (CourseCycle ya tiene fechas → se preservan)
- Auditoría / changelog
- Cambios en Enrollment, Attendance u otras entidades que referencian AcademicCycle

## Capabilities

### Modified Capabilities
- `academic-cycle-query`: se expande a CRUD completo con nuevos campos → renombrar a `academic-cycle`
- `course-cycle`: bimestre pasa a opcional con herencia desde AcademicCycle; endpoint GET incluye fechas efectivas

## Approach

1. **AcademicCycle**: agregar `description` (texto opcional), `numericId` (Int PK autoincrement, mismo patrón que CourseCycle), `code` (Int 4 dígitos, único), y 4 pares de fechas de bimestre (`firstBimStart/End` … `fourthBimStart/End`). El `id` UUID existente se mantiene como identificador público. Se crean use cases CRUD, DTOs, controller.

2. **CourseCycle**: en vez de eliminar los 8 campos (rompería datos), hacerlos `@default(null)` — opcionales. Al crear un CourseCycle sin fechas propias, se toma snapshot de las fechas del AcademicCycle asignado. Al devolver en GET, se muestran las fechas efectivas (las del curso si existen, o las del ciclo). Esto mantiene backward compat y evita migración.

3. **Frontend**: nueva ruta `/academic-cycles`, visible bajo Académico en sidebar (requiere módulo COURSES). Tabla con columnas: código, nombre, nivel, activo, acciones.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `api/prisma/schema_tenant.prisma` | Modified | AcademicCycle +5 campos, CourseCycle 8 campos → nullable |
| `packages/domain/src/pedagogy/` | Modified | AcademicCycle entity expandida, nuevos VOs |
| `api/src/application/pedagogy/` | Modified | Use cases CRUD para AcademicCycle |
| `api/src/presentation/pedagogy/` | Modified | Controller + DTOs + module wiring |
| `api/src/application/course-cycle/` | Modified | Herencia de bimestre en create y GET |
| `web/src/pages/dashboard/` | New | Página `academic-cycles.tsx` |
| `web/src/components/layout/sidebar.tsx` | Modified | Nuevo ítem en menú |
| `web/src/App.tsx` | Modified | Nueva ruta |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| CourseCycle existente con fechas null rompe queries | Low | Los campos se mantienen físicamente; solo se agrega fallback en capa de presentación |
| Código duplicado entre instituciones | Low | `@@unique([code])` a nivel tenant; cada institución tiene su DB |
| Regresión en endpoint GET course-cycles | Low | Tests de integración cubren el nuevo response con fechas efectivas |

## Rollback Plan

1. Revertir migración de Prisma (los 8 campos de CourseCycle nunca se eliminan, solo pasan a optional → no reversible necesario)
2. Revertir código de API y web
3. Si se desplegó: los nuevos campos de AcademicCycle pueden quedar (no rompen GET existente)

## Dependencies

- Ninguna externa. Internamente depende del módulo COURSES existente y del patrón de entidades establecido por CourseCycle (PK int + UUID).

## Success Criteria

- [ ] POST/PATCH/DELETE /v1/academic-cycles funcionan con validación de VOs
- [ ] GET /v1/academic-cycles lista con filtros (level, active) y paginación
- [ ] CourseCycle GET incluye `effectiveBimonthDates` (propias o heredadas)
- [ ] CourseCycle POST sin bimonth hereda fechas del ciclo (snapshot)
- [ ] Página web `/academic-cycles` permite crear, editar, listar y soft-delete
- [ ] Control de acceso: ROOT ve todo; otros roles requieren módulo COURSES
- [ ] Tests pasan: unit ≥80% coverage, integration, e2e
