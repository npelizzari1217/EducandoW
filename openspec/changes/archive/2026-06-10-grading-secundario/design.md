# Technical Design: Secundario Grading (Fase 4 Etapa 2)

> Scope of this document: the architectural HOW for `grading-secundario`. It resolves the five
> design decisions (D1–D5) deferred from the proposal, within the LOCKED decisions (Approach A —
> mirror Primario, `condicion` enum on `SubjectFinalGrade`, previas entity in scope, competencies in
> scope, no legacy migration, rebuilt `boletin-secundario.hbs`). Tasks are NOT written here.

## 1. Architecture Approach

**Approach A — mirror Primario on the level-agnostic foundation.** Secundario is base level 3
(`Math.floor(level/10) === 3`). The grading engine (`SubjectPeriodGrade`, `SubjectFinalGrade`,
`SubjectGradingPeriod`, their repos, the upsert/read use cases, the `/grading/*` endpoints, the
competency model, `TeacherFilteredSelector`, `use-grading-grid`, and the boletín level dispatch) is
already level-parameterized and is reused verbatim. The seeded `gs-secundaria` scale (level=3) and
`gpt-secundaria-trimestral` template flow through the existing `?level=`/`?modality=` query params
with zero change.

New surface area is deliberately small and additive:

1. A `condicion` value object + nullable column on `SubjectFinalGrade` (REGULAR | PREVIA | LIBRE).
2. A new `materia-previa` aggregate (academic debt per student/year/subject) in the `secundario`
   bounded context, with its own repository port + Prisma table + use cases + endpoints.
3. A `buildMateriasSecundario()` branch in `GenerateBoletinUseCase`, structurally cloned from
   `buildMateriasPrimario()`, plus a rebuilt `boletin-secundario.hbs`.
4. Generalizing the two existing Primario entry screens to also accept Secundario CCs.

Layering (clean-arch) is preserved throughout: domain (entities + VOs + ports) imports nothing
outside itself; application orchestrates domain via Result types and never throws; infra implements
ports against Prisma; presentation maps Result→HTTP at the boundary; the `.hbs` template only renders
the assembled contract — all condición/previas/imprimible logic stays in the use case.

## 2. Component & Data-Flow Map

```
Entry screens (web)                 API (application)                 Domain
─────────────────────              ──────────────────────            ────────────────────────
subject-grading-by-subject ─PUT──▶ UpsertSubjectFinalGrades ──────▶ SubjectFinalGrade.setCondicion()
subject-grading-by-course  ─PUT──▶ UpsertSubjectPeriodGrades       SubjectFinalGradeCondicion (VO)
   (isPrimarioOrSecundario)  ─GET─▶ GetSubjectGradesBy{Subject,Student} (now returns condicion)
materias-previas screen*   ─PUT──▶ UpsertMateriaPrevia ──────────▶ MateriaPrevia (secundario ctx)
                           ─GET──▶ ListMateriasPreviasByStudent ─▶ MateriaPreviaRepository (port)

Boletín:  GET /boletines/:enrollmentId ─▶ GenerateBoletinUseCase
            └─ buildMaterias() dispatch:
                 level/10 === 2 → buildMateriasPrimario      (UNCHANGED)
                 level/10 === 3 → buildMateriasSecundario    (NEW — clone + condicion + previas)
                 else           → legacy NotaTrimestral path  (UNCHANGED — Terciario/Inicial)
            └─ template select: SECUNDARIO → boletin-secundario.hbs (REBUILT)

* The previas capture screen is optional for MVP; previas can also be seeded via the endpoint.
```

Integration points (all pre-existing, reused): `/course-cycles?role=&teacherUserId=`,
`/course-cycles/:id/students`, `/course-cycles/:id/subjects`, `/grading/subject-grades`,
`/grading/subject-final-grades`, `/grading/scales`, `/grading/period-templates`,
`/competency-valuations`. New: `/materias-previas` (GET list by student, PUT upsert).

## 3. Design Decisions (ADR-style)

### D1 — `condicion` set & validation flow

**Decision.** Model `condicion` as a self-validating pedagogy enum VO and carry it through the
existing final-grade write/read path alongside `passed`. Cross-field consistency is enforced in the
**use case**, never in the entity — mirroring the AD-2/AD-7 precedent where the DICIEMBRE/MARZO
lifecycle blocks live in `UpsertSubjectFinalGradesUseCase`, not in `SubjectFinalGrade`.

**VO** — new file `packages/domain/src/pedagogy/value-objects/subject-final-grade-condicion.ts`,
cloned from `subject-final-grade-type.ts`:

```ts
export enum SubjectFinalGradeCondicion { REGULAR = 'REGULAR', PREVIA = 'PREVIA', LIBRE = 'LIBRE' }
export function fromSubjectFinalGradeCondicionString(
  value: string,
): Result<SubjectFinalGradeCondicion, ValidationError> { /* guard, err on unknown */ }
```

> NOTE: do NOT reuse `secundario/value-objects/condicion-alumno.ts` — it uses `APROBADO|PREVIA|LIBRE`
> (wrong member, `REGULAR` not `APROBADO`) and a `create()→null` style, not the Result/guard style
> mandated by the value-objects standard. A new pedagogy VO keeps grading level-agnostic.

**Entity** — `SubjectFinalGrade`: add `condicion: SubjectFinalGradeCondicion | null` to props,
`ReconstructSubjectFinalGradeProps`, the `create()` factory (defaults `null`, like `passed`), a getter,
and a `setCondicion(condicion): Result<void, never>` method styled exactly like `setPassed()`. No
cross-field logic in the entity.

**DTO** — `UpsertFinalGradeItemSchema` gains
`condicion: z.nativeEnum(SubjectFinalGradeCondicion).optional()`. `UpsertFinalGradeItem` gains
`condicion?: SubjectFinalGradeCondicion`.

**Use case** — in `UpsertSubjectFinalGradesUseCase.execute`, after the existing `setPassed` block:
apply `grade.setCondicion(item.condicion)` when provided, then run consistency validation (returns
`ValidationError` → 400):

| Rule | Check |
|------|-------|
| C-1 LIBRE excludes promotion | If `condicion === LIBRE` and the resolved `passed === true` → reject. LIBRE means the student did not regularize; it cannot coexist with a passing verdict. |
| C-2 PREVIA excludes promotion | If `condicion === PREVIA` and `passed === true` → reject. A subject carried as previa is, by definition, not closed as passed. |
| C-3 REGULAR is unconstrained | Default semantics; no relation to `passed`/grade enforced. |
| C-4 enum validity | Unknown strings rejected by the VO guard at the boundary (DTO `nativeEnum`). |

`condicion` is conceptually a **year-end verdict for the subject**, so it is set on the `FINAL` row
(the natural promotion row); the column physically exists on every `SubjectFinalGrade` row but the UX
and the boletín read it from `FINAL` (fallback `DEFINITIVA`). No auto-creation of previas from a
PREVIA condición here — previas are recorded through their own endpoint (single-responsibility; avoids
coupling the grading upsert to the previas aggregate). This is a deliberate boundary; see D2 risk note.

**Read** — `GetSubjectGradesBySubjectUseCase` and `GetSubjectGradesByStudentUseCase` add
`condicion: string | null` to each `finalGrades[]` entry (sourced from the row). The hook
`SubjectFinalGradeCell` + `RawSubjectFinalGrade` gain `condicion`.

### D2 — `MateriaPrevia` entity shape

**Decision.** New aggregate in the **`secundario` bounded context** (screaming architecture: previas
históricas are a Secundario concept; pedagogy stays level-agnostic).

- Entity: `packages/domain/src/secundario/entities/materia-previa.ts`
- Port: `packages/domain/src/secundario/repositories/materia-previa-repository.ts`
- Prisma impl: `api/src/infrastructure/persistence/prisma/repositories/prisma-materia-previa.repository.ts`
- Prisma model: `materias_previas` (NEW table — second migration, see D5)

**Fields / keying:**

| Field | Type | Notes |
|-------|------|-------|
| `id` | uuid | PK |
| `studentId` | string | FK → students.id (Cascade) |
| `subjectId` | string | FK → subjects.id (the owed subject) |
| `originAcademicYear` | string | the academic year/cycle the subject is owed FROM (matches `enrollment.academicYear` string) |
| `originCourseCycleId` | string \| null | optional provenance link → course_cycles.uuid (SetNull) |
| `condicion` | enum `SubjectFinalGradeCondicion` (PREVIA \| LIBRE) | how the debt arose; REGULAR is never persisted here |
| `status` | enum `MateriaPreviaStatus` { PENDIENTE, APROBADA, LIBRE } | resolution state |
| `resolvedGradeCode` | string \| null | snapshot when resolved/approved |
| `resolvedAt` | DateTime \| null | |
| `createdAt` / `updatedAt` | DateTime | |

Unique: `(studentId, subjectId, originAcademicYear)`. Indexes: `(studentId)`,
`(studentId, originAcademicYear)`.

**Behavior** (self-validating, Result-typed): `create()` (status defaults PENDIENTE; validates
`subjectId`/`originAcademicYear` non-empty), `reconstruct()`, `resolve(gradeCode)` → APROBADA + snapshot,
`markLibre()` → LIBRE. Getters only; no public setters.

**Port:**
```ts
interface MateriaPreviaRepository {
  findByStudent(studentId: string): Promise<MateriaPrevia[]>;
  findByStudentAndAcademicYear(studentId: string, academicYear: string): Promise<MateriaPrevia[]>;
  saveMany(rows: MateriaPrevia[]): Promise<void>;
}
```
Returns domain projections (not ORM rows), one query each, tenant-scoped via `TenantContext`.

**Use cases (application):** `UpsertMateriaPreviaUseCase`, `ListMateriasPreviasByStudentUseCase`
(+ optional `ResolveMateriaPreviaUseCase`). `@Injectable`, Result types, Symbol DI token for the port.

**Boletín load + render:** in `buildMateriasSecundario`, call
`materiaPreviaRepo.findByStudentAndAcademicYear(studentId, academicYear)` **once per enrollment** (not
per subject — no N+1). Previas are student-level, not per-materia, so they surface as a new top-level
`DatosBoletin.previas?: PreviaBoletin[]` and render in a dedicated "Materias Previas" section.

### D3 — Entry-screen UX

**Recommendation: (a) generalize the two existing Primario screens** to accept both Primario and
Secundario CCs. **Reject** new Secundario-specific routes (b) and any rewrite (c).

**Code evidence.** The only Primario-specific coupling in `subject-grading-by-subject.tsx` and
`subject-grading-by-course.tsx` is one predicate:

```ts
const isPrimario = (cc: { level: number }) => Math.floor(cc.level / 10) === 2;
// ... passed only to <TeacherFilteredSelector filterCourseCycle={isPrimario} />
```

Everything downstream is already level-agnostic:
- The grids read `/grading/subject-grades`, `/grading/scales?level=`, `/grading/period-templates?level=`
  and `/competency-valuations` — all parameterized by `context.level`/`context.modality`. Secundario
  (level 3, `gs-secundaria`, `gpt-secundaria-trimestral`) flows through unchanged.
- `use-grading-grid`'s competency-coupled `CellState` works as-is because Secundario DOES use
  competencies (locked decision 4); the imprimible toggle path is identical.
- The subject-grade channel already carries `passed` on `SubjectFinalGradeCell`. We only ADD
  `condicion` to that cell + the read raw type + the PUT body — no structural hook change.

**Change:** replace the literal `isPrimario` with a shared predicate
`isPrimarioOrSecundario = (cc) => [2,3].includes(Math.floor(cc.level/10))` in both pages, and keep the
page titles generic. Add a **condición `<select>`** (REGULAR/PREVIA/LIBRE, accessible `aria-label`,
loading/empty/error states already present) to the finals table, bound to the `FINAL`-row cell and
wired to `updateSubjectFinalGrade(key, { condicion })`; the hook's PUT body gains `condicion`.

**Why not (b)/(c):** duplicating ~800 lines of screen for zero behavioral delta violates DRY, doubles
the test surface (Strict TDD), and diverges over time. Generalizing is the smallest, lowest-risk change
that reuses 100% of the grid.

### D4 — `buildMateriasSecundario`

**Decision.** Add a third branch to `buildMaterias`:
`Math.floor(level/10) === 3 && sgpRepo && periodGradeRepo && finalGradeRepo && cvRepo →
buildMateriasSecundario(client, enrollment)`. The method is a structural clone of
`buildMateriasPrimario` (same bulk-fetch-per-CC strategy, same `pgBySubject`/`fgBySubject` indexing,
same `periodOrdinal === GradingPeriodTemplateItem.sortOrder` invariant for competency column
alignment, same imprimible-filter-in-use-case rule), differing only by:
- CC filter `Math.floor(cc.level/10) === 3`.
- Reads `condicion` from the `FINAL` final-grade row (fallback `DEFINITIVA`) → sets a new optional
  `MateriaBoletin.condicion?: string`.
- Assembles previas once per enrollment (D2) → new top-level `DatosBoletin.previas?: PreviaBoletin[]`.

**Contract additions** (`boletin.template.ts`) are all OPTIONAL so other levels are untouched:
- `MateriaBoletin.condicion?: string`
- `DatosBoletin.previas?: PreviaBoletin[]` where
  `PreviaBoletin = { subjectName: string; originAcademicYear: string; condicion: string; status: string }`

**Template `boletin-secundario.hbs` (rebuilt)** mirrors `boletin-primario.hbs` structure:
dynamic per-trimester columns via `{{#with (lookup materias 0)}}{{#each periodGrades}}`, the 4 final
columns, a Condición column (`{{condicion}}`), the per-materia competencies table (imprimible already
filtered upstream), plus a new "Materias Previas" `{{#if previas}}` section. Asistencia/mesasExamen
blocks are preserved.

**Regression guarantee.** Primario stays on `=== 2` (buildMateriasPrimario untouched); Terciario (4)
and Inicial (1) stay on the legacy `NotaTrimestral` else-branch (untouched). Template dispatch already
maps `SECUNDARIO → boletin-secundario.hbs`. The new contract fields are `undefined` for non-Secundario
levels, so their `{{#if}}` guards no-op and `boletin-primario.hbs` / `boletin-terciario.hbs` /
`boletin-inicial.hbs` render byte-for-byte identically. The existing boletín regression tests stand.

### D5 — Migration plan

**Decision: TWO migrations** (each single-responsibility, mirroring the Primario
one-table/one-concern-per-migration convention; honors the locked "ONE nullable-column migration for
`condicion`" while keeping the previas table isolated for independent rollback).

Folder convention: `YYYYMMDDHHMMSS_description/migration.sql`, dated AFTER the latest Primario
migration (`20260609150000`). Edit `schema.prisma` in tandem.

1. `20260610120000_secundario_add_subject_final_grade_condicion/migration.sql`
   ```sql
   CREATE TYPE "SubjectFinalGradeCondicion" AS ENUM ('REGULAR', 'PREVIA', 'LIBRE');
   ALTER TABLE "subject_final_grades" ADD COLUMN "condicion" "SubjectFinalGradeCondicion";
   ```
   Nullable → backward-safe; rollback = drop column + type.

2. `20260610130000_secundario_add_materias_previas/migration.sql`
   `CREATE TABLE "materias_previas"` (+ `MateriaPreviaStatus` enum) with the D2 columns, the
   `(student_id, subject_id, origin_academic_year)` unique index, the `(student_id)` and
   `(student_id, origin_academic_year)` indexes, and FKs: `student_id → students.id` (Cascade),
   `subject_id → subjects.id` (Cascade), `origin_course_cycle_id → course_cycles.uuid` (SetNull).
   Rollback = drop table + enum.

## 4. Reuse vs New

**Reused verbatim (≈40-60% for free):** `SubjectPeriodGrade` / `SubjectGradingPeriod` entities + repos;
`UpsertSubjectPeriodGradesUseCase`; `GetSubjectGradesBy{Subject,Student}` (extended, not rewritten);
all `/grading/*` endpoints; `TeacherFilteredSelector`; `use-grading-grid` (extended with `condicion`);
the competency model + imprimible toggle; PDF/HTML infra + template dispatch;
`buildMateriasPrimario`'s structure as the blueprint for the Secundario clone; seeded
`gs-secundaria` + `gpt-secundaria-trimestral`.

**Genuinely new:** `SubjectFinalGradeCondicion` VO; `condicion` column + entity method + DTO/use-case
wiring; `MateriaPrevia` aggregate + port + Prisma repo + table + use cases + endpoints;
`buildMateriasSecundario` branch; rebuilt `boletin-secundario.hbs`; `condicion`/`previas` optional
contract fields; the `isPrimarioOrSecundario` predicate + condición selector on the two screens; two
migrations.

**Modified (additive):** `SubjectFinalGrade` entity; `UpsertSubjectFinalGradesUseCase`;
`GetSubjectGradesBy*UseCase`; `subject-grades.dto.ts`; `use-grading-grid.ts`; the two entry screens;
`generate-boletin.use-case.ts`; `boletin.template.ts`.

## 5. Design-Level Risks (for tasks/apply)

| Risk | Sev | Mitigation |
|------|-----|------------|
| Naming overlap: existing `secundario/value-objects/condicion-alumno.ts` (`APROBADO`) vs new pedagogy `SubjectFinalGradeCondicion` (`REGULAR`) | Med | Keep them separate; new VO lives in `pedagogy`; do not import or "unify". Document the distinction in the VO header. |
| `condicion` C-1/C-2 vs `passed` ordering — `passed` and `condicion` may arrive in the same item or across items | Med | Validate against the **merged** row state after applying both, exactly where the lifecycle block already reads merged state; add explicit tests for LIBRE+passed=true and PREVIA+passed=true (Strict TDD). |
| Previas NOT auto-derived from PREVIA condición → data can drift (a subject marked PREVIA with no `materias_previas` row) | Med | Explicit boundary decision; surface previas capture in the UX or a follow-up. Note for tasks: optionally add a reconciliation read, but do NOT couple the grading upsert. |
| `buildMateriasSecundario` duplication of `buildMateriasPrimario` risks divergence | Low | Acceptable per Approach A; keep the two methods structurally parallel, share private helpers (`resolveSubjectsForCC`) already on the use case. |
| Boletín regression for Inicial/Terciario if contract fields not optional | Low | All new fields optional + `{{#if}}` guarded; existing regression suite must pass unchanged before merge. |
| Migration ordering vs already-applied Primario migrations on shared tenant DBs | Low | Timestamps strictly after `20260609150000`; nullable column + new table are non-destructive. |

## 6. Strict TDD Notes

Each new unit is test-first: the `SubjectFinalGradeCondicion` VO guard (valid/invalid),
`SubjectFinalGrade.setCondicion`, the use-case consistency rules C-1..C-4, the `MateriaPrevia` entity
behavior + repo contract, the extended read projections, `buildMateriasSecundario` (period alignment,
condición read, previas assembly, imprimible filter), and the boletín regression for the other three
levels.
