# Explore: retiro-sala-grado-curso-teacher-s3b1

> Fase: sdd-explore · Store: hybrid · 2026-06-17
> S3b-1 del retiro de Teacher — `Sala`/`Grado`/`Curso.teacherId`.

## Resumen
- **Curso.teacherId**: columna FANTASMA — ningún código la lee/escribe (CursoProps no la tiene, repo/DTO/controller la ignoran). Drop limpio, cero cambios de app.
- **Sala.teacherId** (Inicial) y **Grado.teacherId** (Primario): VIVOS pero primitivos — `<Input>` de UUID crudo (sin dropdown ni lookup de nombre). Sala no lo muestra en la lista; Grado sí (columna "Docente" → UUID o "-"). Sin consumidores aguas abajo (boletín ya no lee Teacher tras S2). Cardinalidad 0..1, opcional, sin unicidad.

## Mapeo al modelo nuevo: INVIABLE
`Sala/Grado.teacherId` NO mapea a `AsignacionCursoXCiclo(rol=TITULAR)`:
- Sala no tiene FK a CourseCycle (es year-scoped: academicYear+ageGroup+turno).
- Grado tiene `courseSectionId?` (opcional) pero NO `cycleId` → no se puede resolver el CourseCycle ni el DocenteXCiclo (cycle-scoped).
Son un modelo paralelo legacy de secciones, anterior a la arquitectura de ciclos. La premisa de Decision #4 ("migrar a DocenteXCiclo") es estructuralmente imposible. La decisión real es DROP vs repoint-a-User.

## Approaches (Curso se dropea igual en ambos)
**A — Eliminar el campo** de Sala/Grado/Curso (schema FK+índice+columna, entidad, use-cases, DTOs, repos, controllers, forms web, columna "Docente" de Grado, tests). Cero migración de datos (FK es SetNull). Pierde asignaciones existentes (UUIDs crudos). ~20 archivos, ~150-200 líneas (mayormente borrados). Single PR.

**B — Repuntar a `User.id`** (patrón cross-DB AD-6, sin FK): el campo queda pero guarda User.id en vez de Teacher.id. Backfill por tenant: `UPDATE salas/grados SET teacher_id = (SELECT user_id FROM teachers WHERE id = teacher_id) WHERE teacher_id IS NOT NULL`. Pierde asignaciones donde `Teacher.userId` es null (mismo caveat que Fase 4). Reversible pre-drop. Mismo set de archivos + script.

## Decisión de producto requerida (BLOQUEA la propuesta)
Decision #4 quedó como "migrar" pero migrar al modelo nuevo es inviable. Definir:
1. ¿Sala/Grado conservan un campo de docente tras dropear Teacher? SÍ → Approach B; NO → Approach A.
2. (Si B) ¿se acepta perder asignaciones de Teachers sin userId? SÍ → backfill simple; NO → pre-poblar Teacher.userId antes.

(Curso: drop fantasma, sin decisión.)

## Riesgos
- R1 (MEDIO): pérdida de datos en Approach A (teacherIds no-null en prod).
- R2 (BAJO-MEDIO): Approach B → UUIDs huérfanos si Teacher.userId null.
- R3 (confirmado): AsignacionCursoXCiclo(TITULAR) NO es target viable.
- R4 (seguro): drop de Curso.teacher_id trivial.

## Scope
~20 archivos (schema+migración, 3 domain, 2 app, 3 infra, 6 presentation, 4 web, 3 tests, +1 script si B). ~150-200 líneas, mayormente borrados. Single PR. Migración SQL a mano + per-tenant deploy.

## Siguiente: resolver A vs B → sdd-propose. (Curso puede proponerse ya.)
