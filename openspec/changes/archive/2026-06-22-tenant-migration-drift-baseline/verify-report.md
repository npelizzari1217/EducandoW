# Verify Report: tenant-migration-drift-baseline

> Phase: verify
> Date: 2026-06-22
> Branch: fix/tenant-migration-drift-baseline
> Verdict: PASS WITH WARNINGS — 0 CRITICAL · 2 WARNING · 2 SUGGESTION
> Safe to PR: YES

---

## Check 1 — Migration file content (MI-11 / ADR-2)

**Result: PASS**

File: `api/prisma_tenant/migrations/20260623000000_reconcile_tenant_drift_baseline/migration.sql`

Exactly 11 DDL statements present:
- 1× `DROP INDEX "competency_valuations_studentId_competencyId_key"` (CV-R9 / ADR-3)
- 8× `ALTER TABLE "<t>" ALTER COLUMN "updated_at" DROP DEFAULT` (MI-11 / ADR-2)
  - alumnos_x_curso_x_ciclo
  - alumnos_x_grupo_x_curso_x_materia_x_ciclo
  - alumnos_x_materia_x_curso_x_ciclo
  - asignaciones_curso_x_ciclo
  - docentes_x_ciclo
  - grupos_x_curso_x_materia_x_ciclo
  - materias_x_curso_x_ciclo
  - planificaciones_curso
- 2× `ALTER TABLE "<asistencia_t>" ALTER COLUMN "id" DROP DEFAULT` (MI-11 / ADR-2)
  - asistencia_x_alumno_x_curso_x_ciclo
  - asistencia_x_materia_x_alumno_x_curso_x_ciclo

No RENAME, no SET DATA TYPE, no data DML present. ✓

---

## Check 2 — Empty-diff gate / MI-S11 (the acceptance criterion)

**Result: PASS**

Command run: `npx prisma migrate diff --from-url "$SANDBOX" --to-schema-datamodel prisma_tenant/schema.prisma --script`
Sandbox: `educandow_tenant_dev`

Output (verbatim):
```
-- This is an empty migration.
```

MI-S11 is satisfied. The tenant schema produces zero drift against the fully-migrated sandbox. ✓

---

## Check 3 — Annotation correctness and count

**Result: PASS**

### FK map: annotations (7)
All 7 match the CURRENT DB constraint names from drift-snapshot.sql (left side of each RenameForeignKey):

| Schema map: value | Drift-snapshot FROM |
|---|---|
| `asignaciones_curso_x_ciclo_course_cycle_fkey` | ✓ exact match |
| `asignaciones_curso_x_ciclo_docente_x_ciclo_fkey` | ✓ exact match |
| `alumnos_x_materia_x_curso_x_ciclo_materia_fkey` | ✓ exact match |
| `grupos_x_curso_x_materia_x_ciclo_materia_fkey` | ✓ exact match |
| `axgxcxmxc_alumno_materia_fkey` | ✓ exact match |
| `dxmc_materia_carrera_fkey` | ✓ exact match |
| `asistencia_x_materia_x_alumno_x_curso_x_ciclo_materia_fkey` | ✓ exact match |

### Index/unique map: annotations (13)
All 13 match the CURRENT DB index names from drift-snapshot.sql (left side of each RenameIndex):

| Schema map: value | Type |
|---|---|
| `asignaciones_curso_x_ciclo_cc_dxc_rol_turno_key` | @@unique |
| `alumnos_x_materia_x_curso_x_ciclo_materia_idx` | @@index |
| `grupos_x_curso_x_materia_x_ciclo_materia_idx` | @@index |
| `axgxcxmxc_alumno_materia_idx` | @@index |
| `competency_valuations_studentId_competencyId_course_cycle_id_ke` | @@unique (63-char) |
| `dxmc_user_materia_anio_key` | @@unique |
| `dxmc_materia_anio_idx` | @@index |
| `dxmc_user_idx` | @@index |
| `subject_grading_periods_course_cycle_id_subject_id_period_ordin` | @@unique (63-char) |
| `subject_period_grades_student_id_course_cycle_id_subject_id_per` | @@unique (63-char) |
| `subject_final_grades_student_id_course_cycle_id_subject_id_type` | @@unique (63-char) |
| `asistencia_x_alumno_x_curso_x_ciclo_course_cycle_id_year_month_` | @@index (63-char) |
| `asistencia_x_materia_x_alumno_x_curso_x_ciclo_materia_year_mont` | @@index (63-char) |

All 7 PG-63-char-truncated names verified verbatim against drift-snapshot. ✓

### @db.Timestamptz(6) annotations (18)
Count confirmed: 18 occurrences in schema.prisma.
- 8 models × 2 fields (createdAt + updatedAt) = 16
- Plus deletedAt on DocenteXCiclo and PlanificacionCurso = 2
Total = 18 ✓

### Preservation of @updatedAt and @default(uuid())
- All `updatedAt` fields retain `@updatedAt` decorator after annotation edits. ✓
- The `asistencia` tables retain `@default(uuid())` on `id` — only the DB-level DEFAULT was dropped via migration, client-side generation is unchanged. ✓

---

## Check 4 — No logic change / build health

**Result: PASS**

- `pnpm --filter api prisma:generate`: exit 0 ✓
- `pnpm --filter api typecheck`: exit 0 (no TypeScript errors) ✓
- `pnpm --filter api test`: 160 test files, 1539 tests, all green ✓

Only files changed:
- `api/prisma_tenant/schema.prisma` — 38 insertions, 38 deletions (pure annotation edits, net 0 lines)
- `api/prisma_tenant/migrations/20260623000000_reconcile_tenant_drift_baseline/migration.sql` — new file, untracked
- `openspec/changes/tenant-migration-drift-baseline/` — untracked (artifacts only)

No application code (services, controllers, use cases, tests) was modified. ✓

---

## Check 5 — CV-R9: Competency uniqueness scoped to CourseCycle

**Result: PASS**

Schema after change:
```prisma
@@unique([studentId, competencyId, courseCycleId], map: "competency_valuations_studentId_competencyId_course_cycle_id_ke")
```

Confirmed:
- Exactly one unique constraint on `competency_valuations`: the 3-column `(studentId, competencyId, courseCycleId)`. ✓
- No 2-column unique on `(studentId, competencyId)` exists anywhere in schema. ✓
- Migration drops the stranded 2-col index `competency_valuations_studentId_competencyId_key` from the DB. ✓
- CV-S21 (same student+competency in two CourseCycles) is now possible at DB level.
- CV-S22 (same triple rejected) remains enforced by the 3-col constraint.

---

## Task completion

| Task | Status | Verified |
|---|---|---|
| T1: 7 FK map: annotations | DONE | ✓ count=7, names match |
| T2: 13 index/unique map: annotations | DONE | ✓ count=13, names match |
| T3: 18 @db.Timestamptz(6) annotations | DONE | ✓ count=18 |
| T4 GATE: diff = 11 stmts, no RENAME/TYPE | DONE | ✓ gate passed |
| T5: TDD test for CV-S21/S22 (optional) | DEFERRED | — |
| T6: migration.sql, 11 DDL | DONE | ✓ 11 statements verified |
| T7 GATE: empty diff on sandbox | DONE | ✓ "-- This is an empty migration." |
| T8: TDD test GREEN post-migration (optional) | DEFERRED | — |
| T9: prisma:generate | DONE | ✓ exit 0 |
| T10: typecheck | DONE | ✓ exit 0 |
| T11: tests green | DONE | ✓ 1539/1539 |

All 9 mandatory tasks complete. 2 optional TDD tasks deferred.

---

## Findings

### WARNING W1 — `openspec/specs/migration-integrity/spec.md` does not exist

The delta file (`specs/migration-integrity/delta.md`) references
`openspec/specs/competency-valuations/spec.md` as the canonical spec location for CV-R9
(which EXISTS ✓), and `openspec/specs/migration-integrity/spec.md` for MI-11
(which does NOT exist on disk).

At archive time, the archive phase must CREATE `openspec/specs/migration-integrity/spec.md`
from scratch (using the delta content as the seed) rather than appending to an existing file.
This is not a blocker for PR but must be handled before archive is marked complete.

### WARNING W2 — CV-S21 and CV-S22 lack automated test coverage

T5 (DB integration test for CV-R9 scenarios) was deferred. The acceptance scenarios CV-S21
(cross-CourseCycle insert accepted) and CV-S22 (same triple rejected) have no automated
test. DB-level correctness is verified implicitly by the empty-diff gate and the DROP INDEX
in migration, but behavioral coverage is absent. Recommend creating the integration test
before or alongside archive.

### SUGGESTION S1 — Changes not yet committed

All changes are unstaged/untracked. A commit and PR against `main` is required to complete
the lifecycle. Suggested commit message:
```
fix(tenant): reconcile schema drift baseline (CV-R9, MI-11)
```

### SUGGESTION S2 — Rollout requires fleet migration

This forward migration must run on all tenants via `migrate-tenants` fleet command.
Recommended sequence:
1. Validate on `educandow_ccaeff` tenant (representative staging tenant)
2. Run `migrate-tenants` fleet command across all tenants
3. Confirm no rollout errors before closing the change

---

## Spec requirements verdict

| Requirement | Scenario | Status |
|---|---|---|
| CV-R9 | CV-S21 (cross-CourseCycle accepted) | SATISFIED at DB level; no automated test |
| CV-R9 | CV-S22 (same triple rejected) | SATISFIED at DB level; no automated test |
| MI-11 | MI-S11 (empty diff) | SATISFIED — verified independently |

---

## Verdict

**PASS WITH WARNINGS** — 0 CRITICAL, 2 WARNING, 2 SUGGESTION

Safe to commit and open PR: **YES**
Ready for archive: **YES** (with W1 resolved during archive — create migration-integrity/spec.md)
Next recommended phase: `sdd-archive`
