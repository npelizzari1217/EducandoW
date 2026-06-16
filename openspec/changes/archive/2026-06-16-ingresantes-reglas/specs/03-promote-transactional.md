# Spec: Promote transaccional (ACEPTADO → INGRESO)

**RFC 2119 keywords apply throughout this document.**

## Overview

The PromoteIngresante operation transitions an ingresante from ACEPTADO to INGRESO by
creating a Student record, creating an Enrollment record, and marking the ingresante
as INGRESO. These three sub-operations MUST be executed atomically: either all succeed
and are committed, or all are rolled back with no partial side effects.

## Rules

1. Only an ingresante in state ACEPTADO MAY be promoted. Any promote attempt on an
   ingresante in another state MUST be rejected with a descriptive 4xx error.
2. The promote operation MUST atomically:
   a. Create a Student record.
   b. Create an Enrollment record linked to the ingresante's cycleId and level.
   c. Mark the ingresante state as INGRESO.
3. If any of the three sub-operations fails, ALL changes within the operation MUST be
   rolled back. After a failed promote:
   - No Student record created by this operation MUST persist.
   - No Enrollment record created by this operation MUST persist.
   - The ingresante state MUST remain ACEPTADO.
4. After a successful promote, the ingresante state MUST be INGRESO (terminal). Further
   status changes MUST be rejected per the state machine rules (spec 01-state-machine).
5. The promote operation MUST require the STUDENTS.CREATE permission. Requests by users
   lacking this permission MUST be rejected with 403 Forbidden.
6. The ingresante record MUST remain in the database after promote (as historical record).
   It MUST NOT be deleted.
7. INGRESO state MUST NOT be reachable via the status-update endpoint — only via promote.

## Acceptance Scenarios

### SC-PRM-01 — Successful promote
**Given** an ingresante in state ACEPTADO with a valid cycleId and level  
**And** no existing Student record with the same DNI  
**When** the promote operation is requested by a user with STUDENTS.CREATE permission  
**Then** a new Student record is created  
**And** a new Enrollment record is created, linked to the ingresante's cycleId and level  
**And** the ingresante state becomes INGRESO  
**And** all three changes are committed in the same atomic transaction  
**And** the ingresante record persists as a historical record

### SC-PRM-02 — Promote fails due to duplicate DNI — full rollback
**Given** an ingresante in state ACEPTADO  
**And** a Student record with the same DNI already exists  
**When** the promote operation is requested  
**Then** the Student creation fails (duplicate DNI constraint)  
**And** no Enrollment record is created  
**And** the ingresante state remains ACEPTADO  
**And** no Student record from this operation persists

### SC-PRM-03 — Promote fails due to Enrollment creation error — full rollback
**Given** an ingresante in state ACEPTADO  
**And** Student creation succeeds  
**And** Enrollment creation subsequently fails (any reason)  
**When** the promote operation runs  
**Then** the entire transaction is rolled back  
**And** the Student record created in this operation does not persist  
**And** the ingresante state remains ACEPTADO

### SC-PRM-04 — Promote rejected for non-ACEPTADO state (INSCRIPTO)
**Given** an ingresante in state INSCRIPTO  
**When** the promote operation is requested  
**Then** the API returns a 4xx error with a descriptive message  
**And** no Student, Enrollment, or state change occurs

### SC-PRM-05 — Promote rejected for non-ACEPTADO state (terminal INGRESO)
**Given** an ingresante already in state INGRESO  
**When** the promote operation is requested  
**Then** the API returns a 4xx error  
**And** no Student, Enrollment, or state change occurs

### SC-PRM-06 — Promote rejected without STUDENTS.CREATE permission
**Given** a user without the STUDENTS.CREATE permission  
**And** an ingresante in state ACEPTADO  
**When** the promote operation is requested  
**Then** the API returns 403 Forbidden  
**And** no Student, Enrollment, or state change occurs

---

## Preserved Permissions (out of change scope)

The following permission assignments are UNCHANGED by this spec and MUST remain as-is:

| Operation | Required Permission |
|-----------|-------------------|
| Create ingresante | ENROLLMENTS |
| Read ingresante | ENROLLMENTS |
| Update ingresante status | ENROLLMENTS |
| Promote ingresante | STUDENTS.CREATE |

Roles that currently have access (ROOT, ADMIN, DIRECTOR, SECRETARIO) MUST continue to
have access under the same permission model.
