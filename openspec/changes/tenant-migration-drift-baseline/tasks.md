# Tasks: tenant-migration-drift-baseline

> Phase: tasks · Store: hybrid
> Change: tenant-migration-drift-baseline
> PR decomposition: **SINGLE atomic PR** (~60 lines)
> Specs: CV-R9 (CV-S21, CV-S22) · MI-11 (MI-S11)
> Dependencies: `sdd/tenant-migration-drift-baseline/design` · `sdd/tenant-migration-drift-baseline/spec`

## Dependency graph

```
T1 → T2 → T3 → T4[gate] ──┬──> T5(opt) ─────────────> T8(opt)
                            │                              ↑
                            └──> T6 ──────> T7[gate] ─────┘──> T9 → [T10 ‖ T11]
```

Legend: `[gate]` = blocking; `(opt)` = recommended but not mandatory for PR merge; `‖` = parallel.

---

## [x] T1 — Group A-a: Add 7 FK `map:` annotations

**File**: `api/prisma_tenant/schema.prisma`
**DB change**: NONE
**Spec**: MI-11 (annotation-only, eliminates RenameForeignKey drift)
**ADR**: ADR-1 (schema-follows-DB)

Add `map:` to the named `@relation` directives on the 7 models below. Values are the **current short DB constraint names** (verbatim from drift-snapshot.sql `RenameForeignKey` FROM sides):

| Model | Relation field | `map:` value |
|---|---|---|
| `AlumnosXGrupoXCursoXMateriaXCiclo` | `alumnoMateria` | `"axgxcxmxc_alumno_materia_fkey"` |
| `MateriasXAlumnoXCursoXCiclo` | `materia` | `"alumnos_x_materia_x_curso_x_ciclo_materia_fkey"` |
| `AsignacionCursoXCiclo` | `courseCycle` | `"asignaciones_curso_x_ciclo_course_cycle_fkey"` |
| `AsignacionCursoXCiclo` | `docenteXCiclo` | `"asignaciones_curso_x_ciclo_docente_x_ciclo_fkey"` |
| `asistenciaXMateriaXAlumnoXCursoXCiclo` | `materia` | `"asistencia_x_materia_x_alumno_x_curso_x_ciclo_materia_fkey"` |
| `DocenteXMateriaCarrera` | `materiaCarrera` | `"dxmc_materia_carrera_fkey"` |
| `GrupoXCursoXMateriaXCiclo` | `materia` | `"grupos_x_curso_x_materia_x_ciclo_materia_fkey"` |

**Done when**: every `@relation` above has the exact `map:` string with no trailing/extra characters.

---

## [x] T2 — Group A-b: Add 13 index/unique `map:` annotations

**File**: `api/prisma_tenant/schema.prisma`
**DB change**: NONE
**Spec**: MI-11 (eliminates RenameIndex drift)
**ADR**: ADR-1
**Risk**: Seven names are exactly 63 chars (PG identifier truncation) — copy verbatim, including any trailing underscore.

| Model | Attribute | `map:` value |
|---|---|---|
| `AlumnosXGrupoXCursoXMateriaXCiclo` | `@@index([alumnosXMateriaXCursoXCicloId])` | `"axgxcxmxc_alumno_materia_idx"` |
| `MateriasXAlumnoXCursoXCiclo` | `@@index([materiaXCursoXCicloId])` | `"alumnos_x_materia_x_curso_x_ciclo_materia_idx"` |
| `AsignacionCursoXCiclo` | `@@unique([courseCycleId,docenteXCicloId,rol,turno])` | `"asignaciones_curso_x_ciclo_cc_dxc_rol_turno_key"` |
| `asistenciaXAlumnoXCursoXCiclo` | `@@index([courseCycleId,year,month])` | `"asistencia_x_alumno_x_curso_x_ciclo_course_cycle_id_year_month_"` **(63 chars, trailing `_`)** |
| `asistenciaXMateriaXAlumnoXCursoXCiclo` | `@@index([materiaXCursoXCicloId,year,month])` | `"asistencia_x_materia_x_alumno_x_curso_x_ciclo_materia_year_mont"` **(63 chars)** |
| `CompetenciaXMateriaXAlumnoXCursoXCiclo` | `@@unique([studentId,competencyId,courseCycleId])` | `"competency_valuations_studentId_competencyId_course_cycle_id_ke"` **(63 chars)** |
| `DocenteXMateriaCarrera` | `@@index([materiaCarreraId,anioAcademico])` | `"dxmc_materia_anio_idx"` |
| `DocenteXMateriaCarrera` | `@@index([userId])` | `"dxmc_user_idx"` |
| `DocenteXMateriaCarrera` | `@@unique([userId,materiaCarreraId,anioAcademico])` | `"dxmc_user_materia_anio_key"` |
| `GrupoXCursoXMateriaXCiclo` | `@@index([materiaXCursoXCicloId])` | `"grupos_x_curso_x_materia_x_ciclo_materia_idx"` |
| `SubjectFinalGrade` | `@@unique([studentId,courseCycleId,subjectId,type])` | `"subject_final_grades_student_id_course_cycle_id_subject_id_type"` **(63 chars)** |
| `SubjectGradingPeriod` | `@@unique([courseCycleId,subjectId,periodOrdinal])` | `"subject_grading_periods_course_cycle_id_subject_id_period_ordin"` **(63 chars)** |
| `SubjectPeriodGrade` | `@@unique([studentId,courseCycleId,subjectId,periodOrdinal])` | `"subject_period_grades_student_id_course_cycle_id_subject_id_per"` **(63 chars)** |

**Done when**: all 13 `map:` strings are present; 63-char names end exactly as shown above.

---

## [x] T3 — Group A-c: Add 18 `@db.Timestamptz(6)` type annotations

**File**: `api/prisma_tenant/schema.prisma`
**DB change**: NONE
**Spec**: MI-11 (eliminates SET DATA TYPE drift)
**ADR**: ADR-4 (document tz inconsistency; defer unification)
**Constraint**: KEEP `@updatedAt` and `@default(now())` on all annotated fields; only append `@db.Timestamptz(6)`. Do not remove `@default(uuid())` from any `id` field.

| Model (table) | Fields to annotate with `@db.Timestamptz(6)` |
|---|---|
| `AlumnosXCursoXCiclo` (`alumnos_x_curso_x_ciclo`) | `createdAt`, `updatedAt` |
| `AlumnosXGrupoXCursoXMateriaXCiclo` (`alumnos_x_grupo_x_curso_x_materia_x_ciclo`) | `createdAt`, `updatedAt` |
| `MateriasXAlumnoXCursoXCiclo` (`alumnos_x_materia_x_curso_x_ciclo`) | `createdAt`, `updatedAt` |
| `AsignacionCursoXCiclo` (`asignaciones_curso_x_ciclo`) | `createdAt`, `updatedAt` |
| `DocenteXCiclo` (`docentes_x_ciclo`) | `deletedAt`, `createdAt`, `updatedAt` |
| `GrupoXCursoXMateriaXCiclo` (`grupos_x_curso_x_materia_x_ciclo`) | `createdAt`, `updatedAt` |
| `MateriaXCursoXCiclo` (`materias_x_curso_x_ciclo`) | `createdAt`, `updatedAt` |
| `PlanificacionCurso` (`planificaciones_curso`) | `deletedAt`, `createdAt`, `updatedAt` |

Total: 18 field-level annotations (2 per model × 6 models + 3 per model × 2 models = 12 + 6).

**Done when**: each listed field has `@db.Timestamptz(6)` appended; `@updatedAt` / `@default(now())` remain intact on every field that had them.

---

## [x] T4 — Set-equality gate: verify diff = exactly 11 DDL statements [BLOCKING]

**Depends on**: T1 + T2 + T3 complete
**Spec**: MI-11 (annotation completeness before migration authoring)
**Purpose**: explicit typo guard — catches any incorrect or missing 63-char name before the migration is committed.

Run against the dev sandbox:

```bash
prisma migrate diff \
  --from-url "$EDUCANDOW_TENANT_DEV_URL" \
  --to-schema-datamodel prisma_tenant/schema.prisma \
  --script
```

**Assert** the output is set-equal to exactly these 11 statements (order may vary):

1. `DROP INDEX "competency_valuations_studentId_competencyId_key";`
2. `ALTER TABLE "alumnos_x_curso_x_ciclo" ALTER COLUMN "updated_at" DROP DEFAULT;`
3. `ALTER TABLE "alumnos_x_grupo_x_curso_x_materia_x_ciclo" ALTER COLUMN "updated_at" DROP DEFAULT;`
4. `ALTER TABLE "alumnos_x_materia_x_curso_x_ciclo" ALTER COLUMN "updated_at" DROP DEFAULT;`
5. `ALTER TABLE "asignaciones_curso_x_ciclo" ALTER COLUMN "updated_at" DROP DEFAULT;`
6. `ALTER TABLE "docentes_x_ciclo" ALTER COLUMN "updated_at" DROP DEFAULT;`
7. `ALTER TABLE "grupos_x_curso_x_materia_x_ciclo" ALTER COLUMN "updated_at" DROP DEFAULT;`
8. `ALTER TABLE "materias_x_curso_x_ciclo" ALTER COLUMN "updated_at" DROP DEFAULT;`
9. `ALTER TABLE "planificaciones_curso" ALTER COLUMN "updated_at" DROP DEFAULT;`
10. `ALTER TABLE "asistencia_x_alumno_x_curso_x_ciclo" ALTER COLUMN "id" DROP DEFAULT;`
11. `ALTER TABLE "asistencia_x_materia_x_alumno_x_curso_x_ciclo" ALTER COLUMN "id" DROP DEFAULT;`

**FAIL condition**: any `RENAME`, `SET DATA TYPE`, `CREATE`, or extra `ALTER` in the output = one or more Group A annotations are wrong or missing. Fix the offending annotation(s) and re-run. Do NOT proceed to T6 until this check passes with exactly these 11 statements.

---

## [ ] T5 — (Recommended) Write TDD `.db.test.ts` for CV-R9 — DEFERRED (see apply-progress)

**File**: `api/src/<relevant-module>/competency-valuations.db.test.ts` (or nearest `.db.test.ts` per project conventions)
**Depends on**: T4 (gate passed; annotations confirmed complete)
**Spec**: CV-R9, CV-S21, CV-S22
**ADR**: ADR-3 (DROP the stranded 2-col unique; do not re-add)
**Note**: Strict TDD is active. Write the test BEFORE the migration is applied (before T6/T7). Run it against the pre-migration sandbox to confirm RED — this proves the bug exists.

Test cases:

1. **CV-S21 (RED before migration, GREEN after)**: insert two `competency_valuations` rows for the same `(studentId, competencyId)` but DIFFERENT `courseCycleId` values. Against the current sandbox (stranded 2-col unique present): INSERT must FAIL. After the forward migration is applied (T7): INSERT must SUCCEED.
2. **CV-S22 (RED throughout — must always reject)**: insert two rows with the exact same `(studentId, competencyId, courseCycleId)` triple. Must fail with a unique-constraint violation both before and after migration. The 3-col constraint enforces this.

**Done when**: test file exists and CV-S21 returns a unique-constraint error when run against the current pre-migration sandbox, confirming the stranded 2-col index is in effect.

---

## [x] T6 — Group B: Create migration dir and hand-author `migration.sql`

**Files**:
- New dir: `api/prisma_tenant/migrations/20260623000000_reconcile_tenant_drift_baseline/`
- New file: `api/prisma_tenant/migrations/20260623000000_reconcile_tenant_drift_baseline/migration.sql`
- (Apply phase may adjust the leading timestamp — MUST sort after `20260622145831`)

**Depends on**: T4 [gate] (set-equality confirmed)
**Spec**: CV-R9 (ADR-3: DROP the stranded 2-col unique), MI-11 (ADR-2: keep `@updatedAt` / `@default(uuid())`)
**CRITICAL**: Do NOT run `prisma migrate dev`. Hand-author the 11 statements below (equivalently, copy verbatim from the T4 diff output after set-equality is confirmed).

`migration.sql` body — exactly these 11 statements, nothing else:

```sql
-- DropIndex: stranded broken 2-col unique (left behind by 20260608201000;
-- 20260608210000 tried DROP CONSTRAINT IF EXISTS which silently no-oped on an index).
-- The superseding 3-col unique (competency_valuations_studentId_competencyId_course_cycle_i_key)
-- is already correctly enforced. Dropping this is a correctness fix (CV-R9 / ADR-3).
DROP INDEX "competency_valuations_studentId_competencyId_key";

-- updated_at DROP DEFAULT (8): @updatedAt sets it client-side on every write;
-- the DB-level DEFAULT NOW() is unreachable (MI-11 / ADR-2).
ALTER TABLE "alumnos_x_curso_x_ciclo" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "alumnos_x_grupo_x_curso_x_materia_x_ciclo" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "alumnos_x_materia_x_curso_x_ciclo" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "asignaciones_curso_x_ciclo" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "docentes_x_ciclo" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "grupos_x_curso_x_materia_x_ciclo" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "materias_x_curso_x_ciclo" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "planificaciones_curso" ALTER COLUMN "updated_at" DROP DEFAULT;

-- asistencia id DROP DEFAULT (2): schema uses @default(uuid()) (client-side);
-- DB carries (gen_random_uuid())::text. Prisma always passes id in INSERT (MI-11 / ADR-2).
ALTER TABLE "asistencia_x_alumno_x_curso_x_ciclo" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "asistencia_x_materia_x_alumno_x_curso_x_ciclo" ALTER COLUMN "id" DROP DEFAULT;
```

**Done when**: `migration.sql` exists with exactly these 11 statements and no extras; migration dir timestamp sorts after `20260622145831`.

---

## [x] T7 — Verification gate: deploy to sandbox + assert empty diff [BLOCKING — acceptance criterion]

**Depends on**: T6
**Spec**: MI-11, MI-S11 (empty diff IS the acceptance criterion for this change)
**ADR**: ADR-5 (staged rollout: dev sandbox first, then real tenant, then fleet)

Step 1 — Apply migration to dev sandbox:

```bash
pnpm --filter api prisma:migrate:deploy:tenant
# targets EDUCANDOW_TENANT_DEV_URL (educandow_tenant_dev)
```

Step 2 — Assert empty diff:

```bash
prisma migrate diff \
  --from-url "$EDUCANDOW_TENANT_DEV_URL" \
  --to-schema-datamodel prisma_tenant/schema.prisma
```

**Expected output**: `-- This is an empty migration.`
**FAIL condition**: any non-empty DDL output = something is still wrong in Group A or Group B. Debug which statement is missing or incorrect; do NOT proceed to T8/T9/T10/T11.

**Done when**: diff output is exactly the empty-migration sentinel on `educandow_tenant_dev`.

---

## [ ] T8 — (Recommended) Verify TDD test GREEN — DEFERRED (T5 deferred)

**Depends on**: T5 + T7
**Spec**: CV-R9, CV-S21, CV-S22

Run the `.db.test.ts` from T5 against the now-migrated sandbox:

- **CV-S21**: same `(studentId, competencyId)`, different `courseCycleId` → INSERT MUST SUCCEED (GREEN)
- **CV-S22**: same `(studentId, competencyId, courseCycleId)` triple → MUST still fail with unique-constraint violation

**Done when**: CV-S21 succeeds and CV-S22 is rejected; both scenarios pass.

---

## [x] T9 — Prisma client regeneration

**Depends on**: T7
**Spec**: MI-11 (no type regression after schema annotations)

```bash
pnpm --filter api prisma:generate
```

Must complete without error for both master and tenant schemas. `map:` and `@db.Timestamptz(6)` do NOT alter generated TS types (DateTime stays DateTime; map is DB-only metadata) — regeneration is expected to produce no type-level changes.

**Done when**: command exits 0, no errors.

---

## [x] T10 — Typecheck [parallel with T11]

**Depends on**: T9
**Spec**: MI-11 (no type regression)

```bash
pnpm --filter api typecheck
```

**Done when**: `tsc --noEmit` exits 0.

---

## [x] T11 — Unit test suite [parallel with T10]

**Depends on**: T9
**Spec**: MI-11 (no regressions; coverage threshold ≥ 80%)

```bash
pnpm --filter api test
```

No application logic changes in this PR — coverage is not materially affected by this infra-only change. All pre-existing tests must remain green.

**Done when**: vitest exits 0; coverage threshold met.

---

## Rollout note (deploy-time procedure, not a code task)

After the PR merges and deploys — do NOT run fleet-wide until sandbox + one real tenant are confirmed:

1. **Dev sandbox** (`educandow_tenant_dev`): already validated by T7.
2. **First real tenant** (`educandow_ccaeff`): `prisma migrate deploy --schema=prisma_tenant/schema.prisma` → re-run T7 diff gate and confirm empty output.
3. **Fleet**: `pnpm --filter api migrate-tenants` (`scripts/migrate-all-tenants.ts`, `deploy.ps1` step 8b). Run only after step 2 confirms success.

All 11 DDL statements are instant catalog operations; no table rewrites, no lock escalation concern at this data scale.

---

## Review Workload Forecast

| Metric | Value |
|---|---|
| Estimated changed lines | ~60 (`schema.prisma`: ~38 edits; `migration.sql`: ~12 lines; optional `.db.test.ts`: ~20 lines) |
| Files affected (mandatory) | 2 (`api/prisma_tenant/schema.prisma`, new `migration.sql`) |
| Files affected (optional) | +1 (`.db.test.ts`) |
| Chained PRs recommended | **No** |
| 400-line budget risk | **Low** |
| Decision needed before apply | **No** |
| Delivery strategy | Single atomic PR |
