# Spec: Boletín Secundario

> Capability area: Secundario report card rebuilt on the new grade model
> Change: grading-secundario · Fase 4, Etapa 2
> Basis: NEW — replaces the legacy NotaTrimestral read path for level-3 students
> IDs: BSS-R* / BSS-S*

## Purpose

Define what MUST be true after this change regarding the generation and rendering of
the Secundario boletín. The level dispatch in `buildMaterias()` gains a Secundario
branch (`Math.floor(level / 10) === 3`) that reads from the modern grade models.
Non-Primario/non-Secundario levels (Terciario, Inicial) keep the legacy
`NotaTrimestral` path byte-for-byte unchanged.

## Requirements

### BSS-R1 — Level dispatch routes level-3 students to the new branch (NEW)

When generating a boletín, `buildMaterias()` MUST branch on
`Math.floor(level / 10) === 3` for Secundario.
The Secundario branch reads from:
- `SubjectPeriodGrade` (period grades per subject)
- `SubjectFinalGrade` including the `condicion` field (4 typed finals + condición)
- `CompetencyValuation` filtered by `imprimible = true` (competency section)
- `MateriaPreviaHistórica` for the student (previas section)

All other levels continue on the legacy `NotaTrimestral`-based path.

#### BSS-S1 — Secundario boletín reads new model

- GIVEN a student enrolled in a Secundario CourseCycle (level = 30)
- WHEN the boletín use case is called for that student
- THEN `buildMaterias()` uses the Secundario branch and returns data sourced from
  SubjectPeriodGrade, SubjectFinalGrade (with condicion), imprimible CompetencyValuation,
  and MateriaPreviaHistórica

---

### BSS-R2 — Terciario and Inicial use legacy path unchanged (regression requirement)

Calling the boletín use case for Terciario (`Math.floor(level / 10) === 4`) or
Inicial (`Math.floor(level / 10) === 1`) students MUST produce output identical to
the pre-change behavior. The legacy `NotaTrimestral` path MUST NOT be modified by
this change.

#### BSS-S2 — Terciario boletín still uses legacy NotaTrimestral path

- GIVEN a student enrolled in a Terciario CourseCycle (level = 40)
- WHEN the boletín use case is called
- THEN `buildMaterias()` uses the legacy NotaTrimestral path;
  output is identical to what it produced before this change was introduced

#### BSS-S3 — Primario boletín unaffected

- GIVEN a student enrolled in a Primario CourseCycle (level = 20)
- WHEN the boletín use case is called
- THEN the Primario branch (Math.floor(level/10) === 2) is used unchanged;
  no regression in Primario output

---

### BSS-R3 — Dynamic per-trimester columns in boletin-secundario.hbs (NEW)

`boletin-secundario.hbs` MUST render subject period grade columns dynamically from
the snapshotted `periodName` values stored on `SubjectPeriodGrade`. It MUST NOT
contain hardcoded period labels such as "1° Trim" or "2° Trim".
If a student has no period grade for a given column, that cell renders blank.

#### BSS-S4 — Period column headers use snapshotted period names

- GIVEN a Secundario CourseCycle snapshotted with periods
  ["1° Trimestre", "2° Trimestre", "3° Trimestre"]
- WHEN the boletín is rendered
- THEN the column headers read "1° Trimestre", "2° Trimestre", "3° Trimestre"
  (not hardcoded labels)

#### BSS-S5 — Absent period grade renders blank cell

- GIVEN student A has a period grade in trimesters 1 and 2 but no grade in trimester 3
- WHEN the boletín is rendered
- THEN the trimester 3 cell for that subject is blank; no error or null text

---

### BSS-R4 — Four final grade instances rendered (NEW)

`boletin-secundario.hbs` MUST render the four final instances
(FINAL, DICIEMBRE, MARZO, DEFINITIVA) as distinct labeled cells per subject row.
An instance with no row in `SubjectFinalGrade` renders as blank — not an error.

#### BSS-S6 — All four instances rendered; absent ones blank

- GIVEN student A has FINAL = "7" and DICIEMBRE = "5" for subject "Matemática"
  and no MARZO or DEFINITIVA rows
- WHEN the boletín is rendered
- THEN FINAL and DICIEMBRE show their values; MARZO and DEFINITIVA cells are blank

---

### BSS-R5 — Condición column per subject row (NEW)

`boletin-secundario.hbs` MUST render a condición column per subject row.
REGULAR, PREVIA, and LIBRE render as distinct labels. NULL condicion renders blank.
(Spec COND-R6 covers the individual scenario details; this requirement locks the
template-level rendering obligation.)

#### BSS-S7 — Condición column present for each subject

- GIVEN 4 subjects with condicion values: REGULAR, PREVIA, LIBRE, NULL
- WHEN the boletín is rendered
- THEN each subject row shows the correct condición label;
  the NULL row shows a blank cell

---

### BSS-R6 — Only imprimible=true competencies rendered (REUSED)

`boletin-secundario.hbs` MUST render only CompetencyValuation rows where
`imprimible = true`. Competencies with `imprimible = false` MUST NOT appear.
(Same rule as boletin-primario.hbs; CSEC-R4 covers individual scenarios.)

#### BSS-S8 — Non-imprimible competencies excluded from boletín

- GIVEN subject "Historia" has 3 CompetencyValuation rows: 2 imprimible=true, 1 imprimible=false
- WHEN the boletín is rendered
- THEN only the 2 imprimible competencies appear; the third is absent

---

### BSS-R7 — Previas section rendered (NEW)

`boletin-secundario.hbs` MUST include a materias previas section listing all
MateriaPreviaHistórica records for the student, grouped by yearOwed ascending.
A student with no previas renders an empty section without error.
(MP-R8 covers individual previas scenarios; this requirement locks the template
obligation.)

#### BSS-S9 — Previas section present and populated for student with previas

- GIVEN student A has previas: 2023/"Matemática"/PENDIENTE, 2024/"Inglés"/REGULARIZADA
- WHEN the boletín is rendered
- THEN the previas section shows both records in year-ascending order with
  their respective statuses

---

### BSS-R8 — Complete Secundario boletín includes all sections (NEW)

A Secundario boletín for a student with full data MUST include all five sections
in a single rendered document:
(1) per-trimester period grade columns,
(2) four final grade instances,
(3) condición per subject,
(4) imprimible competency section, and
(5) materias previas section.

#### BSS-S10 — Full boletín renders all five sections

- GIVEN a Secundario student with:
  period grades in 3 trimesters, FINAL = "8" and DEFINITIVA = "8" for subject "Lengua",
  condicion = REGULAR for "Lengua", 2 imprimible competencies in subject "Biología",
  and 1 previa (2023/"Historia"/PENDIENTE)
- WHEN the boletín is generated and rendered
- THEN the output contains: period grade cells, FINAL/DEFINITIVA values,
  REGULAR condición label, 2 competency rows (imprimible), and the previa entry —
  all in one document

---

### BSS-R9 — Multi-tenant scoping (REUSED)

The Secundario boletín use case MUST scope all data queries to the `institutionId`
associated with the student's enrollment. Cross-tenant data access → error or empty.

#### BSS-S11 — Boletín queries scoped to institution

- GIVEN student A belongs to institution I
- WHEN the boletín is generated for student A
- THEN SubjectPeriodGrade, SubjectFinalGrade, CompetencyValuation, and
  MateriaPreviaHistórica queries are all filtered by institutionId = I;
  no data from any other institution appears
