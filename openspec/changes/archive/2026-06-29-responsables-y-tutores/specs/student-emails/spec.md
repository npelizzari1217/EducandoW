# Delta Spec — Student: fatherEmail / motherEmail

> **Change**: `responsables-y-tutores`
> **Delta against**: `openspec/specs/student-profile/spec.md`
> **Nivel pedagógico afectado**: TODOS (Inicial, Primario, Secundario, Terciario) — dato transversal de legajo.
> **RFC 2119**: MUST / SHALL / SHOULD / MAY as defined in RFC 2119.

---

## Purpose

Add `fatherEmail` and `motherEmail` as optional legal-record fields on `Student`. These emails belong to the student's institutional file (legajo) and are independent of any tutor contact email stored in `StudentGuardian.email`.

---

## REQ-RYT-01 — fatherEmail / motherEmail on Student

`Student` MUST expose two optional email fields: `fatherEmail` and `motherEmail`. Both fields MUST be validated as `Email` VO when a value is present and MUST accept `undefined`/`null` when absent. These fields MUST NOT appear in `ALLOWED_TUTOR_FIELDS` — they are writable only by ADMIN, ROOT, or equivalent privileged roles.

### Scenario RYT-01-A: ADMIN sets fatherEmail on student

- GIVEN an ADMIN user and student `s1` with no `fatherEmail`
- WHEN `PATCH /v1/students/s1` with `{ fatherEmail: "padre@example.com" }`
- THEN the system persists `fatherEmail = "padre@example.com"` and returns HTTP 200
- AND `student.fatherEmail.get()` equals `"padre@example.com"` (Email VO)

### Scenario RYT-01-B: ADMIN sets motherEmail on student

- GIVEN an ADMIN user and student `s1` with no `motherEmail`
- WHEN `PATCH /v1/students/s1` with `{ motherEmail: "madre@example.com" }`
- THEN the system persists `motherEmail = "madre@example.com"` and returns HTTP 200

### Scenario RYT-01-C: Invalid email format rejected

- GIVEN an ADMIN user
- WHEN `PATCH /v1/students/s1` with `{ fatherEmail: "not-an-email" }`
- THEN the system MUST return HTTP 400 with a validation error describing the invalid format
- AND no mutation is applied

### Scenario RYT-01-D: STUDENT / TUTOR cannot set fatherEmail

- GIVEN a STUDENT or TUTOR user
- WHEN `PATCH /v1/students/s1` with `{ fatherEmail: "padre@example.com" }`
- THEN the system MUST return HTTP 403 (blocked field per `ALLOWED_TUTOR_FIELDS` enforcement)

### Scenario RYT-01-E: fatherEmail / motherEmail may be absent

- GIVEN a student record without `fatherEmail` and without `motherEmail`
- WHEN the student entity is constructed or reconstructed
- THEN `student.fatherEmail` returns `undefined`
- AND `student.motherEmail` returns `undefined`
- AND no validation error is raised

### Scenario RYT-01-F: Email VO reused — no new VO required

- GIVEN the existing `Email` VO in `packages/domain/src/shared/value-objects/`
- WHEN `Student.create()` or `Student.reconstruct()` receives `fatherEmail` or `motherEmail`
- THEN the system MUST use the existing `Email` VO for validation; a new VO MUST NOT be created
