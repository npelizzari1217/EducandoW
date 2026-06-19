# Explore: retiro-teacher-legacy-s3b-final — drop tabla Teacher

> Fase: sdd-explore · Store: hybrid · 2026-06-19
> Último slice del epic `retiro-teacher-legacy`. Precondición cumplida: `retiro-grading-legacy-s3pre` dropeó `subject_assignments` (último FK child de `teachers`). Verificado en dev: `teachers` sin FK children.

## Veredicto: DROP SEGURO — SÍ. 1 PR. Sin cambio de comportamiento.

## Clasificación de los 12 archivos que mencionan "Teacher" en api/src

**TODOS son Categoría B** (usan "teacher/docente" como concepto o nombre de método; NO importan la entidad de dominio `Teacher` ni leen el modelo Prisma). **Cero Categoría A.**

| Archivo | Evidencia |
|---|---|
| `presentation/course-cycle/course-cycle.module.ts` | Importa `ListTeacherCourseCyclesUseCase` (nombre); usa DocenteXCiclo/Grupo. Sin Teacher. |
| `presentation/course-cycle/course-cycle.controller.ts` | "TEACHER" solo en comentario (L98). |
| `presentation/grading/dto/subject-grades.dto.ts` | `TeacherCCListQuerySchema`/`TeacherSubjectsQuerySchema` = naming de query params. |
| `application/users/use-cases/users.use-cases.ts` | "Teacher" solo en comentario (L63, legacy-read-only). |
| `application/grading/list-teacher-subjects-in-course-cycle.use-case.ts` | Usa DocenteXCiclo + Grupo. Sin Teacher. |
| `application/grading/list-admin-subjects-in-course-cycle.use-case.ts` | `TeacherSubjectEntry` = interface de capa, no la entidad. |
| `application/grading/upsert-subject-final-grades.use-case.ts` | "Teacher-supplied" en comentario (L37). |
| `application/grading/list-teacher-course-cycles.use-case.ts` | Usa Asignacion/DocenteXCiclo/Grupo. Comentario: "Teacher table NOT read". |
| `presentation/auth/dto/register.request.ts` | 'TEACHER' en role enum (rol del master, sobrevive). `CreateTeacherSchema`/`CreateTeacherDTO` = **dead exports** (sin consumidores) → limpiar. |
| `application/materia-grupo-ciclo/validate-teacher-level.ts` | Consulta `User` (master) + `CourseCycle` (tenant). Sin Teacher. |
| `application/materia-grupo-ciclo/create-grupo.use-case.ts` | `validateTeacherLevel` + DocenteXCiclo. |
| `application/materia-grupo-ciclo/update-grupo.use-case.ts` | Idem. |

Grep de confirmación: `tenant.teacher`/`client.teacher`/`prisma.teacher` → **0** en api/src. `TeacherRepository` → **0** en api/src. Sin binding en módulos NestJS.

## Schema tenant (`api/prisma_tenant/schema.prisma`)
`model Teacher` (L93-114): **0 relaciones entrantes** (confirmado post grading-legacy-s3pre), **0 salientes** (modelo aislado). 4 índices propios (lastName, dni unique, dni, user_id) — se eliminan con el DROP TABLE.

## Removal Inventory

**ELIMINAR (4):**
- `packages/domain/src/personnel/entities/teacher.ts`
- `packages/domain/src/personnel/repositories/teacher-repository.ts`
- `packages/domain/src/personnel/__tests__/entities/teacher.test.ts`
- `packages/domain/src/personnel/entities/teacher.spec.ts`

**MODIFICAR (6):**
- `packages/domain/src/personnel/entities/index.ts` — quitar export `Teacher`.
- `packages/domain/src/personnel/index.ts` — quitar export `Teacher` + `TeacherRepository`.
- `packages/domain/src/index.ts` — quitar `Teacher` + `TeacherRepository`.
- `api/prisma_tenant/schema.prisma` — quitar `model Teacher` (L93-114).
- `api/src/presentation/auth/dto/register.request.ts` — quitar dead exports `CreateTeacherSchema`/`CreateTeacherDTO` (L77-88).
- `web/src/__tests__/App.test.tsx` — quitar mock stale de `../pages/dashboard/teachers` (L11; la página se borró en S3b-2).

**CREAR (1):**
- `api/prisma_tenant/migrations/{timestamp}_drop_teachers/migration.sql`:
```sql
-- S3b-final (retiro-teacher-legacy): teachers sin FK children tras retiro-grading-legacy-s3pre.
DROP TABLE IF EXISTS "teachers";
-- ROLLBACK INLINE: CREATE TABLE "teachers" (...) + 4 índices (ver bloque comentado).
```

## Estimación
~252 líneas eliminadas, ~20 agregadas (migración). 10 archivos (4 del, 6 mod, 1 create). Budget: BAJO. **1 PR.**

## Aclaraciones
- El rol `'TEACHER'` en `User.roles` (master) SOBREVIVE — es acceso, no la tabla.
- Archivos con "teacher" en el nombre (`list-teacher-*`, `validate-teacher-level`, etc.) son conceptuales (docente vía DocenteXCiclo/User). NO tocar.
- Correr `pnpm --filter api prisma:generate` tras el schema change (el cliente deja de exponer `client.teacher`; nadie lo usa, así que `tsc` pasa).

## Next: sdd-propose / apply (1 PR mecánico). Habilita el cierre del epic retiro-teacher-legacy.
