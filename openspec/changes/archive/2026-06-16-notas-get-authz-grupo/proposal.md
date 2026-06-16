# Proposal: `notas-get-authz-grupo`

> Fase: sdd-propose · Store: hybrid · 2026-06-16
> Deuda follow-up #1 de `docente-ciclo-grupos` (WARNING-1 / F5-A2 / F5-T8 / F5-T9)

## Intent

`get-subject-grades-by-subject.use-case.ts` ya autoriza su gate con `authorizer.canWriteGrades(...)` (grupo-based, línea 93). La WARNING-1 del verify-report ("todavía usa Teacher+SubjectAssignment") está DESACTUALIZADA. El gap real: tras pasar el gate, la línea 104 llama `ccRepo.findEnrolledStudents(courseCycleId)`, que devuelve TODOS los alumnos del ciclo sin filtro de grupo. Un TEACHER scopeado a G1 ve también alumnos de G2. Este cambio agrega el FILTRO de conjunto de alumnos para que las lecturas queden scopeadas por grupo, igual que el write ya migrado, y desbloquea F5-T8/F5-T9 de `docente-ciclo-grupos`. Éxito = el GET devuelve solo alumnos de los grupos asignados al docente; admin/ROOT siguen viendo todos.

## Scope

**In:**
- Nuevo método `getAllowedStudentIds(userId, userRoles, courseCycleId, subjectId): Promise<string[] | 'all' | null>` en `AssignmentAuthorizerPort` (`null`=forbidden, `'all'`=bypass admin sin filtro, `string[]`=IDs permitidos).
- Nuevo método `AlumnosXGrupoRepository.findStudentIdsByGrupoIds(grupoIds): Promise<string[]>`.
- El GET reemplaza el gate booleano por la llamada de scope y filtra `students`.
- Tests unit del authorizer y del use-case (incluye F5-T8/T9 con mocks).

**Out:**
- Tests de integración reales con DB para F5-T8/T9 — los unit (mocks) bastan para desbloquear el spec; integración real queda DIFERIDA por patrón del proyecto.
- Remoción de legacy Teacher/SubjectAssignment — ya está ausente en este use-case.
- Cambios de DTO/controller/frontend — el frontend ya es grupo-aware (Fase 7).

## Approach (Opción A)

Mover el scope al authorizer (capa correcta) en vez de re-derivarlo en el use-case (Opción B, descartada: duplica 3 lookups, mete authz en orquestación). Path teacher: `resolveAccessScope → isAdministrative → 'all'`; sino `DocenteXCiclo` → `materiaXCursoXCiclo` → `findGroupsForDocente` → `findStudentIdsByGrupoIds` (dedup vía Set). Cualquier paso vacío → `null`. El use-case: `scope === null → forbidden`; `scope === 'all' → students`; sino `students.filter(s => scope.includes(s.studentId))`.

## Impact

~250 líneas, 8 archivos. El contrato de respuesta `SubjectGradesBySubjectResult.students[]` NO cambia de forma — solo baja el número de filas para teachers. Co-docencia: `@@unique([studentId, courseCycleId, subjectId])` → registro compartido; el dedup por Set es correcto. Bypass D3 ya resuelto vía `isAdministrative → 'all'`.

## Risks

1. **Migración de mocks (alto):** ~8 tests del GET mockean `canWriteGrades`; deben pasar a `getAllowedStudentIds` o crashean en runtime de test.
2. **Wiring del módulo:** `AssignmentAuthorizer` pasa de 2 a 3 deps; `grading.module.ts` debe inyectar `PrismaAlumnosXGrupoRepository` o falla la DI de NestJS.
3. **Grupo vacío:** teacher con grupo sin alumnos ve grilla vacía (correcto; riesgo de datos, no de código).

## Delivery

Estrategia **auto-chain**. Cabe en UN SOLO PR dentro del budget de 400 líneas — NO requiere chaining. Se declara explícitamente.

## Out-of-scope / Deferred

Integration tests reales F5-T8/T9 (diferidos); cleanup de legacy (ya hecho).
