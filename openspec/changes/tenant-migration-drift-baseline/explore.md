# Exploration: tenant-migration-drift-baseline

> Phase: explore · Store: hybrid (engram `sdd/tenant-migration-drift-baseline/explore`)

## Problem
`prisma migrate dev` against the tenant schema generates ~31 lines of unrelated drift every run (we stripped it manually in the last 2 changes). `api/prisma_tenant/schema.prisma` has drifted from the actual DB state on 5 axes. Goal: reconcile so `prisma migrate diff` (DB↔schema) is EMPTY → migrate dev clean — with MINIMUM production risk. Authoritative drift captured in `drift-snapshot.sql`.

## Drift categorized — 31 statements, 5 buckets
1. **FK renames (7)** — metadata-only, zero data risk. DB has short handwritten names vs Prisma convention. Fix: `map:` on each `@relation`.
2. **Index renames (13)** — metadata-only. Same cause + PG 63-char truncation. Fix: `map:` on `@@index`/`@@unique`.
3. **Timestamp drift (8 tables)** — June 2026 migrations used `TIMESTAMPTZ NOT NULL DEFAULT NOW()` (older tables use `TIMESTAMP(3)`). Schema lacks `@db.Timestamptz(6)` and uses `@updatedAt` (no DB default). Confirmed inconsistency: `academic_cycles` = `timestamp`; `docentes_x_ciclo`/`materias_x_curso_x_ciclo` = `timestamptz`. Tables: alumnos_x_curso_x_ciclo, alumnos_x_grupo_x_curso_x_materia_x_ciclo, alumnos_x_materia_x_curso_x_ciclo, asignaciones_curso_x_ciclo, docentes_x_ciclo, grupos_x_curso_x_materia_x_ciclo, materias_x_curso_x_ciclo, planificaciones_curso.
4. **`id` DEFAULT on 2 asistencia tables** — DB default `(gen_random_uuid())::text`; schema `@default(uuid())` (client-side). Prisma wants DROP DEFAULT.
5. **Stranded 2-col unique on competency_valuations (1)** — `competency_valuations_studentId_competencyId_key`. ROOT CAUSE: migration `20260608201000` created it via `CREATE UNIQUE INDEX`; `20260608210000` tried `ALTER TABLE ... DROP CONSTRAINT IF EXISTS` which **silently no-oped** (can't drop an index via DROP CONSTRAINT). It is BROKEN in prod: blocks same student+competency across different CourseCycles — the opposite of the fase3 model. The superseding 3-col unique was applied correctly.

## Recommended approach: SCHEMA-FOLLOWS-DB + tiny forward migration
- **20 schema annotations** (no DB change): 7 FK `map:`, 13 index/unique `map:`, `@db.Timestamptz(6)` on the 8 drifted tables' created_at/updated_at (+ deleted_at on docentes_x_ciclo & planificaciones_curso). Keep `@updatedAt` and `@default(uuid())`.
- **1 forward migration, 11 DDL statements (instant, no data rewrite)**:
  - `DROP INDEX "competency_valuations_studentId_competencyId_key";` (the stranded broken unique)
  - 8× `ALTER TABLE "..." ALTER COLUMN "updated_at" DROP DEFAULT;`
  - 2× `ALTER TABLE "asistencia_*" ALTER COLUMN "id" DROP DEFAULT;`
- Do NOT add the 2-col competency unique back to schema (it's broken; drop it).

## Empirical proof (verified on sandbox educandow_tenant_dev)
- Unmodified schema → 31 drift statements (= drift-snapshot.sql).
- Scratch schema with all 20 annotations + (2-col unique back + updated_at @default(now()) + id @default(dbgenerated)) → `-- This is an empty migration.` (EMPTY).
- Clean schema (revert the 3 "match-everything" hacks, keep @updatedAt/@default(uuid()), omit 2-col unique) → diff = exactly the 11-statement forward migration above. After applying that migration → EMPTY diff.

## Approaches compared
| | Schema-follows-DB + forward migration (REC) | Full schema-follows-DB (0 migration) | DB-follows-schema (full reconcile) |
|---|---|---|---|
| Migrations | 1 tiny (11 DDL) | 0 | 1 large (type conversions) |
| `@updatedAt` preserved | YES | NO (regression) | YES |
| `@default(uuid())` preserved | YES | NO (subtle change) | YES |
| Data risk | NONE | NONE | MEDIUM (timestamptz→timestamp rewrite) |
| Complexity | Low | Low | High |

**Recommendation: Schema-follows-DB + tiny forward migration.** The 11 DDL statements are instant, no data. The zero-migration variant would force dropping `@updatedAt`/`@default(uuid())` (behavioral regressions) just to avoid 11 safe statements — not worth it.

## Timestamp strategy
Keep the tz/non-tz inconsistency, document it with `@db.Timestamptz(6)`, DEFER unification. Converting timestamptz→timestamp(3) across all tenants rewrites data with timezone-loss risk — out of scope; separate future change if ever wanted.

## Scope
**In:** 20 schema annotations + forward migration (1 DROP INDEX + 8 updated_at DROP DEFAULT + 2 id DROP DEFAULT) + rollout to all tenants via migrate-tenants.
**Out:** timestamp type unification, any data migration, modifying existing migration files, pre-June-2026 tables.

## Risks
| Risk | Sev | Mitigation |
|---|---|---|
| 2-col competency unique drop violates rows | None | 3-col already enforced in prod; all rows already satisfy it. |
| updated_at DROP DEFAULT breaks something | Low | `@updatedAt` sets it client-side always; DB default was unreachable. |
| asistencia.id DROP DEFAULT | Low | Prisma always passes id in INSERT. |
| Multi-tenant rollout (run on every tenant) | Medium | migrate-tenants one pass; all DDL instant. Validate on a tenant first. |
