# Exploration: optativas-inscripcion

> Change: optativas-inscripcion — Deuda #3 de `docente-ciclo-grupos`
> Phase: explore · Store: hybrid (también en engram `sdd/optativas-inscripcion/explore`)

## Problem Framing

Las materias optativas deben inscribir solo un SUBCONJUNTO elegido de alumnos en un `CursoXCiclo`. Hoy el mecanismo de cascade (`POST /course-cycles/:ccId/alumnos/:id/cascade`) inscribe a un alumno en TODAS las `MateriaXCursoXCiclo` del CC sin distinción. El concepto de "optativa" no existe en el modelo.

## Current Model

**Schema** (`api/prisma_tenant/schema.prisma`):
- `MateriaXCursoXCiclo` (línea 173): `id, courseCycleId, subjectId, studyPlanSubjectId?` — sin `esOptativa`.
- `StudyPlanSubject` (línea 595): `id, studyPlanCourseId, subjectId, hoursPerWeek?` — sin `esOptativa`.
- `Subject` (línea 367): `id, name, level, modality` — sin tipo/optativa.
- `MateriaCarrera.regimen` ("PROMOCIONAL"|"REGULAR"|"LIBRE") — solo terciario, no relacionado.

**Auto-enrollment (mecanismo clave):**
`CascadeStudentMateriasCompetenciasUseCase` (`api/src/application/course-cycle/cascade-student-materias-competencias.use-case.ts`):
1. Trae TODAS las `MateriaXCursoXCiclo` del CC (línea 54: `findByCourseCycleId`).
2. `upsertMany` de TODAS para el alumno (línea 62).
3. Disparado explícitamente por el admin vía `POST /course-cycles/:ccId/alumnos/:id/cascade`.
4. UI: `AlumnosCursoCicloPanel` (botón "Asignar materias y competencias", `web/src/pages/dashboard/components/AlumnosCursoCicloPanel.tsx` línea 160).

**Alta manual por alumno (ya funciona):**
- `AddStudentToMateriaUseCase` (`api/src/application/materia-grupo-ciclo/add-student-to-materia.use-case.ts`) — agrega un alumno a `MateriasXAlumnoXCursoXCiclo`, idempotente.
- Endpoint: `POST /course-cycles/:ccId/materias/:materiaId/alumnos` (controller línea 114).
- UI: página `GestionGrupos` (`web/src/pages/dashboard/gestion-grupos.tsx`) — ya muestra materias y permite agregar alumnos.

**Falta:** `AlumnosXMateriaRepository` (`packages/domain/src/materia-grupo-ciclo/repositories/alumnos-x-materia-repository.ts`) tiene `addStudent`, `upsertMany`, pero NO `removeStudent`. No existe endpoint de quitar alumno de una materia.

**Cadena de materialización:**
`GenerateCourseCyclesUseCase` (líneas 397–412) → `MaterializeMateriasUseCase` (fire-and-forget) — crea filas `MateriaXCursoXCiclo` desde `StudyPlanCourseDto.subjects` (`{id, subjectId, subjectName?, hoursPerWeek?}`) — sin flag.

## Key Questions Answered

1. **¿De dónde sale la designación optativa?** De NINGÚN lado. No existe `optativa`/`obligatoria`/`tipo`/`isOptional` en ningún modelo. Hay que introducirlo de cero.
2. **¿Dónde poner el flag?** Dos candidatos: `StudyPlanSubject.esOptativa` (nivel plan) o `MateriaXCursoXCiclo.esOptativa` (instancia materializada). El cascade ya tiene las filas MXCxC en memoria — filtrar `!m.esOptativa` es costo cero si el flag está ahí. Ir por el soft ref `studyPlanSubjectId` requeriría N queries extra.
3. **¿Hay endpoint de quitar alumno de materia?** No. Hay que agregarlo.
4. **Co-docencia:** El spec (MGC-R5) dice que se permite overlap; la implementación (`add-student-to-grupo.use-case.test.ts` línea 6) dice que co-docencia se removió. Discrepancia preexistente, fuera de scope.
5. **¿El cascade es automático?** No — es explícito por alumno (botón del admin). El bypass de optativa es un filtro dentro del cascade, no una rama en tiempo de generación.

## Approaches Compared

| | A: Flag en StudyPlanSubject | B: Flag en MateriaXCursoXCiclo | C: Flag en ambos |
|---|---|---|---|
| Migraciones | 1 | 1 | 2 |
| Filtro cascade | N-query extra vía soft ref | Trivial — filas ya traídas | Trivial |
| Semántica snapshot | Rota — editar plan afecta materias existentes | Self-contained | Mejor — editar plan no toca filas materializadas |
| UI a nivel plan | Toggle natural en editor de plan | No visible en plan | Completo |
| Esfuerzo | Medio | Bajo | Medio-Alto |
| ¿Mínimo viable? | No | Sí (difiere UI a nivel plan) | Solución completa |

## Recommended Approach

**Mínimo viable: flag solo en `MateriaXCursoXCiclo`, con camino limpio a C completo en follow-up.** El filtro del cascade es el cambio de comportamiento central; la designación a nivel plan es nice-to-have.

## Scope Boundaries

**In scope:**
- Schema: `MateriaXCursoXCiclo.esOptativa Boolean @default(false)` (migración Prisma, sin backfill — filas existentes quedan `false`).
- Domain: entidad `MateriaXCursoXCiclo` con `esOptativa`; `MateriaXCursoXCicloRepository.upsertMany`/`updateDescription` aceptan `esOptativa`.
- `AlumnosXMateriaRepository`: agregar `removeStudent(id): Promise<void>`.
- Nuevo `RemoveStudentFromMateriaUseCase` + endpoint `DELETE /course-cycles/:ccId/materias/:materiaId/alumnos/:id`.
- `PATCH /course-cycles/:ccId/materias/:materiaId` para togglear `esOptativa`.
- `CascadeStudentMateriasCompetenciasUseCase`: filtrar `materias.filter(m => !m.esOptativa)` antes del upsertMany.
- `GET /course-cycles/:ccId/materias`: incluir `esOptativa` en `MateriaResponse`.
- Web UI (`GestionGrupos`): badge optativa, afordance de agregar alumno en optativas, botón de quitar de materia.
- Tests: unit del filtro cascade + remove UC; integración de persistencia del flag.

**Out of scope:**
- `StudyPlanSubject.esOptativa` y UI a nivel plan (follow-up).
- Bulk enrollment a optativas (ya excluido por MGC-S6).
- Cambios en notas/boletines.
- Resolución del modelo de co-docencia.
- Limpieza de alumnos ya inscriptos en optativas de CCs existentes.

## Risks

1. **Retroactividad del cascade:** Si el admin marca optativa DESPUÉS de que algunos alumnos ya fueron cascade-enrolled, esos quedan inscriptos. Sin auto-cleanup. La proposal debe definir el workflow (remove manual + toggle, o una operación de un-cascade).
2. **Discrepancia spec-impl (co-docencia):** MGC-S12 dice overlap permitido; el código dice removido. No bloquea, pero la UI de optativa que muestra "agregar a grupo" puede exponerlo.
3. **Soft ref:** Sin `StudyPlanSubject.esOptativa`, el admin marca optativas por-CC (post-materialización). Para instituciones con muchos CCs es repetitivo; el follow-up de flag a nivel plan lo amortiza.
4. **Query `?unassigned=true` en optativas:** Cuando una optativa tiene 0 alumnos, la query existente puede no servir para "qué alumnos pueden inscribirse". Puede requerir un nuevo método de repo (alumnos del CC filtrados contra `MateriasXAlumnoXCursoXCiclo`).
5. **Scope de PR:** schema + domain + app + infra + presentation + web. Recomendado encadenar: PR1 (schema + domain + filtro cascade) → PR2 (remove endpoint + PATCH esOptativa) → PR3 (web UI).
