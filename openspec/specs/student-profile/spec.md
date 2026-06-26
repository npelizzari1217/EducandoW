# Student Profile Specification

## Purpose

Student self-profile access and field-level permission model for PATCH. STUDENT reads own data; TUTOR reads own children; PATCH enforces per-role editable fields.

## Requirements

### Requirement: Student Self-Profile

`GET /v1/students/me` MUST return the student record whose `userId` matches the authenticated user's ID. Only users with STUDENT or TUTOR role SHALL access this endpoint. If no student exists with that `userId`, the system MUST return HTTP 404.

#### Scenario: STUDENT retrieves own profile

- GIVEN an authenticated user with STUDENT role and `userId` matching student `s1`
- WHEN `GET /v1/students/me` is called
- THEN the system returns HTTP 200 with student `s1` data including `address`, `phone`, `photoUrl`

#### Scenario: No student linked to user

- GIVEN an authenticated STUDENT user with no student record having matching `userId`
- WHEN `GET /v1/students/me` is called
- THEN the system returns HTTP 404

#### Scenario: Unauthenticated request

- GIVEN a request without a valid JWT
- WHEN `GET /v1/students/me` is called
- THEN the system returns HTTP 401

### Requirement: Tutor Children Listing

`GET /v1/students/my-children` MUST return all students linked to the authenticated user via `StudentGuardian` records. Only TUTOR role SHALL access this endpoint. If the tutor has no linked students, the system MUST return HTTP 200 with empty array.

#### Scenario: TUTOR sees their children

- GIVEN an authenticated TUTOR with `userId` linked to students `s1` and `s2` via StudentGuardian
- WHEN `GET /v1/students/my-children` is called
- THEN the system returns HTTP 200 with array containing `s1` and `s2`

#### Scenario: TUTOR with no children

- GIVEN an authenticated TUTOR with no StudentGuardian records
- WHEN `GET /v1/students/my-children` is called
- THEN the system returns HTTP 200 with `{ data: [] }`

#### Scenario: STUDENT cannot access my-children

- GIVEN an authenticated STUDENT user
- WHEN `GET /v1/students/my-children` is called
- THEN the system returns HTTP 403

### Requirement: Field-Level Patch Permissions

`PATCH /v1/students/:id` MUST validate each requested field against the caller's role before updating. STUDENT and TUTOR MAY only edit: `phone`, `address`, `photoUrl`, `email`, `birthDate`, `guardianPhone`. ADMIN, MANAGER, TEACHER, and PRECEPTOR MAY edit all fields. If any blocked field is present in the request body, the system MUST reject the entire request with HTTP 403.

#### Scenario: STUDENT edits allowed field

- GIVEN a STUDENT user with `userId` matching student `s1`
- WHEN `PATCH /v1/students/s1` with `{ phone: "2215551234" }`
- THEN the system updates `phone` and returns HTTP 200

#### Scenario: STUDENT edits blocked field

- GIVEN a STUDENT user with `userId` matching student `s1`
- WHEN `PATCH /v1/students/s1` with `{ firstName: "Nuevo" }`
- THEN the system returns HTTP 403 with a message indicating `firstName` is not editable

#### Scenario: STUDENT patches another student

- GIVEN a STUDENT user with `userId` matching student `s1`
- WHEN `PATCH /v1/students/s2` with `{ phone: "2215551234" }`
- THEN the system returns HTTP 403 — student can only patch themselves

#### Scenario: TUTOR edits child's allowed field

- GIVEN a TUTOR linked to student `s1` via StudentGuardian
- WHEN `PATCH /v1/students/s1` with `{ phone: "2215559999" }`
- THEN the system updates `phone` and returns HTTP 200

#### Scenario: TUTOR edits non-child student

- GIVEN a TUTOR NOT linked to student `s2`
- WHEN `PATCH /v1/students/s2` with `{ phone: "2215559999" }`
- THEN the system returns HTTP 403

#### Scenario: ADMIN edits any field

- GIVEN an ADMIN user
- WHEN `PATCH /v1/students/s1` with `{ firstName: "Nuevo", dni: "12345678" }`
- THEN the system updates all fields and returns HTTP 200

#### Scenario: Mixed allowed and blocked fields

- GIVEN a STUDENT user with `userId` matching student `s1`
- WHEN `PATCH /v1/students/s1` with `{ phone: "2215551234", firstName: "Nuevo" }`
- THEN the system returns HTTP 403 — blocked field `firstName` present, no fields updated

---

### Requirement: Student.institutionId typed as Id VO

`StudentProps.institutionId` MUST be typed as `Id` VO instead of `string`.
The getter `student.institutionId` MUST return `Id`.
`Student.create()` MUST accept `Id` for `institutionId` (optional — see R4).
`Student.reconstruct()` MUST accept `Id` for `institutionId`.
Existing callers that pass a pre-constructed `Id` instance SHALL continue to work.

#### Scenario: Student created with Id VO institutionId

- GIVEN a valid `Id` VO and all required student fields
- WHEN `Student.create({ ..., institutionId: Id.create("inst-uuid") })` is called
- THEN `student.institutionId.get()` returns `"inst-uuid"`

#### Scenario: Student reconstructed from persistence with Id VO

- GIVEN a persisted student record with `institutionId = "inst-uuid"`
- WHEN `Student.reconstruct({ ..., institutionId: Id.reconstruct("inst-uuid") })` is called
- THEN `student.institutionId.get()` returns `"inst-uuid"`

---

### Requirement: Teacher.institutionId typed as Id VO

`TeacherProps.institutionId` MUST be typed as `Id` VO instead of `string`.
The getter `teacher.institutionId` MUST return `Id`.
`Teacher.create()` MUST accept `Id` for `institutionId` (optional — see R4).
`Teacher.reconstruct()` MUST accept `Id` for `institutionId`.

#### Scenario: Teacher created with Id VO institutionId

- GIVEN a valid `Id` VO and all required teacher fields
- WHEN `Teacher.create({ ..., institutionId: Id.create("inst-uuid") })` is called
- THEN `teacher.institutionId.get()` returns `"inst-uuid"`

#### Scenario: Teacher reconstructed from persistence with Id VO

- GIVEN a persisted teacher record with `institutionId = "inst-uuid"`
- WHEN `Teacher.reconstruct({ ..., institutionId: Id.reconstruct("inst-uuid") })` is called
- THEN `teacher.institutionId.get()` returns `"inst-uuid"`

---

### Requirement: institutionId optional in tenant-scoped create() inputs

`Student.create()` MUST accept `institutionId` as optional (`Id | undefined`).
`Teacher.create()` MUST accept `institutionId` as optional (`Id | undefined`).
When `institutionId` is omitted, the entity is created without it (tenant DB is already scoped).
When `institutionId` is provided, it MUST be stored as an `Id` VO on the entity.
`reconstruct()` MUST keep `institutionId` required (infrastructure always has the value from DB).
`Enrollment.institutionId` is already typed as `Id` VO — no change required.

#### Scenario: Student created without institutionId

- GIVEN all required student fields, but no `institutionId`
- WHEN `Student.create({ firstName, lastName, dni })` is called
- THEN the student is created successfully
- AND `student.institutionId` is `undefined`

#### Scenario: Student created with institutionId still works

- GIVEN all required student fields and `institutionId: Id.create("inst-uuid")`
- WHEN `Student.create({ ..., institutionId })` is called
- THEN `student.institutionId?.get()` returns `"inst-uuid"`

#### Scenario: Teacher created without institutionId

- GIVEN all required teacher fields, but no `institutionId`
- WHEN `Teacher.create({ firstName, lastName, dni, email })` is called
- THEN the teacher is created successfully
- AND `teacher.institutionId` is `undefined`

#### Scenario: Teacher created with institutionId still works

- GIVEN all required teacher fields and `institutionId: Id.create("inst-uuid")`
- WHEN `Teacher.create({ ..., institutionId })` is called
- THEN `teacher.institutionId?.get()` returns `"inst-uuid"`

#### Scenario: Reconstruct always requires institutionId

- GIVEN a persisted record with a known institutionId
- WHEN `Student.reconstruct(props)` or `Teacher.reconstruct(props)` is called without `institutionId`
- THEN TypeScript compilation MUST fail (type-level enforcement, not runtime)

---

### Requirement: Student.fechaDePase — Marca de Pase por Egreso

> Added: pase-alumno-egreso (2026-06-26). Archive: `openspec/changes/archive/2026-06-26-pase-alumno-egreso/`.

`StudentProps` MUST include `fechaDePase?: Date` (optional field — `undefined` means no active pase). The pase mark is GLOBAL to the alumno (field lives on `Student`, not on `AlumnosXCursoXCiclo`), so it propagates to every course-cycle panel the student appears in.

**TypeScript contract clarification (W-3 from verify)**: at the domain layer the field uses optional/undefined semantics (`Date | undefined`). External contracts (port `setFechaDePase`, DTO `AlumnoCursoCicloItem`, Prisma) use `Date | null` / `string | null`. All callers checking for an active pase MUST use `!= null` (loose equality covers both `null` and `undefined`).

The domain `Student` entity MUST provide:

| Member | Signature | Semantics |
|--------|-----------|-----------|
| Getter | `fechaDePase: Date \| undefined` | Raw optional domain value |
| Getter | `tienePase: boolean` | `this.props.fechaDePase != null` |
| Method | `registrarPase(fecha: Date): void` | Throws `PaseFechaInvalidaError` if `fecha > now`; otherwise sets `fechaDePase` |
| Method | `revertirPase(): void` | Sets `fechaDePase = undefined`; idempotent (no error when already unset) |

`StudentRepository` port MUST declare:

```ts
setFechaDePase(studentId: string, fechaDePase: Date | null): Promise<void>;
```

Mutación puntual — mirrors `setPrintable`. Does NOT `save()` the full aggregate. The invariant still lives in the domain because the use case loads `Student`, calls `registrarPase/revertirPase`, then persists the resulting value via this method.

Domain errors introduced:
- `PaseFechaInvalidaError` — code `PASE_FECHA_INVALIDA`, HTTP 400. Message: "La fecha de pase no puede ser futura".
- `StudentHasPaseError` — code `STUDENT_HAS_PASE`, HTTP 409. Message: "No se puede quitar un alumno con pase registrado; revertí el pase primero".

#### Scenario PAE-D1: registrarPase — fecha pasada o igual a hoy aceptada

- GIVEN a student entity (with or without active pase)
- AND `fecha` is not after the current date/time
- WHEN `student.registrarPase(fecha)` is called
- THEN `student.fechaDePase` equals `fecha`
- AND `student.tienePase` returns `true`

#### Scenario PAE-D2: registrarPase — fecha futura rechazada

- GIVEN `fecha` strictly after `new Date()` at call time
- WHEN `student.registrarPase(fecha)` is called
- THEN `PaseFechaInvalidaError` (code `PASE_FECHA_INVALIDA`) MUST be thrown
- AND `student.fechaDePase` remains unchanged

#### Scenario PAE-D3: revertirPase — idempotente

- GIVEN any student (with or without active pase)
- WHEN `student.revertirPase()` is called
- THEN the call completes without error
- AND `student.fechaDePase` is `undefined` after the call

#### Scenario PAE-D4: tienePase — única fuente de verdad para pase activo

- GIVEN a student reconstructed from DB with `fechaDePase` set to a non-null value
- WHEN `student.tienePase` is evaluated
- THEN it returns `true`
- AND checking `student.fechaDePase != null` yields the same result (loose equality)
