# Spec: Materias Previas Históricas

> Capability area: carry-over academic debt per student per year
> Change: grading-secundario · Fase 4, Etapa 2
> Basis: NEW — no equivalent in grading-primario
> IDs: MP-R* / MP-S*

## Purpose

Define what MUST be true after this change regarding the tracking and reporting of
materias previas históricas — subjects a Secundario student owes from a prior school
year. This is a new entity and use case; there is no legacy model to migrate from
(fresh start). Design determines exact field names and key structure; this spec locks
the observable behavior.

## Requirements

### MP-R1 — Previa record captures the debt tuple (NEW)

A MateriaPreviaHistórica MUST record at minimum:
- The student who owes the subject (`studentId`)
- The school year the subject was owed (`yearOwed`: 4-digit integer)
- The name of the subject as it existed in that year (`subjectName`: snapshotted string)
- The resolution status (`status`: at minimum PENDIENTE and REGULARIZADA)
- The institution (`institutionId`) for multi-tenant scoping

At most one record per `(institutionId, studentId, yearOwed, subjectName)` tuple exists.
Design MAY add additional fields (e.g., examDate, notes) without violating this spec.

#### MP-S1 — Previa record created for a student

- GIVEN studentId A, yearOwed = 2024, subjectName = "Matemática"
  in institution I
- WHEN the previa is submitted via the create/upsert endpoint
- THEN response is HTTP 200 with `{ data: { id, studentId, yearOwed, subjectName,
  status: "PENDIENTE", institutionId } }`

---

### MP-R2 — Status transitions: PENDIENTE → REGULARIZADA (NEW)

A previa MUST support two statuses: PENDIENTE (debt outstanding) and REGULARIZADA
(debt cleared). A previa is created as PENDIENTE by default. A teacher or admin
MUST be able to update a previa's status to REGULARIZADA without deleting the record
(history is preserved).

#### MP-S2 — Previa created with PENDIENTE status

- GIVEN a new previa upsert without an explicit status field
- WHEN created
- THEN the record has status = PENDIENTE

#### MP-S3 — Previa marked as REGULARIZADA

- GIVEN an existing previa with status = PENDIENTE
- WHEN the status is updated to REGULARIZADA
- THEN response is HTTP 200 with `{ data: { ..., status: "REGULARIZADA" } }`
  and the original record is updated (not a new row)

---

### MP-R3 — Upsert semantics for previas (NEW)

Submitting a previa for an existing `(institutionId, studentId, yearOwed, subjectName)`
tuple MUST overwrite (upsert) the existing record, not create a duplicate.

#### MP-S4 — Duplicate tuple upserts existing record

- GIVEN a previa for studentId A, yearOwed = 2024, subjectName = "Historia"
  already exists with status = PENDIENTE
- WHEN the same tuple is submitted with status = REGULARIZADA
- THEN exactly one record exists with status = REGULARIZADA

---

### MP-R4 — List previas by student (NEW)

A read endpoint MUST return all MateriaPreviaHistórica records for a given
`(institutionId, studentId)`, ordered by `yearOwed` ascending.
All statuses (PENDIENTE and REGULARIZADA) are returned; the caller filters if needed.

#### MP-S5 — List returns all previas for a student across years

- GIVEN studentId A has 3 previas: 2 from yearOwed = 2023 and 1 from yearOwed = 2024
- WHEN previas are listed for studentId A
- THEN response is `{ data: [3 rows] }` ordered 2023 entries first, then 2024

#### MP-S6 — List returns empty array when student has no previas

- GIVEN studentId B has no previa records
- WHEN previas are listed for studentId B
- THEN response is `{ data: [] }` with no error

---

### MP-R5 — Invalid status value rejected (NEW)

An unknown status value (anything other than PENDIENTE, REGULARIZADA, or absence/null)
MUST return HTTP 400.

#### MP-S7 — Unknown status value rejected

- GIVEN status = "APROBADA" in the request body
- WHEN submitted
- THEN response is HTTP 400

---

### MP-R6 — Not-found references → 404 (NEW)

References to non-existent `studentId` within the institution → HTTP 404.

#### MP-S8 — Non-existent studentId returns 404

- GIVEN a studentId that does not belong to the institution
- WHEN a previa is submitted for that student
- THEN response is HTTP 404

---

### MP-R7 — Multi-tenant scoping (NEW)

ALL reads and writes for materias previas MUST be scoped by `institutionId` from
the JWT. A previa belonging to a different institution MUST NOT be returned or
modified.

#### MP-S9 — Cross-tenant previas not accessible

- GIVEN studentId X and their previas belong to institution A
- WHEN institution B's JWT requests previas for studentId X
- THEN response is `{ data: [] }` (no cross-tenant data leaked)

---

### MP-R8 — Previas section rendered on boletín Secundario (NEW)

`boletin-secundario.hbs` MUST include a materias previas section that lists all
MateriaPreviaHistórica records for the student being printed, grouped by `yearOwed`.
Each row shows at minimum: `subjectName`, `yearOwed`, and `status`. Records with
status = REGULARIZADA MUST be visually distinguishable from PENDIENTE records.
A student with no previas MUST render the section as empty (no rows) without error.

#### MP-S10 — Previas section shows PENDIENTE and REGULARIZADA rows

- GIVEN studentId A has: 2023/"Matemática"/PENDIENTE, 2023/"Inglés"/REGULARIZADA
- WHEN the boletín is rendered
- THEN the previas section shows both rows, with "Matemática" marked as pending
  and "Inglés" marked as regularized; both under the "2023" group

#### MP-S11 — No previas renders empty previas section without error

- GIVEN studentId B has no previa records
- WHEN the boletín is rendered
- THEN the previas section exists in the document but contains no rows;
  no error or placeholder text (such as "null") is shown

#### MP-S12 — Multiple years grouped in order

- GIVEN studentId A has previas from yearOwed = 2022, 2023, and 2024
- WHEN the boletín is rendered
- THEN previas are grouped by year, ordered 2022 → 2023 → 2024

---

### MP-R9 — No legacy migration (NEW)

Materias previas are entered from scratch (fresh start). The system MUST NOT
attempt to migrate or read from `CalificacionSecundario` or `NotaTrimestral`
to populate previas. All previa records originate from the new entity's write path.
