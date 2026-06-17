# Design: retiro-sala-grado-curso-teacher-s3b1

> Fase: sdd-design · Store: hybrid · 2026-06-17
> Branch: `feat/retiro-sala-grado-curso-teacher-s3b1`
> Approach A (DROP) confirmado por la propuesta.

## 1. Architecture approach

Pure structural removal across the four Clean-Arch layers, top-down by dependency
(domain → application → infra → presentation → web) plus one hand-written tenant
migration. No new abstractions, no data migration, no behavioral logic. The change
preserves the existing entity/dto/repo/schema consistency contract — it just deletes
the `teacherId` axis everywhere it appears.

Layering order matters because `@educandow/domain` is the leaf dependency: removing
`teacherId` from `SalaProps`/`CreateSalaProps`/`SalaFilters`/`GradoProps`/`CreateGradoInput`
breaks every downstream typecheck until app/infra/presentation are updated. The migration
is independent of the TS build and can land in the same PR.

Curso is a degenerate case: the column never reached the domain (`CursoProps` has no
`teacherId`, `CursoRow` has no `teacherId`, repo never reads/writes it). For Curso the ONLY
artifacts are the Prisma schema relation + the migration DDL — zero TS edits.

## 2. Definitive removal table (file → symbol → action)

### 2.1 Schema — `api/prisma_tenant/schema.prisma`
| Model | Lines | Symbol | Action |
|-------|-------|--------|--------|
| Teacher | 108-110 | `salas Sala[]` / `grados Grado[]` / `cursos Curso[]` | DELETE all 3 back-relations |
| Sala | 821 | `teacherId String? @map("teacher_id")` | DELETE |
| Sala | 826 | `teacher Teacher? @relation(...onDelete: SetNull)` | DELETE |
| Sala | 836 | `@@index([teacherId])` | DELETE |
| Grado | 943 | `teacherId String? @map("teacher_id")` | DELETE |
| Grado | 949 | `teacher Teacher? @relation(...onDelete: SetNull)` | DELETE |
| Grado | 956 | `@@index([teacherId])` | DELETE |
| Curso | 998 | `teacher Teacher? @relation(...onDelete: SetNull)` | DELETE |
| Curso | 999 | `teacherId String? @map("teacher_id")` | DELETE |

> **BOTH sides** of each relation are removed — required for `prisma validate`/`generate`
> to pass (a relation field without its scalar, or a back-relation without the forward side,
> is a validation error). Do NOT touch the `generator erd` block (lines 6-9).
> Curso has NO `@@index` on teacherId (confirmed: indices are `academicYear` + `courseSectionId` only).

### 2.2 Domain — `@educandow/domain`
| File | Symbol | Action |
|------|--------|--------|
| `inicial/entities/sala.ts` | `SalaProps.teacherId?` (13), `CreateSalaProps.teacherId?` (24), `teacherId:` in `create()` (61), `get teacherId()` (77) | DELETE |
| `inicial/repositories/sala-repository.ts` | `SalaFilters.teacherId?` (7) | DELETE |
| `primario/entities/grado.ts` | `GradoProps.teacherId?` (12), `CreateGradoInput.teacherId?` (22), `teacherId:` in `create()` (45), `get teacherId()` (59), `'teacherId'` in `update()` Pick (64), `update()` body line (66) | DELETE |

### 2.3 Application — `api/src/application`
| File | Symbol | Action |
|------|--------|--------|
| `nivel-inicial/use-cases/sala.use-cases.ts` | `CreateSalaInput.teacherId?` (10), `UpdateSalaInput.teacherId?` (19), `teacherId:` in `Sala.create({...})` (77), `teacherId:` in `Sala.reconstruct({...})` (89) | DELETE |
| `nivel-primario/use-cases/grado.use-cases.ts` | `CreateGradoInput.teacherId?` (9), `UpdateGradoInput.teacherId?` (15) | DELETE |

### 2.4 DTOs — `api/src/presentation/.../dto`
| File | Symbol | Action |
|------|--------|--------|
| `nivel-inicial/dto/create-sala.dto.ts` | `teacherId: z.string().uuid().optional()` (8) | DELETE |
| `nivel-inicial/dto/update-sala.dto.ts` | `teacherId: z.string().uuid().optional().nullable()` (8) | DELETE |
| `nivel-primario/dto/create-grado.dto.ts` | `teacherId: z.string().uuid().optional()` (7) | DELETE |
| `nivel-primario/dto/update-grado.dto.ts` | `teacherId: z.string().uuid().optional()` (5) | DELETE — `.refine(>0 keys)` still holds with courseSectionId+academicYear |

### 2.5 Infra — `api/src/infrastructure/persistence/prisma/repositories`
| File | Symbol | Action |
|------|--------|--------|
| `prisma-sala.repository.ts` | filter `if (filters?.teacherId) where.teacherId = ...` (26), `teacherId:` in create (49), in update (59), in `toDomain` (81) | DELETE |
| `prisma-grado.repository.ts` | `teacherId:` in create (39), in update (48), in `toDomain` (73) | DELETE |
| `prisma-curso.repository.ts` | — | NO CHANGE (CursoRow + toDomain + save already teacher-free) |

### 2.6 Presentation controllers
| File | Symbol | Action |
|------|--------|--------|
| `nivel-inicial/sala.controller.ts` | `teacherId` normalization in `update()` input (75), `teacherId?` in `mapSala` param type (90), `teacherId: sala.teacherId` in mapSala return (97) | DELETE (the spread `...body` at line 74 then carries no teacherId) |
| `nivel-primario/grado.controller.ts` | `teacherId: g.teacherId` in `toDto()` (29) | DELETE |

### 2.7 Web — `web/src`
| File | Symbol | Action |
|------|--------|--------|
| `niveles/inicial/salas/sala-form.tsx` | `teacherId?` in `initial` interface (14), `teacherId:` in useState init (30), `teacherId:` in body (48), the `<Input label="ID del docente (opcional)">` block (124-128) | DELETE |
| `niveles/inicial/salas/page.tsx` | `teacherId?: string` in Sala interface (15) | DELETE |
| `niveles/primario/grados/grado-form.tsx` | `teacherId: string` in GradoFormData (10), useState init (29), `teacherId:` in handleSubmit (36), the `<Input label="Docente ID (opcional)">` block (77-81) | DELETE |
| `niveles/primario/grados/page.tsx` | `teacherId?` in Grado interface (15), `teacherId` in handleCreate param type (32), conditional spread `...(formData.teacherId ? ...)` (39), the `{ key: 'teacherId', header: 'Docente', ... }` column (89) | DELETE |

### 2.8 Tests
| File | Symbol | Action |
|------|--------|--------|
| `packages/domain/src/inicial/__tests__/entities/sala.test.ts` | `expect(sala.teacherId).toBeUndefined()` (28), whole `it('creates sala with optional teacherId')` block (37-41) | DELETE |
| `packages/domain/src/primario/__tests__/entities/grado.test.ts` | whole `it('creates grado with optional teacherId')` block (40-44); in `update()` test rewrite `grado.update({ teacherId:..., academicYear:'2027' })` → `grado.update({ academicYear: '2027' })` and DELETE the `expect(grado.teacherId)...` assertion (107-108) | EDIT |
| `api/.../sala.use-cases.test.ts`, `grado.use-cases.test.ts` | — | NO CHANGE (grep: no teacherId references) |

## 3. Migration

**Folder**: `api/prisma_tenant/migrations/20260617130000_drop_sala_grado_curso_teacher_id/migration.sql`
(timestamp strictly after the latest existing `20260617120000_drop_homeroom_teacher_id`).
No per-folder `migration_lock.toml` — the single lock lives at the migrations root (convention
confirmed against all 23 existing migration folders). Hand-written; NO `prisma migrate dev`.

**Exact `migration.sql`** (mirrors the `drop_homeroom_teacher_id` precedent — drop FK → drop index → drop column, all `IF EXISTS`):

```sql
-- Migration: drop_sala_grado_curso_teacher_id
-- S3b-1 (retiro de Teacher): Sala/Grado/Curso.teacher_id eran vínculos legacy primitivos
-- (UUID crudo, sin lookup de nombre, sin consumidores aguas abajo tras S2). Curso.teacher_id
-- es columna FANTASMA (ningún código la lee/escribe). No mapean al modelo de ciclos
-- (AsignacionCursoXCiclo es cycle-scoped; Sala/Grado son year-scoped) → drop sin migración de datos.
-- FK ya era SetNull → cero riesgo de integridad. La tabla "teachers" PERMANECE.
-- PÉRDIDA DE DATOS ACEPTADA (R1): teacher_id no-null en salas/grados se pierde de forma permanente.
-- Reversibilidad (DDL autocontenido — la estructura, NO la data):
--   ALTER TABLE "salas"  ADD COLUMN "teacher_id" TEXT;
--   ALTER TABLE "salas"  ADD CONSTRAINT "salas_teacher_id_fkey"  FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
--   CREATE INDEX "salas_teacher_id_idx"  ON "salas"("teacher_id");
--   ALTER TABLE "grados" ADD COLUMN "teacher_id" TEXT;
--   ALTER TABLE "grados" ADD CONSTRAINT "grados_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
--   CREATE INDEX "grados_teacher_id_idx" ON "grados"("teacher_id");
--   ALTER TABLE "cursos" ADD COLUMN "teacher_id" TEXT;
--   ALTER TABLE "cursos" ADD CONSTRAINT "cursos_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
--   (NOTA: cursos NO tenía índice en teacher_id — no recrear.)

-- DropForeignKey
ALTER TABLE "salas"  DROP CONSTRAINT IF EXISTS "salas_teacher_id_fkey";
ALTER TABLE "grados" DROP CONSTRAINT IF EXISTS "grados_teacher_id_fkey";
ALTER TABLE "cursos" DROP CONSTRAINT IF EXISTS "cursos_teacher_id_fkey";

-- DropIndex (cursos NO tiene índice en teacher_id)
DROP INDEX IF EXISTS "salas_teacher_id_idx";
DROP INDEX IF EXISTS "grados_teacher_id_idx";

-- DropColumn
ALTER TABLE "salas"  DROP COLUMN IF EXISTS "teacher_id";
ALTER TABLE "grados" DROP COLUMN IF EXISTS "teacher_id";
ALTER TABLE "cursos" DROP COLUMN IF EXISTS "teacher_id";
```

**Deploy**: per-tenant via `pnpm --filter api prisma:migrate:tenant:deploy` (master DB unaffected).
Exact FK/index names verified against `20240101000000_init_tenant/migration.sql`
(lines 817, 853, 1124, 1178, 1208) — all match the Prisma default naming the precedent uses.

## 4. SalaFilters.teacherId — caller analysis

Confirmed the ONLY consumer of `SalaFilters.teacherId` is `prisma-sala.repository.ts:26`
(`if (filters?.teacherId) where.teacherId = filters.teacherId`). The `ListSalasUseCase`
passes filters through untouched; `sala.controller.ts` `list()` (lines 42-57) builds filters
from only `academicYear` / `ageGroup` / `turno` query params — it never sets `teacherId`.
→ Removing the field from the interface + the repo line is safe; no endpoint loses a query param.

## 5. Build / test integrity

- **prisma generate**: clean — both sides of every relation removed, no dangling references,
  `generator erd` untouched. The generated `@prisma/tenant-client` `Sala`/`Grado`/`Curso` types
  lose `teacherId`, which is exactly what the infra edits expect (`PrismaGrado` import stays valid).
- **typecheck**: 0 new errors expected once the layered edits land together. The domain leaf
  must be edited in the same commit as its consumers or `tsc` fails transiently (single-PR, so fine).
- **tests touched**: only the 2 domain entity specs (§2.8). Use-case specs need no edits.
  No infra spec references `teacher` for Sala/Grado/Curso (the `prisma-teacher.repository.spec.ts`
  hits the Teacher model itself — out of scope).
- **web**: `pnpm --filter web build` (tsc + vite) clean after interface + form edits.

## 6. Scope / delivery

~20 files, ~150-200 lines, almost entirely deletions. Single PR (Approach A, auto-chain).
Touches 4 layers but each edit is mechanical and the migration is self-contained → no
chained-PR pressure, well under the 400-line budget.

## 7. ADR-style decisions

**AD-1 — DROP, not repoint-to-User (Approach A over B).**
Rationale: the field was a primitive raw-UUID input with no name lookup and no downstream
readers after S2 (boletin already dropped teacher lookup — confirmed at
`generate-boletin.use-case.ts:334,521`). Keeping a docente field adds an unnecessary cross-DB
backfill for zero product value. Rejected B (repoint to `User.id`, AD-6 cross-DB pattern):
extra backfill script + orphan-UUID risk where `Teacher.userId` is null.

**AD-2 — No data migration / no backfill (R1 accepted).**
Rationale: FK is already `SetNull`, so no integrity risk on drop. Non-null `teacher_id` values
in prod are lost permanently — accepted because the feature is primitive and unused downstream.
Structure-only reversibility is documented inline in the migration.

**AD-3 — Remove BOTH sides of each Prisma relation.**
Rationale: Prisma `validate`/`generate` rejects a relation field without its scalar (and a
back-relation without its forward side). The Teacher back-relations (`salas`/`grados`/`cursos`)
are independent array fields; removing them does NOT affect Teacher's other relations
(`subjectAssignments`, `mesasExamen`, `actasExamen` stay). Rejected alternative: leaving the
back-relations would break generate.

**AD-4 — Curso treated as ghost-column drop (schema + DDL only).**
Rationale: `CursoProps`/`CursoRow`/repo never reference `teacherId`; the column exists only in
DB + schema. Confirmed zero TS edits for Curso. Rejected alternative: searching for app
consumers — none exist.

**AD-5 — Migration follows the `drop_homeroom_teacher_id` precedent verbatim.**
Rationale: same retiro programme, same drop-FK→drop-index→drop-column `IF EXISTS` shape, same
inline reversibility comment, hand-written, per-tenant deploy. Reuses an already-reviewed pattern.

## 8. Risks (vs exploration)

- **R1 (MEDIO, ACEPTADO)**: data loss on non-null `teacher_id` in salas/grados — matches exploration R1.
- **R4 (NULO)**: Curso ghost-column drop is trivial — confirmed (CursoRow clean). Matches exploration R4.
- **No mismatch vs exploration**: every premise validated against code — Curso ghost (confirmed),
  no downstream consumers (boletin S2 comments confirm), `SalaFilters.teacherId` single consumer,
  Teacher back-relations independent. The `backfill-materia-grupo.ts` `teacherId` hits
  (lines 170/176) are `SubjectAssignment.teacherId` — OUT of scope (Teacher table + SubjectAssignment FK stay).
- **Assumption requiring no action**: `UpdateGradoSchema.refine(>0 keys)` still satisfiable with
  `courseSectionId`/`academicYear` after teacherId removal — verified.
