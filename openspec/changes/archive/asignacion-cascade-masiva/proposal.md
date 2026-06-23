# Proposal: asignacion-cascade-masiva

## Nivel pedagógico afectado

Level-agnostic por CourseCycle. Cada CourseCycle ya tiene su nivel + plan de estudios definidos, así que la operación es inherentemente acotada a un solo nivel por ejecución. No hay riesgo cruzado entre niveles.

## Intent

Agregar un botón masivo "Asignar materias y competencias" a nivel de FILA DE CURSO en CursosXCiclo (`web/src/pages/dashboard/course-cycles.tsx`, junto a Materias/Alumnos/Editar/Eliminar) que ejecute la cascada de materias + competencias para TODOS los alumnos inscriptos de un CourseCycle de una sola vez.

Éxito: con un click + confirmación, todos los alumnos del curso quedan con sus `MateriasXAlumnoXCursoXCiclo` y `CompetenciaXMateriaXAlumnoXCursoXCiclo` creadas, sin pasar alumno por alumno.

## Problem

Hoy solo existe la cascada PER-STUDENT (panel Alumnos: `POST /course-cycles/:ccId/alumnos/:id/cascade`), verificada y correcta (HIGH confidence, idempotente, 16 tests). Para un curso de 30+ alumnos hay que repetir la acción manualmente uno por uno. No existe ningún endpoint, use case ni handler bulk.

## Scope

### In (este change)
- Use case dedicado `cascade-all-students-materias-competencias.use-case.ts` en `api/src/application/course-cycle/`.
- Endpoint `POST /course-cycles/:ccId/alumnos/cascade` (sin `:id`).
- Registro en el módulo NestJS.
- Botón + confirmación + toast en `course-cycles.tsx`.
- Tests (TDD): use case, controller, frontend.

### Out (futuros changes)
- Modificar la cascada per-student (queda intacta).
- Ejecución concurrente (Promise.all) — se hace secuencial.
- Tocar grades / `CompetenciaPeriodo` (ADR-7: nunca se tocan).

## Approach (decisiones tomadas)

1. **Use case dedicado** (Opción B): trae materias del curso UNA vez y competencias una vez por `studyPlanSubjectId` único, luego itera las filas de `findByCourseCycle(ccId)`. Reusa `upsertMany` + `bulkCreate` (skipDuplicates) → idempotente. NO delega al use case per-student (evita N+1 `findById`).
2. **Orden de ruta CRÍTICO**: registrar `POST /alumnos/cascade` ANTES de `POST /alumnos/:id/cascade`, o NestJS matchea "cascade" como `:id`. Mismo patrón ya resuelto para `/printable`.
3. **Falla parcial = best-effort**: si la cascada de un alumno lanza, se loguea, se sigue con el resto y se cuenta como `studentsFailed`. Seguro por idempotencia (re-correr saltea lo hecho). Sin throw del operativo completo (Result, no excepción).
4. **Respuesta agregada**: `{ studentsProcessed, studentsFailed, materiasCreated, materiasSkipped, competenciasCreated, competenciasSkipped }`.
5. **Frontend**: diálogo de confirmación antes de ejecutar; botón con loading/disabled in-flight; deshabilitado/oculto cuando el curso tiene 0 alumnos; toast de éxito/error en `course-cycles.tsx`.

## Impact

- API: 1 use case nuevo, 1 endpoint, 1 provider en módulo.
- Frontend: 1 botón + estado `cascadingBulkCcId` + handler en `course-cycles.tsx`.
- Sin migraciones, sin nuevas tablas, sin nuevos repos (puertos ya existen).

## Rollback

Quitar botón frontend + endpoint + use case + provider. Sin migración que revertir. La cascada per-student no se ve afectada.
