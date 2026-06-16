# Verify Report: docente-ciclo-grupos

> Fecha: 2026-06-12
> Rama: feat/docente-ciclo-fase7 (fases 1–7 completas, stack de 7 PRs)
> Ejecutor: sdd-verify (claude-sonnet-4-6)

## Veredicto: PASS WITH WARNINGS

**0 CRITICAL · 3 WARNING · 5 SUGGESTION**

---

## Build / Test Results

| Paquete | TypeScript | Tests |
|---------|-----------|-------|
| `packages/domain` | 0 errores (CLEAN) | 92 archivos · 1004 pasaron · 0 fallaron |
| `api` | 11 errores (TODOS PRE-EXISTENTES: `academicYear`×4, `BimonthPeriod`×2, `competency.controller`×2, `GradeScaleNotConfiguredError`×1, `course-cycle.dto`×2) | 112 archivos · 1084 pasaron · 6 fallaron (TODOS PRE-EXISTENTES: `postgres-admin` Pool mock×6 + `ensure-institution-levels` PrismaClient mock×1 suite) |
| `web` | 0 errores (CLEAN) | 32 archivos · 351 pasaron · 0 fallaron |
| `web vite build` | PASS (exit 0, 205 módulos, 5.80s) | — |

Ningún fallo nuevo introducido por este cambio.

---

## WARNING-1: GET de notas con authz legacy (F5-A2 diferido)

**Archivo**: `api/src/application/grading/get-subject-grades-by-subject.use-case.ts`

`GetSubjectGradesBySubjectUseCase` aún usa `Teacher+SubjectAssignment` para autorizar lectura. El spec delta de notas requiere "Teacher ve solo los alumnos de su grupo asignado" — ese escenario NO está satisfecho para el path de GET.

Explícitamente diferido y documentado en tasks (F5-A2 marcado `[x]` como deferral intencional). Los paths de escritura (`upsert-subject-period-grades`, `upsert-subject-final-grades`) están correctamente protegidos. No es una regresión — el GET nunca fue group-scoped. Requiere un SDD de seguimiento para migrar el authz del GET a grupo-based.

**Tests pendientes relacionados**: F5-T8, F5-T9

## WARNING-2: smart-course-creation/delta.md inconsistente con D1

**Archivo**: `openspec/changes/docente-ciclo-grupos/specs/smart-course-creation/delta.md`

El delta contiene dos escenarios supersedidos por D1:
- _"Re-generating with no linked data replaces subject rows"_ — la implementación es aditiva (createMany skipDuplicates), NO reemplaza.
- _"Re-generation blocked when graded data exists"_ — la implementación nunca bloquea; siempre es aditiva.

La implementación sigue D1 (correcto). El archivo de spec está desactualizado. `decisions.md` explicita "D1 corrige el supuesto previo de rechazar la regeneración". **El delta.md debe actualizarse antes o durante el archive para reflejar D1.**

## WARNING-3: Firma de isPreceptor diverge del spec

**Spec F4-D2** dice `isPreceptor(userId, courseCycleId)`.
**Implementación real**: `isPreceptor(docenteXCicloId, courseCycleId)` — tanto en el dominio como en el repositorio.

El comportamiento es equivalente: el use-case resuelve el `DocenteXCiclo` del userId antes de llamar con `dxcId`. La firma en el spec está desactualizada.

---

## SUGGESTION-1: 14 tests de integración diferidos (aceptables)

| Fase | Tests diferidos |
|------|----------------|
| F1 | T4, T5, T6 |
| F2 | T6, T7, T8 |
| F3 | T9, T10, T11, T12 |
| F4 | T5, T6, T7 |
| F5 | T8, T9 |
| F6 | T3, T8, T9 |

Todos explícitamente marcados `[ ]` en tasks. Requieren contexto de DB tenant real, cross-tenant isolation o el GET authz de F5-A2. **Clasificación: aceptable deferral — no bloquean archive.**

## SUGGESTION-2: F5-T5 (test de co-docencia unitario) pendiente

El comportamiento está garantizado por `@@unique([courseCycleId, subjectId, studentId])` en la DB, no por el authorizer. El test descriptivo puede agregarse como anotación o en el follow-up SDD.

## SUGGESTION-3: F6-T3 (Door 1 fail) pendiente

Door 1 se enforce vía `@Roles` del guard de NestJS a nivel de controller, no a nivel del use-case. No testeable como unit test puro. Requiere integration test.

## SUGGESTION-4: Chunk size warning en Vite (pre-existente)

`dist/assets/index-BG_ExsiL.js` 656 kB y `html2pdf` 984 kB superan el umbral de 500 kB. Pre-existente; no introducido por este cambio.

## SUGGESTION-5: Comentario deprecation en homeroomTeacherId (cosmético)

El campo lleva `/// @deprecated — migrado a AsignacionCursoXCiclo rol=TITULAR (Fase 4 backfill)` como triple-slash comment (Prisma doc comment). F4-S3 pedía `// @deprecated`. Semánticamente equivalente; el triple-slash es más visible en Prisma Studio. Sin impacto funcional.

---

## Cobertura de Specs por Capability

| Capability | Reqs | Estado |
|---|---|---|
| UP (user-persona) | UP-R1..R3 / UP-S1..S6 | PASS (S3..S6 integration deferred) |
| DC (docente-ciclo) | DC-R1..R5 / DC-S1..S9 | PASS (S1/S2/S9 integration deferred) |
| MGC (materia-grupo-ciclo) | MGC-R1..R6 / MGC-S1..S13 | PASS (S1/S2/S10..S13 integration deferred) |
| ACC (asignacion-curso-ciclo) | ACC-R1..R5 / ACC-S1..S8 | PASS (S1/S3/S8 integration deferred) |
| Notas delta | Write authz scenarios | PASS (GET authz deferred — WARNING-1) |
| Asistencia delta | Todos los escenarios | PASS (T3/T8/T9 integration deferred) |
| Smart-course-creation delta | Generación aditiva (D1) | PASS (delta.md stale — WARNING-2) |

---

## Invariantes Arquitecturales Verificadas

- **grupo ⊆ materia**: cadena FK `AlumnosXGrupo → AlumnosXMateria` garantizada a nivel DB (decisión de diseño implementada correctamente).
- **Co-docencia**: `@@unique([studentId, courseCycleId, subjectId])` asegura 1 registro de nota compartido entre docentes.
- **D3 bypass**: `resolveAccessScope(isAdministrative)` guarda el bypass de gestión en use-cases de notas y asistencia.
- **NULLS NOT DISTINCT** en índice único de `asignaciones_curso_x_ciclo` (Postgres 15+, compliance D2).
- **homeroomTeacherId** preservado con `/// @deprecated` en schema (compliance D5).
- **Fases 1–7 completadas**: todas las tareas core marcadas `[x]` en tasks.md; solo integration tests `[ ]`.

---

## Siguiente Paso Recomendado

`sdd-archive` — Los Warnings son deferrals documentados o texto de spec desactualizado. No hay CRITICALs. Listo para archivar con deuda registrada.

### Deuda registrada para follow-up SDD

1. ~~Migrar GET de notas a authz grupo-based (F5-A2 + F5-T8/T9)~~ **RESUELTO** por `notas-get-authz-grupo` (2026-06-16). F5-T8/T9 cerrados a nivel unit; DB integration sigue diferida (ver ítem 4).
2. Retiro de `Teacher` y `SubjectAssignment` (D5)
3. Optativas: asignación de subconjunto de alumnos a materia (diferido)
4. Tests de integración multi-tenant (F1-T4..T6, F2-T6..T8, F3-T9..T12, F4-T5..T7, F6-T8/T9). Nota: F5-T8/T9 cerrados a nivel unit por `notas-get-authz-grupo`; los tests de integración DB para esos escenarios siguen pendientes.
5. Actualizar `smart-course-creation/delta.md` para reflejar D1
