# Change Proposal — grading-primario (Fase 4, Etapa 1)

> Status: PROPOSED · Store: hybrid (engram + openspec) · Delivery: chained PRs, strict TDD, ask-on-risk
> Scope: PRIMARIO vertical only — first of a by-level roadmap (Secundario → Inicial → Terciario follow as later etapas).

## Intent

Deliver an end-to-end alphanumeric grading vertical for the **Primario** level: an authenticated teacher opens one of two entry screens — "Alumnos por materia" (their subject across all students) or "Alumnos por curso" (one student across all their subjects) — filtered to their own assignments, loads **subject-level grades** (configurable period grades + the four final instances: Nota Final, Diciembre, Marzo, Nota Definitiva) **and** per-competency valuations (Fase 3, reused), flags pedagogical conditions (PA/PPI/PP), and the **boletín Primario** renders all of it from this new model. Success = a Primario teacher can grade a course top-to-bottom and the printed report card reflects exactly what was loaded, with zero regression to the other three levels still on the legacy path.

## Problem

The competency layer (Fase 3) is done, but the Primario grading vertical is missing its spine:

- **Subject-level grades do not exist.** Today's only subject-level grades are numeric legacy models (`CalificacionPrimario` tied to legacy `Grado` with hardcoded 3 trimesters; `NotaTrimestral` tied to the old period model). Neither is alphanumeric, neither uses `CourseCycle`, neither carries the four final instances. They are not reusable.
- **Teacher identity is missing.** There is no `Teacher.userId` link between the authenticated User (master DB) and the Teacher record (tenant DB). Without it, neither entry screen can be filtered to the logged-in teacher's assignments.
- **PA/PPI/PP flags do not exist** anywhere in schema, domain, or API.
- **The boletín is outdated.** `buildMaterias()` reads numeric `NotaTrimestral`; `boletin-primario.hbs` hardcodes "1°/2°/3° Trim" numeric columns with no competencies, no final instances, no flags.
- **No snapshot of period structure.** Period count lives in `GradingPeriodTemplate(level,modality)`; Fase 3 competency valuations reference `GradingPeriodTemplateItem` via a **live FK**, so historical grading would shift if the plan changes in a future cycle.

## Scope

### In scope (Etapa 1 — Primario)

- New subject-level grade model: configurable period grades + four final instances (Final, Diciembre, Marzo, Definitiva), alphanumeric, at Materia×Curso×Ciclo, per student.
- Period-structure **snapshot** into the Primario grading context (decoupled from the live plan FK).
- `Teacher.userId` link + a modern teacher↔course relationship for "Alumnos por curso".
- PA/PPI/PP pedagogical flags.
- The two teacher-filtered entry screens (replacing the Fase 3b `/competency-grading` page).
- Subject-grade CRUD API + teacher-identity/assignment query endpoints.
- Boletín Primario: `buildMaterias()` Primario branch + rewritten `boletin-primario.hbs` (period grades + 4 final instances + imprimible competencies + PA/PPI/PP), behind a **level dispatch** so other levels are untouched.
- Reuse of Fase 3 `CompetencyValuation`/`CompetencyPeriodValuation` and `GradeScale`/`GradeScaleValue` as-is.

### Out of scope (deferred to later etapas)

- **Secundario** (Etapa 2) — reuses the same grade model; built next, ideally with zero new grade tables (see Approach).
- **Inicial** (Etapa 3) — qualitative INFORMES per period; different paradigm.
- **Terciario** (Etapa 4) — per period two grades (TP + Final), Final retakeable up to 3×.
- Retirement/migration of legacy `CalificacionPrimario` / `NotaTrimestral` (kept, deprecated, retired only once all levels migrate).
- Refactoring Fase 3 `CompetencyPeriodValuation` off its live period FK (accepted debt — see Risks).

## Approach (architectural shape + recommendations on open questions)

### New grade entities — level-agnostic, type-enum finals

- **`SubjectPeriodGrade`** — one row per (studentId, courseCycleId, subjectId, periodOrdinal). Carries `gradeScaleValueId` + denormalized `gradeCode` + `internalStatus`, mirroring `CompetencyPeriodValuation`'s grade columns. `periodOrdinal` (Int) + snapshotted `periodName` (String) — **no live FK** to `GradingPeriodTemplateItem`.
- **`SubjectFinalGrade`** — one row per (studentId, courseCycleId, subjectId, **type**) where `type` is an enum `{ FINAL, DICIEMBRE, MARZO, DEFINITIVA }`. Same grade columns + a `passed` boolean. **Recommendation:** model the four instances as **rows keyed by a type enum on a single table**, NOT four columns and NOT four tables — this matches the conditional lifecycle and keeps the schema flat.

**Recommendation (table naming):** use English, level-agnostic names (`SubjectPeriodGrade`, `SubjectFinalGrade`), consistent with existing modern entities (`CompetencyValuation`, `SubjectAssignment`, `GradeScale`). NOT Spanish/Primario-specific (`MateriaPrimarioNota`). Rationale: **Secundario uses the identical model** (period + Final/Dic/Marzo/Definitiva), so generic tables let Etapa 2 ship with zero new grade tables. Only Inicial and Terciario diverge.

**Recommendation (NotaDefinitiva semantics):** `DEFINITIVA` is just another `SubjectFinalGrade` row carrying the final `passed` verdict, considering whichever prior instance was approved (Final OR Diciembre OR Marzo). Diciembre and Marzo rows are **created conditionally** (only when the student did not pass the earlier instance), not eagerly scaffolded. Definitiva is filled manually when a prior instance is approved.

**Recommendation (imprimible at subject level):** subject grades and final instances **always print** in the boletín. The `imprimible` filter is a **competency-only** concept (per `CompetencyPeriodValuation`). No `imprimible` flag is added to subject grades.

### Period snapshot mechanism

Materialize the period structure (count + ordered labels) into the Primario grading context as a **copy** taken from `GradingPeriodTemplate(level,modality)` items, anchored at **Materia×Curso×Ciclo** (per the resolved decision). `SubjectPeriodGrade` carries the snapshotted `periodOrdinal` + `periodName`, so historical grading stays fixed when the plan changes in future cycles.

**Recommendation (snapshot vs live FK tension):** snapshot the **new** subject grades; leave Fase 3 `CompetencyPeriodValuation` on its existing live `periodItemId` FK **as-is (accepted debt)**. Rationale: refactoring Fase 3 is out of scope, risky, and not required for the Primario boletín to be correct on the subject-grade axis. Flagged explicitly as a known inconsistency to revisit when the period model is hardened across all levels. (Design phase to settle whether the snapshot lives on a per-CourseCycle×Subject config parent or normalizes to one snapshot per CourseCycle, since period config is uniform per level/modality within a cycle — honoring the Materia×Curso×Ciclo decision while noting the normalization option.)

### Teacher identity & assignment (option A)

- Add **`Teacher.userId`** (nullable FK to the master-DB User id) + repo `findByUserId(userId)`. This maps the JWT user to the tenant Teacher record.
- **"Alumnos por materia":** filter by `SubjectAssignment(teacherId, subjectId, courseSectionId)` → resolve `CourseCycle` via `CourseSection.courseCycles`.
- **"Alumnos por curso":** **Recommendation — add a modern `CourseCycle.homeroomTeacherId` (nullable FK to Teacher)** rather than entrenching legacy `Grado.teacherId`. Rationale: `CourseCycle` is the modern entity; `Grado` is a legacy parallel model not wired to the CourseCycle lookup. A small explicit field on `CourseCycle` gives a clean teacher↔course link without dragging `Grado` into the new flow. (Alternative considered: derive via `Grado.teacherId → Grado.courseSectionId → CourseSection → CourseCycle`. Rejected as accepted-debt-by-default — keeps a deprecated model load-bearing. Confirm with user.)

### PA/PPI/PP placement

**Recommendation — store at student × courseCycle × subject granularity** (a small dedicated flags table/parent, NOT booleans on `Enrollment`). Rationale: the legacy screens display PA/PPI/PP **per student×subject row** and the boletín renders them per subject; storing at `Enrollment` (student×cycle) would lose subject specificity that real practice uses (e.g., a PPI adaptation or assisted project that applies to some subjects and not others). Granular storage can always aggregate up; the reverse is impossible. Kept decoupled from grade rows so a flag can exist before any grade is loaded. (Exact table shape left to spec/design.)

### Entry screens (replace Fase 3b `/competency-grading`)

Reuse the Fase 3b grid infrastructure (`use-grading-grid` hook, dense-cells Map, bounded-parallel save, scale-value dropdowns) and the teacher-filtered selector. Two screens:

- **Alumnos por materia** — students × {period grades + 4 final instances + imprimible competencies}, plus a PA/PPI/PP column per student. Replaces the current page.
- **Alumnos por curso** — one student → subjects × {period grades + 4 final instances + competencies}, PA/PPI/PP per subject row. New route.

### Boletín level dispatch

`buildMaterias()` branches on `Math.floor(level / 10)`: `PRIMARIO (2)` → new-model path (reads `SubjectPeriodGrade` + `SubjectFinalGrade` + imprimible `CompetencyPeriodValuation` + PA/PPI/PP); all other levels keep the legacy `NotaTrimestral` path **unchanged**. `MateriaBoletin` gains **optional** fields (`competencies[]`, `finalGrades{}`, `pedagogicalFlags{}`) so the legacy path leaves them undefined. Rebuild `boletin-primario.hbs` with dynamic period columns; other level templates untouched.

**Recommendation (legacy retirement):** do **not** delete `CalificacionPrimario` / `NotaTrimestral` now — Secundario/Terciario boletines still read `NotaTrimestral`. Mark `@deprecated`, retire only once every level is migrated off them.

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| **Boletín regression** to Secundario/Inicial/Terciario when rewriting the Primario path. | Level dispatch in `buildMaterias()`; only the PRIMARIO branch and `boletin-primario.hbs` change. Add a regression test asserting non-Primario levels still read the legacy path. |
| **Snapshot vs live-FK inconsistency** between new subject grades (snapshot) and Fase 3 competencies (live FK). | Explicitly accepted as scoped debt; documented. Subject-grade correctness does not depend on Fase 3's FK. Revisit when period model is hardened across levels. |
| **`Teacher.userId` unpopulated** for existing teachers → empty screens. | Nullable field + backfill/admin-linking is a data task; flag that screens must handle "teacher has no userId / no assignments" gracefully (empty state, not error). |
| **Multi-tenant leakage** — new tables/queries must carry `institutionId` scoping. | Follow the existing tenant-call convention on every repo method and use case; covered by strict-TDD tests asserting tenant filtering. |
| **`CourseCycle.homeroomTeacherId` decision** could be contested (reuse `Grado` instead). | Surfaced as a confirm-before-specs decision; cheap to flip in design since it is one nullable field. |
| **Conditional final-instance lifecycle** (Diciembre/Marzo only on non-pass) could be mis-modeled as eager rows. | Recommend on-demand row creation keyed by type enum; encode the lifecycle rules in the use case with tests. |
| **PA/PPI/PP granularity** mismatch with real workflow. | Recommend the more granular student×subject×cycle; granular can aggregate, coarse cannot. Confirm with user. |

## PR slicing (refined, chained, dependency-ordered)

All strict TDD (RED→GREEN), conventional commits, scope `grading` or `pedagogy`, stacked-to-main, none > 300 lines.

| PR | Title | Est. | Depends on |
|----|-------|------|------------|
| **PR1** | Domain + schema: `SubjectPeriodGrade` + `SubjectFinalGrade` (type enum) + period **snapshot** anchor; entities, repo interfaces + Prisma impls, unit tests | ~250 | — |
| **PR2** | Domain + schema: `Teacher.userId` + `findByUserId` **and** `CourseCycle.homeroomTeacherId` (teacher↔course link); entity/repo updates, tests | ~120 | — |
| **PR3** | Domain + schema: PA/PPI/PP flags at student×courseCycle×subject; entity/VO + repo, tests | ~90 | — |
| **PR4** | API: subject-grade CRUD use cases (create/update period + final, get-by-courseCycle+subject) + teacher-filtered endpoints (`GET /course-cycles?teacherUserId=`, `GET /course-cycles/:id/subjects?teacherUserId=`); controllers, DTOs, tests | ~220 | PR1, PR2, PR3 |
| **PR5** | Web: "Alumnos por materia" screen (replaces `/competency-grading`) — teacher-filtered selector, students × {periods + 4 finals + imprimible competencies}, PA/PPI/PP column | ~300 | PR4 |
| **PR6** | Web: "Alumnos por curso" screen (new route) — student picker, subjects × {periods + 4 finals + competencies}, PA/PPI/PP per subject row | ~250 | PR4 |
| **PR7** | API + template: boletín Primario — `buildMaterias()` PRIMARIO branch + extend `MateriaBoletin` (optional fields) + rebuild `boletin-primario.hbs` (dynamic periods, competencies, finals, flags); tests incl. non-Primario regression | ~220 | PR1, PR3 |

**Dependency DAG:** `PR1, PR2, PR3` are independent foundation slices → `PR4` → (`PR5`, `PR6`); `PR1 + PR3` → `PR7`.
**Total:** ~1450 lines across 7 PRs. Refinement vs exploration's plan: folded the teacher↔course link (`CourseCycle.homeroomTeacherId`) into PR2, and the period snapshot anchor into PR1.

## Decisions to confirm before specs

1. **Teacher↔course link:** add modern `CourseCycle.homeroomTeacherId` (recommended) vs reuse legacy `Grado.teacherId`.
2. **PA/PPI/PP granularity:** student×courseCycle×subject (recommended) vs student×cycle on `Enrollment`.
3. **Table naming:** level-agnostic `SubjectPeriodGrade`/`SubjectFinalGrade` (recommended, so Secundario reuses them) vs Primario-specific names.
4. **Snapshot anchor:** per-CourseCycle×Subject config parent (honors the resolved Materia×Curso×Ciclo decision) vs normalized one-per-CourseCycle.
