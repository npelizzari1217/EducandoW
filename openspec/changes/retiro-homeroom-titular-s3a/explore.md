# Explore: retiro-homeroom-titular-s3a

> Fase: sdd-explore · Store: hybrid · 2026-06-17
> S3a del retiro de Teacher — migración del modo homeroom.

## Resumen
El modo homeroom de `ListTeacherCourseCyclesUseCase` resuelve hoy los CCs vía `Teacher.id → CourseCycle.homeroomTeacherId` (2 queries legacy). Tras el backfill Fase 4, cada CC activo con homeroom teacher tiene su `AsignacionCursoXCiclo(rol=TITULAR)`. S3a reemplaza ese path por: `userId → DocenteXCiclo(active) → AsignacionCursoXCiclo(rol=TITULAR) → courseCycleId[]` + el `findByUuids` existente. Contrato de salida idéntico. Elimina el read de `Teacher` de este use-case; `TeacherRepository` queda removible de `course-cycle.module.ts`. **Sin cambio de schema** (`homeroomTeacherId` queda).

## Path actual (OLD) — list-teacher-course-cycles.use-case.ts:44-48
`teacherRepo.findByUserId(userId)` → si null `[]` → `courseCycleRepo.findByHomeroomTeacher(teacher.id)` → filtro década (Primario) → `findGradingContextsByUuids` → map `{cycle, modality}`. Input: `{userId, mode: 'homeroom'|'subject'}`. (Modo subject ya está sobre DocenteXCiclo — no se toca.)

## Path nuevo (recomendado: single join)
```ts
client.asignacionCursoXCiclo.findMany({
  where: { rol: RolCurso.TITULAR, docenteXCiclo: { userId, active: true } },
  select: { courseCycleId: true },
})
```
→ `string[]` dedup de UUIDs → `courseCycleRepo.findByUuids(uuids)` (ya existe, maneja `[]`). El resto del pipeline (filtro década, findGradingContextsByUuids, map) NO cambia.

## Repo methods
- AÑADIR: `AsignacionCursoXCicloRepository.findTitularCourseIdsByUser(userId): Promise<string[]>` (port + impl Prisma ~8 líneas).
- REUSAR: `CourseCycleRepository.findByUuids`.
- ELIMINAR (0 callers tras S3a): `CourseCycleRepository.findByHomeroomTeacher` (port + impl + test).
- `TeacherRepository`: removible de `course-cycle.module.ts`.

## Contrato de salida: PRESERVADO
Retorno `Array<{cycle: CourseCycle; modality: number|null}>` sin cambios. El front (`use-teacher-grading-access.ts`, `GET /course-cycles?teacherUserId=...&role=homeroom`) solo chequea `length>0` y usa id/level — sin campos Teacher. Contrato intacto.

## DI (R5)
NO importar `AsignacionCursoModule` en `CourseCycleModule` (riesgo de circular). Registrar `PrismaAsignacionCursoXCicloRepository` directo en `providers` (igual que ya se hace con `PrismaDocenteXCicloRepository`).

## Precondición de deploy (R4, ALTO)
Backfill Fase 4 (`scripts/backfill-asignacion-curso.ts`) crea TITULAR desde `homeroomTeacherId`. Skips logueados con ⚠️: (1) `Teacher.userId` null, (2) sin `DocenteXCiclo(userId,cycleId)`. Tras S3a, un CC skippeado → nav homeroom vacía (degradación silenciosa, no error). **Verificar skip count por tenant antes de deploy.**

## Consumidores de Teacher que QUEDAN tras S3a
`/teachers` admin CRUD; `MesaExamen.presidenteId` / `ActaExamen.presidenteId` (FK Restrict); columna `CourseCycle.homeroomTeacherId` (queda, drop en slice posterior).

## Archivos (~200 líneas, single PR, sin migración)
asignacion port + impl Prisma (nuevo método); list-teacher-course-cycles.use-case.ts (homeroom branch + constructor: −teacherRepo +asignacionRepo); course-cycle.module.ts (DI); use-case spec; course-cycle-repository port + impl + spec (−findByHomeroomTeacher).

## Decisión de producto: NINGUNA (migración técnica).

## Siguiente paso: sdd-propose.
