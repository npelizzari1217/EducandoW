# Spec: PA/PPI/PP Pedagogical Flags

> Capability area: per-period pedagogical condition flags per (student, courseCycle, subject, period)
> Change: grading-primario · Fase 4, Etapa 1
> IDs: PPF-R* / PPF-S*

## Purpose

Define what MUST be true after this change regarding the three pedagogical condition flags:
- **PA** — Proyecto Asistido
- **PPI** — Proyecto Pedagógico Individual (disability-related adaptation)
- **PP** — Proyecto en Proceso

Granularity (corrected from proposal): flags are stored per
`(institutionId, studentId, courseCycleId, subjectId, periodOrdinal)`.
They MAY differ subject-to-subject and period-to-period within the same cycle.

## Requirements

### PPF-R1 — Flag tuple

A `PedagogicalFlag` record MUST carry three independent boolean fields
`{ pa: Boolean, ppi: Boolean, pp: Boolean }` keyed by the unique tuple
`(institutionId, studentId, courseCycleId, subjectId, periodOrdinal)`.
At most one row per tuple exists.

#### PPF-S1 — Save PA=true for a specific subject+period

- GIVEN a valid (studentId, courseCycleId, subjectId, periodOrdinal) tuple
- WHEN a request sets pa=true, ppi=false, pp=false
- THEN response is HTTP 200 with `{ data: { id, studentId, courseCycleId, subjectId,
  periodOrdinal, pa: true, ppi: false, pp: false } }`

---

### PPF-R2 — Per-period independence

A flag for period 1 is INDEPENDENT of the flag for period 2 for the same
student+subject. Setting PPI=true in period 2 MUST NOT alter the period 1 row.

#### PPF-S2 — Period 2 flag does not affect period 1

- GIVEN student A, subject "Lengua", period 1: ppi=false
- WHEN ppi=true is set for the same student+subject, period 2
- THEN period 1 row remains ppi=false; period 2 row has ppi=true

---

### PPF-R3 — Per-subject independence

A flag for subject "Matemática" is INDEPENDENT of the flag for "Lengua" for the same
student+period. Changing a flag for one subject MUST NOT alter another.

#### PPF-S3 — Subject isolation

- GIVEN student B, period 1: "Matemática" has pa=true, "Lengua" has pa=false
- WHEN "Lengua" pa is set to true for period 1
- THEN "Matemática" pa for period 1 remains true unchanged

---

### PPF-R4 — Each flag independently toggleable

Within a single row, each of the three flags (pa, ppi, pp) can be set or cleared
independently. A request that sets only `pp=true` MUST NOT alter `pa` or `ppi`
unless they are explicitly included in the request body.
Omitted fields in a PATCH/upsert retain their existing values.

#### PPF-S4 — Partial update preserves other flags

- GIVEN a row with pa=true, ppi=false, pp=false
- WHEN a request sets only pp=true (pa and ppi not included)
- THEN resulting row has pa=true, ppi=false, pp=true

---

### PPF-R5 — Flags are independent of grade rows

A `PedagogicalFlag` row MAY exist even if no `SubjectPeriodGrade` row exists for the
same tuple. Flags and grades are decoupled; saving a flag does NOT require a grade to
have been entered first.

#### PPF-S5 — Flag saved before any grade

- GIVEN no SubjectPeriodGrade exists for student C, subject S, period 1
- WHEN ppi=true is set for that tuple
- THEN response is HTTP 200; the flag row is saved successfully

---

### PPF-R6 — Upsert semantics

Submitting flags for an existing `(institutionId, studentId, courseCycleId, subjectId,
periodOrdinal)` MUST overwrite (upsert) that row. No duplicate rows are created.

#### PPF-S6 — Re-save overwrites

- GIVEN a row with pa=true, ppi=false, pp=false
- WHEN the same tuple is submitted with pa=false
- THEN one row exists with pa=false

---

### PPF-R7 — Period ordinal bounds

The `periodOrdinal` MUST be within the valid range of the snapshotted period structure
for the given `courseCycleId×subjectId`. Out-of-range ordinals → HTTP 400.

#### PPF-S7 — Out-of-range periodOrdinal rejected

- GIVEN a CourseCycle×Subject snapshotted with 3 periods (ordinals 1–3)
- WHEN a flag is submitted with periodOrdinal = 0
- THEN response is HTTP 400

---

### PPF-R8 — Not-found references

References to non-existent `studentId`, `courseCycleId`, or `subjectId`
within the institution → HTTP 404.

#### PPF-S8 — Non-existent courseCycleId returns 404

- GIVEN a courseCycleId that does not exist in the institution
- WHEN a flag is submitted
- THEN response is HTTP 404

---

### PPF-R9 — Multi-tenant scoping

ALL reads and writes MUST be scoped by `institutionId` from the JWT.
Cross-tenant access → HTTP 404.

#### PPF-S9 — Cross-tenant isolation

- GIVEN studentId X belongs to institution A
- WHEN institution B's JWT submits a flag for studentId X
- THEN response is HTTP 404

---

### PPF-R10 — Bulk read by courseCycle + subject

`GET /pedagogical-flags?courseCycleId=:id&subjectId=:id` MUST return all
`PedagogicalFlag` rows for all students and all periods in that subject+courseCycle,
wrapped in `{ data: [...] }`.

#### PPF-S10 — GET returns all rows per subject

- GIVEN 3 students with flag rows across 2 periods for subject "Ciencias"
- WHEN GET is called for that courseCycle+subject
- THEN response is `{ data: [6 or fewer rows — only rows that exist] }`

---

### PPF-R11 — Missing required fields → 400

A request body missing `studentId`, `courseCycleId`, `subjectId`, or `periodOrdinal`
MUST return HTTP 400.

#### PPF-S11 — Missing periodOrdinal rejected

- GIVEN a request body without periodOrdinal
- WHEN submitted
- THEN response is HTTP 400
