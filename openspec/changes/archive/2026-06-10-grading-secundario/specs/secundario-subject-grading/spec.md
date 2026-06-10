# Spec: Secundario Subject Grading

> Capability area: period grades + final grades on level-3 CourseCycles
> Change: grading-secundario · Fase 4, Etapa 2
> Basis: REUSED — extends SPG/SFG/SFG foundation from grading-primario (Fase 4, Etapa 1)
> IDs: SSG-R* / SSG-S*

## Purpose

Define what MUST be true after this change regarding grade capture and retrieval for
Secundario students. Secundario grading runs on the same level-agnostic
`SubjectPeriodGrade` / `SubjectFinalGrade` / `SubjectGradingPeriod` foundation as
Primario. This spec documents the Secundario-specific constraints that layer on top of
the inherited SPG and SFG requirements (which remain in force and are NOT repeated here).

## Requirements

### SSG-R1 — Level-3 CourseCycles use the existing upsert use cases (REUSED)

`UpsertSubjectPeriodGrades` and `UpsertSubjectFinalGrades` MUST accept grades for
CourseCycles where `Math.floor(level / 10) === 3`. No new grade tables are created.
The seeded `gs-secundaria` scale (level = 3, numeric codes 1–10) and the seeded
`gpt-secundaria-trimestral` template (level = 3, 3 periods) supply the configuration
without any new migrations.

#### SSG-S1 — Period grade accepted for a Secundario CourseCycle

- GIVEN a CourseCycle with level = 30 (Secundario)
  and a gradeScaleValueId belonging to gs-secundaria (numeric code, e.g. "7")
  and a valid enrolled studentId
- WHEN a period grade upsert is submitted
- THEN response is HTTP 200 with `{ data: { id, studentId, courseCycleId, subjectId,
  periodOrdinal, periodName, gradeScaleValueId, gradeCode, internalStatus } }`

---

### SSG-R2 — gs-secundaria scale enforced for level-3 grades (REUSED)

The `gradeScaleValueId` MUST belong to `gs-secundaria` (numeric 1–10). A value from a
different level's scale → HTTP 400.

#### SSG-S2 — Primario alphanumeric scale value rejected for Secundario

- GIVEN a gradeScaleValueId belonging to the Primario scale (level = 2, alphanumeric)
- WHEN submitted for a Secundario CourseCycle
- THEN response is HTTP 400

#### SSG-S3 — Grade code "10" valid for Secundario

- GIVEN gradeCode = "10" from gs-secundaria
- WHEN submitted for a Secundario CourseCycle, subject "Historia", period 1
- THEN response is HTTP 200 and the saved row carries gradeCode = "10"

---

### SSG-R3 — Trimester period structure from gpt-secundaria-trimestral (REUSED)

Secundario CourseCycles MUST snapshot their period structure from
`gpt-secundaria-trimestral` (3 trimesters). Period ordinals 1–3 are valid;
out-of-range ordinals → HTTP 400. Period names are snapshotted at first write for
each CourseCycle×Subject and are immutable thereafter (inherits SPG-R2 invariant).

#### SSG-S4 — Snapshotted period name correct for trimester template

- GIVEN a Secundario CourseCycle whose period plan is gpt-secundaria-trimestral
- WHEN a grade is submitted with periodOrdinal = 3
- THEN response is HTTP 200 and the row carries the snapshotted periodName for
  trimester 3 (e.g., "3° Trimestre")

#### SSG-S5 — Period ordinal 4 rejected for trimestral Secundario

- GIVEN a Secundario CourseCycle snapshotted with 3 periods (ordinals 1–3)
- WHEN a grade is submitted with periodOrdinal = 4
- THEN response is HTTP 400

---

### SSG-R4 — Four final grade instances available for Secundario (REUSED)

The four typed final instances (FINAL, DICIEMBRE, MARZO, DEFINITIVA) on
`SubjectFinalGrade` MUST be available for Secundario students. All SFG invariants
(lifecycle enforcement, upsert, multi-tenant scoping, bulk read, passed boolean on
DEFINITIVA) apply unchanged. Condición (COND-R*) is a separate concern layered on top.

#### SSG-S6 — FINAL grade persisted for a Secundario subject

- GIVEN a Secundario student, type = FINAL, gradeScaleValueId from gs-secundaria (code "6")
- WHEN the final grade is submitted
- THEN response is HTTP 200 with `{ data: { ..., type: "FINAL", gradeCode: "6" } }`

#### SSG-S7 — DICIEMBRE blocked when FINAL passed (Secundario)

- GIVEN a Secundario student with a FINAL row where passed = true for subject "Matemática"
- WHEN a DICIEMBRE grade is submitted for the same student/subject
- THEN response is HTTP 400 (inherits SFG-R3 conditional lifecycle rule)

---

### SSG-R5 — Multi-tenant scoping (REUSED)

All Secundario grade reads and writes MUST be scoped by `institutionId` from the JWT.
Cross-tenant access → HTTP 404. Inherits SPG-R7 and SFG-R9 without modification.

#### SSG-S8 — Cross-tenant Secundario grade rejected

- GIVEN a Secundario CourseCycle belonging to institution A
- WHEN institution B's JWT submits a period grade for that CourseCycle
- THEN response is HTTP 404
