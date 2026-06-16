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
  **STATUS: PENDING — depende de B1 (completo). Safe to start.**
- **B3 — Migrar modo homeroom + drop homeroomTeacherId (~350, MEDIO):** refactor a AsignacionCursoXCiclo rol=TITULAR; quitar findByHomeroomTeacher; decidir destino de la página /teachers. Requiere verificar backfill Fase 4 completo por tenant.
  **STATUS: PENDING — depende de B2. Decisions #2/#3 (Teacher track) deben resolverse primero.**
- **B4 — Migración de datos + drop de schema (~300 + scripts, ALTO):** decisión sobre MesaExamen/ActaExamen y archivado de Evaluacion/NotaTrimestral ANTES de dropear. Deploy escalonado (precedente: cleanup D1 de ingresantes).
  **STATUS: PENDING — depende de B2+B3 y de las 3 decisiones de producto (ver sección abajo).**

Big-bang descartado: ~1000-1200 líneas, riesgo muy alto, pérdida de datos fácil de provocar.

## Decisiones de producto requeridas ANTES de proponer
1. **Evaluacion / NotaTrimestral** (historial de notas legacy): ¿borrar, archivar, o conservar SubjectAssignment permanentemente para niveles legacy?
2. **MesaExamen / ActaExamen** `presidenteId`: ¿migrar a User/DocenteXCiclo, o mantener `Teacher` como registro permanente solo para mesas de examen?
3. **Página /teachers**: ¿se retira (reemplazada por gestión basada en User) o se mantiene como vista legacy?

## Risk register (resumen)
- R1 (CRÍTICO): pérdida de Evaluacion/NotaTrimestral al dropear SubjectAssignment sin archivar.
- R2 (CRÍTICO): Restrict de MesaExamen/ActaExamen bloquea drop de Teacher.
- R3 (ALTO): boletín de todos los niveles consulta SubjectAssignment+Teacher.
- R4 (ALTO): nav homeroom se rompe si el backfill Fase 4 está incompleto en algún tenant.
- R5 (MEDIO): Sala/Grado/Curso teacherId quedan en null (SetNull) — pérdida de asignación.

## Siguiente paso
NO proponer aún. Resolver las 3 decisiones de producto. PR B1 (código muerto) es seguro y se puede arrancar ya, independiente de esas decisiones.
