# Explore: retiro-teachers-admin-s3b2

> Fase: sdd-explore · Store: hybrid · 2026-06-17
> S3b-2 del retiro de Teacher — retirar el CRUD `/teachers` admin.

## Veredicto de orden: S3b-2 PUEDE IR AHORA
Retirar `/teachers` NO rompe la creación de MesaExamen/ActaExamen. El `presidenteId` se carga con un `<Input>` de UUID libre (`mesa-examen-form.tsx`), NO con un dropdown que consulte `/teachers`. Los use-cases (`CreateMesaExamenUseCase`, `CreateActaExamenUC`) reciben `presidenteId: string` y NO inyectan `TeacherRepository`. La FK Restrict se valida en Postgres; los Teacher rows existentes quedan (la tabla no se dropea).

## Surface de /teachers
**Borrar (API, 7):** teacher.controller.ts, teacher.module.ts, create-teacher.dto.ts, update-teacher.dto.ts, teacher.use-cases.ts, prisma-teacher.repository.ts, prisma-teacher.repository.spec.ts.
**Editar (API):** app.module.ts (quitar TeacherModule del imports[]).
**Borrar (web):** teachers.tsx.
**Editar (web):** App.tsx (import + route), sidebar.tsx (entrada "Docentes").

**CONSERVAR:**
- Modelo Prisma `Teacher` (FK target de MesaExamen/ActaExamen/SubjectAssignment) — sin cambio de schema.
- Entidad de dominio `Teacher` + `TeacherRepository` interface → dead code, cleanup diferido a S3b-final (inofensivo, no rompe tsc).
- **Permiso de módulo `TEACHERS` (master DB)** — lo reusa `docente-ciclo.controller.ts` (`@Roles('ROOT', {module:'TEACHERS', action:'READ'})`). NO borrarlo.

## Quién crea Teacher rows
SOLO el CRUD `/teachers` (`CreateTeacherUseCase`). No hay seed/bootstrap/otro path. `CreateUserUseCase` crea solo User (master). Tras S3b-2: NINGÚN path crea Teacher rows nuevos (los existentes persisten).

## Cobertura User+DocenteXCiclo (Decision #3)
Existe: `POST/GET/PATCH /users` (persona UP-R1) + `GET /docentes-x-ciclo?cycleId=`. Cubre gestión de persona de docente + enrolamiento por ciclo. La gestión de docentes vía el modelo nuevo es válida y está implementada.

## ⚠️ R-GAP (MEDIO, producto) — el fork
Tras S3b-2 no hay forma de crear Teacher rows nuevos. Como `presidenteId` sigue siendo FK a `Teacher`, **crear una mesa/acta nueva con un presidente sin Teacher row preexistente queda bloqueado** (Postgres rechaza el UUID inexistente) hasta que S3b-3 migre `presidenteId` a User. Docentes existentes: OK. Docentes nuevos (creados vía Users): no pueden ser presidente hasta S3b-3.

## Approaches
- **A (recomendado):** retirar /teachers ahora; aceptar el R-GAP window; S3b-3 lo cierra pronto. PR chico (~400 líneas borradas), sin schema, sin riesgo de orden.
- **B:** bundlear S3b-2 + S3b-3 (migrar presidenteId + backfill + schema) en un PR. Sin gap, pero scope grande y más riesgoso (S3b-3 es MEDIO solo).

## Scope (Approach A)
7 borrados API + 1 web + 3 edits. Sin migración SQL. ~350-400 líneas borradas. Single PR.

## Riesgos
- R-GAP (MEDIO): creación de mesa/acta con presidente nuevo bloqueada hasta S3b-3.
- R-TEACHERS-MODULE (BAJO): NO borrar el permiso de módulo TEACHERS (lo usa /docentes-x-ciclo).
- R-DEAD-DOMAIN (BAJO): entidad/repo Teacher quedan dead code (cleanup S3b-final).

## Decisión requerida: A (ahora, aceptar gap) vs B (bundlear con S3b-3). Recomendado A. Siguiente: sdd-propose.
