# Design: Docente / Materia / Grupo por Ciclo

## Technical Approach

Clean Architecture multi-tenant ya existente: persona en `prisma_master` (`User`), todo lo pedagógico en `prisma_tenant`. Se agregan 5 entidades tenant + 1 de asignación a nivel curso, materializadas (no derivadas) desde el plan de estudios al "Generar" el `CourseCycle`. La restricción dura **grupo ⊆ materia ⊆ curso** se garantiza por FK (el grupo referencia la fila de pertenencia a la materia, no el `studentId` suelto). Las notas siguen keyeadas por `(student, courseCycle, subject)` — el grupo es solo el **lente de alcance/autorización**, lo que da co-docencia con 1 registro compartido sin tocar `SubjectPeriodGrade`/`SubjectFinalGrade`. Cada fase = 1 PR con migración Prisma reversible + script de backfill idempotente; nada se elimina en este cambio (coexistencia total).

## Architecture Decisions

### Decision: Grupo referencia la pertenencia a materia, no el studentId
**Choice**: `AlumnosXGrupoXCursoXMateriaXCiclo.alumnosXMateriaXCursoXCicloId` → FK a `AlumnosXMateriaXCursoXCiclo` (universo).
**Alternatives**: guardar `studentId` directo en el grupo + validar a nivel app.
**Rationale**: el FK hace IMPOSIBLE meter en un grupo a un alumno que no esté en el universo de la materia → grupo ⊆ materia garantizado por la BD, no por código. `materia ⊆ curso` ya queda por la cadena `MateriaXCursoXCiclo.courseCycleId`. El `studentId` se obtiene por join.

### Decision: Notas sin grupoId — grupo como alcance, no como clave
**Choice**: `SubjectPeriodGrade`/`SubjectFinalGrade` quedan keyeadas por `(student, courseCycle, subject)` (sin cambios de esquema).
**Alternatives**: agregar `grupoId` a las notas (1 registro por grupo).
**Rationale**: el requisito es **1 registro por alumno-materia compartido** entre docentes (co-docencia). Agregar `grupoId` duplicaría notas y rompería boletines existentes. El grupo se usa solo para resolver permiso de lectura/escritura.

### Decision: Los grupos SON la asignación docente-materia (sin tabla aparte)
**Choice**: "qué docentes dan una materia" = `DISTINCT docenteXCicloId` de los `GrupoXCursoXMateriaXCiclo` de esa materia.
**Alternatives**: tabla `DocenteXMateria` separada.
**Rationale**: fuente única de verdad; una tabla extra se desincronizaría con los grupos. Materia normal = 1 grupo (todos) = 1 docente; partida = N grupos = N docentes.

### Decision: DocenteXCiclo unifica docente y preceptor; los distingue el módulo del User
**Choice**: una sola entidad de participación por ciclo; rol funcional vive en la asignación (grupo = docente, `AsignacionCursoXCiclo` = preceptor/titular) y los permisos en módulos del `User` (3 puertas, `educandow/rbac-access-model`).
**Rationale**: evita duplicar personas; alcance = asignación, permiso = módulo.

### Decision: userId sin FK (cross-DB), patrón AD-6 ya vigente
**Choice**: `DocenteXCiclo.userId` y `AsignacionCursoXCiclo` resuelven persona vía `User.id` master, sin FK (igual que `Teacher.userId`).
**Rationale**: tenant y master son bases separadas; el patrón ya existe en `Teacher`/`CourseCycle.homeroomTeacherId`.

### Decision: Retirar nada en este cambio — coexistencia y retiro diferido
**Choice**: `Teacher` y `SubjectAssignment` permanecen. `homeroomTeacherId` se conserva y se refleja en `AsignacionCursoXCiclo` (rol TITULAR) en fase 4, marcado `@deprecated`.
**Alternatives**: dropear `Teacher`/`SubjectAssignment` al cerrar la fase 2/3.
**Rationale**: `Teacher` aún es FK de `Sala/Grado/Curso/MesaExamen/ActaExamen`; `SubjectAssignment` aún es FK de `Evaluacion`/`NotaTrimestral` (grading legacy). Dropearlos rompería esos módulos. El retiro es un cambio SDD posterior, una vez migrados sus consumidores.

## Data Model (Prisma — prisma_tenant salvo indicado)

**User (master) — enriquecer**: `+ firstName String?`, `+ lastName String?` (se backfillean desde `Teacher`; `name` se mantiene `@deprecated` para auth/display, derivado `firstName+lastName` en altas nuevas), `+ dni String?`, `+ title String?`, `+ phone String?`. Unicidad: `@@unique([institutionId, dni])` (DNI único por institución; NULLs distintos en Postgres permiten ROOT/usuarios sin dni).

| Modelo (`@map`) | Campos clave | Unicidad / Índices |
|---|---|---|
| `DocenteXCiclo` (`docentes_x_ciclo`) | `userId @map("user_id")` (master, sin FK), `cycleId`→`AcademicCycle.uuid`, `active`, `deletedAt` | `@@unique([userId, cycleId])`, `@@index([cycleId])`, `@@index([userId])` |
| `MateriaXCursoXCiclo` (`materias_x_curso_x_ciclo`) | `courseCycleId`→`CourseCycle.uuid`, `subjectId`→`Subject.id`, `studyPlanSubjectId?` (provenance) | `@@unique([courseCycleId, subjectId])`, `@@index([courseCycleId])` |
| `AlumnosXMateriaXCursoXCiclo` (`alumnos_x_materia_x_curso_x_ciclo`) | `materiaXCursoXCicloId` (FK), `studentId`→`Student.id` | `@@unique([materiaXCursoXCicloId, studentId])`, `@@index([materiaXCursoXCicloId])` |
| `GrupoXCursoXMateriaXCiclo` (`grupos_x_curso_x_materia_x_ciclo`) | `materiaXCursoXCicloId` (FK), `docenteXCicloId` (FK), `name String?` | `@@unique([materiaXCursoXCicloId, docenteXCicloId])`, `@@index([materiaXCursoXCicloId])`, `@@index([docenteXCicloId])` |
| `AlumnosXGrupoXCursoXMateriaXCiclo` (`alumnos_x_grupo_x_curso_x_materia_x_ciclo`) | `grupoId` (FK), `alumnosXMateriaXCursoXCicloId` (FK → universo) | `@@unique([grupoId, alumnosXMateriaXCursoXCicloId])`, índices por ambos FK |
| `AsignacionCursoXCiclo` (`asignaciones_curso_x_ciclo`) | `courseCycleId`→`CourseCycle.uuid`, `docenteXCicloId` (FK), `rol RolCurso`, `turno TurnoCurso?` | `@@unique([courseCycleId, docenteXCicloId, rol, turno])`, `@@index([courseCycleId])` |

`enum RolCurso { PRECEPTOR, TITULAR }` · `enum TurnoCurso { MANANA, TARDE, VESPERTINO, NOCHE }` (turno nullable: TITULAR puede no tenerlo; varios PRECEPTOR por turno = distintos `docenteXCicloId`).

## Data Flow — Generar CursoXCiclo (extiende `GenerateCourseCyclesUseCase`)

```
Ciclo + Plan + "Generar"
  └─ por StudyPlanCourse → CourseCycle (ya existe)
       └─ por StudyPlanSubject → MateriaXCursoXCiclo            [createMany skipDuplicates]
            └─ AlumnosXMateriaXCursoXCiclo = enrolled(CourseCycle)  (obligatorias=todos)  [createMany]
  (alumnos cargados a mano luego; optativas = subconjunto, diferido)
```
Patrón idéntico al `autoCreateUC` fire-and-forget ya presente. Performance: `createMany` batch + índices por `courseCycleId`; idempotente por los `@@unique`.

## Data Flow — Fix de autorización (notas/asistencia)

Hoy el GET (`get-subject-grades-by-subject`) valida vía `Teacher`+`SubjectAssignment`; los upsert (`upsert-subject-period-grades`, `upsert-subject-final-grades`) **NO validan** (bug). Fase 5 introduce un guard compartido resuelto VÍA grupos e inyectado en los tres use-cases:

```
userId → DocenteXCiclo(cycle of CC) → GrupoXCursoXMateriaXCiclo(materia = subject in CC)
       → ¿studentId ∈ AlumnosXGrupo de esos grupos?  → ROOT bypass
```
Se extrae a un `AssignmentAuthorizer` (application service) reusando el contrato del GET pero con repos nuevos (`DocenteXCicloRepository`, `GrupoRepository`), y se invoca en los upsert antes de `saveMany`. Asistencia: diaria (curso/preceptor) valida vía `AsignacionCursoXCiclo`; por materia valida vía grupo. Sin nuevos registros de nota: co-docencia comparte el mismo `(student, cc, subject)`.

## Migration / Rollout (por fase, todas coexisten; nada se dropea)

| Fase | Migración Prisma | Backfill idempotente (ts-node, multi-tenant) |
|---|---|---|
| 1 | master: `+firstName/lastName/dni/title/phone`, `@@unique([institutionId,dni])` | copia persona `Teacher`→`User` donde `userId` presente; reporta huérfanos sin userId |
| 2 | tenant: `DocenteXCiclo` | por `(teacher.userId, ciclo activo)` con assignment/homeroom en ese ciclo → upsert `DocenteXCiclo` |
| 3 | tenant: 4 entidades materia/grupo | materializa plan en CC activos; `SubjectAssignment`→ por assignment crea `GrupoXCursoXMateriaXCiclo` (1 grupo=todos) + `AlumnosXGrupo`=universo |
| 4 | tenant: `AsignacionCursoXCiclo` + enums | `homeroomTeacherId`→ `AsignacionCursoXCiclo` rol TITULAR; `homeroomTeacherId` queda `@deprecated` |
| 5 | — (lógica) | switch authz GET+upsert a grupo-based (cae el bug) |
| 6 | — | asistencia diaria (preceptor) / por materia (grupo) separadas |

Scripts siguen el patrón de `backfill-system-attendance-types.ts` (loop sobre instituciones activas del master, `TenantPrismaClient` por tenant, upsert/`skipDuplicates`). Despliegue de esquema vía `migrate-all-tenants.ts` (`prisma migrate deploy` por tenant). Reversibilidad: cada migración tiene `down` (drop de tablas nuevas / columnas), y los backfills son re-ejecutables por `@@unique`. Backup previo en prod antes de cada fase.

## Testing Strategy

| Layer | Qué | Cómo |
|---|---|---|
| Unit | VOs/invariantes grupo⊆materia, guard de autorización | jest, repos mockeados |
| Integration | materialización al Generar, upsert rechaza docente no asignado vía grupo, co-docencia 1 registro | tenant client de test |
| Migration | backfill idempotente (doble corrida), reversibilidad down | DB efímera por tenant |

## Open Questions (resueltas)

- **Momento de materialización**: eager al "Generar" (decidido).
- **Docentes de una materia**: derivado de `DISTINCT docenteXCiclo` de sus grupos (sin tabla aparte).
- **Homeroom**: se conserva `homeroomTeacherId`, se refleja en `AsignacionCursoXCiclo` rol TITULAR (fase 4) y se deprecia; retiro diferido.
- **DNI**: único por institución (`@@unique([institutionId,dni])`), no global.
