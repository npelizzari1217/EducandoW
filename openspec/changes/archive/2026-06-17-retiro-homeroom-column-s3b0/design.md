# Design: retiro-homeroom-column-s3b0

> Fase: sdd-design · Store: hybrid · 2026-06-17
> Arquitectura del drop de `CourseCycle.homeroomTeacherId` (S3b-0 del retiro de Teacher).

## Resumen ejecutivo

Drop quirúrgico de una columna FK muerta: remover ambos lados de la relación Prisma, el campo/getter/setter de la entidad de dominio, el passthrough del mapper, y eliminar los 2 backfills históricos obsoletos + sus tests (rompen `tsc` transitivamente). Migración SQL a mano, deploy per-tenant. Single PR.

## Enfoque arquitectónico

Clean Architecture estricta — el cambio atraviesa las 3 capas que tocan la columna, de afuera hacia adentro, y nada más:

- **Infra/persistencia** — schema Prisma (modelo de datos) + mapper (traducción persistencia↔dominio) + migración SQL (DDL).
- **Dominio** — entidad `CourseCycle` (campo, getter, comando `assignHomeroomTeacher`).
- **Sin capa de aplicación afectada** — el use-case homeroom ya migró a `AsignacionCursoXCiclo(TITULAR)` en S3a. Los únicos consumidores residuales del campo eran los 2 scripts de backfill (one-shot, fuera del runtime), que se eliminan.

Principio rector: la columna es deuda muerta (cero lectores funcionales). El diseño NO introduce abstracciones nuevas; solo retira un acoplamiento `CourseCycle → Teacher` ya redundante. La tabla `Teacher` permanece (slices S3b siguientes).

## Sitios de remoción exactos (verificados contra el código)

### 1. Schema — `api/prisma_tenant/schema.prisma` (4 sitios, AMBOS lados)

| Línea | Contenido | Acción |
|------:|-----------|--------|
| 113 | `courseCyclesHomeroom CourseCycle[]` (back-relation en `Teacher`) | borrar |
| 350 | `/// @deprecated — migrado a AsignacionCursoXCiclo rol=TITULAR (Fase 4 backfill)...` | borrar |
| 351 | `homeroomTeacherId String? @map("homeroom_teacher_id")` | borrar |
| 358 | `homeroomTeacher Teacher? @relation(fields: [homeroomTeacherId], references: [id], onDelete: SetNull)` | borrar |
| 373 | `@@index([homeroomTeacherId])` | borrar |

`prisma validate`/`generate` exigen que AMBOS lados se borren juntos (R1): dejar la back-relation `Teacher.courseCyclesHomeroom` sin su contraparte → `generate` falla. Se atrapa en build. NO tocar el bloque `generator erd` (líneas 6-9, WIP no relacionado).

### 2. Entidad — `packages/domain/src/course-cycle/entities/course-cycle.ts` (3 sitios)

| Líneas | Contenido | Acción |
|-------:|-----------|--------|
| 26-27 | comentario `/** FK → Teacher.id ... */` + `homeroomTeacherId?: string;` en `CourseCycleProps` | borrar |
| 148-150 | getter `get homeroomTeacherId(): string \| undefined { ... }` | borrar |
| 152-155 | comentario + método `assignHomeroomTeacher(teacherId: string): void { ... }` | borrar |

`create()` y `reconstruct()` no setean el campo explícitamente (es opcional) → no requieren cambios.

### 3. Mapper — `api/src/infrastructure/persistence/prisma/repositories/prisma-course-cycle.repository.ts` (2 sitios)

| Línea | Contenido | Acción |
|------:|-----------|--------|
| 251 | `homeroomTeacherId: record.homeroomTeacherId ?? undefined,` (en `toDomain`) | borrar |
| 277 | `homeroomTeacherId: courseCycle.homeroomTeacherId ?? null,` (en `toPersistence`) | borrar |

Tras `prisma generate`, `CourseCycleRow` (= `Prisma.CourseCycleGetPayload<...>`) ya no tendrá `homeroomTeacherId`; mantener la línea 251 sería un error de tipo. Por eso van en el mismo PR que el schema.

## Decisiones (ADR-style)

### AD-1 — Remover ambos lados de la relación en el mismo change
**Decisión:** borrar `Teacher.courseCyclesHomeroom` Y (`CourseCycle.homeroomTeacherId` + `homeroomTeacher` + `@@index`) en el mismo commit.
**Razón:** Prisma valida relaciones bidireccionales; un lado huérfano rompe `prisma generate`.
**Alternativa rechazada:** drop incremental (primero un lado). Rechazada: `generate` falla entre commits, deja el repo en estado no compilable.

### AD-2 — Migración SQL a mano con `IF EXISTS` y drop explícito
**Decisión:** autorar `migration.sql` a mano siguiendo la convención del proyecto (sin `prisma migrate dev`, sin DB viva). Secuencia explícita: drop constraint → drop index → drop column, todos con `IF EXISTS`.
**Razón:** Postgres haría cascade-drop del FK y del índice al hacer `DROP COLUMN`, pero el proyecto autora DDL explícito y defensivo (ver `20260613100000_drop_grupo_materia_docente_unique` que usa `DROP INDEX IF EXISTS`). Explícito + idempotente = seguro ante re-runs y legible.
**Alternativa rechazada:** `prisma migrate dev` (genera el diff automáticamente). Rechazada: no es la convención del repo y requiere DB shadow viva.

### AD-3 — DELETE de los 2 backfills obsoletos + sus tests (no exclude)
**Decisión:** ELIMINAR los 4 archivos (2 scripts + 2 tests), no excluirlos de compilación.
**Razón (verificada):**
- Los scripts NO están en `package.json` (`api/package.json` scripts: `bootstrap`, `migrate-tenants`, `tenant:create`, `diagnose:auth` — ninguno los invoca).
- `scripts/migrate-all-tenants.ts` NO los importa (grep `backfill|homeroom` → 0 matches).
- `api/tsconfig.json` incluye solo `src/**/*` + `prisma/**/*`; `scripts/` NO está en `include`. Los scripts entran al grafo de `tsc` SOLO vía sus tests en `src/` (`backfill-*.test.ts` importan `../../../../scripts/backfill-*`). Por eso `vitest`/swc no detecta el break pero `tsc --noEmit` sí.
- Los scripts consultan `homeroomTeacherId` directamente sobre el cliente Prisma (`backfill-asignacion-curso.ts` L132/L137; `backfill-docente-x-ciclo.ts` L53). Tras el drop + regenerate, esas queries son errores de tipo permanentes — excluirlos solo esconde un break irreversible.
- Son backfills one-shot históricos (Fase 2 y Fase 4); la data ya está migrada. Recuperación = git history.
**Archivos eliminados (exactos):**
1. `api/scripts/backfill-asignacion-curso.ts`
2. `api/scripts/backfill-docente-x-ciclo.ts`
3. `api/src/application/asignacion-curso/__tests__/backfill-asignacion-curso.test.ts`
4. `api/src/application/docente-ciclo/__tests__/backfill-docente-x-ciclo.test.ts`
**Alternativa rechazada:** tsconfig `exclude` o mover los scripts fuera de `src`. Rechazada: deja código + tests muertos que igual no compilan contra el cliente regenerado; oculta el problema en vez de resolverlo.
**Verificación de no-vaciado:** ambos `__tests__/` conservan otros specs (`assign-docente-to-curso`, `list-asignaciones-curso`, `remove-asignacion-curso`; y `docente-x-ciclo.service.test.ts`) → los directorios no quedan vacíos.

### AD-4 — Borrar el archivo de spec de entidad completo (no solo el bloque)
**Decisión:** ELIMINAR `packages/domain/src/course-cycle/entities/course-cycle.spec.ts` entero.
**Razón:** el archivo (líneas 1-93) contiene UN solo `describe('CourseCycle — homeroomTeacherId', ...)` — es exclusivamente sobre la feature que se retira. Sin homeroom no queda nada que testear ahí.
**Matiz vs exploración:** la exploración decía "borrar el describe"; al ser el único describe del archivo, borrar el archivo es lo correcto y limpio.
**Alternativa rechazada:** dejar el archivo con un describe vacío. Rechazada: ruido sin valor.

### AD-5 — Deploy per-tenant vía `migrate-tenants`, con precondición dura
**Decisión:** deploy = `pnpm --filter api migrate-tenants` (`tsx scripts/migrate-all-tenants.ts` → `prisma migrate deploy` por tenant activo). Sin staged deploy.
**Razón:** multitenant con DB por institución; la migración es destructiva pero la columna ya no tiene escritores post-S3a, así que no hace falta deploy escalonado (código primero / DDL después es suficiente).
**Precondición CRÍTICA:** el backfill Fase 4 TITULAR debe estar COMPLETO en TODOS los tenants antes de aplicar. CCs con `skip > 0` (Teacher.userId null o sin DocenteXCiclo) pierden la data de la columna permanentemente Y el script de recuperación se elimina (queda en git history). **Verificar skip-count por tenant antes de `migrate-tenants`.**

## Migración — contenido y convención

**Carpeta:** `api/prisma_tenant/migrations/20260617120000_drop_homeroom_teacher_id/migration.sql`
(timestamp posterior al último existente `20260613100000`; formato `YYYYMMDDHHMMSS_snake_case`).

**Convención confirmada:**
- Un único `migration_lock.toml` en la raíz de `migrations/` (`provider = "postgresql"`) — NO se crea lock por carpeta.
- Migraciones a mano, con header comentado describiendo intención/reversibilidad (ver todas las existentes).
- Drops defensivos con `IF EXISTS` (precedente: `20260613100000_drop_grupo_materia_docente_unique`).

**`migration.sql` (contenido):**
```sql
-- Migration: drop_homeroom_teacher_id
-- S3b-0 (retiro de Teacher): CourseCycle.homeroomTeacherId quedó sin lectores
-- funcionales tras S3a (nav homeroom migrada a AsignacionCursoXCiclo rol=TITULAR, Fase 4).
-- Drop del FK → teachers.id (SetNull), su índice, y la columna.
-- PRECONDICIÓN: backfill Fase 4 TITULAR completo en todos los tenants (data ya en
--   AsignacionCursoXCiclo). CCs skippeados pierden la data de esta columna de forma permanente.
-- Reversibilidad: re-crear vía ALTER TABLE ADD COLUMN + ADD CONSTRAINT + CREATE INDEX
--   (ver 20260609140000_grading_primario_add_teacher_user_and_homeroom). La DATA no es
--   recuperable desde aquí — vive en AsignacionCursoXCiclo(TITULAR).

-- DropForeignKey
ALTER TABLE "course_cycles" DROP CONSTRAINT IF EXISTS "course_cycles_homeroom_teacher_id_fkey";

-- DropIndex
DROP INDEX IF EXISTS "course_cycles_homeroom_teacher_id_idx";

-- DropColumn
ALTER TABLE "course_cycles" DROP COLUMN IF EXISTS "homeroom_teacher_id";
```

Nombres verificados contra la migración de creación `20260609140000_grading_primario_add_teacher_user_and_homeroom/migration.sql`:
- FK: `course_cycles_homeroom_teacher_id_fkey` ✓
- Índice: `course_cycles_homeroom_teacher_id_idx` ✓
- Columna: `homeroom_teacher_id` ✓

## Limpieza de tests (integridad de build)

| Archivo | Acción |
|---------|--------|
| `packages/domain/src/course-cycle/entities/course-cycle.spec.ts` | ELIMINAR archivo completo (AD-4) |
| `api/src/infrastructure/persistence/prisma/repositories/prisma-course-cycle.repository.spec.ts` | borrar línea 40 `homeroomTeacherId: null,` del factory |
| `api/src/application/asignacion-curso/__tests__/backfill-asignacion-curso.test.ts` | ELIMINAR (AD-3) |
| `api/src/application/docente-ciclo/__tests__/backfill-docente-x-ciclo.test.ts` | ELIMINAR (AD-3) |

## Flujo de datos / integración

```
DROP COLUMN homeroom_teacher_id (DDL)
      │
      ▼
prisma generate  →  CourseCycle type sin homeroomTeacherId/homeroomTeacher
                    Teacher type sin courseCyclesHomeroom
      │
      ▼
mapper (toDomain/toPersistence) — sin passthrough → compila contra el nuevo tipo
      │
      ▼
entidad CourseCycle — sin campo/getter/setter → dominio desacoplado de Teacher
```

Secuencia de ejecución (apply): editar dominio + mapper + schema → `pnpm --filter api prisma:generate` → eliminar scripts+tests → limpiar specs → `pnpm test` → `pnpm --filter api typecheck` → PR → merge → deploy código → `pnpm --filter api migrate-tenants`.

## Integridad de build/test (verificación esperada)

- `prisma validate` + `prisma:generate` (master + tenant): OK (ambos lados removidos, sin relación huérfana).
- `pnpm --filter api typecheck` (`tsc --noEmit`): 0 errores nuevos. Tras borrar scripts+tests, no quedan referencias a `homeroomTeacherId` en TS (la única superficie residual eran esos 4 archivos + el mapper/entidad que se limpian).
- `pnpm test` (vitest): verde — specs de homeroom eliminados, factory del repo-spec sin la línea muerta.

## Estimación / PR

- Producción: schema 4 sitios + entidad 3 sitios + mapper 2 líneas ≈ **~40 líneas removidas**.
- Migración: **~25 líneas** (1 archivo nuevo, ~7 de SQL efectivo + header).
- Eliminaciones: 2 scripts (~414 líneas) + 2 tests (~152 líneas) + 1 spec de entidad (~93 líneas).
- Edición: 1 línea en repo-spec factory.
- **Single PR.** No staged deploy. Riesgo de tamaño: bajo (borrados mayormente).

## Riesgos (arquitectónicos / vs exploración)

- **R1 (BAJO):** olvidar la back-relation `Teacher.courseCyclesHomeroom` → `prisma generate` falla. Mitigación: AD-1; se atrapa en build.
- **R2 (RESUELTO):** los 2 backfills rompen `tsc` vía sus tests. Resolución: AD-3 — DELETE (verificado: sin referencias en `package.json`/`migrate-all-tenants`/runtime).
- **R3 (BAJO, aceptado):** pérdida de data en CCs skippeados por Fase 4. Mitigación: precondición dura (AD-5) — verificar skip-count por tenant.
- **Sin lectores ocultos:** confirmado — los únicos consumidores del campo (los 2 backfills) se eliminan; web/controllers/DTOs/use-cases ya no lo leen (cero lectores post-S3a).
- **Sin mismatch de convención vs exploración**, salvo un refinamiento (AD-4): el spec de entidad es un archivo de un solo describe → se borra entero en lugar de "borrar el bloque". El resto (nombres FK/índice, carpeta de migración, lock único en raíz) coincide con lo explorado.
