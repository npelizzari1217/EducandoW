# Proposal: retiro-homeroom-titular-s3a

> Fase: sdd-propose · Store: hybrid · 2026-06-17
> S3a del retiro de Teacher — migración del modo homeroom de `ListTeacherCourseCyclesUseCase`.

## Intent
El modo homeroom de `ListTeacherCourseCyclesUseCase` todavía resuelve los course-cycles por el path legacy `Teacher.id → CourseCycle.homeroomTeacherId` (2 queries sobre el modelo viejo). Tras el backfill Fase 4, cada CC activo con titular ya tiene su `AsignacionCursoXCiclo(rol=TITULAR)`. **Por qué ahora:** el modo subject ya vive sobre `DocenteXCiclo`; migrar homeroom deja a este use-case 100% sobre el modelo nuevo y permite quitarle el read de `Teacher`. **Éxito:** homeroom resuelto vía `userId → DocenteXCiclo(active) → AsignacionCursoXCiclo(TITULAR)`, contrato de salida idéntico, `TeacherRepository` fuera de `course-cycle.module.ts`, tests verdes, sin migración.

## Scope
**IN:**
- Branch homeroom del use-case (constructor: −`teacherRepo` +`asignacionRepo`).
- Nuevo método `AsignacionCursoXCicloRepository.findTitularCourseIdsByUser` (port + impl Prisma).
- Eliminar `CourseCycleRepository.findByHomeroomTeacher` (port + impl + test) — 0 callers tras S3a.
- DI en `course-cycle.module.ts`.
- Specs del use-case y del course-cycle-repository.

**OUT:**
- Sin cambio de schema: `CourseCycle.homeroomTeacherId` (columna + FK + índice) **queda** — su drop es un slice posterior.
- Modo subject: no se toca.
- `/teachers` admin, `MesaExamen`/`ActaExamen`: no se tocan.
- Frontend: contrato preservado, sin cambios.

## Approach (single-join, recomendado por exploración)
1. `AsignacionCursoXCicloRepository.findTitularCourseIdsByUser(userId): Promise<string[]>` — una query Prisma con nested filter `{ rol: TITULAR, docenteXCiclo: { userId, active: true } }`, `select { courseCycleId }`, dedup de UUIDs.
2. Reescribir branch homeroom: `findTitularCourseIdsByUser(userId)` → `courseCycleRepo.findByUuids(uuids)` (ya existe, maneja `[]`) → filtro década + `findGradingContextsByUuids` + map. Salida `Array<{cycle, modality}>` SIN cambios.
3. DI: quitar `PrismaTeacherRepository`/`TeacherRepository`; registrar `PrismaAsignacionCursoXCicloRepository` **directo en providers** (NO importar `AsignacionCursoModule` → riesgo circular, R5).

## Impact
- Use-case sobre modelo nuevo; un read de `Teacher` menos.
- Tras S3a, los únicos consumidores de `Teacher` que quedan: `/teachers` admin CRUD y `MesaExamen.presidenteId`/`ActaExamen.presidenteId` (FK Restrict).
- ~200 líneas, **single PR** (delivery auto-chain confirmado).

## Risks
- **R4 (ALTO, operacional, no código):** precondición de deploy — **verificar el skip-count de TITULAR del backfill Fase 4 por tenant ANTES de prod**. Un CC skippeado (Teacher.userId null o sin DocenteXCiclo) → nav homeroom vacía (degradación silenciosa, no error).
- **R5:** circular import si se importa `AsignacionCursoModule` — mitigado registrando el repo directo en providers.
- Working tree tiene **WIP no commiteado del ERD** del usuario (`.gitignore`, `package.json`, ambos `schema.prisma`, `pnpm-lock`, `ERD.svg` ignorado) — **fuera de scope, NO debe commitearse**; apply usará rutas de archivo explícitas.

## Out-of-scope / Deferred
- Drop de `homeroomTeacherId` (columna + FK + índice): slice posterior.
- Retiro de los consumidores restantes de `Teacher` (`/teachers`, MesaExamen/ActaExamen): fuera de este retiro.

## Decisión de producto: NINGUNA (migración técnica).

## Siguiente paso: sdd-spec + sdd-design (en paralelo).
