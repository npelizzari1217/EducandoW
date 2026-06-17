# Archive Report: retiro-sala-grado-curso-teacher-s3b1

> Phase: sdd-archive · 2026-06-17
> Branch: feat/retiro-sala-grado-curso-teacher-s3b1
> Commits on branch: 3 (8dcdd02, ed73d2c, 90d0aec)

---

## Summary

S3b-1 of the Teacher retirement epic. Pure DROP of the legacy `teacherId` field (FK SetNull → teachers) from `Sala` (Inicial), `Grado` (Primario), and `Curso` (Secundario) across all Clean-Arch layers. Approach A chosen after exploration confirmed that migration to the cycle model (`AsignacionCursoXCiclo`) was structurally inviable: `Sala`/`Grado` are year-scoped (no `cycleId`), and `Curso.teacherId` was already a ghost column with zero code reading or writing it.

---

## What Changed

### Database (tenant schema)
- **Dropped**: column `salas.teacher_id`
- **Dropped**: FK constraint `salas_teacher_id_fkey`
- **Dropped**: index `salas_teacher_id_idx`
- **Dropped**: column `grados.teacher_id`
- **Dropped**: FK constraint `grados_teacher_id_fkey`
- **Dropped**: index `grados_teacher_id_idx`
- **Dropped**: column `cursos.teacher_id` (ghost column — no app code ever read or wrote it)
- **Dropped**: FK constraint `cursos_teacher_id_fkey`
- **No index on `cursos.teacher_id`** — none existed; none recreated in rollback DDL
- Migration: `api/prisma_tenant/migrations/20260617130000_drop_sala_grado_curso_teacher_id/migration.sql` (hand-written, IF EXISTS on every DROP, inline rollback DDL in header comments)

### Prisma Schema (`api/prisma_tenant/schema.prisma`)
- Removed `teacherId` field, `teacher` relation, `@@index([teacherId])` from `Sala` model
- Removed `teacherId` field, `teacher` relation, `@@index([teacherId])` from `Grado` model
- Removed `teacherId` field, `teacher` relation from `Curso` model (no index existed)
- Removed back-relations `salas Sala[]`, `grados Grado[]`, `cursos Curso[]` from `Teacher` model
- `Teacher` other relations (`subjectAssignments`, `mesasExamen`, `actasExamen`) are INTACT
- `prisma:generate` passes with exit 0; `generator erd` block (lines 6–9) untouched

### Domain (`packages/domain`)
- `inicial/entities/sala.ts`: removed `teacherId?` from `SalaProps`, `CreateSalaProps`, `Sala.create()`, getter `get teacherId()`
- `inicial/repositories/sala-repository.ts`: removed `teacherId?` from `SalaFilters`
- `primario/entities/grado.ts`: removed `teacherId?` from `GradoProps`, `CreateGradoInput`, `Grado.create()`, getter `get teacherId()`, `Pick<>` in `update()`, assignment in `update()` body
- `Curso` domain: NO CHANGE (I-DM-6 — `CursoProps` never had `teacherId`)

### Application (`api/src/application`)
- `nivel-inicial/use-cases/sala.use-cases.ts`: removed `teacherId?` from `CreateSalaInput`, `UpdateSalaInput`, `Sala.create({})` call, `Sala.reconstruct({})` call
- `nivel-primario/use-cases/grado.use-cases.ts`: removed `teacherId?` from `CreateGradoInput`, `UpdateGradoInput`

### Infrastructure (`api/src/infrastructure/persistence/prisma/repositories`)
- `prisma-sala.repository.ts`: removed filter `if (filters?.teacherId)`, `teacherId:` in create, update, toDomain
- `prisma-grado.repository.ts`: removed `teacherId:` in create, update, toDomain
- `prisma-curso.repository.ts`: NO CHANGE (CursoRow was already teacher-free)

### Presentation (`api/src/presentation`)
- DTOs: removed `teacherId` from `create-sala.dto.ts`, `update-sala.dto.ts`, `create-grado.dto.ts`, `update-grado.dto.ts` (Zod schemas). `UpdateGradoSchema.refine(>0 keys)` still satisfiable with remaining fields.
- `sala.controller.ts`: removed `teacherId` normalization in `update()`, `teacherId?` from `mapSala` param type, `teacherId: sala.teacherId` from `mapSala` return
- `grado.controller.ts`: removed `teacherId: g.teacherId` from `toDto()`

### Web (`web/src/niveles`)
- `inicial/salas/sala-form.tsx`: removed `teacherId?` from interface, useState init, body state, and `<Input label="ID del docente (opcional)">` block
- `inicial/salas/page.tsx`: removed `teacherId?: string` from Sala interface
- `primario/grados/grado-form.tsx`: removed `teacherId` from GradoFormData, useState init, handleSubmit body, and `<Input label="Docente ID (opcional)">` block
- `primario/grados/page.tsx`: removed `teacherId?` from Grado interface, `handleCreate` param type, conditional spread, and `{ key: 'teacherId', header: 'Docente', ... }` column definition

### Tests
- `packages/domain/src/inicial/__tests__/entities/sala.test.ts`: removed `expect(sala.teacherId).toBeUndefined()` assertion; removed `it('creates sala with optional teacherId')` block
- `packages/domain/src/primario/__tests__/entities/grado.test.ts`: removed `it('creates grado with optional teacherId')` block; rewrote `update()` test call from `grado.update({ teacherId:..., academicYear:'2027' })` → `grado.update({ academicYear: '2027' })`; removed `expect(grado.teacherId)...` assertion

---

## Verify Result

**VERDICT: PASS — 0 CRITICAL / 0 WARNING / 0 SUGGESTION**

All 41 spec invariants satisfied. All 11 tasks complete and match implementation.

| Gate | Command | Result |
|------|---------|--------|
| prisma:generate | `pnpm --filter api prisma:generate` | EXIT 0 (master + tenant) |
| typecheck | `pnpm --filter api typecheck` | 11 errors — exactly matches pre-existing baseline; ZERO new errors |
| api tests | `pnpm --filter api test` | 1204/1204 GREEN (127 files) |
| web tests | `pnpm --filter web test` | 394/394 GREEN (37 files) |
| full build | `pnpm build` (turbo) | EXIT 0 — 3/3 packages cached |
| dangling sweep | `rg "teacherId" <in-scope paths>` | ZERO matches |

SubjectAssignment.teacherId in `schema.prisma` correctly preserved (out of scope).

---

## Deploy Precondition

Per-tenant migration via `pnpm --filter api prisma:migrate:tenant:deploy` (alias: `migrate-tenants`). Master DB is unaffected.

**R1 (ACCEPTED):** Non-null `teacher_id` values in `salas` and `grados` in prod are permanently lost. This is accepted: the field was a primitive raw-UUID input with no name lookup and no downstream consumers after S2. Structure-only rollback DDL is documented inline in the migration file (ADD COLUMN + ADD CONSTRAINT + CREATE INDEX). Data is NOT restorable.

---

## Canonical Spec Merges

| Target spec | What was merged |
|-------------|-----------------|
| `openspec/specs/nivel-inicial/spec.md` | Removed `teacherId (optional FK)` from Sala CRUD field list; added S3b-1 archive note. |
| `openspec/specs/nivel-primario/spec.md` | Removed `teacherId (optional)` from Grado CRUD field list; added S3b-1 archive note. |
| `openspec/specs/nivel-secundario/spec.md` | No change — Curso CRUD spec did not list `teacherId` (it was already a ghost column, never spec'd at this layer). |

---

## Umbrella Roadmap Update

`openspec/changes/retiro-teacher-legacy/explore.md` updated:
- Decision #4 corrected: "RESUELTO → migrar a DocenteXCiclo/User" → "RESUELTO → DROP (Approach A)" (migration to cycle model was structurally inviable)
- Consumer (c) `Sala/Grado/Curso.teacherId` marked DONE ✔ S3b-1 (2026-06-17)
- S3b-1 slice in the slice list marked DONE with verify result, commits, and deploy precondition
- "Siguiente paso" updated: S3b-1 added to DONE list; S3b-2 is now next
- Remaining Teacher consumers: (a) `/teachers` admin, (b) `MesaExamen/ActaExamen.presidente` + `SubjectAssignment.teacherId` gate (S3-pre, Decision #1 pending)
- Umbrella remains ACTIVE

---

## Engram Artifact IDs

| Artifact | ID |
|----------|----|
| explore | #1087 |
| proposal | #1089 |
| spec | #1090 |
| design | #1091 |
| tasks | #1092 |
| verify-report | #1094 |

---

## Remaining Roadmap (Teacher Retirement Epic)

| Slice | Status | Notes |
|-------|--------|-------|
| S3b-0 | DONE ✔ | Drop `homeroomTeacherId` column/FK/index. Archived 2026-06-17 (`retiro-homeroom-column-s3b0`). |
| S3b-1 | DONE ✔ | Drop `Sala/Grado/Curso.teacherId` (Approach A). This change. |
| S3b-2 | PENDING | Retire `/teachers` admin CRUD + `teachers.tsx` + sidebar |
| S3b-3 | PENDING | Migrate `MesaExamen/ActaExamen.presidenteId` → User/DocenteXCiclo + backfill (Restrict FK blocks Teacher drop) |
| S3-pre | PENDING | Migrate Inicial/Terciario grading out of NotaTrimestral (Decision #1 pending) — gate for SubjectAssignment drop |
| S3b-final | PENDING | Drop Teacher table + domain entity + repo (requires S3b-2, S3b-3, S3-pre all complete) |
