# Spec: Condición — REGULAR / PREVIA / LIBRE

> Capability area: explicit condición enum on SubjectFinalGrade for Secundario
> Change: grading-secundario · Fase 4, Etapa 2
> Basis: NEW — not present in grading-primario
> IDs: COND-R* / COND-S*

## Purpose

Define what MUST be true after this change regarding the `condicion` field on
`SubjectFinalGrade`. Secundario requires a three-way explicit classification:
REGULAR (on-track/passed), PREVIA (academic debt from this year), and LIBRE
(absent beyond the regulatory threshold). LIBRE cannot be derived from any
computed field — it MUST be set explicitly by the teacher. This capability
adds one nullable column via a single Prisma tenant migration.

## Requirements

### COND-R1 — condicion column on SubjectFinalGrade (NEW)

`SubjectFinalGrade` MUST gain a nullable `condicion` column of enum type
`{ REGULAR, PREVIA, LIBRE }`. The column is nullable; Primario rows and any
Secundario row where condición has not been set carry `condicion = NULL`
without error. The migration MUST be backward-compatible: no existing rows
are mutated.

#### COND-S1 — condicion persisted as REGULAR

- GIVEN a Secundario student's SubjectFinalGrade upsert with condicion = "REGULAR"
- WHEN the request is submitted
- THEN the row is saved with condicion = REGULAR
  and the response body includes `"condicion": "REGULAR"`

#### COND-S2 — condicion persisted as PREVIA

- GIVEN a Secundario student's SubjectFinalGrade upsert with condicion = "PREVIA"
- WHEN the request is submitted
- THEN the row is saved with condicion = PREVIA

#### COND-S3 — condicion persisted as LIBRE

- GIVEN a Secundario student's SubjectFinalGrade upsert with condicion = "LIBRE"
- WHEN the request is submitted
- THEN the row is saved with condicion = LIBRE

---

### COND-R2 — LIBRE is explicit — not auto-derived (NEW)

LIBRE MUST only be set when the teacher explicitly submits `condicion = "LIBRE"`.
The system MUST NOT infer LIBRE from `internalStatus`, absence counts, or any
other computed property. Omitting `condicion` from a save request leaves the
column at its current value (NULL on a new row, unchanged on an existing row).

#### COND-S4 — Omitting condicion leaves it NULL on a new row

- GIVEN a Secundario SubjectFinalGrade row that does not yet exist
- WHEN the teacher submits an upsert without the `condicion` field in the body
- THEN the row is created with condicion = NULL

#### COND-S5 — Omitting condicion on update leaves it unchanged

- GIVEN an existing Secundario SubjectFinalGrade row with condicion = REGULAR
- WHEN the teacher submits an upsert that updates gradeCode but omits `condicion`
- THEN condicion remains REGULAR

#### COND-S6 — LIBRE not auto-derived from absences

- GIVEN a Secundario student with absences exceeding the institution's threshold
- WHEN a SubjectFinalGrade is created without `condicion` in the body
- THEN condicion is NULL; no automatic LIBRE derivation occurs

---

### COND-R3 — Invalid condicion value rejected (NEW)

An unknown `condicion` value (anything other than REGULAR, PREVIA, LIBRE, or
absence/null) MUST return HTTP 400.

#### COND-S7 — Unknown enum value rejected

- GIVEN condicion = "AUSENTE" in the request body
- WHEN submitted
- THEN response is HTTP 400

---

### COND-R4 — Primario rows carry condicion null without error (NEW — backward compat)

Primario `SubjectFinalGrade` rows MUST NOT be required to carry a condicion value.
Any read of a Primario final grade MUST return `condicion: null` without raising
a validation error.

#### COND-S8 — Primario final grade response includes condicion null

- GIVEN a Primario SubjectFinalGrade row with condicion = NULL (column not set)
- WHEN the row is fetched (individually or via bulk read)
- THEN the response includes `"condicion": null` and no error occurs

---

### COND-R5 — condicion included in bulk-read response (NEW)

`GET /subject-final-grades?courseCycleId=:id&subjectId=:id` MUST include the
`condicion` field in every row of the response payload. Rows without a set
condicion return `"condicion": null`.

#### COND-S9 — Bulk read includes condicion per row

- GIVEN 5 Secundario students with FINAL rows: 3 with condicion = REGULAR,
  1 with condicion = PREVIA, 1 with condicion = NULL
- WHEN GET /subject-final-grades?courseCycleId=X&subjectId=Y is called
- THEN the response includes all 5 rows, each with its respective
  `condicion` value (REGULAR / PREVIA / null)

---

### COND-R6 — condicion rendered on boletín per subject row (NEW)

`boletin-secundario.hbs` MUST display the `condicion` value for each subject row.
REGULAR, PREVIA, and LIBRE each render as distinct labels. NULL condicion renders
as a blank cell — not an error, not a placeholder.

#### COND-S10 — REGULAR label on boletín subject row

- GIVEN subject "Matemática" has condicion = REGULAR for a Secundario student
- WHEN the boletín is rendered
- THEN a "REGULAR" label (or equivalent display string) appears in the
  condición column of the "Matemática" row

#### COND-S11 — LIBRE label on boletín subject row

- GIVEN subject "Historia" has condicion = LIBRE
- WHEN the boletín is rendered
- THEN a "LIBRE" label appears in the condición column for "Historia"

#### COND-S12 — NULL condicion renders blank on boletín

- GIVEN subject "Biología" has condicion = NULL
- WHEN the boletín is rendered
- THEN no condición label appears in the "Biología" row
  (the cell is blank, not "null" or "--")

---

### COND-R7 — Multi-tenant scoping (REUSED)

condicion is stored on `SubjectFinalGrade`, which inherits SFG-R9 multi-tenant
scoping. No additional scoping rule is needed beyond what SFG already enforces.
