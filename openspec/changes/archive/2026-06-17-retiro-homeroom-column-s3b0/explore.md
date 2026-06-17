# Explore: retiro-homeroom-column-s3b0

> Fase: sdd-explore · Store: hybrid · 2026-06-17
> S3b-0 del retiro de Teacher — drop de la columna `CourseCycle.homeroomTeacherId`.

## Resumen
S3a migró la nav homeroom a `AsignacionCursoXCiclo(TITULAR)`. La columna `homeroomTeacherId` (FK→Teacher SetNull + índice) ya no tiene lectores funcionales — solo passthrough en mapper + campo en entidad. S3b-0 la elimina. **Decision-free.** Migración = SQL a mano (convención del proyecto), no necesita DB viva.

## Cero lectores (post-S3a)
Confirmado: ni el port CourseCycleRepository (findByHomeroomTeacher se borró en S3a), ni el use-case homeroom (usa TITULAR), ni web, ni controllers/DTOs. Solo queda passthrough.

## Sitios de remoción
**schema `api/prisma_tenant/schema.prisma` (4, AMBOS lados de la relación):**
- Teacher: `courseCyclesHomeroom CourseCycle[]` (back-relation — sin esto `prisma generate` falla).
- CourseCycle: campo `homeroomTeacherId`, relación `homeroomTeacher`, `@@index([homeroomTeacherId])`.

**entidad `packages/domain/src/course-cycle/entities/course-cycle.ts` (3):** prop `homeroomTeacherId?`, getter, método `assignHomeroomTeacher()`.

**mapper `prisma-course-cycle.repository.ts` (2):** línea toDomain + toPersistence.

**migración nueva:** `api/prisma_tenant/migrations/20260617HHMMSS_drop_homeroom_teacher_id/migration.sql`.

**limpieza de tests/scripts (R2 — necesaria para que compile):**
- `course-cycle.spec.ts` (entidad) — borrar el describe de homeroomTeacherId.
- `prisma-course-cycle.repository.spec.ts` — quitar `homeroomTeacherId: null` del factory.
- `api/scripts/backfill-asignacion-curso.ts` (Fase 4) + su test — usa homeroomTeacherId; obsoleto → borrar/archivar.
- `api/scripts/backfill-docente-x-ciclo.ts` (Fase 2) + su test — `collectCycleIdsForTeacher()` filtra por homeroomTeacherId → borrar/archivar.
- (Los scripts rompen `tsc --noEmit` transitivamente vía sus tests en src/; vitest/swc NO lo detecta — solo tsc.)

## Migración (SQL a mano, convención del proyecto)
```sql
ALTER TABLE "course_cycles" DROP CONSTRAINT "course_cycles_homeroom_teacher_id_fkey";
DROP INDEX "course_cycles_homeroom_teacher_id_idx";
ALTER TABLE "course_cycles" DROP COLUMN "homeroom_teacher_id";
```
Nombres confirmados de la migración de creación `20260609140000_grading_primario_add_teacher_user_and_homeroom`. Deploy multi-tenant: `pnpm --filter api migrate-tenants` (itera tenants activos, `prisma migrate deploy`).

## Destructividad / deploy
Datos ya migrados a AsignacionCursoXCiclo TITULAR (Fase 4). Sin FKs Restrict apuntando a la columna → drop limpio. Secuencia: code change → prisma:generate → test → typecheck → PR → merge → deploy code → `migrate-tenants`. Sin staged deploy.

## Precondición de deploy (IMPORTANTE)
El backfill TITULAR (Fase 4) debe estar **completo en todos los tenants** antes de aplicar el DROP. CCs con skip>0 (Teacher.userId null / sin DocenteXCiclo) pierden la data permanentemente Y se borra el script de recuperación (queda en git history). Misma precondición que el deploy de S3a, ahora endurecida. Verificar skip-count por tenant.

## Riesgos
- R1 (BAJO): olvidar la back-relation `Teacher.courseCyclesHomeroom` → `prisma generate` falla (se atrapa al build).
- R2 (MEDIO): los 2 scripts de backfill rompen `tsc` vía sus tests → borrarlos/archivarlos en el mismo PR. (Design decide: borrar vs sacar de compilación.)
- R3 (BAJO): pérdida de data para CCs skippeados — aceptada (S3a ya live; nav ya degradada ahí).

## Scope
~4 archivos de producción + migración + 5-6 de limpieza. ~40 líneas borradas, ~15 SQL. Single PR.

## Decisión de producto: NINGUNA. Siguiente: sdd-propose.
