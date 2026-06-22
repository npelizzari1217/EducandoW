# Proposal: tenant-migration-drift-baseline

> Phase: propose · Store: hybrid (engram `sdd/tenant-migration-drift-baseline/proposal`). Adopts exploration's recommended approach.

## Intent

`prisma migrate dev` contra el schema tenant escupe ~31 líneas de drift NO relacionado en cada corrida — lo venimos stripeando a mano en los últimos 2 changes. Causa: `api/prisma_tenant/schema.prisma` divergió del estado real de la DB en 5 ejes (FK renames, index renames, timestamp types, `id` defaults, un unique huérfano roto). Lo hacemos ahora para frenar la sangría de tiempo y el riesgo de pisar drift legítimo. Éxito = `prisma migrate diff` (DB↔schema) VACÍO → migrate dev limpio, con riesgo de producción NULO sobre datos.

## Scope

### In Scope
- **20 anotaciones de schema** (sin cambio de DB): 7 FK `map:`, 13 `map:` en `@@index`/`@@unique`, `@db.Timestamptz(6)` en created_at/updated_at de las 8 tablas drifteadas (+ deleted_at en docentes_x_ciclo y planificaciones_curso).
- **1 migración forward, 11 DDL instantáneos** (sin reescritura de datos): 1× `DROP INDEX` del unique 2-col huérfano de competency_valuations + 8× `updated_at DROP DEFAULT` + 2× asistencia `id DROP DEFAULT`.
- **Rollout a todos los tenants** vía `migrate-tenants` (deploy.ps1 paso 8b).

### Out of Scope
- Unificación de tipo timestamp (timestamptz→timestamp(3)): reescritura de datos + riesgo de timezone. Diferido a posible change separado.
- Cualquier migración de datos / backfill.
- Modificar migration files existentes (inmutables, ya en prod).
- Tablas previas a junio 2026.

## Approach

**SCHEMA-FOLLOWS-DB + migración forward mínima.** El schema se alinea al estado real de la DB con anotaciones, y una única migración limpia las 11 discrepancias residuales que la DB tiene de más. Probado empíricamente en sandbox `educandow_tenant_dev`: schema sin tocar = 31 drift; con las 20 anotaciones + esta migración aplicada = diff VACÍO.

**Nivel pedagógico:** NINGUNO — higiene de infra/schema, sin cambio de comportamiento para usuarios.

## Decisions

1. **Schema-follows-DB + migración tiny (11 DDL).** Rechazamos la variante zero-migration: forzaría dropear `@updatedAt` y `@default(uuid())` (regresiones de comportamiento) solo para evitar 11 statements seguros.
2. **Conservar `@updatedAt` y `@default(uuid())`** — sin regresiones client-side.
3. **Dropear, NO re-agregar, el unique 2-col de competency.** Es un constraint huérfano ROTO: un `DROP CONSTRAINT IF EXISTS` no-opeó silenciosamente sobre un `CREATE UNIQUE INDEX`. Hoy bloquea el mismo alumno+competencia entre CourseCycles — dropearlo es un fix de correctitud real. El unique 3-col superseder ya está bien aplicado.
4. **Timestamp tz/non-tz: documentar con `@db.Timestamptz(6)`, diferir unificación.**
5. **Rollout uniforme:** los 11 DDL son instantáneos, una pasada de `migrate-tenants` sobre todos los tenants.

## Risks

| Riesgo | Sev | Mitigación |
|--------|-----|------------|
| Drop del unique 2-col viola filas | Nula | El 3-col ya rige en prod; todas las filas lo cumplen. |
| `updated_at DROP DEFAULT` rompe algo | Baja | `@updatedAt` lo setea client-side siempre; el default DB era inalcanzable. |
| `asistencia.id DROP DEFAULT` | Baja | Prisma siempre pasa `id` en el INSERT. |
| Rollout multi-tenant | Media | Una pasada; validar en un tenant primero. |
