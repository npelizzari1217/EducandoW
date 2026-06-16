# Ingresante Specification

**RFC 2119 keywords apply throughout this document.**

## Purpose

The Ingresante capability governs the pre-enrollment admission flow: an aspirant registers,
pays the enrollment fee, is accepted, and is then promoted to become a Student (with an
Enrollment record) through a single atomic operation. Three invariants are enforced at the
domain/API layer: (1) a strict state machine that permits no skips, backward moves, or
direct writes to terminal states; (2) mandatory `level` and `cycleId` on creation, with
values constrained by the requesting user's role; (3) a transactional promote that creates
Student + Enrollment + state transition atomically, leaving no orphan records on failure.

This capability is pre-admission. It is distinct from the post-admission `enrollment` and
`enrollment-status` capabilities, which govern the student's life in a course after acceptance.

---

## Requirements

### Requirement: State Machine — forward-only, no skips, terminal immutability

The Ingresante state machine MUST be enforced at the domain/API layer, not only in the UI.
Invalid transitions MUST be rejected with a descriptive error message.

**State table:**

| State | Terminal |
|-------|----------|
| INSCRIPTO | No |
| PAGO_MATRICULA | No |
| ACEPTADO | No |
| INGRESO | Yes |
| NO_INGRESARA | Yes |

**Transition map:**

| From | Allowed → To |
|------|-------------|
| INSCRIPTO | PAGO_MATRICULA, NO_INGRESARA |
| PAGO_MATRICULA | ACEPTADO, NO_INGRESARA |
| ACEPTADO | NO_INGRESARA |
| INGRESO | (none — terminal) |
| NO_INGRESARA | (none — terminal) |

> INGRESO is reachable ONLY via the PromoteIngresante operation (see Promote requirement below).
> A direct status-update request targeting INGRESO MUST be rejected regardless of current state.

**Rules:**

1. **Forward-only**: The API MUST NOT allow backward transitions (e.g., PAGO_MATRICULA → INSCRIPTO).
2. **No skipping**: The API MUST NOT allow skipping states (e.g., INSCRIPTO → ACEPTADO).
3. **Terminal immutability**: Once INGRESO or NO_INGRESARA is reached, state MUST NOT change.
4. **INGRESO via promote only**: Any direct write of INGRESO through the status-update endpoint MUST be rejected.
5. **NO_INGRESARA availability**: NO_INGRESARA MUST be reachable from any non-terminal state.
6. **Non-retroactive (D2)**: Validation applies ONLY to transitions requested after deployment. Existing records are NOT corrected retroactively; future transitions on those records MUST follow the rules from their current state.

#### Scenario: SC-SM-01 — Valid forward transition (INSCRIPTO → PAGO_MATRICULA)

- GIVEN an ingresante currently in state INSCRIPTO
- WHEN a status-update request to PAGO_MATRICULA is submitted
- THEN the request is accepted
- AND the ingresante state becomes PAGO_MATRICULA

#### Scenario: SC-SM-02 — Skip transition rejected (INSCRIPTO → ACEPTADO)

- GIVEN an ingresante currently in state INSCRIPTO
- WHEN a status-update request to ACEPTADO is submitted
- THEN the API returns a 4xx error
- AND the error message identifies the transition as invalid
- AND the ingresante state remains INSCRIPTO

#### Scenario: SC-SM-03 — Backward transition rejected (PAGO_MATRICULA → INSCRIPTO)

- GIVEN an ingresante currently in state PAGO_MATRICULA
- WHEN a status-update request to INSCRIPTO is submitted
- THEN the API returns a 4xx error
- AND the error message identifies the transition as invalid
- AND the ingresante state remains PAGO_MATRICULA

#### Scenario: SC-SM-04 — Terminal state INGRESO is immutable

- GIVEN an ingresante currently in state INGRESO
- WHEN any status-update request is submitted (to any state)
- THEN the API returns a 4xx error
- AND the error message indicates the state is terminal
- AND the ingresante state remains INGRESO

#### Scenario: SC-SM-05 — Terminal state NO_INGRESARA is immutable

- GIVEN an ingresante currently in state NO_INGRESARA
- WHEN any status-update request is submitted (to any state)
- THEN the API returns a 4xx error
- AND the error message indicates the state is terminal
- AND the ingresante state remains NO_INGRESARA

#### Scenario: SC-SM-06 — NO_INGRESARA from INSCRIPTO

- GIVEN an ingresante currently in state INSCRIPTO
- WHEN a status-update request to NO_INGRESARA is submitted
- THEN the request is accepted
- AND the ingresante state becomes NO_INGRESARA

#### Scenario: SC-SM-07 — NO_INGRESARA from PAGO_MATRICULA

- GIVEN an ingresante currently in state PAGO_MATRICULA
- WHEN a status-update request to NO_INGRESARA is submitted
- THEN the request is accepted
- AND the ingresante state becomes NO_INGRESARA

#### Scenario: SC-SM-08 — NO_INGRESARA from ACEPTADO

- GIVEN an ingresante currently in state ACEPTADO
- WHEN a status-update request to NO_INGRESARA is submitted
- THEN the request is accepted
- AND the ingresante state becomes NO_INGRESARA

#### Scenario: SC-SM-09 — Direct write to INGRESO via status-update rejected

- GIVEN an ingresante currently in state ACEPTADO
- WHEN a status-update request directly to INGRESO is submitted (not via promote)
- THEN the API returns a 4xx error
- AND the ingresante state remains ACEPTADO

#### Scenario: SC-SM-10 — Legacy record: future transitions follow rules from current state (D2)

- GIVEN an ingresante whose current state is ACEPTADO but which reached that state before validation was active
- WHEN a status-update request to NO_INGRESARA is submitted
- THEN the request is accepted (ACEPTADO → NO_INGRESARA is a valid transition)
- AND no retroactive error or correction is triggered for the legacy state

---

### Requirement: Mandatory level and cycleId, resolved by role

Both `level` and `cycleId` MUST be provided when creating an ingresante.
Their valid values are constrained by the requesting user's role using the
`resolveAccessScope` three-door access model established in the codebase.

**Level rules:**

1. `level` MUST be present and non-null on every create request. Requests without a level MUST be rejected.
2. ROOT and ADMIN users (`allLevels = true` in `resolveAccessScope`) MAY choose any level available to them:
   - ROOT MUST have access to all levels in the system.
   - ADMIN MUST have access to levels belonging to their own institution only.
3. All other authenticated users (e.g., DIRECTOR, SECRETARIO) MUST receive `userLevels[0].level` automatically. The user MUST NOT override it — any submitted level differing from `userLevels[0].level` MUST be ignored or rejected by the system.
4. The system MUST NOT accept a level not in the set available to the requesting user.

**cycleId rules:**

1. `cycleId` MUST be present and non-null on every create request.
2. Available cycles MUST be filtered by the resolved level (chosen for ROOT/ADMIN or auto-assigned for others).
3. ROOT MUST have access to all cycles in the system regardless of level or institution.
4. Non-ROOT users MUST see only cycles associated with their resolved level (and institution for non-ADMIN).
5. The system MUST NOT accept a cycleId that does not belong to the resolved level's available set.

**D1 migration rules (manual deploy step):**

6. Existing ingresante records with `cycleId IS NULL` MUST be deleted before the NOT NULL migration runs.
7. The cleanup MUST operate across all tenants (multi-tenant).
8. The cleanup MUST be idempotent — running it multiple times MUST produce the same result.
9. A database backup MUST be performed before running this migration in production.

#### Scenario: SC-LVL-01 — ROOT creates with explicit level

- GIVEN a ROOT user
- WHEN a create request is submitted with `level = SECUNDARIO`
- THEN the ingresante is created with `level = SECUNDARIO`

#### Scenario: SC-LVL-02 — ADMIN creates with level from their institution

- GIVEN an ADMIN user whose institution has levels [PRIMARIO, SECUNDARIO]
- WHEN a create request is submitted with `level = PRIMARIO`
- THEN the ingresante is created with `level = PRIMARIO`

#### Scenario: SC-LVL-03 — ADMIN cannot use a level outside their institution

- GIVEN an ADMIN user whose institution has levels [PRIMARIO]
- WHEN a create request is submitted with `level = SECUNDARIO`
- THEN the API returns a validation error
- AND no ingresante is created

#### Scenario: SC-LVL-04 — DIRECTOR creates — level auto-assigned and locked

- GIVEN a DIRECTOR user with `userLevels[0].level = PRIMARIO`
- WHEN a create request is submitted (with or without a `level` field)
- THEN the ingresante is created with `level = PRIMARIO`
- AND any `level` value in the request other than PRIMARIO is rejected or overridden by the system

#### Scenario: SC-LVL-05 — Create without level rejected (all roles)

- GIVEN any user
- WHEN a create request is submitted with no `level` field
- THEN the API returns a validation error
- AND no ingresante is created

#### Scenario: SC-CYC-01 — Create without cycleId rejected (all roles)

- GIVEN any user
- WHEN a create request is submitted with no `cycleId` field
- THEN the API returns a validation error
- AND no ingresante is created

#### Scenario: SC-CYC-02 — ROOT sees all cycles

- GIVEN a ROOT user who has selected level PRIMARIO
- WHEN the available cycles are queried
- THEN all cycles for PRIMARIO across all institutions are returned

#### Scenario: SC-CYC-03 — ADMIN sees cycles for chosen level in their institution

- GIVEN an ADMIN user of institution X who selects level SECUNDARIO
- WHEN the available cycles are queried
- THEN only cycles associated with SECUNDARIO within institution X are returned

#### Scenario: SC-CYC-04 — DIRECTOR sees cycles for their auto-assigned level

- GIVEN a DIRECTOR user with `userLevels[0].level = PRIMARIO`
- WHEN the available cycles are queried
- THEN only cycles associated with PRIMARIO for their institution are returned

#### Scenario: SC-CYC-05 — cycleId not in allowed set is rejected

- GIVEN a DIRECTOR user with `userLevels[0].level = PRIMARIO`
- WHEN a create request is submitted with a cycleId that belongs to SECUNDARIO
- THEN the API returns a validation error
- AND no ingresante is created

#### Scenario: SC-CYC-06 — D1 migration: null cycleId ingresantes are deleted

- GIVEN there are ingresante records across one or more tenants where `cycleId IS NULL`
- WHEN the cleanup script runs
- THEN all such records are deleted
- AND records with a valid cycleId are unaffected
- AND running the script a second time deletes no additional records (idempotent)

---

### Requirement: Promote is atomic (ACEPTADO → Student + Enrollment + INGRESO)

The PromoteIngresante operation MUST atomically create a Student record, create an
Enrollment record, and mark the ingresante as INGRESO. Either all three succeed and are
committed, or all are rolled back with no partial side effects.

**Rules:**

1. Only an ingresante in state ACEPTADO MAY be promoted. Any other state MUST be rejected.
2. The promote operation MUST atomically:
   a. Create a Student record.
   b. Create an Enrollment record linked to the ingresante's cycleId and level.
   c. Mark the ingresante state as INGRESO.
3. If any sub-operation fails, ALL changes MUST be rolled back. No Student or Enrollment from this operation MUST persist; the ingresante state MUST remain ACEPTADO.
4. After a successful promote, the ingresante state is INGRESO (terminal) and further status changes MUST be rejected.
5. The promote operation MUST require the STUDENTS.CREATE permission. Requests lacking this permission MUST be rejected with 403 Forbidden.
6. The ingresante record MUST remain in the database after promote (historical record). It MUST NOT be deleted.
7. INGRESO MUST NOT be reachable via the status-update endpoint — only via promote.

**Preserved permissions (unchanged by this spec):**

| Operation | Required Permission |
|-----------|-------------------|
| Create ingresante | ENROLLMENTS |
| Read ingresante | ENROLLMENTS |
| Update ingresante status | ENROLLMENTS |
| Promote ingresante | STUDENTS.CREATE |

#### Scenario: SC-PRM-01 — Successful promote

- GIVEN an ingresante in state ACEPTADO with a valid cycleId and level
- AND no existing Student record with the same DNI
- WHEN the promote operation is requested by a user with STUDENTS.CREATE permission
- THEN a new Student record is created
- AND a new Enrollment record is created, linked to the ingresante's cycleId and level
- AND the ingresante state becomes INGRESO
- AND all three changes are committed in the same atomic transaction
- AND the ingresante record persists as a historical record

#### Scenario: SC-PRM-02 — Promote fails due to duplicate DNI — full rollback

- GIVEN an ingresante in state ACEPTADO
- AND a Student record with the same DNI already exists
- WHEN the promote operation is requested
- THEN the Student creation fails (duplicate DNI constraint)
- AND no Enrollment record is created
- AND the ingresante state remains ACEPTADO
- AND no Student record from this operation persists

#### Scenario: SC-PRM-03 — Promote fails due to Enrollment creation error — full rollback

- GIVEN an ingresante in state ACEPTADO
- AND Student creation succeeds
- AND Enrollment creation subsequently fails (any reason)
- WHEN the promote operation runs
- THEN the entire transaction is rolled back
- AND the Student record created in this operation does not persist
- AND the ingresante state remains ACEPTADO

#### Scenario: SC-PRM-04 — Promote rejected for non-ACEPTADO state (INSCRIPTO)

- GIVEN an ingresante in state INSCRIPTO
- WHEN the promote operation is requested
- THEN the API returns a 4xx error with a descriptive message
- AND no Student, Enrollment, or state change occurs

#### Scenario: SC-PRM-05 — Promote rejected for non-ACEPTADO state (terminal INGRESO)

- GIVEN an ingresante already in state INGRESO
- WHEN the promote operation is requested
- THEN the API returns a 4xx error
- AND no Student, Enrollment, or state change occurs

#### Scenario: SC-PRM-06 — Promote rejected without STUDENTS.CREATE permission

- GIVEN a user without the STUDENTS.CREATE permission
- AND an ingresante in state ACEPTADO
- WHEN the promote operation is requested
- THEN the API returns 403 Forbidden
- AND no Student, Enrollment, or state change occurs

---

## Known Debts (Documented, Acceptable)

| ID | Description | Risk |
|----|-------------|------|
| D-ADMIN-LVL | SC-LVL-03 ADMIN level validation is indirect — protection comes from tenant DB scoping (ADMIN can only find cycles within their institution) rather than an explicit whitelist check. Effective in practice. | LOW |
| D-MULTI-LEVEL | Frontend non-ROOT/ADMIN assumes `userLevels[0]` — institutions where a non-admin user has multiple levels are not supported in this release. | LOW |
| D-MANUAL-DEPLOY | D1 cleanup (`cleanup-ingresantes-sin-ciclo.ts`) + NOT NULL migration are MANUAL deploy steps. Must run cleanup before `prisma:migrate:tenant:deploy`, with backup first. | OPERATIONAL |
