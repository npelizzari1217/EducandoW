# Design: tenant-migration-drift-baseline

> Phase: design · Store: hybrid (engram `sdd/tenant-migration-drift-baseline/design`)
> Reads: proposal (engram `sdd/.../proposal`, #1342), explore.md, drift-snapshot.sql
> Pedagogical level affected: NONE (infra / schema hygiene, no user-facing behavior)

## 1. Architecture approach

**Pattern: SCHEMA-FOLLOWS-DB + one tiny forward migration.** No Clean-Arch layering involved — this is a persistence-boundary reconciliation, not application logic. The single architectural decision is *which direction reconciliation flows*: we move the Prisma datamodel toward the real DB (annotations, zero DB change) and only emit DDL for the 11 residual discrepancies the DB has that are genuinely wrong or stale.

Two disjoint change groups:

- **Group A — schema annotations (NO DB change).** Describe existing DB objects so `migrate diff` stops proposing renames/type-conversions. 20 `map:` renames (7 FK + 13 index/unique) + 18 `@db.Timestamptz(6)` type annotations. These edit only `api/prisma_tenant/schema.prisma`.
- **Group B — forward migration (11 instant DDL).** Removes the 3 kinds of real residual drift the DB carries that the schema (correctly) does not want: 1 stranded broken unique index, 8 unreachable `updated_at` DB defaults, 2 client-managed `id` DB defaults.

After A is applied to the schema and B is applied to a DB, `migrate diff (DB ↔ schema)` is EMPTY. Empirically proven on `educandow_tenant_dev` (explore.md §"Empirical proof").

Data-flow / integration points touched: only the Prisma tenant client regeneration boundary (`@prisma/tenant-client`) and the multi-tenant migration runner (`scripts/migrate-all-tenants.ts`). No NestJS module, repository, or domain code changes.

---

## 2. Group A — schema annotations (`api/prisma_tenant/schema.prisma`)

### 2a. 7 FK `map:` on `@relation` (metadata-only)

`map:` value = the **current short DB constraint name** (the `FROM` side of each `RenameForeignKey` in drift-snapshot.sql). Adding it tells Prisma the FK already exists under that name → the rename drift disappears.

| # | Model | Relation field | Add to `@relation` |
|---|-------|----------------|--------------------|
| 1 | `AlumnosXGrupoXCursoXMateriaXCiclo` | `alumnoMateria` (fields `[alumnosXMateriaXCursoXCicloId]`) | `map: "axgxcxmxc_alumno_materia_fkey"` |
| 2 | `MateriasXAlumnoXCursoXCiclo` | `materia` (fields `[materiaXCursoXCicloId]`) | `map: "alumnos_x_materia_x_curso_x_ciclo_materia_fkey"` |
| 3 | `AsignacionCursoXCiclo` | `courseCycle` (fields `[courseCycleId]`) | `map: "asignaciones_curso_x_ciclo_course_cycle_fkey"` |
| 4 | `AsignacionCursoXCiclo` | `docenteXCiclo` (fields `[docenteXCicloId]`) | `map: "asignaciones_curso_x_ciclo_docente_x_ciclo_fkey"` |
| 5 | `asistenciaXMateriaXAlumnoXCursoXCiclo` | `materia` (fields `[materiaXCursoXCicloId]`) | `map: "asistencia_x_materia_x_alumno_x_curso_x_ciclo_materia_fkey"` |
| 6 | `DocenteXMateriaCarrera` | `materiaCarrera` (fields `[materiaCarreraId]`) | `map: "dxmc_materia_carrera_fkey"` |
| 7 | `GrupoXCursoXMateriaXCiclo` | `materia` (fields `[materiaXCursoXCicloId]`) | `map: "grupos_x_curso_x_materia_x_ciclo_materia_fkey"` |

### 2b. 13 `map:` on `@@index` / `@@unique` (metadata-only)

`map:` value = the current DB index name (`FROM` side of each `RenameIndex`). Several are exactly 63 chars (PG identifier truncation) — copy verbatim, including any trailing underscore.

| # | Model | Attribute | Add `map:` |
|---|-------|-----------|-----------|
| 1 | `AlumnosXGrupoXCursoXMateriaXCiclo` | `@@index([alumnosXMateriaXCursoXCicloId])` | `map: "axgxcxmxc_alumno_materia_idx"` |
| 2 | `MateriasXAlumnoXCursoXCiclo` | `@@index([materiaXCursoXCicloId])` | `map: "alumnos_x_materia_x_curso_x_ciclo_materia_idx"` |
| 3 | `AsignacionCursoXCiclo` | `@@unique([courseCycleId, docenteXCicloId, rol, turno])` | `map: "asignaciones_curso_x_ciclo_cc_dxc_rol_turno_key"` |
| 4 | `asistenciaXAlumnoXCursoXCiclo` | `@@index([courseCycleId, year, month])` | `map: "asistencia_x_alumno_x_curso_x_ciclo_course_cycle_id_year_month_"` |
| 5 | `asistenciaXMateriaXAlumnoXCursoXCiclo` | `@@index([materiaXCursoXCicloId, year, month])` | `map: "asistencia_x_materia_x_alumno_x_curso_x_ciclo_materia_year_mont"` |
| 6 | `CompetenciaXMateriaXAlumnoXCursoXCiclo` | `@@unique([studentId, competencyId, courseCycleId])` | `map: "competency_valuations_studentId_competencyId_course_cycle_id_ke"` |
| 7 | `DocenteXMateriaCarrera` | `@@index([materiaCarreraId, anioAcademico])` | `map: "dxmc_materia_anio_idx"` |
| 8 | `DocenteXMateriaCarrera` | `@@index([userId])` | `map: "dxmc_user_idx"` |
| 9 | `DocenteXMateriaCarrera` | `@@unique([userId, materiaCarreraId, anioAcademico])` | `map: "dxmc_user_materia_anio_key"` |
| 10 | `GrupoXCursoXMateriaXCiclo` | `@@index([materiaXCursoXCicloId])` | `map: "grupos_x_curso_x_materia_x_ciclo_materia_idx"` |
| 11 | `SubjectFinalGrade` | `@@unique([studentId, courseCycleId, subjectId, type])` | `map: "subject_final_grades_student_id_course_cycle_id_subject_id_type"` |
| 12 | `SubjectGradingPeriod` | `@@unique([courseCycleId, subjectId, periodOrdinal])` | `map: "subject_grading_periods_course_cycle_id_subject_id_period_ordin"` |
| 13 | `SubjectPeriodGrade` | `@@unique([studentId, courseCycleId, subjectId, periodOrdinal])` | `map: "subject_period_grades_student_id_course_cycle_id_subject_id_per"` |

> **The "20 annotations" of the proposal = 2a (7) + 2b (13).** These are the metadata-only renames. The Timestamptz type annotations (2c) are an additional, type-correcting group; do not conflate the counts.

### 2c. `@db.Timestamptz(6)` type annotations on the 8 drifted tables

The June-2026 migrations created these columns as `TIMESTAMPTZ`, but the schema fields carry no `@db` annotation → Prisma assumes `timestamp(3)` and proposes `SET DATA TYPE TIMESTAMP(3)`. Adding `@db.Timestamptz(6)` makes the schema describe the real column type → the type-conversion drift disappears with **zero DB change**. **KEEP `@updatedAt` and `@default(now())`** on these fields; only append `@db.Timestamptz(6)`.

18 annotations across 8 models:

| Model (table) | Fields to annotate `@db.Timestamptz(6)` |
|---|---|
| `AlumnosXCursoXCiclo` (`alumnos_x_curso_x_ciclo`) | `createdAt`, `updatedAt` |
| `AlumnosXGrupoXCursoXMateriaXCiclo` (`alumnos_x_grupo_x_curso_x_materia_x_ciclo`) | `createdAt`, `updatedAt` |
| `MateriasXAlumnoXCursoXCiclo` (`alumnos_x_materia_x_curso_x_ciclo`) | `createdAt`, `updatedAt` |
| `AsignacionCursoXCiclo` (`asignaciones_curso_x_ciclo`) | `createdAt`, `updatedAt` |
| `DocenteXCiclo` (`docentes_x_ciclo`) | `deletedAt`, `createdAt`, `updatedAt` |
| `GrupoXCursoXMateriaXCiclo` (`grupos_x_curso_x_materia_x_ciclo`) | `createdAt`, `updatedAt` |
| `MateriaXCursoXCiclo` (`materias_x_curso_x_ciclo`) | `createdAt`, `updatedAt` |
| `PlanificacionCurso` (`planificaciones_curso`) | `deletedAt`, `createdAt`, `updatedAt` |

> Type unification (timestamptz→timestamp(3) to match older tables) is **explicitly OUT of scope** — it would rewrite data with timezone-loss risk. The tz/non-tz inconsistency stays, now *documented* by the explicit annotation.

> `@default(uuid())` on every `id` (client-side) and `@default(now())` on `createdAt` stay untouched — generated TS types are unaffected by `map:` and `@db.Timestamptz`.

---

## 3. Group B — forward migration (11 DDL, instant, no data rewrite)

New migration directory under `api/prisma_tenant/migrations/`. Name must sort **after** the current latest (`20260622145831_…`); suggested `20260623000000_reconcile_tenant_drift_baseline` (apply phase picks the final timestamp). `migration.sql` body — exactly these 11 statements, nothing else:

```sql
-- DropIndex: stranded broken 2-col unique (left behind by 20260608201000;
-- 20260608210000 tried DROP CONSTRAINT IF EXISTS which silently no-oped on an index).
-- The superseding 3-col unique (competency_valuations_studentId_competencyId_course_cycle_i_key)
-- is already correctly enforced; dropping this is a real correctness fix.
DROP INDEX "competency_valuations_studentId_competencyId_key";

-- updated_at DROP DEFAULT (8): @updatedAt sets it client-side on every write;
-- the DB-level DEFAULT NOW() is unreachable. Type already absorbed by @db.Timestamptz(6).
ALTER TABLE "alumnos_x_curso_x_ciclo" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "alumnos_x_grupo_x_curso_x_materia_x_ciclo" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "alumnos_x_materia_x_curso_x_ciclo" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "asignaciones_curso_x_ciclo" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "docentes_x_ciclo" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "grupos_x_curso_x_materia_x_ciclo" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "materias_x_curso_x_ciclo" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "planificaciones_curso" ALTER COLUMN "updated_at" DROP DEFAULT;

-- asistencia id DROP DEFAULT (2): schema uses @default(uuid()) (client-side);
-- DB carries (gen_random_uuid())::text. Prisma always passes id in INSERT.
ALTER TABLE "asistencia_x_alumno_x_curso_x_ciclo" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "asistencia_x_materia_x_alumno_x_curso_x_ciclo" ALTER COLUMN "id" DROP DEFAULT;
```

### Authoring method (CRITICAL — do NOT `migrate dev`)

`prisma migrate dev` builds its diff against a shadow DB rebuilt from migration *history*, not the live drifted prod DB; it would re-bundle the renames/type-conversions baked into prod and produce a polluted migration. Instead:

1. Apply ALL of Group A to `schema.prisma` first.
2. Generate the body deterministically:
   `prisma migrate diff --from-url "$EDUCANDOW_TENANT_DEV_URL" --to-schema-datamodel prisma_tenant/schema.prisma --script`
   → assert the output is EXACTLY these 11 statements (order may differ; set-equality is the gate). If it contains any `RENAME`, `SET DATA TYPE`, `CREATE`, or extra `ALTER`, Group A is incomplete — fix annotations, do not edit the migration to paper over it.
3. Save the verified body as the new `migration.sql` (hand-authoring the 11 statements directly is equally valid and is the fallback if the diff tool is unavailable).
4. Mark/apply via `prisma migrate deploy` (it runs the file; it does NOT recompute drift). On the dev sandbox this both applies and records the migration; for already-tracked tenants `deploy` applies the new pending migration only.

---

## 4. Verification gate (acceptance criterion)

After Group A is in `schema.prisma` AND Group B is applied to a DB, the following MUST print `No difference detected` / empty:

```
prisma migrate diff \
  --from-url "$EDUCANDOW_TENANT_DEV_URL" \
  --to-schema-datamodel prisma_tenant/schema.prisma
```

This is THE acceptance test for the change. Run it on the dev sandbox (`educandow_tenant_dev`) first, then on the active tenant (`educandow_ccaeff`) after rollout.

**Optional regression guard (recommended if cheap):** a CI migration-check job that runs `prisma migrate diff --from-url <reference tenant DB> --to-schema-datamodel prisma_tenant/schema.prisma --exit-code` and fails the build on non-empty output. It needs a live reference DB, so gate it to the migration CI lane rather than the unit-test lane. This permanently prevents the drift from silently reaccumulating.

---

## 5. Rollout

All 11 DDL statements are metadata/catalog operations — instant, no table rewrite, no lock escalation of concern at this data scale.

1. **Dev sandbox** (`educandow_tenant_dev`): `prisma:migrate:deploy:tenant` → run verification gate (§4) → must be EMPTY.
2. **Active tenant** (`educandow_ccaeff`): `prisma migrate deploy --schema=prisma_tenant/schema.prisma` → re-run gate.
3. **All tenants**: `pnpm --filter api migrate-tenants` (`scripts/migrate-all-tenants.ts`), invoked by `deploy.ps1` step 8b — one pass, applies the single pending migration to every tenant DB.

Order: validate on dev + one real tenant BEFORE the fleet-wide `migrate-tenants` pass (mitigates the medium-severity multi-tenant risk).

---

## 6. PR decomposition

**SINGLE atomic PR.** Footprint: ~38 schema annotation edits (20 `map:` + 18 `@db.Timestamptz(6)`) on `schema.prisma` + 1 migration dir with a ~12-line `migration.sql` (+ optional `.db.test.ts`). Far under the 400-line budget; no chaining required.

**Review Workload Forecast**
- Estimated changed lines: ~60 (well under 400).
- Chained PRs recommended: **No**.
- 400-line budget risk: **Low**.
- Decision needed before apply: **No**.

---

## 7. Testing strategy

No application logic changes, but the tenant Prisma client regenerates. `map:` and `@db.Timestamptz(6)` do NOT alter generated TS types (DateTime stays DateTime; map is DB-only), so no type breakage is expected.

1. `pnpm --filter api prisma:generate` — must succeed for master AND tenant.
2. `pnpm --filter api typecheck` (`tsc --noEmit`) — green.
3. `pnpm --filter api test` (vitest) — green. Strict-TDD: project test_command `pnpm test`, coverage ≥ 80%; this change adds no production code paths, so coverage is unaffected except the optional DB test below.
4. **Recommended TDD test for decision #3** (`*.db.test.ts`): insert two `competency_valuations` rows with the SAME `(studentId, competencyId)` but DIFFERENT `courseCycleId`. Against the current DB (stranded 2-col unique present) this FAILS (red); after the forward migration it SUCCEEDS (green) while the 3-col unique still rejects a true duplicate `(studentId, competencyId, courseCycleId)`. This both proves the bug and locks the fix.

---

## 8. ADR-style decisions

**ADR-1 — Reconcile schema-toward-DB, not DB-toward-schema.**
Decision: align the datamodel to the live DB via annotations; emit DDL only for genuinely-wrong residue.
Rationale: zero data risk, instant DDL, preserves prod state.
Rejected: full DB-follows-schema (timestamptz→timestamp(3) rewrite = medium data risk, timezone loss) — out of scope, possible future change.

**ADR-2 — Keep the tiny forward migration; reject the zero-migration variant.**
Decision: pay 11 safe DDL statements to keep `@updatedAt` and `@default(uuid())`.
Rationale: the zero-migration path would force dropping `@updatedAt` (write-time regression) and `@default(uuid())` (subtle client-behavior change) only to avoid 11 instant, safe statements. Not worth a behavioral regression.
Rejected: full schema-follows-DB with 0 migrations.

**ADR-3 — DROP the stranded 2-col competency unique; do NOT re-add it to the schema.**
Decision: `DROP INDEX competency_valuations_studentId_competencyId_key`; schema keeps only the 3-col `@@unique([studentId, competencyId, courseCycleId])`.
Rationale: the 2-col index is a BROKEN leftover — `20260608201000` created it via `CREATE UNIQUE INDEX`; `20260608210000`'s `DROP CONSTRAINT IF EXISTS` silently no-oped (can't drop an index via DROP CONSTRAINT). It currently blocks the SAME student+competency across DIFFERENT CourseCycles, contradicting the fase3 model. Dropping it is a correctness fix, not just hygiene.
Rejected: re-adding the 2-col unique (would re-enshrine the bug).

**ADR-4 — Document the tz/non-tz timestamp inconsistency with `@db.Timestamptz(6)`; defer unification.**
Decision: annotate the 8 drifted tables' timestamp columns as `Timestamptz(6)` to match reality; leave older `timestamp(3)` tables as-is.
Rationale: unification rewrites data with timezone-loss risk for no functional gain now.
Rejected: converting all to `timestamp(3)` in this change.

**ADR-5 — One uniform fleet rollout via `migrate-tenants`, validated on dev + one tenant first.**
Decision: dev sandbox → `educandow_ccaeff` → `migrate-tenants` fleet pass (deploy.ps1 step 8b).
Rationale: all DDL is instant; staged validation contains the only medium risk (running on every tenant).

---

## 9. Risks / assumptions requiring validation

| Risk / assumption | Sev | Mitigation / validation |
|---|---|---|
| `migrate diff` after Group A still shows renames/type drift (annotation typo, esp. the 63-char truncated names) | Med | §3 step-2 set-equality gate catches it before the migration is written; copy 63-char `map:` values verbatim. |
| Drop of 2-col unique violates existing rows | None | 3-col unique already enforced in prod; all rows satisfy it. |
| `updated_at` DROP DEFAULT breaks an INSERT path that relied on the DB default | Low | `@updatedAt` always sets it client-side; DB default was unreachable. Covered by existing tests + typecheck. |
| `asistencia.id` DROP DEFAULT breaks an INSERT | Low | Prisma always passes `id` (`@default(uuid())` client-side) in INSERT. |
| Fleet-wide `migrate-tenants` partial failure | Med | Validate on dev + `educandow_ccaeff` first; DDL is instant and idempotent-safe per migration history. |
| Assumption: only the 2 asistencia tables carry a DB-level `id` default | — | Confirmed by drift-snapshot (only those 2 appear); other `@default(uuid())` ids never had a DB default. |

---

## 10. Out of scope (restated)

Timestamp type unification; any data migration/backfill; editing existing (immutable, prod-applied) migration files; pre-June-2026 tables.
