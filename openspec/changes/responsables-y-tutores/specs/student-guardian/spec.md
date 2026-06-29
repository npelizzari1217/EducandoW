# Delta Spec — StudentGuardian: tutores de estudio sin cuenta + campos extendidos

> **Change**: `responsables-y-tutores`
> **Delta against**: `openspec/specs/student-guardian/spec.md` · `openspec/specs/guardian-management/spec.md`
> **Nivel pedagógico afectado**: TODOS (Inicial, Primario, Secundario, Terciario) — dato transversal de alumno/tutor.
> **RFC 2119**: MUST / SHALL / SHOULD / MAY as defined in RFC 2119.

---

## Purpose

Extend `StudentGuardian` from a portal-link-only record into a single entity that also covers contact-only study tutors (without a portal account). `userId` becomes optional; new fields (`fullName`, `mobile`, `email`, `active`, `updatedAt`) are added; `relationship` migrates from enum to free text. Two new use cases are introduced; `AssignGuardianUseCase` is preserved unchanged for portal links.

---

## Modified Behavior

The following behavior from `openspec/specs/student-guardian/spec.md` **changes**:

| Prior behavior | New behavior |
|---|---|
| `userId` REQUIRED — entity links to User | `userId` OPTIONAL — `userId != null` means "has portal access" |
| `relationship` is one of `{ mother, father, legal_guardian, other }` (enum) | `relationship` is free text, `String @db.VarChar(15)` |
| No `fullName`, `mobile`, `email`, `active`, `updatedAt` fields | All five fields added (see REQ-RYT-02) |
| `POST /v1/students/:id/guardians` requires `userId` | Same endpoint; `userId` optional when creating a study tutor |

---

## REQ-RYT-02 — Nuevos campos en StudentGuardian

`StudentGuardian` MUST include the following new fields:

| Field | Type | Default | Notes |
|---|---|---|---|
| `fullName` | `String?` (schema), required in app for study tutors | — | Required by `CreateStudyTutorUseCase`; nullable in DB to avoid breaking existing portal rows |
| `mobile` | `String?` (schema), required in app for study tutors | — | Validated as `Mobile` VO; required by `CreateStudyTutorUseCase` |
| `email` | `String?` | — | Validated as `Email` VO when present |
| `active` | `Boolean` | `true` | Defaults to active on create |
| `updatedAt` | `DateTime` (`@updatedAt`) | set by DB | MUST be set automatically on every mutation |

### Scenario RYT-02-A: Nuevos campos persisten al crear tutor de estudio

- GIVEN an ADMIN user and student `s1`
- WHEN `CreateStudyTutorUseCase` executes with `{ studentId: "s1", fullName: "Ana García", mobile: "+5492215551234", relationship: "abuela" }`
- THEN the system persists a `StudentGuardian` with `active = true`, `updatedAt` set to current time, `userId = null`
- AND returns a success Result with the created record

### Scenario RYT-02-B: updatedAt actualizados en mutación

- GIVEN a `StudentGuardian` record `sg1` with `updatedAt = T0`
- WHEN `UpdateStudyTutorUseCase` executes with any valid field change
- THEN `sg1.updatedAt` MUST be updated to a timestamp after `T0`

---

## REQ-RYT-03 — userId opcional; inferer acceso a portal

`StudentGuardian.userId` MUST be nullable. "Has portal access" MUST be inferred exclusively from `userId != null`. No discriminator field or separate model is introduced.

### Scenario RYT-03-A: Tutor de estudio sin cuenta — userId nulo

- GIVEN a `StudentGuardian` created via `CreateStudyTutorUseCase` with no `userId`
- WHEN the entity is loaded
- THEN `guardian.userId` is `null`
- AND the system MUST treat this record as a contact-only tutor (no portal access)

### Scenario RYT-03-B: Guardian con portal — userId presente

- GIVEN a `StudentGuardian` created via `AssignGuardianUseCase` with `userId = "u-tutor"`
- WHEN the entity is loaded
- THEN `guardian.userId` is `"u-tutor"`
- AND the system MUST treat this record as having portal access

---

## REQ-RYT-04 — relationship: texto libre ≤15 caracteres

`StudentGuardian.relationship` MUST be stored as `String @db.VarChar(15)`. The enum `GuardianRelationship` is removed. The application layer MUST validate that the value is non-empty and at most 15 characters. Values from the old enum (`mother`, `father`, `legal_guardian`, `other`) are all ≤15 characters and remain valid as strings.

### Scenario RYT-04-A: Valor válido aceptado

- GIVEN an ADMIN user
- WHEN `CreateStudyTutorUseCase` executes with `{ relationship: "abuela" }`
- THEN the system persists `relationship = "abuela"` and returns success

### Scenario RYT-04-B: Valor demasiado largo rechazado

- GIVEN an ADMIN user
- WHEN `CreateStudyTutorUseCase` executes with `{ relationship: "tutora_externa_x" }` (16 chars)
- THEN the system MUST return a `Result.err` with a validation error; no record is persisted

### Scenario RYT-04-C: Valor vacío rechazado

- GIVEN an ADMIN user
- WHEN `CreateStudyTutorUseCase` executes with `{ relationship: "" }`
- THEN the system MUST return a `Result.err` with a validation error

---

## REQ-RYT-05 — CreateStudyTutorUseCase (sin userId)

`CreateStudyTutorUseCase.execute()` MUST create a `StudentGuardian` without a `userId`. The application layer MUST enforce `fullName` and `mobile` as required inputs. `relationship` is optional (MAY be omitted). `isFinancialResponsible` and `isAuthorizedToPickUp` default to `false` and MUST NOT be forced by this use case. The use case MUST return `Result<StudentGuardian, DomainError>`.

### Scenario RYT-05-A: Creación exitosa de tutor de estudio

- GIVEN an ADMIN user and student `s1` exists
- WHEN `CreateStudyTutorUseCase.execute({ studentId: "s1", fullName: "Lucía Rodríguez", mobile: "+5492215559999" })`
- THEN a `StudentGuardian` is persisted with `userId = null`, `active = true`, `isFinancialResponsible = false`, `isAuthorizedToPickUp = false`
- AND `Result.isOk()` is `true`

### Scenario RYT-05-B: fullName ausente — rechazado

- GIVEN an ADMIN user and student `s1` exists
- WHEN `CreateStudyTutorUseCase.execute({ studentId: "s1", mobile: "+5492215559999" })`
- THEN the use case MUST return `Result.err` with code `FULL_NAME_REQUIRED`
- AND no record is persisted

### Scenario RYT-05-C: mobile ausente — rechazado

- GIVEN an ADMIN user and student `s1` exists
- WHEN `CreateStudyTutorUseCase.execute({ studentId: "s1", fullName: "Lucía Rodríguez" })`
- THEN the use case MUST return `Result.err` with code `MOBILE_REQUIRED`
- AND no record is persisted

### Scenario RYT-05-D: mobile con formato inválido — rechazado

- GIVEN an ADMIN user and student `s1` exists
- WHEN `CreateStudyTutorUseCase.execute({ studentId: "s1", fullName: "Lucía Rodríguez", mobile: "123" })`
- THEN `Mobile` VO construction MUST return an error
- AND the use case MUST propagate it as `Result.err`

### Scenario RYT-05-E: email opcional válido incluido

- GIVEN an ADMIN user and student `s1` exists
- WHEN `CreateStudyTutorUseCase.execute({ studentId: "s1", fullName: "Lucía Rodríguez", mobile: "+5492215559999", email: "lucia@example.com" })`
- THEN the system persists `email = "lucia@example.com"` and returns success

### Scenario RYT-05-F: email opcional inválido rechazado

- GIVEN an ADMIN user
- WHEN `CreateStudyTutorUseCase.execute({ ..., email: "not-an-email" })`
- THEN `Email` VO construction MUST return an error
- AND the use case MUST return `Result.err`; no record is persisted

---

## REQ-RYT-06 — UpdateStudyTutorUseCase

`UpdateStudyTutorUseCase.execute()` MUST allow updating `fullName`, `mobile`, `email`, `active`, and `relationship` on an existing `StudentGuardian`. The use case MUST NOT allow changing `userId`, `studentId`, `isFinancialResponsible`, or `isAuthorizedToPickUp` through this use case. The use case MUST return `Result<StudentGuardian, DomainError>`. `updatedAt` MUST be refreshed by the DB (`@updatedAt`).

### Scenario RYT-06-A: Actualización de fullName y mobile

- GIVEN a `StudentGuardian` `sg1` with `fullName = "Ana García"` and `mobile = "+5492215551234"`
- WHEN `UpdateStudyTutorUseCase.execute({ id: "sg1", fullName: "Ana G. López", mobile: "+5492215554321" })`
- THEN `sg1.fullName = "Ana G. López"` and `sg1.mobile = "+5492215554321"` are persisted
- AND `Result.isOk()` is `true`

### Scenario RYT-06-B: Toggle active a false

- GIVEN a `StudentGuardian` `sg1` with `active = true`
- WHEN `UpdateStudyTutorUseCase.execute({ id: "sg1", active: false })`
- THEN `sg1.active = false` is persisted and returned in the Result

### Scenario RYT-06-C: Tutor no encontrado

- GIVEN no `StudentGuardian` exists with `id: "sg-missing"`
- WHEN `UpdateStudyTutorUseCase.execute({ id: "sg-missing", fullName: "..." })`
- THEN the use case MUST return `Result.err` with code `GUARDIAN_NOT_FOUND` (HTTP 404)

### Scenario RYT-06-D: email nulo aceptado (borrar email)

- GIVEN a `StudentGuardian` `sg1` with `email = "old@example.com"`
- WHEN `UpdateStudyTutorUseCase.execute({ id: "sg1", email: null })`
- THEN `sg1.email` is set to `null` and the change is persisted

---

## REQ-RYT-07 — AssignGuardianUseCase preservado (portal link)

`AssignGuardianUseCase` MUST remain the designated path for creating portal links. `userId` MUST be required in this use case. Calling `AssignGuardianUseCase` with `userId = null` or `undefined` MUST return `Result.err` with code `USER_ID_REQUIRED`. This use case remains the only way to link a `User` to a `StudentGuardian`.

### Scenario RYT-07-A: Asignación con portal — userId presente

- GIVEN an ADMIN user, student `s1`, and user `u-tutor` exist
- WHEN `AssignGuardianUseCase.execute({ studentId: "s1", userId: "u-tutor", relationship: "father" })`
- THEN a `StudentGuardian` is created with `userId = "u-tutor"`
- AND `Result.isOk()` is `true`

### Scenario RYT-07-B: userId ausente — rechazado

- GIVEN an ADMIN user
- WHEN `AssignGuardianUseCase.execute({ studentId: "s1", relationship: "mother" })` (no userId)
- THEN the use case MUST return `Result.err` with code `USER_ID_REQUIRED`

---

## REQ-RYT-08 — Unicidad: DB + chequeo app

The DB MUST enforce `@@unique([studentId, userId])`. In Postgres, two rows with `userId = NULL` for the same `studentId` are NOT considered duplicates at the DB level (NULLs are distinct). The application layer MUST therefore enforce an additional uniqueness check on `(studentId, fullName)` to prevent accidental duplicate study tutors. This check MAY be bypassed by the caller by passing an explicit `allowDuplicate: true` flag (for legitimate homonyms).

### Scenario RYT-08-A: Duplicado de portal (mismo userId) rechazado por DB

- GIVEN a `StudentGuardian` already exists for `(studentId: "s1", userId: "u-tutor")`
- WHEN `AssignGuardianUseCase.execute({ studentId: "s1", userId: "u-tutor", relationship: "father" })`
- THEN the system MUST return `Result.err` with code `GUARDIAN_ALREADY_ASSIGNED` (HTTP 409)

### Scenario RYT-08-B: Duplicado de tutor (mismo fullName) bloqueado a nivel app

- GIVEN a `StudentGuardian` already exists with `(studentId: "s1", fullName: "Ana García", userId: null)`
- WHEN `CreateStudyTutorUseCase.execute({ studentId: "s1", fullName: "Ana García", mobile: "..." })` without `allowDuplicate`
- THEN the use case MUST return `Result.err` with code `TUTOR_DUPLICATE_NAME` (HTTP 409)

### Scenario RYT-08-C: Homónimos legítimos con override

- GIVEN a `StudentGuardian` already exists with `(studentId: "s1", fullName: "Ana García", userId: null)`
- WHEN `CreateStudyTutorUseCase.execute({ studentId: "s1", fullName: "Ana García", mobile: "...", allowDuplicate: true })`
- THEN the system MUST persist a second record and return success

### Scenario RYT-08-D: Múltiples tutores nulos no colisionan en DB

- GIVEN a `StudentGuardian` with `(studentId: "s1", userId: null)` already exists
- WHEN a second `StudentGuardian` with `(studentId: "s1", userId: null)` is inserted (different `fullName`)
- THEN the DB `@@unique([studentId, userId])` constraint MUST NOT fire (Postgres NULL != NULL)
- AND the insert succeeds

---

## REQ-RYT-09 — N tutores por alumno

A single student MAY have any number of `StudentGuardian` records (both with and without `userId`). There is no enforced maximum at domain or DB level.

### Scenario RYT-09-A: Alumno con múltiples tutores

- GIVEN student `s1` has no existing tutors
- WHEN three `CreateStudyTutorUseCase` calls succeed for `s1` with distinct `fullName` values
- THEN `GET /v1/students/s1/guardians` returns all three records

---

## REQ-RYT-10 — Portal familiar (get-my-children) ignora tutores sin cuenta

`GET /v1/students/my-children` MUST return only students linked to the authenticated user via `StudentGuardian` records where `userId = authenticatedUserId`. Records with `userId = null` MUST be excluded from this query.

### Scenario RYT-10-A: Tutor con portal ve sus alumnos

- GIVEN authenticated TUTOR with `userId = "u1"` linked to student `s1` via `StudentGuardian` (`userId = "u1"`)
- WHEN `GET /v1/students/my-children` is called
- THEN the response MUST include `s1`

### Scenario RYT-10-B: Tutores sin cuenta no contaminan my-children

- GIVEN student `s1` has only one `StudentGuardian` record with `userId = null` (study tutor)
- WHEN an authenticated TUTOR with `userId = "u1"` calls `GET /v1/students/my-children`
- THEN `s1` MUST NOT appear in the response (no portal link to `u1`)

---

## REQ-RYT-11 — Mobile VO nuevo

A new `Mobile` value object MUST be created in `packages/domain/src/shared/value-objects/` following the existing `Email` VO pattern. `Mobile` MUST validate that the value is a non-empty string matching a basic international phone number format. `Mobile` MUST be immutable and self-validating, returning a `Result<Mobile, ValidationError>`.

### Scenario RYT-11-A: Formato válido aceptado

- GIVEN a phone string `"+5492215551234"`
- WHEN `Mobile.create("+5492215551234")` is called
- THEN `Result.isOk()` is `true` and `mobile.get()` returns `"+5492215551234"`

### Scenario RYT-11-B: Formato inválido rechazado

- GIVEN a phone string `"abc"` (non-numeric, no country code)
- WHEN `Mobile.create("abc")` is called
- THEN `Result.isErr()` is `true` with a `MOBILE_INVALID` validation error

### Scenario RYT-11-C: Valor vacío rechazado

- GIVEN an empty string `""`
- WHEN `Mobile.create("")` is called
- THEN `Result.isErr()` is `true`

---

## REQ-RYT-12 — Listado de tutores incluye tutores sin cuenta

`GET /v1/students/:id/guardians` MUST return ALL `StudentGuardian` records for the student — both with `userId` (portal tutors) and without (study tutors). The response shape MUST include: `{ id, userId, fullName, mobile, email, relationship, isFinancialResponsible, isAuthorizedToPickUp, active, updatedAt }`.

### Scenario RYT-12-A: Lista mixta — tutores con y sin cuenta

- GIVEN student `s1` has one guardian with `userId = "u-tutor"` and one study tutor with `userId = null`
- WHEN `GET /v1/students/s1/guardians` is called with ADMIN token
- THEN HTTP 200 is returned with both records
- AND each record includes all fields defined in REQ-RYT-12

### Scenario RYT-12-B: Sólo tutores de estudio

- GIVEN student `s1` has two study tutors (both with `userId = null`)
- WHEN `GET /v1/students/s1/guardians` is called
- THEN both records are returned

---

## REQ-RYT-13 — UI: admin gestiona tutores de estudio desde el panel del alumno

The student admin panel MUST expose a section to list, create, and edit study tutors for that student. Listing MUST display: `fullName`, `mobile`, `email`, `relationship`, `active`. Create and edit MUST use the same form (split internally into `CreateStudyTutorUseCase` vs `UpdateStudyTutorUseCase`). Listing SHOULD distinguish portal-linked tutors from contact-only tutors visually (e.g., badge or icon).

### Scenario RYT-13-A: Admin lista tutores del alumno

- GIVEN an ADMIN user viewing student `s1`'s panel
- WHEN the tutor section is rendered
- THEN all `StudentGuardian` records for `s1` are displayed with `fullName`, `mobile`, `active`

### Scenario RYT-13-B: Admin crea tutor de estudio

- GIVEN an ADMIN user in the tutor creation form for student `s1`
- WHEN the ADMIN fills `fullName`, `mobile`, and submits
- THEN the form calls `POST /v1/students/s1/guardians` (no `userId`) and the new tutor appears in the list
- AND HTTP 201 is returned

### Scenario RYT-13-C: Admin edita tutor de estudio existente

- GIVEN an ADMIN user and a study tutor `sg1` for student `s1`
- WHEN the ADMIN opens the edit form, changes `mobile`, and submits
- THEN `PATCH /v1/students/s1/guardians/sg1` is called with `{ mobile: "..." }`
- AND the list reflects the updated value

### Scenario RYT-13-D: Admin desactiva tutor de estudio

- GIVEN an ADMIN user and a study tutor `sg1` with `active = true`
- WHEN the ADMIN toggles `active` off and saves
- THEN `PATCH /v1/students/s1/guardians/sg1` is called with `{ active: false }`
- AND the tutor is marked inactive in the UI

---

## REQ-RYT-14 — Pre-carga de email desde legajo cuando parentesco es padre/madre

When creating or editing a study tutor and the user selects a `relationship` that is `"father"` (padre) or `"mother"` (madre), the UI MUST pre-fill the `email` field from `Student.fatherEmail` or `Student.motherEmail` respectively. This pre-fill is an EDITABLE default — the user MAY override it before saving. The tutor's `email` and the student's `fatherEmail`/`motherEmail` MAY diverge after separate edits.

### Scenario RYT-14-A: Pre-carga email al seleccionar "padre"

- GIVEN an ADMIN user in the tutor creation form for student `s1` where `s1.fatherEmail = "padre@example.com"`
- WHEN the ADMIN selects `relationship = "father"`
- THEN the `email` field MUST be pre-filled with `"padre@example.com"`
- AND the field remains editable

### Scenario RYT-14-B: Pre-carga vacía si no hay fatherEmail

- GIVEN student `s1` has no `fatherEmail`
- WHEN the ADMIN selects `relationship = "father"`
- THEN the `email` field MUST be left empty (no pre-fill); no error raised

### Scenario RYT-14-C: Pre-carga editable — divergencia permitida

- GIVEN an ADMIN in the creation form with `s1.fatherEmail = "padre@example.com"` and `relationship = "father"` pre-filled
- WHEN the ADMIN changes `email` to `"otro@example.com"` before submitting
- THEN the system persists `email = "otro@example.com"` in `StudentGuardian`
- AND `Student.fatherEmail` remains `"padre@example.com"` (unchanged)

### Scenario RYT-14-D: Pre-carga para "mother"

- GIVEN an ADMIN user in the tutor creation form for student `s1` where `s1.motherEmail = "madre@example.com"`
- WHEN the ADMIN selects `relationship = "mother"`
- THEN the `email` field MUST be pre-filled with `"madre@example.com"`
