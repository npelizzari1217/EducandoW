# Proposal: Cursos Inteligentes — Creación con Contexto Automático

## Intent

Crear cursos secciones requiere hoy ingresar manualmente todos los campos (nombre, año lectivo, nivel, institución, grado, división). El sistema ya conoce el contexto del usuario (institución, nivel pedagógico) y tiene una tabla `academic_cycles`. Este cambio reemplaza el formulario genérico por uno inteligente que auto-completa lo que ya sabe, reduciendo fricción y errores humanos.

Nivel pedagógico: **ALL** (aplica a primario, secundario, inicial, terciario).

## Scope

### In Scope
- **Backend**: endpoint `GET /academic-cycles` que devuelva ciclos activos filtrados por institución y nivel
- **Backend**: modificar `CreateCourseSectionDTO` para que `name` sea opcional (auto-generado desde `grade`+`division`)
- **Backend**: generación automática del `name` en el use case cuando no se provee
- **Frontend**: reemplazar `GenericPage` con componente `CourseSectionsPage` custom con:
  - Ciclo lectivo auto-cargado desde API (readonly)
  - Nivel auto-cargado desde JWT (`user.level`) si es específico (1-4); dropdown si es `ADMINISTRACION=9` o ausente
  - Campos `grade` (requerido) + `division` (opcional) en lugar de `name`
  - Institución desde JWT (`user.institutionId`), mostrando nombre via `useInstitution()`, readonly
- **Tests**: endpoint de ciclos académicos + componente CourseSectionsPage

### Out of Scope
- Edición de cursos existentes (solo creación)
- Eliminación de cursos (ya funciona)

## Capabilities

### New Capabilities
- `academic-cycle-query`: API para consultar ciclos lectivos activos por institución/nivel
- `smart-course-creation`: Formulario inteligente de creación de cursos con auto-llenado contextual

### Modified Capabilities
- None (no existen specs de pedagogía en `openspec/specs/`; estas son capacidades nuevas)

## Approach

**Backend**: Agregar `GET /academic-cycles?institutionId=&level=` al `PedagogyController` con su use case. El `AcademicCycle` model ya existe en Prisma. Modificar `CreateCourseSectionUC` para generar `name = {grade} {division}` cuando `name` no se provee.

**Frontend**: Componente `CourseSectionsPage` que usa `useAuth()` y `useInstitution()` para leer contexto, llama al nuevo endpoint para ciclos, y renderiza un formulario con inputs condicionales (readonly vs editable según el nivel del usuario).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `api/src/presentation/pedagogy/pedagogy.controller.ts` | Modified | +GET /academic-cycles endpoint |
| `api/src/application/pedagogy/use-cases/` | New + Modified | Nuevo `ListAcademicCyclesUC`; modificado `CreateCourseSectionUC` |
| `api/src/presentation/auth/dto/register.request.ts` | Modified | `name` pasa a optional en `CreateCourseSectionSchema` |
| `api/src/infrastructure/persistence/prisma/` | New | `PrismaAcademicCycleRepo` |
| `packages/domain/src/pedagogy/` | New | Repo interface + entity (si no existe) |
| `web/src/pages/dashboard/pedagogy-pages.tsx` | Modified | `CourseSectionsPage` custom component |
| `web/src/pages/dashboard/__tests__/` | New | Tests del nuevo componente |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `academic_cycles` vacía en algún tenant | Medium | Si no hay ciclos activos, mostrar año corriente como fallback y advertir al usuario |
| `user.institutionId` faltante en JWT | Low | Validación frontend: si no existe, redirigir o mostrar error descriptivo |
| Nivel `ADMINISTRACION=9` requiere dropdown con todos los niveles | Low | Condición explícita en componente: `user.level === 9 \|\| !user.level` → dropdown completo |

## Rollback Plan

1. Revertir `CourseSectionsPage` a usar `GenericPage` (una línea)
2. Eliminar endpoint `GET /academic-cycles` y sus archivos asociados
3. Restaurar `name` como requerido en el DTO
4. El modelo `AcademicCycle` en la DB no se modifica — no hay migración destructiva

## Dependencies

- `AcademicCycle` model ya existe en `schema_tenant.prisma` (migración `20260522095306`)
- `useAuth()` y `useInstitution()` ya disponibles en el frontend

## Success Criteria

- [ ] Al crear un curso, el ciclo lectivo se auto-completa desde el ciclo activo actual
- [ ] Si el usuario tiene nivel PRIMARIO (2), el campo nivel aparece readonly con valor "PRIMARIO"
- [ ] Si el usuario es ADMINISTRACION (9), el campo nivel muestra un dropdown con todos los niveles
- [ ] El nombre del curso se genera automáticamente como "5to A" al ingresar grado=5 y división=A
- [ ] La institución se muestra como texto readonly (nombre), no como UUID
- [ ] Tests del nuevo endpoint y del componente pasan con coverage >= 80%
