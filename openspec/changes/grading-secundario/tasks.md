# Implementation Tasks — grading-secundario (Fase 4, Etapa 2)

> Status: TASKS · Store: hybrid · Total: 42 tasks across 6 PRs
> Strict TDD: ACTIVE (RED→GREEN mandatory for every implementation task)
> Test runners: `pnpm --filter @educandow/domain build` + `pnpm --filter api test` (vitest) + `pnpm --filter web test` (vitest)
> Conventional commits: scope `grading` or `secundario`

## Design decisions superseding spec where they conflict

1. **Condicion validation lives in the USE CASE, not in the entity.** C-1 (LIBRE+passed=true→reject) and C-2 (PREVIA+passed=true→reject) are cross-field invariants enforced by `UpsertSubjectFinalGrades`, not by `SubjectFinalGrade.setCondicion()`. The entity stores condicion, the use case validates the combined state.
2. **MateriaPrevia previas are NOT auto-derived from a PREVIA condicion.** Setting condicion=PREVIA on a final grade does NOT automatically create a `MateriaPrevia` row. These are independent writes; surfacing the link in UX is a follow-up concern.
3. **ListTeacherCourseCycles predicate expands to Secundario.** The existing `Math.floor(level/10)===2` Primario filter in subject mode becomes `[2,3].includes(Math.floor(level/10))` to include Secundario CCs. This is a server-side use-case change, not a client-only predicate.
4. **Design wins** on all other spec/design conflicts.

---

## PR1 — Domain + schema: SubjectFinalGradeCondicion VO + condicion on SubjectFinalGrade + Migration 1

**Depends on:** none
**Estimate:** ~135 lines
**Reuse leverage:** HIGH — VO is a direct clone of `subject-final-grade-type.ts`; entity patch is 4 additive lines
**Packages:** `packages/domain`, `api`

| ID | Action | Files | Spec refs |
|---|---|---|---|
| PR1-T1 | [x] [RED] Write failing unit tests for `SubjectFinalGradeCondicion` VO: `fromString('REGULAR')` / `fromString('PREVIA')` / `fromString('LIBRE')` each return the correct enum value; `fromString('INVALID')` → `ValidationError`; all three values round-trip correctly; VO is value-equal by value | `packages/domain/src/pedagogy/value-objects/subject-final-grade-condicion.spec.ts` | C-R1, C-R2, D1 |
| PR1-T2 | [x] [GREEN] Implement `SubjectFinalGradeCondicion` VO: `enum SubjectFinalGradeCondicion {REGULAR,PREVIA,LIBRE}`; `fromSubjectFinalGradeCondicionString(s): Result<SubjectFinalGradeCondicion,ValidationError>`; cloned from `subject-final-grade-type.ts` — do NOT reuse `condicion-alumno.ts` (wrong member APROBADO, wrong style) | `packages/domain/src/pedagogy/value-objects/subject-final-grade-condicion.ts` | C-R1, D1 |
| PR1-T3 | [x] [RED] Write failing unit tests for `SubjectFinalGrade` condicion extension: `create()` yields `condicion: null`; `setCondicion(PREVIA)` sets value and returns Ok; `setCondicion(undefined)` leaves condicion as null; `reconstruct(props)` with condicion=LIBRE round-trips correctly; condicion coexists with existing `setPassed` / `assignGrade` paths | `packages/domain/src/pedagogy/entities/subject-final-grade.spec.ts` (new describe block `condicion`) | C-R3, D1 |
| PR1-T4 | [x] [GREEN] Extend `SubjectFinalGrade` entity: add `condicion: SubjectFinalGradeCondicion \| null` field to Props + Reconstruct + `create()` default null; add getter; add `setCondicion(c: SubjectFinalGradeCondicion \| undefined): Result<void,never>` styled like `setPassed()` — no cross-field validation in entity (see decision #1 above) | `packages/domain/src/pedagogy/entities/subject-final-grade.ts` | C-R3, D1 |
| PR1-T5 | [x] Add `SubjectFinalGradeCondicion` enum to Prisma schema + `condicion SubjectFinalGradeCondicion?` nullable column on `SubjectFinalGrade` model | `api/prisma_tenant/schema.prisma` | D5 |
| PR1-T6 | [x] Generate and apply Prisma migration `20260610120000_secundario_add_subject_final_grade_condicion` (CREATE TYPE `SubjectFinalGradeCondicion`; ALTER TABLE `subject_final_grades` ADD COLUMN `condicion` nullable — safe, no backfill required; Primario rows get NULL naturally) | `api/prisma_tenant/migrations/20260610120000_secundario_add_subject_final_grade_condicion/migration.sql` | D5 |
| PR1-T7 | [x] Re-export `SubjectFinalGradeCondicion`, `fromSubjectFinalGradeCondicionString` from pedagogy barrel and root domain barrel | `packages/domain/src/pedagogy/index.ts`, `packages/domain/src/index.ts` | D1 |

---

## PR2 — Domain + schema: MateriaPrevia entity + port + Migration 2

**Depends on:** PR1 (shared `schema.prisma` file — sequential to avoid merge conflict)
**Estimate:** ~220 lines
**Reuse leverage:** LOW — genuinely new bounded context; no Primario parallel; entity pattern follows existing DDD style
**Packages:** `packages/domain`, `api`

| ID | Action | Files | Spec refs |
|---|---|---|---|
| PR2-T1 | [x] [RED] Write failing unit tests for `MateriaPrevia` entity: `create()` yields status PENDIENTE and preserves condicion; `create()` with condicion=REGULAR → ValidationError (domain invariant: previas only exist for PREVIA or LIBRE); `resolve(gradeCode)` → status APROBADA + gradeCode snapshot + resolvedAt set; `markLibre()` → status LIBRE; `reconstruct(props)` round-trips all fields including resolvedAt | `packages/domain/src/secundario/entities/materia-previa.spec.ts` | MP-R1, MP-R2, MP-R3, MP-R4, MP-R7, D2 |
| PR2-T2 | [x] [GREEN] Implement `MateriaPrevia` entity: fields `{id, studentId, subjectId, originAcademicYear: string, originCourseCycleId?: string, condicion: SubjectFinalGradeCondicion (PREVIA\|LIBRE only), status: MateriaPreviaStatus, resolvedGradeCode?: string, resolvedAt?: Date, createdAt, updatedAt}`; static `create(input)` validates condicion∈{PREVIA,LIBRE}; `reconstruct(props)`; `resolve(gradeCode): Result<void,ValidationError>`; `markLibre(): Result<void,never>`; getters only; Result-typed throughout | `packages/domain/src/secundario/entities/materia-previa.ts` | MP-R1..MP-R5, D2 |
| PR2-T3 | [x] Define `MateriaPreviaRepository` port: `findByStudent(studentId: string): Promise<MateriaPrevia[]>`; `findByStudentAndAcademicYear(studentId: string, academicYear: string): Promise<MateriaPrevia[]>`; `saveMany(items: MateriaPrevia[]): Promise<void>`; export `MATERIA_PREVIA_REPOSITORY` Symbol DI token | `packages/domain/src/secundario/repositories/materia-previa-repository.ts` | MP-R6, MP-R8, D2 |
| PR2-T4 | [x] Add `MateriaPreviaStatus` enum `{PENDIENTE, APROBADA, LIBRE}` + `materias_previas` model to Prisma schema: `@@unique([studentId,subjectId,originAcademicYear])`; `@@index([studentId])`; `@@index([studentId,originAcademicYear])`; FK `studentId→Student` onDelete:Cascade; FK `subjectId→Subject` onDelete:Cascade; FK `originCourseCycleId→CourseCycle.uuid` onDelete:SetNull | `api/prisma_tenant/schema.prisma` | D2, D5 |
| PR2-T5 | [x] Generate and apply Prisma migration `20260610130000_secundario_add_materias_previas` (CREATE TABLE `materias_previas` + `MateriaPreviaStatus` enum + all indexes + FK constraints) | `api/prisma_tenant/migrations/20260610130000_secundario_add_materias_previas/migration.sql` | D2, D5 |
| PR2-T6 | [x] Create/update `packages/domain/src/secundario/index.ts` barrel; re-export `MateriaPrevia`, `MateriaPreviaRepository`, `MATERIA_PREVIA_REPOSITORY`, `MateriaPreviaStatus`, all Props/Input types from root domain barrel | `packages/domain/src/secundario/index.ts`, `packages/domain/src/index.ts` | D2 |

---

## PR3 — API Infra: condicion round-trip on SubjectFinalGradeRepository + PrismaMateriaPreviaRepository

**Depends on:** PR1, PR2
**Estimate:** ~175 lines
**Reuse leverage:** MEDIUM — condicion patch is 2 additive lines; MateriaPreviaRepository follows `PrismaSubjectFinalGradeRepository` pattern
**Packages:** `api`

| ID | Action | Files | Spec refs |
|---|---|---|---|
| PR3-T1 | [x] [RED] Write failing Prisma repository tests for `SubjectFinalGradeRepository` condicion round-trip: `saveMany` persists condicion=PREVIA and reads it back; condicion=null preserved correctly; upsert from PREVIA→LIBRE updates value; cross-institutionId returns 0 rows (existing test, verify still passes) | `api/src/infrastructure/persistence/prisma/repositories/prisma-subject-final-grade.repository.spec.ts` (new describe block `condicion round-trip`) | C-R3, D1 |
| PR3-T2 | [x] [GREEN] Extend `PrismaSubjectFinalGradeRepository`: map condicion field in `saveMany` write path; map condicion in `toDomain(row)` mapper (`row.condicion → fromSubjectFinalGradeCondicionString() ?? null`) | `api/src/infrastructure/persistence/prisma/repositories/prisma-subject-final-grade.repository.ts` | C-R3, D1 |
| PR3-T3 | [x] [RED] Write failing Prisma repository tests for `MateriaPreviaRepository`: `saveMany` upserts on unique (studentId,subjectId,originAcademicYear); second `saveMany` with same key updates status; `findByStudent` returns all rows for that student; `findByStudentAndAcademicYear` filters correctly by year; cross-institutionId returns 0 rows; all fields (resolvedAt, resolvedGradeCode, condicion) round-trip | `api/src/infrastructure/persistence/prisma/repositories/prisma-materia-previa.repository.spec.ts` | MP-R6, MP-R8, D2 |
| PR3-T4 | [x] [GREEN] Implement `PrismaMateriaPreviaRepository`: `findByStudent(studentId)`, `findByStudentAndAcademicYear(studentId, year)`, `saveMany(items)` (upsert on `@@unique` constraint; tenant-scoped via `institutionId` on Student FK join); `toDomain` mapper; register in module with `MATERIA_PREVIA_REPOSITORY` token | `api/src/infrastructure/persistence/prisma/repositories/prisma-materia-previa.repository.ts` | MP-R6, MP-R8, D2 |

---

## PR4 — API Application: condicion use-case extensions + previas CRUD + ListTeacherCourseCycles Secundario

**Depends on:** PR3
**Estimate:** ~295 lines
**Reuse leverage:** MEDIUM — condicion validation is new logic; previas use cases new but standard pattern; ListTeacherCourseCycles is a 2-line predicate change
**Packages:** `api`
**Pre-authorized split:** PR4a (T1-T6: condicion extension + read extensions) / PR4b (T7-T12: previas CRUD + teacher filter) if TDD pushes past 300

| ID | Action | Files | Spec refs |
|---|---|---|---|
| PR4-T1 | [x] [RED] Write failing use-case tests for `UpsertSubjectFinalGrades` condicion extension: C-1 LIBRE+passed=true → ValidationError 400; C-2 PREVIA+passed=true → ValidationError 400; C-3 REGULAR+passed=true → OK; C-3 REGULAR+passed=false → OK; C-4 unknown condicion string at DTO boundary → 400 (Zod rejects before use case); condicion=undefined leaves existing condicion unchanged; condicion=PREVIA with passed=false → OK | `api/src/application/grading/upsert-subject-final-grades.use-case.spec.ts` (new describe block `condicion validation`) | C-R4, C-R5, C-R6, C-R7, D1 |
| PR4-T2 | [x] [GREEN] Extend `UpsertSubjectFinalGrades` use case: after `setPassed(item.passed)` call `grade.setCondicion(item.condicion)`; validate combined state: LIBRE+passed=true → reject; PREVIA+passed=true → reject; no other constraints; enum guard happens earlier at DTO/Zod boundary | `api/src/application/grading/upsert-subject-final-grades.use-case.ts` | C-R4..C-R7, D1 |
| PR4-T3 | [x] [RED] Write failing use-case tests for `GetSubjectGradesBySubject` condicion extension: `finalGrades[]` entries include `condicion: string \| null`; null condicion returns `null` (not omitted); Primario row (condicion=null on entity) returns `condicion: null` without error | `api/src/application/grading/get-subject-grades-by-subject.use-case.spec.ts` (new describe block `condicion in response`) | C-R8, SSG-R3, D1 |
| PR4-T4 | [x] [GREEN] Extend `GetSubjectGradesBySubject` response assembly: map `condicion: grade.condicion?.toString() ?? null` in `finalGrades[]` | `api/src/application/grading/get-subject-grades-by-subject.use-case.ts` | C-R8, D1 |
| PR4-T5 | [x] [RED] Write failing use-case tests for `GetSubjectGradesByStudent` condicion extension: same assertions as PR4-T3 but for the student-scoped read path | `api/src/application/grading/get-subject-grades-by-student.use-case.spec.ts` (new describe block `condicion in response`) | C-R8, SSG-R3, D1 |
| PR4-T6 | [x] [GREEN] Extend `GetSubjectGradesByStudent` response assembly: map `condicion` in `finalGrades[]` (same pattern as PR4-T4) | `api/src/application/grading/get-subject-grades-by-student.use-case.ts` | C-R8, D1 |
| PR4-T7 | [x] [RED] Write failing use-case tests for `UpsertMateriaPrevia`: valid upsert (condicion=PREVIA) → Ok; valid upsert (condicion=LIBRE) → Ok; condicion=REGULAR → ValidationError 400; non-existent studentId → NotFoundError 404; non-existent subjectId → NotFoundError 404; cross-tenant → 404; second call with same key updates existing row (upsert semantics); resolve flow: `resolve(gradeCode)` sets status=APROBADA | `api/src/application/secundario/upsert-materia-previa.use-case.spec.ts` | MP-R1..MP-R7, D2 |
| PR4-T8 | [x] [GREEN] Implement `UpsertMateriaPrevia` use case (`@Injectable()`; Result-typed; `UPSERT_MATERIA_PREVIA` Symbol token; find-by-key or create; validate condicion∈{PREVIA,LIBRE} at use-case boundary; `saveMany([item])`) | `api/src/application/secundario/upsert-materia-previa.use-case.ts` | MP-R1..MP-R7, D2 |
| PR4-T9 | [x] [RED] Write failing use-case tests for `ListMateriasPreviasByStudent`: returns all rows for student when no academicYear filter; filtered by academicYear when param provided; empty array 200 when no rows (never error); cross-tenant → 404 | `api/src/application/secundario/list-materias-previas-by-student.use-case.spec.ts` | MP-R6, MP-R8, MP-R9, D2 |
| PR4-T10 | [x] [GREEN] Implement `ListMateriasPreviasByStudent` use case (optional `academicYear` filter; calls `findByStudentAndAcademicYear` when provided, else `findByStudent`; returns domain projections as plain objects) | `api/src/application/secundario/list-materias-previas-by-student.use-case.ts` | MP-R6, MP-R8, MP-R9, D2 |
| PR4-T11 | [x] [RED] Write failing use-case tests for `ListTeacherCourseCycles` Secundario extension: `mode=subject` returns both Primario (level 20–29) and Secundario (level 30–39) CCs for the teacher; Terciario (level 40+) excluded; `mode=homeroom` behavior unchanged (still returns all homeroom CCs regardless of level) | `api/src/application/grading/list-teacher-course-cycles.use-case.spec.ts` (new describe block `Secundario inclusion`) | ESS-R1, ESS-R2, D3 |
| PR4-T12 | [x] [GREEN] Update `ListTeacherCourseCycles` use case: replace `Math.floor(level/10)===2` with `[2,3].includes(Math.floor(level/10))` in subject-mode CC filtering | `api/src/application/grading/list-teacher-course-cycles.use-case.ts` | ESS-R1, ESS-R2, D3 |

---

## PR5 — API Presentation + Web: condicion DTOs + materias-previas endpoints + entry-screen generalization

**Depends on:** PR4
**Parallel with:** PR6 (independent web / boletín tracks)
**Estimate:** ~260 lines
**Reuse leverage:** HIGH (web predicate swap is 2-line change; condicion select is ~30 lines; API controller follows existing MateriasPrevias pattern)
**Packages:** `api`, `web`

| ID | Action | Files | Spec refs |
|---|---|---|---|
| PR5-T1 | [ ] Extend `UpsertFinalGradeItemSchema`: add `condicion: z.nativeEnum(SubjectFinalGradeCondicion).optional()`; extend `UpsertFinalGradeItem` type with `condicion?`; extend finalGrades response type with `condicion: string \| null` | `api/src/presentation/grading/dto/subject-grades.dto.ts` | C-R3, C-R7, D1 |
| PR5-T2 | [ ] [RED] Write failing controller tests for `SubjectGradesController` condicion extension: PUT finalGrades with condicion=PREVIA → 200; PUT with condicion=REGULAR+passed=true → 400; GET by-subject response includes `condicion` in each finalGrades entry; GET by-student same; omitting condicion in PUT → 200 (field optional) | `api/src/presentation/grading/subject-grades.controller.spec.ts` (new describe block `condicion flow`) | C-R3, C-R7, C-R8 |
| PR5-T3 | [ ] [GREEN] Extend `SubjectGradesController`: pass condicion through in PUT body binding; include condicion in GET response DTO mapping | `api/src/presentation/grading/subject-grades.controller.ts` | C-R3, C-R8 |
| PR5-T4 | [ ] Define `UpsertMateriaPreviaSchema` (body: subjectId, originAcademicYear, condicion∈{PREVIA,LIBRE}, originCourseCycleId?) + `MateriaPreviaResponseDto` (id, studentId, subjectId, originAcademicYear, condicion, status, resolvedGradeCode?, resolvedAt?) | `api/src/presentation/secundario/dto/materias-previas.dto.ts` | MP-R1, MP-R6, D2 |
| PR5-T5 | [ ] [RED] Write failing controller tests for `MateriasPreviasController`: `POST /students/:studentId/materias-previas` with valid body → 201; condicion=REGULAR → 400; studentId not found → 404; `GET /students/:studentId/materias-previas` → 200 array; `GET /students/:studentId/materias-previas?academicYear=2025` → filtered array; cross-tenant → 404; `{ data }` response shape | `api/src/presentation/secundario/__tests__/materias-previas.controller.spec.ts` | MP-R1, MP-R6, MP-R8, MP-R9 |
| PR5-T6 | [ ] [GREEN] Implement `MateriasPreviasController` with `POST /students/:studentId/materias-previas` (→ `UpsertMateriaPrevia`) and `GET /students/:studentId/materias-previas` (→ `ListMateriasPreviasByStudent`; optional `?academicYear` query param); `{ data }` response envelope | `api/src/presentation/secundario/materias-previas.controller.ts` | MP-R1, MP-R6, MP-R8, MP-R9 |
| PR5-T7 | [ ] [RED] Write failing component/hook tests for entry-screen generalization: `TeacherFilteredSelector` renders Secundario CCs (level 30) alongside Primario (level 20) in subject mode; Terciario (level 40) NOT rendered; `condición <select>` with options REGULAR/PREVIA/LIBRE renders on FINAL-row cell; selecting PREVIA fires `updateSubjectFinalGrade(key, {condicion:'PREVIA'})`; hook PUT body includes `condicion` when set | `web/src/pages/dashboard/__tests__/TeacherFilteredSelector.test.tsx` (new describe block), `web/src/pages/dashboard/__tests__/subject-grading-by-subject.test.tsx` (new describe block `Secundario + condicion`) | ESS-R1, ESS-R2, ESS-R5, ESS-R6, C-R3, D3 |
| PR5-T8 | [ ] [GREEN] Generalize entry screens: (a) replace `isPrimario = Math.floor(level/10)===2` with `isPrimarioOrSecundario = [2,3].includes(Math.floor(level/10))` in `TeacherFilteredSelector.filterCourseCycle` and both page components; (b) add accessible `<select aria-label="Condición">` with options REGULAR/PREVIA/LIBRE on FINAL-row cell in `SubjectGradingBySubject`; (c) wire select onChange to `updateSubjectFinalGrade(key,{condicion})`; (d) extend hook PUT body to include optional `condicion` field | `web/src/pages/dashboard/components/TeacherFilteredSelector.tsx`, `web/src/pages/dashboard/subject-grading-by-subject.tsx`, `web/src/pages/dashboard/subject-grading-by-course.tsx`, `web/src/pages/dashboard/components/use-grading-grid.ts` | ESS-R1, ESS-R2, ESS-R5, C-R3, D3 |

---

## PR6 — API + Template: buildMateriasSecundario + rebuilt boletin-secundario.hbs + regression

**Depends on:** PR4 (condicion + previas data sources)
**Parallel with:** PR5 (independent of web track)
**Estimate:** ~235 lines
**Reuse leverage:** HIGH — structural clone of `buildMateriasPrimario`; share `resolveSubjectsForCC`; all new contract fields optional so Primario/Terciario/Inicial untouched
**Packages:** `api`

| ID | Action | Files | Spec refs |
|---|---|---|---|
| PR6-T1 | [ ] [RED] Write failing regression tests: (a) for any CC where `Math.floor(level/10)===4` (Terciario), `generateBoletin` uses the `NotaTrimestral` path and output is byte-for-byte equivalent to pre-change behavior; (b) for Primario CC (`Math.floor(level/10)===2`), existing Primario boletín tests still pass without modification | `api/src/application/reportes/__tests__/generate-boletin.use-case.test.ts` (new describe block `regression Terciario + Primario`) | BSS-R2, D4 |
| PR6-T2 | [ ] [RED] Write failing tests for `buildMateriasSecundario`: reads `SubjectGradingPeriod` (dynamic period columns from periodName); reads `SubjectPeriodGrade` (period grades per student × period); reads `SubjectFinalGrade` for condicion — FINAL row primary, DEFINITIVA fallback; absent FINAL+DEFINITIVA → condicion=null (no error); reads `CompetencyPeriodValuation` filtered `imprimible=true`; reads `MateriaPrevia` via `findByStudentAndAcademicYear` called ONCE per enrollment (assert call count = number of unique students, NOT number of materias); builds `MateriaBoletin` with `condicion?`; builds `DatosBoletin.previas?[]` | `api/src/application/reportes/__tests__/generate-boletin.use-case.test.ts` (new describe block `buildMateriasSecundario`) | BSS-R1, BSS-R3..BSS-R9, D4 |
| PR6-T3 | [ ] [GREEN] Extend boletín contract types: add `condicion?: string` to `MateriaBoletin`; add `previas?: PreviaBoletin[]` to `DatosBoletin` where `PreviaBoletin = {subjectName: string, originAcademicYear: string, condicion: string, status: string}`; all new fields OPTIONAL — Primario/Terciario/Inicial leave them `undefined`; `{{#if}}` guards in existing templates → no-ops | `api/src/application/reportes/templates/boletin.template.ts` | BSS-R7, D4 |
| PR6-T4 | [ ] [GREEN] Extract shared `resolveSubjectsForCC(courseCycleId, institutionId)` helper (deduplication of `buildMateriasPrimario` subject-fetch); implement `buildMateriasSecundario(courseCycleId, institutionId)` as `level/10===3` branch: same bulk-fetch-per-CC pattern + pgBySubject/fgBySubject indexing + `periodOrdinal===GradingPeriodTemplateItem.sortOrder` invariant + imprimible-filter-in-use-case; condicion from FINAL→DEFINITIVA fallback; previas from `findByStudentAndAcademicYear` once per enrollment → `DatosBoletin.previas?`; dispatch branch: `else if (Math.floor(level/10)===3) buildMateriasSecundario(...)` — Primario (===2) branch untouched | `api/src/application/reportes/generate-boletin.use-case.ts` | BSS-R1..BSS-R9, D4 |
| PR6-T5 | [ ] Rebuild `boletin-secundario.hbs`: dynamic trimester columns (loop over `materias[0].periodGrades[].periodName`); 4 finals columns (FINAL, DICIEMBRE, MARZO, DEFINITIVA); Condición column; per-materia competency rows (from `imprimible=true` items); `{{#if previas}}` Materias Previas section listing `{subjectName, originAcademicYear, condicion, status}`; mirrors `boletin-primario.hbs` structure with Secundario-specific additions | `api/src/infrastructure/reporting/html-templates/boletin-secundario.hbs` | BSS-R3..BSS-R9, D4 |

---

## Review Workload Forecast

| PR | Est. lines | vs 300 target / 400 max | Risk | Pre-authorized split |
|---|---|---|---|---|
| PR1 | ~135 | Well under | Low | — |
| PR2 | ~220 | Under target | Low | — |
| PR3 | ~175 | Under target | Low | — |
| PR4 | ~295 | **At edge of 300** | Medium — 6 use-case extensions + 4 new use cases + test coverage in strict TDD | PR4a: condicion extension T1–T6 / PR4b: previas CRUD + teacher filter T7–T12 |
| PR5 | ~260 | Under target | Low-Medium — spans api + web; condicion select UX is additive but crosses packages | — |
| PR6 | ~235 | Under target | Low | — |

**Total estimated:** ~1320 lines across 6 PRs (42 tasks)
**Chained PRs recommended:** Yes (6-PR DAG; PR1 and PR2 mostly-sequential due to shared schema.prisma; PR3 gates infra; PR4 gates application; PR5 and PR6 run in parallel after PR4)
**400-line budget risk:** Low — no PR estimated above 300
**300-line target risk:** PR4 (~295) sits at the boundary; strict TDD test files will push the real diff above 300. **Split is pre-authorized** — apply executor must split PR4 without asking if either half exceeds 300.
**Decision needed before apply:** None. DAG is locked, corrections applied, splits pre-authorized. Apply can proceed.

---

## Dependency graph

```
PR1 (condicion VO + Migration 1)
  └── PR2 (MateriaPrevia + Migration 2)  [sequential — shared schema.prisma]
        └── PR3 (Infra repos)
              └── PR4 (Application use cases)
                    ├── PR5 (Presentation + Web)   [parallel]
                    └── PR6 (Boletín)              [parallel]
```

---

## Cross-package notes

- **`SubjectFinalGradeCondicion` vs `condicion-alumno.ts`**: Do NOT reuse `secundario/condicion-alumno.ts` — it has member `APROBADO` and a different style contract. Keep both types separate and add a JSDoc note explaining the distinction.
- **Condicion column is additive-nullable**: Migration 1 is safe with zero downtime. Primario rows get `NULL` naturally. No backfill, no default required.
- **Materias previas N+1 guard**: `buildMateriasSecundario` must call `findByStudentAndAcademicYear` ONCE per unique student in the enrollment, NOT once per materia. PR6-T2 test asserts call count. This is the primary regression risk for boletín performance.
- **MateriaBoletin/DatosBoletin new fields OPTIONAL**: `condicion?`, `previas?` undefined in Primario/Terciario/Inicial builds. All existing HBS templates use `{{#if}}` guards → no-ops. Verified in PR6-T1 regression test.
- **Migration path**: `api/prisma_tenant/migrations/` (NOT `api/prisma/migrations/`). Both migration folders dated after Primario 20260609150000.
- **Domain barrel re-exports**: `packages/domain/src/secundario/index.ts` must be created (or extended) and then re-exported from `packages/domain/src/index.ts`. The Primario block at lines 74–79 is the structural reference.
- **CourseCycle FK uses `uuid` not `id`**: `originCourseCycleId` in `materias_previas` must point to `CourseCycle.uuid`. Matches existing pattern from grading-primario.
- **Conventional commits**: `feat(secundario): ...` / `feat(grading): ...`; `test(secundario): ...` for test-only commits; `chore(grading): ...` for barrel/migration-only.
- **`ListTeacherCourseCycles` predicate change** (PR4-T11/T12): this is a 2-line server-side fix but it unlocks the entire Secundario entry-screen UX. It must land in PR4 (not deferred to PR5) because PR5-T7/T8 web tests will mock the API response for both Primario and Secundario CCs.
