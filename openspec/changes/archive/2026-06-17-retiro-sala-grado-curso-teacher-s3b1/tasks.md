# Tasks: retiro-sala-grado-curso-teacher-s3b1

> Fase: sdd-tasks · Store: hybrid · 2026-06-17
> Delivery: auto-chain (single PR — ~160 lines deleted, well under 400-line budget)
> Branch: `feat/retiro-sala-grado-curso-teacher-s3b1`
> Approach A (DROP) — all tasks are pure removals, no new logic.

---

## Dependency graph

```
T01 ─┬──▶ T03 ──▶ T04 ──▶ T05 ┐
     │              └──────▶ T07 ──▶ T08 ┐
T02 ─┘         T06 ───────────▶────────▶ ┤
                              T09 ───────▶ T10 ──▶ T11
                              T04 ─────────────────▶ T10
```

Legend: arrows = "must precede". Items at the same column with no arrow between them can run in parallel.

Parallel groups:
- **Group A (start)**: T01 and T02 (schema vs migration — independent files)
- **Group B (after T03)**: T04, T06, T09 (domain, DTOs, web are independent of each other)
- **Group C (after T04)**: T05, T07 (both consume domain types)
- **Group D (after T07)**: T08 (controllers consume infra)
- **T10** (after T04 + T08): test edits need final domain shape
- **T11** (final): verification sweep

---

## Tasks

### [x] T01 — Schema: remove all teacherId fields and relations from Sala, Grado, Curso, Teacher

**Spec**: I-PS-1, I-PS-2, I-PS-3, I-PS-4
**Design**: §2.1 (lines 29-37)
**File**: `api/prisma_tenant/schema.prisma`
**Parallel with**: T02

Removals (exact lines from design):

| Model   | Lines      | What to remove                                      |
|---------|------------|-----------------------------------------------------|
| Teacher | 108-110    | `salas Sala[]`, `grados Grado[]`, `cursos Curso[]` back-relations (all 3) |
| Sala    | 821        | `teacherId String? @map("teacher_id")`              |
| Sala    | 826        | `teacher Teacher? @relation(...onDelete: SetNull)`  |
| Sala    | 836        | `@@index([teacherId])`                              |
| Grado   | 943        | `teacherId String? @map("teacher_id")`              |
| Grado   | 949        | `teacher Teacher? @relation(...onDelete: SetNull)`  |
| Grado   | 956        | `@@index([teacherId])`                              |
| Curso   | 998-999    | `teacher Teacher? @relation(...)` + `teacherId String? @map("teacher_id")` |

Constraints:
- Do NOT touch `generator erd` block (lines 6-9).
- Do NOT touch Teacher's other relations: `subjectAssignments`, `mesasExamen`, `actasExamen`.
- Curso has NO `@@index([teacherId])` — do not search for or add one.
- Both sides of every relation must be removed together (forward + back-relation) — prisma validate requires this.

Acceptance: `prisma validate` passes (verified by T03).

---

### [x] T02 — Migration: create hand-written SQL file for tenant schema drop

**Spec**: I-DB-1 through I-DB-5, I-MIG-1 through I-MIG-5
**Design**: §3 (exact SQL provided)
**File**: `api/prisma_tenant/migrations/20260617130000_drop_sala_grado_curso_teacher_id/migration.sql` (NEW directory + file)
**Parallel with**: T01

Create the directory `20260617130000_drop_sala_grado_curso_teacher_id/` and write `migration.sql` with the exact DDL from design §3:
- Drop FK constraints (IF EXISTS): `salas_teacher_id_fkey`, `grados_teacher_id_fkey`, `cursos_teacher_id_fkey`
- Drop indexes (IF EXISTS): `salas_teacher_id_idx`, `grados_teacher_id_idx` (cursos has NO index — do not add)
- Drop columns (IF EXISTS): `teacher_id` on salas, grados, cursos
- Include rollback DDL as SQL comments (ADD COLUMN + ADD CONSTRAINT + CREATE INDEX)
- Include the R1 data-loss accepted notice in the header comment

Do NOT create `migration_lock.toml` inside this folder (single lock lives at `api/prisma_tenant/migrations/migration_lock.toml` root — convention confirmed from all 23 existing migrations).
Do NOT run `prisma migrate dev` — this is hand-written only.

Acceptance: file exists, contains IF EXISTS guards on every DROP statement, contains rollback DDL in comments.

---

### [x] T03 — Gate: pnpm --filter api prisma:generate

**Spec**: I-PS-5
**Design**: §5 (build integrity)
**Depends on**: T01

Run: `pnpm --filter api prisma:generate`

This generates both master and tenant clients. After T01 removes all teacherId/teacher relation references from both sides, the tenant client `Sala`/`Grado`/`Curso` types must no longer expose `teacherId`. Exit code must be 0.

If this fails, T01 has a dangling relation — fix schema before proceeding to T04–T09.

This is a hard gate. No downstream tasks start until T03 exits 0.

---

### [x] T04 — Domain: remove teacherId from Sala and Grado entities + SalaFilters

**Spec**: I-DM-1, I-DM-2, I-DM-3, I-DM-4, I-DM-5, I-DM-6
**Design**: §2.2
**Depends on**: T03
**Parallel with**: T06, T09 (after T03)

Files and removals:

**`packages/domain/src/inicial/entities/sala.ts`**
- Line 13: delete `teacherId?` from `SalaProps`
- Line 24: delete `teacherId?` from `CreateSalaProps`
- Line 61: delete `teacherId:` assignment in `Sala.create()`
- Line 77: delete `get teacherId()` getter

**`packages/domain/src/inicial/repositories/sala-repository.ts`**
- Line 7: delete `teacherId?` from `SalaFilters`

**`packages/domain/src/primario/entities/grado.ts`**
- Line 12: delete `teacherId?` from `GradoProps`
- Line 22: delete `teacherId?` from `CreateGradoInput`
- Line 45: delete `teacherId:` assignment in `Grado.create()`
- Line 59: delete `get teacherId()` getter
- Line 64: delete `'teacherId'` from `Pick<>` in `update()` signature
- Line 66: delete `teacherId:` assignment in `update()` body

Curso domain: NO CHANGE (I-DM-6 confirmed — never had teacherId in domain).

---

### [x] T05 — Application: remove teacherId from sala and grado use-case inputs

**Spec**: I-APP-1, I-APP-2, I-APP-3, I-APP-4
**Design**: §2.3
**Depends on**: T04

Files and removals:

**`api/src/application/nivel-inicial/use-cases/sala.use-cases.ts`**
- Line 10: delete `teacherId?` from `CreateSalaInput`
- Line 19: delete `teacherId?` from `UpdateSalaInput`
- Line 77: delete `teacherId:` in `Sala.create({...})`
- Line 89: delete `teacherId:` in `Sala.reconstruct({...})`

**`api/src/application/nivel-primario/use-cases/grado.use-cases.ts`**
- Line 9: delete `teacherId?` from `CreateGradoInput`
- Line 15: delete `teacherId?` from `UpdateGradoInput`

---

### [x] T06 — DTOs: remove teacherId from HTTP request DTOs (Zod schemas)

**Spec**: I-CTRL-3, I-CTRL-4 (HTTP input DTOs)
**Design**: §2.4
**Depends on**: T03 (can run parallel with T04 — DTOs are independent of domain types)

Files and removals:

**`api/src/presentation/nivel-inicial/dto/create-sala.dto.ts`**
- Line 8: delete `teacherId: z.string().uuid().optional()`

**`api/src/presentation/nivel-inicial/dto/update-sala.dto.ts`**
- Line 8: delete `teacherId: z.string().uuid().optional().nullable()`

**`api/src/presentation/nivel-primario/dto/create-grado.dto.ts`**
- Line 7: delete `teacherId: z.string().uuid().optional()`

**`api/src/presentation/nivel-primario/dto/update-grado.dto.ts`**
- Line 5: delete `teacherId: z.string().uuid().optional()`
- Verify: `.refine(>0 keys)` guard on `UpdateGradoSchema` still holds with remaining fields (`courseSectionId` + `academicYear`) — no edit needed there.

---

### [x] T07 — Infra: remove teacherId from Prisma sala and grado repositories

**Spec**: I-INF-1, I-INF-2, I-INF-3, I-INF-4, I-INF-5
**Design**: §2.5
**Depends on**: T03, T04

Files and removals:

**`api/src/infrastructure/persistence/prisma/repositories/prisma-sala.repository.ts`**
- Line 26: delete `if (filters?.teacherId) where.teacherId = filters.teacherId` (filter block)
- Line 49: delete `teacherId:` in `prisma.sala.create({...})`
- Line 59: delete `teacherId:` in `prisma.sala.update({...})`
- Line 81: delete `teacherId:` in `toDomain` mapping

**`api/src/infrastructure/persistence/prisma/repositories/prisma-grado.repository.ts`**
- Line 39: delete `teacherId:` in `prisma.grado.create({...})`
- Line 48: delete `teacherId:` in `prisma.grado.update({...})`
- Line 73: delete `teacherId:` in `toDomain` mapping

**`api/src/infrastructure/persistence/prisma/repositories/prisma-curso.repository.ts`**: NO CHANGE (CursoRow never had teacherId — I-INF-5 trivially satisfied).

---

### [x] T08 — Controllers: remove teacherId from sala and grado response mapping

**Spec**: I-CTRL-1, I-CTRL-2
**Design**: §2.6
**Depends on**: T07

Files and removals:

**`api/src/presentation/nivel-inicial/sala.controller.ts`**
- Line 75: delete `teacherId` normalization in `update()` input
- Line 90: delete `teacherId?` from `mapSala` param type
- Line 97: delete `teacherId: sala.teacherId` from `mapSala` return object

**`api/src/presentation/nivel-primario/grado.controller.ts`**
- Line 29: delete `teacherId: g.teacherId` from `toDto()` return object

---

### [x] T09 — Web: remove teacher input, interface field, and Docente column

**Spec**: I-WEB-1, I-WEB-2, I-WEB-3, I-WEB-4
**Design**: §2.7
**Depends on**: T03 (conceptually on API contract; can run in parallel with T04-T08)

Files and removals:

**`web/src/niveles/inicial/salas/sala-form.tsx`**
- Line 14: delete `teacherId?` from `initial` interface
- Line 30: delete `teacherId:` from `useState` initializer
- Line 48: delete `teacherId:` from form body state
- Lines 124-128: delete the `<Input label="ID del docente (opcional)">` block

**`web/src/niveles/inicial/salas/page.tsx`**
- Line 15: delete `teacherId?: string` from Sala interface

**`web/src/niveles/primario/grados/grado-form.tsx`**
- Line 10: delete `teacherId: string` from `GradoFormData`
- Line 29: delete `teacherId:` from `useState` initializer
- Line 36: delete `teacherId:` from `handleSubmit` body
- Lines 77-81: delete the `<Input label="Docente ID (opcional)">` block

**`web/src/niveles/primario/grados/page.tsx`**
- Line 15: delete `teacherId?` from Grado interface
- Line 32: delete `teacherId` from `handleCreate` param type
- Line 39: delete conditional spread `...(formData.teacherId ? ...)`
- Line 89: delete `{ key: 'teacherId', header: 'Docente', ... }` column definition

---

### [x] T10 — Tests: remove teacherId assertions from domain entity specs

**Spec**: I-BUILD-3 (tests must remain green; no regressions)
**Design**: §2.8
**Depends on**: T04, T08

Files and edits:

**`packages/domain/src/inicial/__tests__/entities/sala.test.ts`**
- Line 28: delete `expect(sala.teacherId).toBeUndefined()` assertion
- Lines 37-41: delete the whole `it('creates sala with optional teacherId')` block

**`packages/domain/src/primario/__tests__/entities/grado.test.ts`**
- Lines 40-44: delete the whole `it('creates grado with optional teacherId')` block
- In the `update()` test block:
  - Rewrite `grado.update({ teacherId: ..., academicYear: '2027' })` → `grado.update({ academicYear: '2027' })`
  - Delete `expect(grado.teacherId)...` assertion (lines 107-108)

Use-case tests: NO CHANGE — confirmed by design §2.8 (grep shows no teacherId references in `sala.use-cases.test.ts` or `grado.use-cases.test.ts`).

---

### [x] T11 — Verification sweep (all gates must pass)

**Spec**: I-BUILD-1, I-BUILD-2, I-BUILD-3, I-PS-5
**Design**: §5 (build/test integrity)
**Depends on**: T01–T10 (all tasks complete)

Run in order:

1. **`pnpm --filter api prisma:generate`** — exit 0, no type errors in generated client (SC-11)
2. **Dangling sweep** — `rg "teacherId" packages/domain/src/inicial/ packages/domain/src/primario/ api/src/application/nivel-inicial/ api/src/application/nivel-primario/ api/src/presentation/nivel-inicial/ api/src/presentation/nivel-primario/ api/src/infrastructure/persistence/prisma/repositories/prisma-sala.repository.ts api/src/infrastructure/persistence/prisma/repositories/prisma-grado.repository.ts api/src/infrastructure/persistence/prisma/repositories/prisma-curso.repository.ts web/src/niveles/` — must return zero matches. (SubjectAssignment.teacherId in `backfill-materia-grupo.ts` is OUT of scope — do not include that path in the sweep.)
3. **`pnpm --filter api typecheck`** — zero new errors (baseline: 11 pre-existing; must not increase) (SC-12, I-BUILD-1)
4. **`pnpm --filter api test`** — all tests green; ~6 pre-existing Pool-mock failures are known baseline and do not count as regressions (SC-13, I-BUILD-3)
5. **`pnpm --filter web test`** (if test script exists) — green
6. **`pnpm build`** — turbo full build, exit 0 (I-BUILD-2)
7. **Deploy note**: per-tenant migration via `pnpm --filter api prisma:migrate:tenant:deploy` (or equivalent alias `migrate-tenants`). Master DB unaffected. R1 data loss accepted.

---

## Review Workload Forecast

| Metric | Value |
|--------|-------|
| Files touched | ~20 |
| Estimated changed lines | ~160 (almost entirely deletions) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Decision needed before apply | No |

Single PR confirmed. auto-chain delivery applies. No review workload gate triggered.

---

## Task summary table

| ID  | Description                                      | Spec refs                          | Depends on | Parallel with |
|-----|--------------------------------------------------|------------------------------------|------------|---------------|
| T01 | Schema: remove teacherId/teacher from Sala/Grado/Curso/Teacher | I-PS-1–4              | —          | T02           |
| T02 | Migration SQL file (hand-written, IF EXISTS)     | I-DB-1–5, I-MIG-1–5               | —          | T01           |
| T03 | Gate: pnpm --filter api prisma:generate          | I-PS-5                             | T01        | —             |
| T04 | Domain: sala.ts, sala-repository.ts, grado.ts    | I-DM-1–5                           | T03        | T06, T09      |
| T05 | App: sala.use-cases.ts, grado.use-cases.ts       | I-APP-1–4                          | T04        | T07           |
| T06 | DTOs: create/update-sala, create/update-grado    | I-CTRL-3–4                         | T03        | T04, T09      |
| T07 | Infra: prisma-sala.repository, prisma-grado.repository | I-INF-1–4                    | T03, T04   | T05           |
| T08 | Controllers: sala.controller, grado.controller   | I-CTRL-1–2                         | T07        | —             |
| T09 | Web: sala-form, salas/page, grado-form, grados/page | I-WEB-1–4                       | T03        | T04, T06      |
| T10 | Tests: sala.test.ts, grado.test.ts               | I-BUILD-3                          | T04, T08   | —             |
| T11 | Verification: rg sweep + typecheck + test + build | I-BUILD-1–3, I-PS-5               | T01–T10    | —             |
