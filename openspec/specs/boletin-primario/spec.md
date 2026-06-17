# Spec: Boletín Primario

> Capability area: Primario report card rendered from the new grade model
> Change: grading-primario · Fase 4, Etapa 1
> IDs: BP-R* / BP-S*

## Purpose

Define what MUST be true after this change regarding the generation and rendering of
the Primario boletín. A level-dispatch in `buildMaterias()` routes Primario students
through the new model path; all other levels remain on the legacy path unchanged.

## Requirements

### BP-R1 — Level dispatch in buildMaterias()

When generating a boletín, `buildMaterias()` MUST branch on whether the CourseCycle
level is Primario (`Math.floor(level / 10) === 2`).
The Primario branch reads from `SubjectPeriodGrade`, `SubjectFinalGrade`,
`CompetencyPeriodValuation` (imprimible=true only), and `PedagogicalFlag`.
All other levels use the existing `NotaTrimestral`-based path.

#### BP-S1 — Primario boletín reads new model

- GIVEN a student enrolled in a Primario CourseCycle (level = 20)
- WHEN the boletín use case is called for that student
- THEN `buildMaterias()` uses the new Primario branch and returns data sourced
  from SubjectPeriodGrade, SubjectFinalGrade, imprimible CompetencyPeriodValuation,
  and PedagogicalFlag

---

### BP-R2 — Non-Primario levels unaffected (regression requirement)

Calling the boletín use case for Secundario or Terciario level students
MUST produce output identical to the pre-change behavior.
The legacy `NotaTrimestral` path MUST NOT be modified by this change.

> **Update (informe-avance-inicial · 2026-06-17):** Inicial students are no longer
> in the legacy path. They route to `buildMateriasInicial` (reads `InformeEvolutivo`).
> See `openspec/specs/boletin-inicial/spec.md` for Inicial boletín requirements.

#### BP-S2 — Secundario boletín still uses legacy path

- GIVEN a student enrolled in a Secundario CourseCycle (level = 30)
- WHEN the boletín use case is called
- THEN `buildMaterias()` uses the legacy NotaTrimestral path and the output is
  identical to what it produced before this change was introduced

#### BP-S3 — Inicial boletín uses InformeEvolutivo path (updated)

> **Changed in informe-avance-inicial (2026-06-17).** Inicial no longer uses the
> legacy NotaTrimestral path. See `openspec/specs/boletin-inicial/spec.md`.

- GIVEN a student enrolled in an Inicial CourseCycle (level = 10..19)
- WHEN the boletín use case is called
- THEN `buildMaterias()` routes to `buildMateriasInicial` (InformeEvolutivo path)
- AND the legacy `NotaTrimestral` query is NOT executed for this student

---

### BP-R3 — Dynamic period columns in boletin-primario.hbs

`boletin-primario.hbs` MUST render subject period columns dynamically from the
snapshotted `periodName` values. It MUST NOT contain hardcoded period labels such as
"1° Trim", "2° Trim", "3° Trim".

#### BP-S4 — Period columns use snapshotted names

- GIVEN a Primario CourseCycle snapshotted with periods ["1° Bimestre", "2° Bimestre",
  "3° Bimestre", "4° Bimestre"]
- WHEN the boletín is rendered
- THEN the column headers read "1° Bimestre", "2° Bimestre", "3° Bimestre", "4° Bimestre"
  (not "1° Trim", "2° Trim", "3° Trim")

---

### BP-R4 — Four final grade instances rendered

`boletin-primario.hbs` MUST render the four final grade instances
(FINAL, DICIEMBRE, MARZO, DEFINITIVA) as distinct labeled cells per subject row.
An instance with no row in `SubjectFinalGrade` renders as blank/empty — not an error.

#### BP-S5 — All four instances shown; absent ones blank

- GIVEN a student with FINAL = "A" and DICIEMBRE = "B" for subject "Matemática"
  and no MARZO or DEFINITIVA rows
- WHEN the boletín is rendered
- THEN FINAL and DICIEMBRE show their grades; MARZO and DEFINITIVA cells are blank

---

### BP-R5 — Imprimible competencies rendered as per-period columns

`boletin-primario.hbs` MUST render only competencies where at least one
`CompetencyPeriodValuation` has `imprimible = true`. Competencies where all
period valuations have `imprimible = false` MUST NOT appear.

For each included competency, grades MUST be displayed **per period column**
(one column per boletín period, aligned with the subject period-grade columns).
A period where the competency's valuation has `imprimible = false` renders as
blank (`—`), not the grade. The column structure mirrors the subject period-grade
grid — dynamic, not hardcoded.

The per-period logic lives exclusively in `buildMateriasPrimario` (use case).
The template only renders the `periodGrades` array it receives.

> **W2 decision (2026-06-10):** original implementation collapsed each competency
> to the grade of the *first* imprimible period. Replaced with full per-period
> columns so the layout matches the subject grade grid.

#### BP-S6 — Non-imprimible competencies excluded

- GIVEN subject "Lengua" has 4 competencies, 2 with imprimible=true in at least one period and 2 with imprimible=false in all periods
- WHEN the boletín is rendered
- THEN only the 2 imprimible competencies appear; the other 2 are absent

#### BP-S6b — Competency grades shown per imprimible period (W2)

- GIVEN subject "Matemática" has competency "Resolución de problemas" with 3 period columns
  where period 1 and period 3 have `imprimible=true` and period 2 has `imprimible=false`
- WHEN the boletín is rendered
- THEN the competency row shows grades for period 1 and period 3, and a blank (`—`) for period 2

---

### BP-R6 — PA/PPI/PP flags rendered per subject+period

`boletin-primario.hbs` MUST render the PA, PPI, and PP flags per subject per period.
A flag that is `false` MUST NOT print (only truthy flags are shown).

#### BP-S7 — True flags print; false flags do not

- GIVEN subject "Educación Física": period 1 has PA=true, PPI=false, PP=false
- WHEN the boletín is rendered
- THEN "PA" label appears in the period 1 cell for that subject; PPI and PP do not

#### BP-S8 — All flags false → nothing printed

- GIVEN all PA/PPI/PP flags are false for a student's subject
- WHEN the boletín is rendered
- THEN no flag labels appear for that subject row

---

### BP-R7 — MateriaBoletin optional fields

The `MateriaBoletin` interface MUST gain optional fields:
- `competencies?: CompetencyBoletinEntry[]`
- `finalGrades?: Partial<Record<SubjectFinalGradeType, FinalGradeBoletinEntry>>`
- `pedagogicalFlags?: PedagogicalFlagsBoletinEntry[]`

The legacy path populates none of these fields; their absence MUST NOT cause rendering
errors in non-Primario templates.

#### BP-S9 — Non-Primario template renders without optional fields

- GIVEN a MateriaBoletin produced by the legacy (non-Primario) path
  with no competencies, no finalGrades, no pedagogicalFlags
- WHEN rendered by any non-Primario template
- THEN no rendering error occurs and output is unchanged

---

### BP-R8 — Multi-tenant scoping

The Primario boletín use case MUST scope all data queries to the `institutionId`
associated with the student's enrollment. Cross-tenant data access → error or empty.

#### BP-S10 — Boletín queries scoped to institution

- GIVEN a student in institution A
- WHEN the boletín is generated for that student
- THEN SubjectPeriodGrade, SubjectFinalGrade, and PedagogicalFlag queries are filtered
  by institutionId = A; no data from institution B appears

---

### BP-R9 — Complete boletín includes all sections

A Primario boletín for a student with full data MUST include:
period grade columns, all four final instances, imprimible competency sections,
and PA/PPI/PP flags — in a single rendered document.

#### BP-S11 — Full boletín renders all sections

- GIVEN a Primario student with period grades in 3 periods, FINAL + DEFINITIVA rows,
  2 imprimible competencies, and PA=true in period 2 for subject "Matemática"
- WHEN the boletín is generated and rendered
- THEN the output contains: period grade cells, FINAL/DEFINITIVA values, competency
  rows (imprimible only), and a PA flag indicator for period 2 — all in one document
