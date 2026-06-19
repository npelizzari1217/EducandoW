# Delta Spec — docente-grade-entry (Fase D, Terciario)

**Pedagogical level**: TERCIARIO
**RFC 2119 keywords apply throughout** (MUST, SHALL, SHOULD, MAY, MUST NOT).
**Scope**: backend-only; web UI is out of scope.

---

## Context

Today every Terciario grading endpoint requires `@Roles GRADES` + `@Levels TERCIARIO` and the 3-door authz model has no Door 3 for Terciario — only Door 1 (module/action) and Door 2 (rank bypass). This change adds:

1. A new tenant entity `DocenteXMateriaCarrera` to track per-materia-per-year assignments.
2. `TerciarioAuthorizerService` — Door 3 for Terciario, mirroring `AssignmentAuthorizer` (Primario/Secundario).
3. Admin endpoints so secretaría can manage docente–materia assignments.
4. Ownership enforcement on cursada slots, confirmar regularidad, and inscripciones reads.
5. An RBAC grant: TEACHER role gains `GRADES:UPDATE` so docentes can pass Door 1 on confirmar and slot-update actions.

Finales (`ActaExamen` creation, nota final), `promocionar`, and AcademicCycle integration are **out of scope**.

---

## SPEC-1 — Entity `DocenteXMateriaCarrera`

### Requirement 1.1 — Schema and Fields

The tenant Prisma schema MUST define a model `DocenteXMateriaCarrera` with the following fields:

| Field              | Type      | Constraints                                      |
|--------------------|-----------|--------------------------------------------------|
| `id`               | String    | Primary key, CUID                                |
| `userId`           | String    | Soft reference to master `User.id` (AD-6 style)  |
| `materiaCarreraId` | String    | FK → tenant `MateriaCarrera.id`                  |
| `anioAcademico`    | String    | Year string (e.g. "2025"), not an AcademicCycle  |
| `active`           | Boolean   | Default true; false = soft-deleted / unassigned  |
| `createdAt`        | DateTime  | Auto-set on insert                               |
| `updatedAt`        | DateTime  | Auto-updated                                     |

### Requirement 1.2 — Uniqueness Invariant

The combination `(userId, materiaCarreraId, anioAcademico)` MUST be unique within the tenant.
Attempting to insert a duplicate MUST be rejected with a conflict error (HTTP 409 in the API layer).

### Requirement 1.3 — Co-teaching Allowed

Multiple distinct `userId` values MAY be active for the same `(materiaCarreraId, anioAcademico)` pair.
There is no maximum on co-teachers per materia/year.

### Requirement 1.4 — Soft Unassign

Setting `active = false` MUST be the canonical "unassign" operation.
Hard-delete of `DocenteXMateriaCarrera` rows is NOT allowed via the public API.

#### Scenario 1.A — Assignment persisted

- GIVEN a valid `userId`, `materiaCarreraId`, and `anioAcademico`
- WHEN secretaría calls the assign endpoint
- THEN a `DocenteXMateriaCarrera` row is created with `active = true`

#### Scenario 1.B — Duplicate assignment rejected

- GIVEN an active `DocenteXMateriaCarrera` for `(userId=U, materiaCarreraId=M, anioAcademico=Y)`
- WHEN secretaría attempts to assign the same `(U, M, Y)` again
- THEN the API MUST return HTTP 409
- AND no duplicate row is created

#### Scenario 1.C — Co-teaching allowed

- GIVEN `DocenteXMateriaCarrera` for `(userId=U1, materiaCarreraId=M, anioAcademico=Y)` is active
- WHEN secretaría assigns `(userId=U2, materiaCarreraId=M, anioAcademico=Y)`
- THEN a second row is created with `active = true`
- AND the first row is unaffected

#### Scenario 1.D — Soft unassign

- GIVEN an active `DocenteXMateriaCarrera` row
- WHEN secretaría calls the unassign endpoint
- THEN `active` is set to `false`
- AND the row MUST NOT be deleted from the database

---

## SPEC-2 — RBAC Grant: TEACHER Role Gains `GRADES:UPDATE`

### Requirement 2.1 — role_modules Update

The `role_modules` entry for the TEACHER role on the GRADES module MUST include `UPDATE` in its actions array.
After this change the effective grant SHALL be `GRADES: [CREATE, READ, UPDATE]`.

### Requirement 2.2 — Update Remains Materia-Scoped

Granting `GRADES:UPDATE` to TEACHER at Door 1 does NOT grant unrestricted update access.
Door 3 (`TerciarioAuthorizerService`) MUST still enforce ownership: a teacher with `GRADES:UPDATE` can only update cursada data for materias they are actively assigned to via `DocenteXMateriaCarrera`.

#### Scenario 2.A — Teacher passes Door 1 for UPDATE after grant

- GIVEN a user with role TEACHER and GRADES:UPDATE in their resolved role_modules
- WHEN a request hits a cursada endpoint decorated with `@Roles({ module: 'GRADES', action: 'UPDATE' })`
- THEN Door 1 passes (the guard does not reject)

#### Scenario 2.B — Teacher still blocked at Door 3 on non-assigned materia

- GIVEN a TEACHER with GRADES:UPDATE (passes Door 1)
- AND the requested inscripcionMateria belongs to a materiaCarreraId NOT assigned to this teacher
- WHEN the use-case invokes TerciarioAuthorizerService
- THEN HTTP 403 is returned

#### Scenario 2.C — Primario/Secundario grading unaffected

- GIVEN any grading request against a Primario or Secundario endpoint
- WHEN the request is processed
- THEN the existing `AssignmentAuthorizer` logic is invoked unchanged
- AND the TEACHER GRADES:UPDATE grant does NOT alter Primario/Secundario authorization behavior

---

## SPEC-3 — `TerciarioAuthorizerService` (Door 3 for Terciario)

### Requirement 3.1 — Service Exists and Lives in Application Layer

An application service `TerciarioAuthorizerService` MUST be created in `api/src/application/grading/`.
It MUST implement two capabilities:

- `canWriteGrades(userId, userRoles, inscripcionMateriaId): Promise<boolean>` — authorizes create/update/confirmar.
- `getAllowedStudentIds(userId, userRoles, materiaCarreraId, anioAcademico): Promise<string[] | 'all' | null>` — scopes reads to assigned students.

### Requirement 3.2 — Door 2 Bypass (Administrative)

When `resolveAccessScope(userRoles).isAdministrative === true` (rank >= SECRETARIO):

- `canWriteGrades` MUST return `true` without querying `DocenteXMateriaCarrera`.
- `getAllowedStudentIds` MUST return `'all'` without querying `DocenteXMateriaCarrera`.

### Requirement 3.3 — Door 3 Teacher Path

For non-administrative users:

- `canWriteGrades` MUST resolve the `materiaCarreraId` from the given `inscripcionMateriaId` (via the tenant DB), then look up an active `DocenteXMateriaCarrera` row for `(userId, materiaCarreraId, anioAcademico)`.
  - If a matching active row exists → return `true`.
  - Otherwise → return `false`.
- `getAllowedStudentIds` MUST query active `InscripcionMateria` rows for the given `materiaCarreraId` + `anioAcademico` whose `studentId` belongs to the teacher's active assignment.
  - If the teacher is assigned → return the array of `studentId` values.
  - If not assigned → return `null`.

### Requirement 3.4 — anioAcademico Derivation

The `anioAcademico` for Door 3 checks MUST be derived from the target `InscripcionMateria.anioAcademico` field (already stored on the record). The service MUST NOT accept `anioAcademico` as a caller-supplied header or query parameter.

#### Scenario 3.A — Administrative user always passes Door 3

- GIVEN a user with role SECRETARIO (rank >= SECRETARIO)
- WHEN `canWriteGrades` is called for any inscripcionMateriaId
- THEN `true` is returned without a DB query on `DocenteXMateriaCarrera`

#### Scenario 3.B — Teacher on assigned materia passes Door 3

- GIVEN a TEACHER with an active `DocenteXMateriaCarrera` for `(userId=U, materiaCarreraId=M, anioAcademico=Y)`
- AND an `InscripcionMateria` with id=I, materiaCarreraId=M, anioAcademico=Y
- WHEN `canWriteGrades(U, ['TEACHER'], I)` is called
- THEN `true` is returned

#### Scenario 3.C — Teacher on non-assigned materia fails Door 3

- GIVEN a TEACHER with no active `DocenteXMateriaCarrera` for materiaCarreraId=M2
- AND an `InscripcionMateria` with id=I2, materiaCarreraId=M2
- WHEN `canWriteGrades(U, ['TEACHER'], I2)` is called
- THEN `false` is returned

#### Scenario 3.D — Inactive assignment is not sufficient

- GIVEN a `DocenteXMateriaCarrera` row for `(U, M, Y)` with `active = false`
- WHEN `canWriteGrades(U, ['TEACHER'], I)` is called for an inscripcion in materia M / year Y
- THEN `false` is returned (inactive rows MUST NOT grant access)

---

## SPEC-4 — Admin Assignment Endpoints

### Requirement 4.1 — Endpoints Require SECRETARIO or Above

All four admin endpoints (assign, list-by-materia, list-by-docente, unassign) MUST be guarded by:

- Door 1: `GRADES:CREATE` for assign; `GRADES:READ` for list; `GRADES:UPDATE` for unassign.
- Door 2: The caller MUST be `isAdministrative` (rank >= SECRETARIO). A TEACHER role MUST NOT call these endpoints even with GRADES:CREATE.

**Note**: the Door 2 check here is an explicit business rule enforced in the controller/use-case, not solely via role rank — the endpoints are secretaría-only by design.

### Requirement 4.2 — Assign Endpoint

`POST /terciario/admin/docentes-materias` MUST accept a JSON body with `{ userId, materiaCarreraId, anioAcademico }` (all required strings).
On success it MUST return the created `DocenteXMateriaCarrera` record (HTTP 201).
On duplicate `(userId, materiaCarreraId, anioAcademico)` it MUST return HTTP 409.

### Requirement 4.3 — List by Materia

`GET /terciario/admin/docentes-materias?materiaCarreraId=X` MUST return all active assignments for the given materia (all years).
If `anioAcademico` is also supplied as a query param, it MUST filter by that year too.

### Requirement 4.4 — List by Docente

`GET /terciario/admin/docentes-materias?userId=X` MUST return all active assignments for the given docente (all materias, all years).

### Requirement 4.5 — Unassign (Soft Delete)

`PATCH /terciario/admin/docentes-materias/:id/unassign` MUST set `active = false` on the identified row.
If the row does not exist, it MUST return HTTP 404.
If the row is already inactive, it MUST return HTTP 409 with a message indicating the assignment is already inactive.

All inputs MUST be validated with Zod schemas.

#### Scenario 4.A — Secretaría assigns a docente

- GIVEN a SECRETARIO user with GRADES:CREATE
- WHEN `POST /terciario/admin/docentes-materias` is called with valid body
- THEN HTTP 201 is returned with the new assignment row

#### Scenario 4.B — Teacher cannot call assign endpoint

- GIVEN a TEACHER user with GRADES:CREATE (after the SPEC-2 grant, they do NOT have GRADES:UPDATE for admin)
- WHEN `POST /terciario/admin/docentes-materias` is called
- THEN HTTP 403 is returned

#### Scenario 4.C — List by materia returns only active rows

- GIVEN three `DocenteXMateriaCarrera` rows: two active, one inactive for the same materiaCarreraId
- WHEN `GET /terciario/admin/docentes-materias?materiaCarreraId=M` is called by secretaría
- THEN only the two active rows are returned

#### Scenario 4.D — Unassign sets active=false

- GIVEN an active `DocenteXMateriaCarrera` row with id=R
- WHEN `PATCH /terciario/admin/docentes-materias/R/unassign` is called by secretaría
- THEN the row has `active = false`
- AND HTTP 200 is returned

#### Scenario 4.E — Unassign on already-inactive row returns 409

- GIVEN a row with `active = false`
- WHEN `PATCH /terciario/admin/docentes-materias/R/unassign` is called
- THEN HTTP 409 is returned

---

## SPEC-5 — Docente Cursada Slot Management (Create / Update)

### Requirement 5.1 — Create Slot Requires Ownership

`POST /terciario/cursada/:inscripcionMateriaId/slots` MUST:

- Pass Door 1: `GRADES:CREATE`.
- Pass Door 3 via `TerciarioAuthorizerService.canWriteGrades`. If `false`, return HTTP 403.
- On success, create the `NotaCursadaTerciario` slot and return HTTP 201.

### Requirement 5.2 — Update Slot Requires Ownership

`PATCH /terciario/cursada/:inscripcionMateriaId/slots/:slot` MUST:

- Pass Door 1: `GRADES:UPDATE`.
- Pass Door 3 via `TerciarioAuthorizerService.canWriteGrades`. If `false`, return HTTP 403.
- On success, update the slot and return HTTP 200.

### Requirement 5.3 — Secretaría Always Passes

A user with rank >= SECRETARIO MUST pass Door 3 implicitly (Door 2 bypass) on both create and update.

#### Scenario 5.A — Assigned docente creates a cursada slot

- GIVEN a TEACHER with an active assignment for materiaCarreraId=M / anioAcademico=Y
- AND an InscripcionMateria with id=I, materiaCarreraId=M, anioAcademico=Y
- WHEN `POST /terciario/cursada/I/slots` is called with a valid slot body
- THEN HTTP 201 is returned with the new NotaCursadaTerciario record

#### Scenario 5.B — Non-assigned docente is rejected on create

- GIVEN a TEACHER with no active assignment for the materia of InscripcionMateria I
- WHEN `POST /terciario/cursada/I/slots` is called
- THEN HTTP 403 is returned
- AND no slot is created

#### Scenario 5.C — Assigned docente updates a cursada slot

- GIVEN same assignment conditions as 5.A
- WHEN `PATCH /terciario/cursada/I/slots/PARCIAL_1` is called with valid update body
- THEN HTTP 200 is returned with the updated record

#### Scenario 5.D — Non-assigned docente is rejected on update

- GIVEN a TEACHER with no active assignment for the materia of InscripcionMateria I
- WHEN `PATCH /terciario/cursada/I/slots/PARCIAL_1` is called
- THEN HTTP 403 is returned

#### Scenario 5.E — Secretaría creates slot without assignment check

- GIVEN a SECRETARIO user
- AND an InscripcionMateria I on any materia
- WHEN `POST /terciario/cursada/I/slots` is called with valid body
- THEN HTTP 201 is returned regardless of DocenteXMateriaCarrera

---

## SPEC-6 — Confirmar Regularidad by Docente

### Requirement 6.1 — Confirmar Requires GRADES:UPDATE and Ownership

`PATCH /terciario/cursada/:inscripcionMateriaId/confirmar` MUST:

- Pass Door 1: `GRADES:UPDATE`. TEACHER role MUST pass because of the SPEC-2 grant.
- Pass Door 3 via `TerciarioAuthorizerService.canWriteGrades`. If `false`, return HTTP 403.
- Accept `condicion` values: `REGULAR`, `LIBRE`, `PROMOCIONAL`. All three conditions are docente-allowed when ownership is satisfied.
- On success, update `InscripcionMateria.estado` and return HTTP 200.

### Requirement 6.2 — Secretaría Always Passes

A user with rank >= SECRETARIO MUST pass Door 3 implicitly (Door 2 bypass).

#### Scenario 6.A — Assigned docente confirms REGULAR

- GIVEN a TEACHER assigned to materiaCarreraId=M / anioAcademico=Y
- AND InscripcionMateria I on that materia/year
- WHEN `PATCH /terciario/cursada/I/confirmar` is called with body `{ condicion: "REGULAR" }`
- THEN `InscripcionMateria.estado` is set to REGULAR
- AND HTTP 200 is returned

#### Scenario 6.B — Assigned docente confirms LIBRE

- Same conditions as 6.A
- WHEN body is `{ condicion: "LIBRE" }`
- THEN `InscripcionMateria.estado` is set to LIBRE

#### Scenario 6.C — Assigned docente confirms PROMOCIONAL

- Same conditions as 6.A
- WHEN body is `{ condicion: "PROMOCIONAL" }`
- THEN `InscripcionMateria.estado` is set to PROMOCIONAL

#### Scenario 6.D — Non-assigned docente is rejected on confirmar

- GIVEN a TEACHER with no active assignment for the materia of InscripcionMateria I
- WHEN `PATCH /terciario/cursada/I/confirmar` is called
- THEN HTTP 403 is returned
- AND InscripcionMateria.estado is NOT changed

#### Scenario 6.E — Secretaría confirms without assignment check

- GIVEN a SECRETARIO user
- WHEN `PATCH /terciario/cursada/I/confirmar` is called with any valid condicion
- THEN HTTP 200 is returned regardless of DocenteXMateriaCarrera

---

## SPEC-7 — Docente Reads Inscripciones of Assigned Materia

### Requirement 7.1 — Scoped Read via GRADES

A TEACHER MUST be able to list inscripciones for a `materiaCarreraId` they are actively assigned to.
This scoped read MUST require `GRADES:READ` at Door 1 (not `ENROLLMENTS:READ`, which TEACHER does not hold).
A dedicated endpoint or an additional code path on the existing inscripciones list MUST apply ownership filtering.

### Requirement 7.2 — Non-Assigned Materia → 403

If a TEACHER queries inscripciones for a `materiaCarreraId` they are NOT actively assigned to:
- The API MUST return HTTP 403.
- It MUST NOT return an empty list as a silent fallback.

### Requirement 7.3 — Secretaría Sees All

A user with rank >= SECRETARIO MUST receive the unfiltered inscripciones list for any materia.

### Requirement 7.4 — `getAllowedStudentIds` Used for Scoping

The scoped read MUST use `TerciarioAuthorizerService.getAllowedStudentIds` to filter results.
If the service returns `'all'` (administrative), the full list is returned.
If the service returns an array of student IDs, only matching inscripciones are returned.
If the service returns `null` (not assigned), HTTP 403 MUST be returned.

#### Scenario 7.A — Assigned docente lists inscripciones

- GIVEN a TEACHER assigned to materiaCarreraId=M / anioAcademico=Y
- WHEN the scoped list endpoint is called with `materiaCarreraId=M` and `anioAcademico=Y`
- THEN only inscripciones where `studentId` is in the allowed student set are returned
- AND HTTP 200 is returned

#### Scenario 7.B — Non-assigned docente receives 403

- GIVEN a TEACHER with no active assignment for materiaCarreraId=M2
- WHEN the scoped list endpoint is called with `materiaCarreraId=M2`
- THEN HTTP 403 is returned
- AND no inscripciones data is leaked

#### Scenario 7.C — Secretaría receives full list

- GIVEN a SECRETARIO user
- WHEN the inscripciones list endpoint is called with any materiaCarreraId
- THEN all inscripciones for that materia are returned (no ownership filter applied)

---

## SPEC-8 — Non-Functional Requirements

### Requirement 8.1 — Tenant Schema Only

`DocenteXMateriaCarrera` MUST be defined in `api/prisma_tenant` (the per-institution schema).
It MUST NOT be added to `api/prisma_master`.

### Requirement 8.2 — Result Pattern

All use-case methods that can fail MUST return `Result<T, E>` (using the existing Result implementation in the codebase).
Use cases MUST NOT throw domain errors directly — they MUST wrap them in `Err(...)`.

### Requirement 8.3 — Zod Validation

Every HTTP endpoint introduced or modified by this change MUST validate incoming bodies and query parameters using Zod schemas exposed from the presentation layer.
Controllers MUST use `ZodValidationPipe` consistent with existing controllers.

### Requirement 8.4 — Test Coverage

Unit and integration tests MUST achieve ≥ 80% line coverage for:

- `DocenteXMateriaCarrera` repository implementation.
- `TerciarioAuthorizerService` (all Door 2 and Door 3 paths).
- All new use-cases (assign, unassign, list assignments, scoped inscripciones list).

Existing tests for `AssignmentAuthorizer` (Primario/Secundario) MUST NOT be broken.

### Requirement 8.5 — 3-Door Model Preserved

The 3-door authorization model in `packages/domain/src/auth/access-scope.ts` and `AssignmentAuthorizer` (Primario/Secundario) MUST remain unchanged.
`TerciarioAuthorizerService` mirrors the pattern; it MUST NOT modify shared authz primitives.

### Requirement 8.6 — Tenant Isolation

All tenant Prisma queries inside `TerciarioAuthorizerService` and the new repositories MUST use `TenantContext.getClient()`.
If no tenant client is available, Door 3 MUST return `false` / `null` (fail-closed), not throw.

#### Scenario 8.A — No tenant client → fail-closed

- GIVEN a request where `TenantContext.getClient()` returns null (e.g., missing JWT dbName)
- WHEN `TerciarioAuthorizerService.canWriteGrades` is called
- THEN `false` is returned without throwing
- AND HTTP 403 propagates to the caller

---

## Summary of New Routes

| Method | Path                                             | Door 1 action | Door 2 required | Door 3 |
|--------|--------------------------------------------------|---------------|-----------------|--------|
| POST   | `/terciario/admin/docentes-materias`             | GRADES:CREATE | isAdministrative | —      |
| GET    | `/terciario/admin/docentes-materias`             | GRADES:READ   | isAdministrative | —      |
| PATCH  | `/terciario/admin/docentes-materias/:id/unassign`| GRADES:UPDATE | isAdministrative | —      |
| POST   | `/terciario/cursada/:id/slots`                   | GRADES:CREATE | bypass if admin  | TerciarioAuthorizerService |
| PATCH  | `/terciario/cursada/:id/slots/:slot`             | GRADES:UPDATE | bypass if admin  | TerciarioAuthorizerService |
| PATCH  | `/terciario/cursada/:id/confirmar`               | GRADES:UPDATE | bypass if admin  | TerciarioAuthorizerService |
| GET    | `/terciario/cursada/inscripciones` (or augmented existing) | GRADES:READ | bypass if admin | TerciarioAuthorizerService |

---

## Out of Scope (Confirmed)

- `POST /terciario/cursada/:id/promocionar` — registrar nota final (secretaría / tribunal only).
- `ActaExamen` creation and any final-grade registration.
- AcademicCycle for Terciario.
- Web UI changes.
