# Explore: retiro-teacher-legacy

> Fase: sdd-explore · Store: hybrid · 2026-06-16
> Deuda D5 de `docente-ciclo-grupos`
> **Veredicto: BLOQUEADO — el retiro NO es seguro como operación atómica.**

## Resumen

`Teacher` y `SubjectAssignment` NO son código muerto: siguen siendo **load-bearing** para generación de boletines (todos los niveles), mesas/actas de examen, navegación de notas en modo homeroom, y la página de gestión de docentes. Además hay **4 FKs `Restrict`** sobre datos de producción que harían **fallar la migración a nivel DB** y, peor, implican **riesgo de pérdida de datos históricos**.

## Análisis de FKs en schema tenant (`api/prisma_tenant/schema.prisma`)

### Teacher (8 referencias)
| Modelo | Campo | onDelete | Riesgo |
|---|---|---|---|
| SubjectAssignment | teacherId | Cascade | Alto (encadena a Evaluacion/NotaTrimestral Restrict) |
| CourseCycle | homeroomTeacherId | SetNull | Medio (@deprecated; backfill Fase 4 a AsignacionCursoXCiclo TITULAR) |
| Sala / Grado / Curso | teacherId | SetNull | Medio (pierde asignación) |
| **MesaExamen** | presidenteId | **Restrict** | **CRÍTICO** — bloquea drop de Teacher |
| **ActaExamen** | presidenteId | **Restrict** | **CRÍTICO** — bloquea drop de Teacher |

### SubjectAssignment (2 hijos con Restrict)
| Modelo | Campo | onDelete | Riesgo |
|---|---|---|---|
| **Evaluacion** | assignmentId | **Restrict** | **CRÍTICO** — historial de evaluaciones |
| **NotaTrimestral** | assignmentId | **Restrict** | **CRÍTICO** — notas trimestrales legacy |

## Clasificación LIVE / DEAD

**DEAD (ya reemplazado por DocenteXCiclo — seguro de borrar):**
- Authz de notas: `AssignmentAuthorizer` (canWriteGrades / getAllowedStudentIds) ya no toca Teacher/SubjectAssignment.
- `upsert-subject-final-grades` / `upsert-subject-period-grades` — DocenteXCiclo.
- `list-teacher-subjects-in-course-cycle` — DocenteXCiclo.
- `list-teacher-course-cycles` **modo subject** — DocenteXCiclo.

**LIVE / load-bearing (bloquean el retiro):**
- `generate-boletin` (Primario, Secundario, y path legacy Inicial/Terciario) — consulta `subjectAssignment.findMany({ include: { teacher } })` en las 3 ramas. Romper esto rompe PDFs de todos los niveles.
- `list-teacher-course-cycles` **modo homeroom** — usa `teacherRepo.findByUserId` + `courseCycleRepo.findByHomeroomTeacher` (columna homeroomTeacherId).
- Gestión de docentes: `TeacherController` + `/teachers` + `teachers.tsx` (CRUD activo).
- `pedagogy.controller` + use-cases CRUD de SubjectAssignment + `/subject-assignments` UI.
- Mesas/actas de examen: `MesaExamen.presidenteId`, `ActaExamen.presidenteId`.
- Sala/Grado/Curso `teacherId` (formularios web Inicial/Primario/Secundario).

## Approach recomendado: ESCALONADO en 4 PRs (auto-chain)

- **B1 — Borrado de código muerto (~200 líneas, riesgo BAJO):** quitar CRUD de SubjectAssignment (UI + rutas + use-cases + repo infra). Mantener entidad de dominio (todavía la usa boletín). **Cero migración de datos, schema intacto.**
  **STATUS: DONE ✔ — Archivado 2026-06-16 como `retiro-evaluaciones-legacy-s1`.** Verify: PASS (0 CRITICAL, 0 WARNING). Commit: `bdd6b4b`. Canonical spec `evaluation-frontend/spec.md` marcada como RETIRED.
- **B2 — Migrar lookup de docente en boletín (~250, MEDIO):** reemplazar `subjectAssignment.findMany({include:{teacher}})` por DocenteXCiclo → userId → User (master). Nombre de docente es campo de display (degrada a vacío).
  **STATUS: DONE ✔ — Archivado 2026-06-17 como `retiro-boletin-docente-s2`.** Verify: PASS WITH SUGGESTIONS (0 CRITICAL, 0 WARNING, 3 SUGGESTION — dead mock data, no-fix). Tests 1211/1211, build PASS, schema+templates intactos. Canonical spec `report-cards/spec.md` actualizada (Requirement: Docente Name Source).
  > **Corrección de scope (IMPORTANTE):** S2 eliminó todas las lecturas de la tabla `Teacher` del boletín, lo cual DESBLOQUEA el drop de la tabla `Teacher` + FK `SubjectAssignment.teacherId` (etapa S3). Sin embargo, S2 NO habilita el drop de `SubjectAssignment`: esa tabla sigue siendo el backbone del path legacy Inicial/Terciario — provee la lista de materias Y es la única clave de join a `NotaTrimestral` (`NotaTrimestral.assignmentId`; `NotaTrimestral` no tiene `subjectId`). Dropear `SubjectAssignment` requiere una etapa nueva (S3-pre) que migre el grading de Inicial/Terciario fuera de `NotaTrimestral` primero.
- **B3a (S3a) — Migrar modo homeroom a AsignacionCursoXCiclo(TITULAR):** refactor homeroom branch de `ListTeacherCourseCyclesUseCase` a `AsignacionCursoXCiclo(rol=TITULAR)`; eliminar `findByHomeroomTeacher`; quitar `TeacherRepository` de `course-cycle.module.ts`.
  **STATUS: DONE ✔ — Archivado 2026-06-17 como `retiro-homeroom-titular-s3a`.** Verify: PASS WITH WARNINGS (0 CRITICAL, 1 WARNING — ERD WIP hygiene, expected). Tests 1212/1212, build PASS. Sin cambio de schema. Columna `homeroomTeacherId` queda (drop en S3b). Deploy precondición: verificar skip-count del backfill Fase 4 (TITULAR) por tenant antes de producción.
- **B3b (S3b) — Drop `homeroomTeacherId` + retiro `/teachers` admin + MesaExamen/ActaExamen (~TBD, MEDIO):** consumidores restantes de `Teacher` son ÚNICAMENTE: (1) `/teachers` admin CRUD + `teachers.tsx`, (2) `MesaExamen.presidenteId`/`ActaExamen.presidenteId` (FK Restrict). Una vez migrados ambos, la columna `homeroomTeacherId` (columna + FK + índice) y la tabla `Teacher` pueden dropearse. Requiere Decisions #2/#3.
  **STATUS: PENDING — depende de Decisions #2/#3 (Teacher track).**
- **B3-pre (ETAPA NUEVA) — Migrar grading Inicial/Terciario de `NotaTrimestral` al modelo nuevo (~estimado ALTO):** mientras `NotaTrimestral` sea la fuente de notas para Inicial/Terciario, `SubjectAssignment` no puede dropearse (es el join key). Esta etapa migra esos niveles al modelo de grading nuevo (SubjectPeriodGrade/SubjectFinalGrade) y archiva los datos legacy. Requiere Decision #1.
  **STATUS: PENDING (nueva etapa identificada en diseño de S2) — depende de S3 + Decision #1.**
- **B4 — Drop de `SubjectAssignment` + archival de `Evaluacion` / `NotaTrimestral` + MesaExamen/ActaExamen cleanup (~300 + scripts, ALTO):** después de S3-pre, `SubjectAssignment` ya no tiene consumidores. Drop de tabla, archival/decisión sobre `Evaluacion`/`NotaTrimestral` histórico (Decision #1), y resolución de `presidenteId` en MesaExamen/ActaExamen (Decision #2). Deploy escalonado (precedente: cleanup D1 de ingresantes).
  **STATUS: PENDING — depende de S3 + S3-pre + las 3 decisiones de producto.**

Big-bang descartado: ~1000-1200 líneas, riesgo muy alto, pérdida de datos fácil de provocar.

## Decisiones de producto (RESUELTAS 2026-06-17)
1. **Evaluacion / NotaTrimestral** (historial de notas legacy): PENDIENTE — define el destino del histórico (gate de S3-pre / B4). Aún sin resolver.
2. **MesaExamen / ActaExamen** `presidenteId`: **RESUELTO → migrar a User/DocenteXCiclo** (+ backfill de datos). Habilita dropear Teacher.
3. **Página /teachers**: **RESUELTO → retirar** (gestión de docentes vía User + DocenteXCiclo).
4. **Sala/Grado/Curso.teacherId**: **RESUELTO → DROP (Approach A)** — migración a ciclos era estructuralmente inviable (Sala/Grado son year-scoped sin cycleId; Curso era ghost column). Implementado en S3b-1, archivado 2026-06-17.

## S3b — Epic de retiro de la tabla Teacher (intención confirmada: retiro total)
Consumidores REALES restantes de `Teacher` (verificado 2026-06-17; los refs en users.use-cases / upsert-subject-final-grades / list-teacher-* / course-cycle.module son solo comentarios/labels, NO leen la tabla):
- ~~(a) `/teachers` admin CRUD (use-cases + controller + prisma-teacher.repository + teachers.tsx + sidebar + ruta)~~ → **DONE ✔ S3b-2 (2026-06-17)** — retirado; gestión de persona docente vía `/users` + `/docentes-x-ciclo`.
- (b) `MesaExamen.presidente` + `ActaExamen.presidente` (FK **Restrict**) → **migrar presidenteId a User/DocenteXCiclo** + backfill (#2)
- ~~(c) `Sala`/`Grado`/`Curso.teacherId`~~ → **DONE ✔ S3b-1 (2026-06-17)** — columnas eliminadas (Approach A DROP). Formularios web actualizados. Deploy precondición: per-tenant migrate-tenants (R1 data loss aceptado).
- (d) `CourseCycle.homeroomTeacherId` (FK SetNull) → ya nadie la lee post-S3a → **drop de columna sin decisión** (slice chico)
- (e) `SubjectAssignment.teacherId` (FK **Cascade**) → gate de datos: dropear Teacher cascadea a SubjectAssignment, bloqueado por Evaluacion/NotaTrimestral Restrict → requiere **S3-pre** (migrar grading Inicial/Terciario fuera de NotaTrimestral, Decision #1).

Slices sugeridos (cada uno su propio SDD; el drop final de Teacher requiere TODOS):
- **S3b-0** (seguro, sin decisión): drop columna `homeroomTeacherId` + FK + índice + campo deprecado.
  **STATUS: DONE ✔ — Archivado 2026-06-17 como `retiro-homeroom-column-s3b0`.** Verify: PASS WITH WARNINGS (0 CRITICAL; WARNING-1 = baseline tsc pre-existente sin relación; WARNING-2 = rollback DDL, corregido en commit `9e3deb3`). Tests 1204/1204, prisma:generate OK, build PASS, sweep ZERO. Eliminados: columna `homeroom_teacher_id` + FK `course_cycles_homeroom_teacher_id_fkey` + index `course_cycles_homeroom_teacher_id_idx` + 2 backfill scripts obsoletos (`backfill-asignacion-curso.ts`, `backfill-docente-x-ciclo.ts`) + sus tests. Recuperables de git history. Deploy precondición: backfill Fase 4 TITULAR completo por tenant antes de `migrate-tenants`.
- **S3b-1** (DONE ✔ — Approach A): DROP `Sala/Grado/Curso.teacherId` — migración a DocenteXCiclo/User era estructuralmente inviable (Sala/Grado sin cycleId; Curso era ghost column). Archivado 2026-06-17 como `retiro-sala-grado-curso-teacher-s3b1`. Verify: PASS (0 CRITICAL, 0 WARNING, 0 SUGGESTION). Tests api 1204 + web 394 green, prisma:generate OK, build PASS, sweep ZERO. Commits: `8dcdd02`, `ed73d2c`, `90d0aec`. Deploy precondición: per-tenant `migrate-tenants` (R1 data loss aceptado — teacher_id no-null en salas/grados se pierde permanentemente).
- **S3b-2**: retirar `/teachers` admin (gestión vía User+DocenteXCiclo).
  **STATUS: DONE ✔ — Archivado 2026-06-17 como `retiro-teachers-admin-s3b2`.** Verify: PASS (0 CRITICAL, 0 WARNING, 1 SUGGESTION — dashboard card "Docentes" con copy estático sin enlace, dejado intencional). Tests api 1198 + web 394 green, build PASS, sweep ZERO, sin schema change. 3 commits en branch `feat/retiro-teachers-admin-s3b2`. Canonical spec `teacher-identity-authz/spec.md` actualizada (TIA-R10). **R-GAP OPEN:** ningún path crea Teacher rows nuevos; creación de MesaExamen/ActaExamen con presidente sin Teacher row preexistente queda bloqueada hasta S3b-3.
- **S3b-3**: migrar `MesaExamen/ActaExamen.presidenteId` a User/DocenteXCiclo + backfill (Restrict).
- **S3-pre**: migrar grading Inicial/Terciario fuera de NotaTrimestral (Decision #1 pendiente) → habilita drop de SubjectAssignment.
- **S3b-final**: drop tabla `Teacher` + entidad de dominio + repo, una vez (a)-(e) resueltos.

## Risk register (resumen)
- R1 (CRÍTICO): pérdida de Evaluacion/NotaTrimestral al dropear SubjectAssignment sin archivar.
- R2 (CRÍTICO): Restrict de MesaExamen/ActaExamen bloquea drop de Teacher.
- R3 (ALTO): boletín de todos los niveles consulta SubjectAssignment+Teacher.
- R4 (ALTO): nav homeroom se rompe si el backfill Fase 4 está incompleto en algún tenant.
- R5 (MEDIO): Sala/Grado/Curso teacherId quedan en null (SetNull) — pérdida de asignación.

## Siguiente paso (2026-06-17)
S1, S2, S3a, **S3b-0**, **S3b-1**, **S3b-2** DONE. Decisions #2/#3/#4 resueltas (retiro total de Teacher). Orden de ejecución recomendado: **S3b-3** (exámenes, Restrict+backfill, cierra R-GAP) → **S3-pre** (NotaTrimestral, pendiente Decision #1) → **S3b-final** (drop tabla Teacher). Cada slice = su propio SDD. Consumidores Teacher remanentes: (b) `MesaExamen/ActaExamen.presidenteId` (FK Restrict → Teacher; migra S3b-3) + `SubjectAssignment.teacherId` (FK Cascade; gate S3-pre / NotaTrimestral, Decision #1 pendiente). `CourseCycle.homeroomTeacherId` ya no existe (dropped S3b-0). `Sala/Grado/Curso.teacherId` ya no existe (dropped S3b-1). `/teachers` admin ya no existe (retired S3b-2). **R-GAP OPEN** — ningún path crea Teacher rows nuevos hasta S3b-3.
