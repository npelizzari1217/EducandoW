# Tasks: retiro-examenes-presidente-s3b3

> Phase: sdd-tasks · Store: hybrid · 2026-06-17
> Delivery: auto-chain · Single PR · ~41 lines changed

---

## Review Workload Forecast

| Metric                       | Value                                           |
|------------------------------|-------------------------------------------------|
| Estimated changed lines      | ~41 (4 removed from schema, ~35 new migration, 2 spec lines) |
| 400-line budget risk         | LOW                                             |
| Chained PRs recommended      | No                                              |
| Decision needed before apply | No                                              |

All changes fit a single PR well under 400 lines. No chaining required.

---

## Dependency Graph (DAG)

```
T1 (schema edit)
  ├── T2 (prisma:generate)  ─────────────────────────────────────────┐
  ├── T3 (migration file)   ──── parallel with T2 ───────────────────┤
  ├── T4 (spec secundario)  ──── parallel with T2, T3 ───────────────┤
  └── T5 (spec terciario)   ──── parallel with T2, T3, T4 ───────────┤
                                                                      ▼
                                                              T6 (verify all gates)
```

T4 and T5 have no compile-time dependency; they may be edited in parallel with T2 and T3.
T6 is gated on T2 (prisma:generate must have passed), T3 (migration file must exist), T4, and T5.

---

## Tasks

### [x] T1 — Edit `api/prisma_tenant/schema.prisma` (remove 4 relation lines)

**Sequential. Must run first. Prerequisite for T2, T3, T4, T5.**

**Satisfies:** R-7

Remove exactly the following 4 lines and nothing else:

1. **Line 108** (Teacher model back-relation):
   ```
   mesasExamen          MesaExamen[]
   ```

2. **Line 109** (Teacher model back-relation):
   ```
   actasExamen          ActaExamen[]
   ```

3. **Line 1035** (MesaExamen relation field):
   ```
   presidente Teacher               @relation(fields: [presidenteId], references: [id], onDelete: Restrict)
   ```

4. **Line 1182** (ActaExamen relation field):
   ```
   presidente     Teacher         @relation(fields: [presidenteId],     references: [id], onDelete: Restrict)
   ```

**Constraints:**
- KEEP `presidenteId String @map("presidente_id")` in both MesaExamen and ActaExamen.
- KEEP all `@@index([presidenteId])` directives.
- KEEP `subjectAssignments SubjectAssignment[]` in Teacher (do NOT touch Teacher otherwise).
- Do NOT touch `generator erd`, the `Subject.mesasExamen` back-relation (line 419), or any other model.

---

### [x] T2 — Run `pnpm --filter api prisma:generate` (gate)

**Sequential. Depends on T1. Prerequisite for T6.**

**Satisfies:** R-10 (partial — schema generation integrity)

```bash
pnpm --filter api prisma:generate
```

Expected result: exit code 0, no errors, no warnings. If it fails, fix T1 before proceeding.

---

### [x] T3 — Create migration file (parallel with T2)

**Parallel with T2 (and T4, T5). Depends on T1. Prerequisite for T6.**

**Satisfies:** R-1, R-2, R-3, R-4, R-5, R-9

Create directory and file:

**Path:** `api/prisma_tenant/migrations/20260617140000_migrate_presidente_id_to_user/migration.sql`

**Content (exact order is mandatory — backfill before drop):**

```sql
-- Migration: 20260617140000_migrate_presidente_id_to_user
-- Description: Migrate MesaExamen/ActaExamen.presidenteId from Teacher.id to User.id (AD-6, no FK).
-- Closes: R-GAP from S3b-2. presidenteId becomes a cross-DB UUID reference (no FK, pattern AD-6).
-- Deploy: per-tenant via migrate-tenants.
--
-- PRE-DEPLOY (run per tenant, informational — does NOT block deploy under Option B):
--   SELECT COUNT(*) FROM mesas_examen me JOIN teachers t ON me.presidente_id = t.id WHERE t.user_id IS NULL;
--   SELECT COUNT(*) FROM actas_examen ae JOIN teachers t ON ae.presidente_id = t.id WHERE t.user_id IS NULL;
-- Rows with count > 0 will retain Teacher.id as dangling UUID (accepted, no UX impact).

-- STEP 1: Backfill mesas_examen — replace Teacher.id with Teacher.userId where available.
UPDATE mesas_examen SET presidente_id = t.user_id
  FROM teachers t
  WHERE mesas_examen.presidente_id = t.id AND t.user_id IS NOT NULL;

-- STEP 2: Backfill actas_examen — same logic.
UPDATE actas_examen SET presidente_id = t.user_id
  FROM teachers t
  WHERE actas_examen.presidente_id = t.id AND t.user_id IS NOT NULL;

-- STEP 3: Drop FK constraint on mesas_examen (IF EXISTS — safe for schema-drift tenants).
ALTER TABLE "mesas_examen" DROP CONSTRAINT IF EXISTS "mesas_examen_presidente_id_fkey";

-- STEP 4: Drop FK constraint on actas_examen (IF EXISTS).
ALTER TABLE "actas_examen" DROP CONSTRAINT IF EXISTS "actas_examen_presidente_id_fkey";

-- Indexes mesas_examen_presidente_id_idx and actas_examen_presidente_id_idx are RETAINED.

-- ROLLBACK DDL (structure only — data reversal out of scope):
-- ALTER TABLE "mesas_examen"
--   ADD CONSTRAINT "mesas_examen_presidente_id_fkey"
--   FOREIGN KEY ("presidente_id") REFERENCES "teachers"("id")
--   ON DELETE RESTRICT ON UPDATE CASCADE;
-- ALTER TABLE "actas_examen"
--   ADD CONSTRAINT "actas_examen_presidente_id_fkey"
--   FOREIGN KEY ("presidente_id") REFERENCES "teachers"("id")
--   ON DELETE RESTRICT ON UPDATE CASCADE;
```

**Constraints:**
- No `lock.toml` in the migration directory.
- File must be hand-written (Prisma does not generate migrations that remove relations from existing tables without dropping columns).
- STEP 3 and STEP 4 MUST follow STEP 1 and STEP 2 in the same file (no separate files, no gap).

---

### [x] T4 — Update `openspec/specs/nivel-secundario/spec.md` (spec text)

**Parallel with T2, T3, T5. Prerequisite for T6.**

**Satisfies:** R-8 (spec consistency), Scenario documentation alignment.

**File:** `/home/usuario/proyectos/educandow/openspec/specs/nivel-secundario/spec.md`

Locate the single line containing:

```
`presidenteId` (FK→Teacher)
```

Replace with:

```
`presidenteId` (User.id — AD-6 cross-DB ref, no FK)
```

Full context (current line 21):

> `POST /v1/secundario/mesas-examen` MUST create an exam board with `subjectId`, `date`, `turno` (DICIEMBRE|FEBRERO), `presidenteId` (FK→Teacher). Only ADMIN, DIRECTOR MAY access.

Becomes:

> `POST /v1/secundario/mesas-examen` MUST create an exam board with `subjectId`, `date`, `turno` (DICIEMBRE|FEBRERO), `presidenteId` (User.id — AD-6 cross-DB ref, no FK). Only ADMIN, DIRECTOR MAY access.

---

### [x] T5 — Update `openspec/specs/nivel-terciario/spec.md` (spec text)

**Parallel with T2, T3, T4. Prerequisite for T6.**

**Satisfies:** R-8 (spec consistency), ActaExamen.vocales free-form note.

**File:** `/home/usuario/proyectos/educandow/openspec/specs/nivel-terciario/spec.md`

Locate the single line containing:

```
`presidenteId`, `vocales` (Teacher[])
```

Replace with:

```
`presidenteId` (User.id — AD-6 cross-DB ref, no FK), `vocales` (free-form strings, no FK)
```

Full context (current line 37):

> `POST /v1/terciario/actas-examen` MUST create an exam record with `subjectId`, `date`, `presidenteId`, `vocales` (Teacher[]), `libro`, `folio`. Only ADMIN, DIRECTOR MAY access. ...

Becomes:

> `POST /v1/terciario/actas-examen` MUST create an exam record with `subjectId`, `date`, `presidenteId` (User.id — AD-6 cross-DB ref, no FK), `vocales` (free-form strings, no FK), `libro`, `folio`. Only ADMIN, DIRECTOR MAY access. ...

(Leave the remainder of the sentence unchanged.)

---

### [x] T6 — Verification gates (all must pass)

**Sequential. Depends on T2, T3, T4, T5. Final task.**

**Satisfies:** R-8, R-10, Scenarios 5, 6, 7, 8.

Run each gate in order. Stop at first failure and fix before continuing.

**Gate 1 — Dangling sweep (before running any build):**
```bash
rg "presidente: |\.mesasExamen|\.actasExamen" /home/usuario/proyectos/educandow/api/src
```
Expected: zero matches. Any hit means application code reads a removed back-relation. Fix before proceeding.

**Gate 2 — Type check:**
```bash
pnpm --filter api typecheck
```
Expected: same 11 baseline errors (or fewer), zero new errors. Any new error blocks merge.

**Gate 3 — Test suite:**
```bash
pnpm --filter api test
```
Expected: all tests green. The ~6 pre-existing Pool-mock failures are known and acceptable if unchanged. Zero new failures. Confirm no test references `Teacher.mesasExamen` or `Teacher.actasExamen`.

**Gate 4 — Full build:**
```bash
pnpm build
```
Expected: exit code 0.

**Gate 5 — Diff scope check:**
```bash
git diff --name-only HEAD
```
Expected output — exactly these files, no others:
```
api/prisma_tenant/schema.prisma
api/prisma_tenant/migrations/20260617140000_migrate_presidente_id_to_user/migration.sql
openspec/specs/nivel-secundario/spec.md
openspec/specs/nivel-terciario/spec.md
```
Any unexpected file in the diff is a scope violation (R-8).

**Gate 6 — Migration structure check (manual review):**
Confirm the migration file contains:
- Two UPDATE statements (backfill) before any ALTER TABLE.
- Two `DROP CONSTRAINT IF EXISTS` statements.
- A clearly delimited ROLLBACK DDL comment block with both ADD CONSTRAINT statements.
- No `lock.toml` in the migration directory.

---

## Spec Requirement → Task Traceability

| Spec Req | Description                         | Task(s) |
|----------|-------------------------------------|---------|
| R-1      | presidenteId stores User.id         | T3      |
| R-2      | FK constraints removed              | T3      |
| R-3      | Indexes preserved                   | T3 (no index DDL = preserved) |
| R-4      | Backfill well-formed rows           | T3      |
| R-5      | Orphan Option B (no abort)          | T3      |
| R-6      | R-GAP closure (no Teacher row req)  | T1 + T3 |
| R-7      | Prisma model back-relations removed | T1      |
| R-8      | Zero code change                    | T6 (Gate 5 enforces) |
| R-9      | Migration reversibility comment     | T3      |
| R-10     | Build integrity                     | T2, T6  |

---

## Execution Order Summary

```
1. T1  — schema.prisma edit (4 lines removed)            [sequential, FIRST]
2. T2  — prisma:generate (gate)                          [sequential, after T1]
   T3  — migration file created                          [parallel with T2]
   T4  — nivel-secundario spec text updated              [parallel with T2, T3]
   T5  — nivel-terciario spec text updated               [parallel with T2, T3, T4]
3. T6  — all verification gates run                      [sequential, LAST]
```

No test-first step: this is a zero-behavior-change migration. Existing tests use opaque UUID strings and remain valid for User.id values.
