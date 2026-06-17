# Proposal: retiro-teachers-admin-s3b2

> Fase: sdd-propose · Store: hybrid · 2026-06-17
> S3b-2 del retiro de Teacher — retirar el CRUD admin `/teachers`.

## Intent

El CRUD `/teachers` es el último resto del modelo de docente legado. La
gestión de persona docente ya migró a `/users` (persona UP-R1) +
`GET /docentes-x-ciclo` (Decision #3): ese par cubre alta de persona y
enrolamiento por ciclo. Mantener `/teachers` duplica la gestión, confunde
al usuario y bloquea el cierre del retiro de Teacher. **Éxito** = `/teachers`
desaparece de API y web sin romper build, tsc, ni la creación de
MesaExamen/ActaExamen para docentes existentes.

## Scope

**In:**
- API — borrar 7 archivos: `teacher.controller.ts`, `teacher.module.ts`,
  `dto/create-teacher.dto.ts`, `dto/update-teacher.dto.ts`,
  `application/teacher/use-cases/teacher.use-cases.ts`,
  `infrastructure/persistence/prisma/repositories/prisma-teacher.repository.ts`
  y su `.spec.ts`.
- API — editar `app.module.ts`: quitar `TeacherModule` de `imports[]`.
- Web — borrar `pages/dashboard/teachers.tsx`.
- Web — editar `App.tsx` (import + ruta `/teachers`) y
  `components/layout/sidebar.tsx` (entrada "Docentes" → `/teachers`).

**Out (no se toca):**
- Schema Prisma: modelo `Teacher` permanece (FK target de
  MesaExamen/ActaExamen/SubjectAssignment). **Sin migración SQL.**
- Entidad de dominio `Teacher` + interface `TeacherRepository`: quedan como
  dead code, cleanup diferido (no rompe tsc).
- Permiso de módulo `TEACHERS` (master DB): lo reusa
  `docente-ciclo.controller.ts`. **NO borrar.**
- MesaExamen/ActaExamen, `docente-ciclo.controller.ts`, SubjectAssignment.

## Approach (A)

Retirar `/teachers` AHORA y aceptar la ventana de R-GAP, que S3b-3 cierra
pronto. Sin riesgo de orden: `presidenteId` es un UUID de texto libre en
`mesa-examen-form.tsx`, no un dropdown que consulte `/teachers`; los
use-cases no inyectan `TeacherRepository`. PR chico, sin schema, reversible.
Se descartó B (bundlear S3b-2 + S3b-3 con migración de `presidenteId`):
scope grande y riesgo mayor sin beneficio que justifique bloquear S3b-2.

## Impact

~400 líneas borradas, 3 edits. Single PR (auto-chain). Sin migración, sin
cambio de contrato de datos persistidos. DI de NestJS queda sin dangling
(se retira el módulo completo).

## Risks

- **R-GAP (MEDIO, aceptado):** tras S3b-2 ningún path crea Teacher rows
  nuevos. Como `presidenteId` sigue siendo FK a `Teacher`, crear una
  mesa/acta nueva con un presidente SIN Teacher row preexistente queda
  bloqueado (Postgres rechaza el UUID) hasta S3b-3. Docentes existentes: OK.
  Gestión de persona docente se hace vía `/users` + DocenteXCiclo.
- **R-TEACHERS-MODULE (BAJO):** el registro de permiso de módulo `TEACHERS`
  DEBE permanecer; lo usa `/docentes-x-ciclo`. Borrarlo rompería ese guard.
- **R-DEAD-DOMAIN (BAJO):** entidad/repo de dominio Teacher quedan dead code.

## Out-of-scope / Deferred

- **S3b-3:** migra `presidenteId` de FK→Teacher a referencia User; cierra
  R-GAP.
- **S3b-final:** elimina entidad de dominio `Teacher` + repo, y dropea la
  tabla `Teacher`.
