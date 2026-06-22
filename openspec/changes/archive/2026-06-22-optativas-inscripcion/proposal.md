# Proposal: Optativas — Inscripción por subconjunto

> Deuda #3 de `docente-ciclo-grupos`. Store: hybrid (engram `sdd/optativas-inscripcion/proposal`).

## Intent

Las materias optativas deben inscribir solo un SUBCONJUNTO elegido de alumnos. Hoy el cascade (`POST /course-cycles/:ccId/alumnos/:id/cascade`) inscribe a cada alumno en TODAS las `MateriaXCursoXCiclo` del CC, sin distinción: el concepto de "optativa" no existe en el modelo. Lo hacemos ahora porque sin él no hay forma de modelar materias electivas, y el modelo de grupos ya materializa materias por ciclo — es el punto natural para introducir el flag. Éxito = una optativa no auto-inscribe a nadie; el admin agrega/quita alumnos explícitamente.

## Scope

### In Scope
- Schema: `MateriaXCursoXCiclo.esOptativa Boolean @default(false)` (migración Prisma, sin backfill).
- Domain: `MateriaXCursoXCiclo` + `esOptativa`; `upsertMany`/`updateDescription` lo aceptan.
- `AlumnosXMateriaRepository.removeStudent(id)` + nuevo `RemoveStudentFromMateriaUseCase`.
- Endpoint `DELETE /course-cycles/:ccId/materias/:materiaId/alumnos/:id`.
- Endpoint `PATCH /course-cycles/:ccId/materias/:materiaId` para togglear `esOptativa`.
- Cascade: `filter(m => !m.esOptativa)` antes del `upsertMany`.
- `esOptativa` en `MateriaResponse` (`GET .../materias`).
- Web `GestionGrupos`: badge optativa, agregar/quitar alumno.

### Out of Scope
- `StudyPlanSubject.esOptativa` + UI a nivel plan (follow-up explícito).
- Auto-cleanup de alumnos ya inscriptos en optativas de CCs existentes.
- Bulk enrollment, cambios en notas/boletines, resolución de co-docencia.

## Approach

Reusar lo que existe: el alta manual (`AddStudentToMateriaUseCase`, `POST .../materias/:materiaId/alumnos`) ya funciona — solo falta el espejo de baja. El cambio de comportamiento central es un filtro de una línea dentro del cascade.

**Nivel pedagógico:** afecta `CursoXCiclo`/materias de forma GENÉRICA — todos los niveles que usan el modelo de grupos.

## Decisions

1. **Flag solo en `MateriaXCursoXCiclo`.** Costo cero en el cascade (las filas ya están en memoria; ir por `studyPlanSubjectId` exigiría N queries) y semántica de snapshot self-contained (editar el plan no toca filas materializadas). El flag a nivel plan es follow-up.
2. **El cascade filtra `!m.esOptativa`** — las optativas nunca se auto-inscriben.
3. **Alta manual reusada; baja nueva.** Se agrega `RemoveStudentFromMateriaUseCase` + `DELETE`.
4. **Toggle vía `PATCH .../materias/:materiaId`.**
5. **Retroactividad: SIN auto-cleanup.** Si se marca optativa DESPUÉS de cascade-enrollar, los alumnos quedan; el admin los quita a mano vía el nuevo `DELETE`. Evita una operación destructiva masiva y mantiene el cambio acotado.

## Risks

| Riesgo | Mitigación |
|--------|------------|
| Designación por-CC repetitiva (sin flag a nivel plan) | Amortizado por el follow-up de `StudyPlanSubject.esOptativa` |
| Query "qué alumnos pueden inscribirse" en optativa con 0 alumnos | Puede requerir método de repo nuevo; se evalúa en spec |
| Scope multi-capa | Encadenar: PR1 schema+domain+filtro cascade → PR2 DELETE+PATCH → PR3 web UI |
