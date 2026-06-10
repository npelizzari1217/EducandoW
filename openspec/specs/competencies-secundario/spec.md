# Spec: Competencies in Secundario

> Capability area: competency valuations for Secundario subjects
> Change: grading-secundario · Fase 4, Etapa 2
> Basis: REUSED — extends Primario CompetencyValuation + imprimible toggle
> IDs: CSEC-R* / CSEC-S*

## Purpose

Define what MUST be true after this change regarding competency valuations for
Secundario. Secundario DOES use competencies. The Primario CompetencyValuation model,
per-cell imprimible toggle, entry-screen behavior (show all), and boletín filtering
(imprimible=true only) are reused without modification. This spec confirms Secundario
is included in the same behavior.

## Requirements

### CSEC-R1 — Competency valuations accepted for Secundario subjects (REUSED)

`CompetencyValuation` records MUST be creatable for subjects belonging to
Secundario CourseCycles (`Math.floor(level / 10) === 3`). The same
`UpsertCompetencyValuation` use case and endpoints serve Primario and Secundario.

#### CSEC-S1 — Competency valuation saved for a Secundario subject

- GIVEN a Secundario CourseCycle with subject "Biología" that has competencies defined
  and a valid gradeScaleValueId from gs-secundaria
- WHEN a CompetencyValuation upsert is submitted for studentId A,
  competencyId C, periodOrdinal 1
- THEN response is HTTP 200 with `{ data: { id, studentId, courseCycleId,
  subjectId, competencyId, periodOrdinal, gradeScaleValueId, gradeCode, imprimible } }`

---

### CSEC-R2 — imprimible toggle per competency row (REUSED)

Each `CompetencyValuation` row for a Secundario subject MUST carry an `imprimible`
boolean field that can be toggled independently per row. Setting `imprimible = true`
on one row MUST NOT affect the `imprimible` value of other rows for the same subject.

#### CSEC-S2 — imprimible toggled to true for one competency

- GIVEN subject "Biología" has 4 CompetencyValuation rows for student A, period 1,
  all with imprimible = false
- WHEN competencyId C2 is updated with imprimible = true
- THEN only competencyId C2 has imprimible = true; C1, C3, C4 remain false

---

### CSEC-R3 — Entry screen shows ALL competencies (imprimible field exposed) (REUSED)

On Secundario entry screens, ALL CompetencyValuation rows MUST be returned with the
`imprimible` field included. The entry screen MUST NOT filter by imprimible. The
imprimible field is exposed so the UI can visually distinguish rows, but ALL rows
are accessible to the teacher.

#### CSEC-S3 — All competencies visible on Secundario entry screen

- GIVEN subject "Historia" has 6 CompetencyValuation rows: 4 with imprimible = true
  and 2 with imprimible = false
- WHEN the entry screen loads the competency sub-grid for that subject
- THEN all 6 rows are returned; the 2 non-imprimible rows are present
  (they may be visually distinguished but are not hidden)

---

### CSEC-R4 — Boletín renders only imprimible=true competencies (REUSED)

`boletin-secundario.hbs` MUST render only `CompetencyValuation` rows where
`imprimible = true`. Rows with `imprimible = false` MUST NOT appear in the printed
boletín. This is the same rule as in `boletin-primario.hbs`.

#### CSEC-S4 — Non-imprimible competencies absent from Secundario boletín

- GIVEN subject "Historia" has 6 CompetencyValuation rows: 4 imprimible = true,
  2 imprimible = false
- WHEN the boletín is rendered
- THEN only the 4 imprimible competencies appear in the competency section;
  the 2 non-imprimible rows are absent

#### CSEC-S5 — All competencies imprimible=false renders empty competency section

- GIVEN all CompetencyValuation rows for subject "Educación Física" have imprimible = false
- WHEN the boletín is rendered
- THEN the competency section for that subject is empty (no rows)
  without error or placeholder text

---

### CSEC-R5 — Upsert semantics (REUSED)

Submitting a competency valuation for an existing
`(institutionId, studentId, courseCycleId, subjectId, competencyId, periodOrdinal)`
MUST overwrite (upsert) the existing row. No duplicate rows are created.

#### CSEC-S6 — Re-save overwrites existing valuation

- GIVEN a CompetencyValuation for student A, competency C, period 1 with gradeCode = "7"
- WHEN the same tuple is submitted with gradeCode = "9"
- THEN exactly one row exists with gradeCode = "9"

---

### CSEC-R6 — Multi-tenant scoping (REUSED)

All Secundario competency valuation reads and writes MUST be scoped by `institutionId`
from the JWT. Cross-tenant access → HTTP 404.

#### CSEC-S7 — Cross-tenant competency valuation rejected

- GIVEN a Secundario CourseCycle belonging to institution A
- WHEN institution B's JWT submits a CompetencyValuation for that CourseCycle
- THEN response is HTTP 404
