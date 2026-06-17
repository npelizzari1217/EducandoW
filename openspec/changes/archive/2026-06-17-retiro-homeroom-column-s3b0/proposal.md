# Proposal: retiro-homeroom-column-s3b0

> Fase: sdd-propose · Store: hybrid · 2026-06-17
> S3b-0 del retiro de Teacher — drop de `CourseCycle.homeroomTeacherId`.

## Intent

S3a migró la navegación homeroom a `AsignacionCursoXCiclo(TITULAR)`. La columna `CourseCycle.homeroomTeacherId` (FK → `Teacher.id` SetNull + índice) quedó **sin lectores funcionales**: solo persiste passthrough en el mapper y un campo en la entidad de dominio. Mantenerla es deuda muerta que ata `CourseCycle` a `Teacher` y confunde el modelo. La eliminamos ahora para cerrar el primer slice del retiro de `Teacher`. **Sin decisión de producto.**

## Scope

**IN:**
- Schema (`schema.prisma`): remover AMBOS lados de la relación — campo `homeroomTeacherId`, relación `homeroomTeacher` y `@@index` en `CourseCycle`, MÁS la back-relation `Teacher.courseCyclesHomeroom`.
- Entidad `course-cycle.ts`: prop `homeroomTeacherId?`, getter, método `assignHomeroomTeacher()`.
- Mapper `prisma-course-cycle.repository.ts`: líneas toDomain + toPersistence.
- Migración SQL nueva (escrita a mano).
- Remoción de los 2 backfills obsoletos (`backfill-asignacion-curso.ts` Fase 4, `backfill-docente-x-ciclo.ts` Fase 2) + sus tests.
- Limpieza de tests: bloque homeroom en spec de entidad, línea del factory en spec del repo.

**OUT:**
- El bloque `generator erd` del schema (WIP no relacionado).
- El use-case homeroom (cerrado en S3a).
- Otros consumidores de `Teacher` (/teachers, exam boards, Sala/Grado/Curso — slices S3b separados).
- La tabla `Teacher` PERMANECE.

## Approach

Cambio de código → `prisma:generate` → test → typecheck → PR → merge → deploy de código → `pnpm --filter api migrate-tenants`. La migración es **SQL a mano** (convención del proyecto): el apply autora el DDL, sin dependencia de `prisma migrate dev` ni DB viva. Secuencia DDL: drop constraint → drop index → drop column, con comentario de reversibilidad. Sin staged deploy.

## Impact

~40 líneas de producción removidas + ~15 de SQL + eliminación de 2 scripts y sus tests. Desacopla `CourseCycle` de `Teacher`. `prisma generate` falla si se omite la back-relation (se atrapa en build). Los 2 backfills rompen `tsc --noEmit` transitivamente vía sus tests; vitest/swc no lo detecta — por eso van en el mismo PR.

## Risks

- **R1 (BAJO):** olvidar la back-relation → `prisma generate` falla. Atrapado en build.
- **R2 (MEDIO):** los 2 backfills rompen `tsc`. Mitigación: removerlos en el mismo PR (design confirma borrar vs sacar de compilación).
- **R3 (BAJO):** pérdida de data en CCs skippeados — aceptada (S3a ya live, nav degradada ahí).

## Precondición de deploy (CRÍTICA)

El backfill **Fase 4 TITULAR debe estar COMPLETO en TODOS los tenants** antes de aplicar la migración. CCs con `skip > 0` (Teacher.userId null o sin DocenteXCiclo) **pierden la data de la columna permanentemente** Y el script de recuperación se elimina (queda solo en git history). Misma precondición que el deploy de S3a, ahora endurecida. **Verificar skip-count por tenant antes de `migrate-tenants`.**

## Out-of-scope / Deferred

Slices S3b siguientes (otros consumidores de `Teacher`) y eventual drop de la tabla `Teacher` — fuera de este PR.

## Delivery

Auto-chain: **single PR**.
