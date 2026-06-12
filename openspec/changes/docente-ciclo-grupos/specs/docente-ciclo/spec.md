# Spec: Docente x Ciclo

> Capability: docente-ciclo
> Change: docente-ciclo-grupos · Fase 2
> IDs: DC-R* / DC-S*

## Purpose

Define the `DocenteXCiclo` record, which represents a User's participation as
institutional personnel in a specific academic cycle. A single entity covers both
teachers (docentes) and preceptors — the behavioral distinction is determined by
the User's assigned system modules, not by any type flag on `DocenteXCiclo`.

## Requirements

### DC-R1 — DocenteXCiclo created on assignment

A `DocenteXCiclo` record MUST be created when a User is:
(a) assigned to a `CursoXCiclo` as preceptor or titular, OR
(b) assigned as teacher of a `GrupoXCursoXMateriaXCiclo`.

The record is keyed by `(userId, cycleId, institutionId)`. If a record for that tuple
already exists, it MUST be reused — no duplicate shall be created.

#### DC-S1 — Assignment to course creates DocenteXCiclo

- GIVEN User u1 has no DocenteXCiclo for cycle C1 in institution I1
- WHEN u1 is assigned to any CursoXCiclo belonging to cycle C1 in I1 (as preceptor or titular)
- THEN a DocenteXCiclo with (userId=u1, cycleId=C1, institutionId=I1) is created

#### DC-S2 — Assignment to group creates DocenteXCiclo

- GIVEN User u1 has no DocenteXCiclo for cycle C1 in institution I1
- WHEN u1 is assigned as teacher of a GrupoXCursoXMateriaXCiclo in cycle C1 in I1
- THEN a DocenteXCiclo with (userId=u1, cycleId=C1, institutionId=I1) is created

#### DC-S3 — Subsequent assignment reuses existing DocenteXCiclo

- GIVEN User u1 already has a DocenteXCiclo for cycle C1 in I1
- WHEN u1 is assigned to a second group or course in cycle C1 in I1
- THEN no new DocenteXCiclo is created; the existing record is referenced by the new assignment
- AND the existing DocenteXCiclo id is the same before and after

---

### DC-R2 — Persona data lives in User, not in DocenteXCiclo

`DocenteXCiclo` MUST NOT store personal identity fields (DNI, title, phone, first name,
last name). Those fields MUST be read from the linked `User` record (UP-R1). Any API
returning personnel data through a DocenteXCiclo MUST source persona fields from `User`.

#### DC-S4 — Persona sourced from User, not DocenteXCiclo

- GIVEN a DocenteXCiclo linking userId = "u1" to cycle C1
- AND User u1 has { dni: "28000001", firstName: "Carlos", lastName: "López", titulo: "Prof." }
- WHEN the system reads person details for that DocenteXCiclo
- THEN the response includes { dni: "28000001", firstName: "Carlos", lastName: "López", titulo: "Prof." }
- AND DocenteXCiclo has no dni / firstName / lastName / titulo fields in its own schema

---

### DC-R3 — Teacher vs. preceptor determined by User module

`DocenteXCiclo` covers BOTH teachers and preceptors. The behavioral distinction MUST be
determined by the User's assigned system modules. A User with the `GRADES` module operates
as a teacher. A User without `GRADES` but with `ATTENDANCE` operates as a preceptor.
No separate entity type or flag on `DocenteXCiclo` encodes this distinction.

#### DC-S5 — User with GRADES module can enter grades

- GIVEN a DocenteXCiclo for User u1, where u1 has the GRADES module assigned
- WHEN the system evaluates whether u1 may submit grades for their assigned group
- THEN access is granted — module check (Door 1) passes

#### DC-S6 — User without GRADES module is denied grade entry

- GIVEN a DocenteXCiclo for User u2, where u2 does NOT have the GRADES module
- WHEN the system evaluates whether u2 may submit grades
- THEN access is denied — Door 1 (module check) fails, regardless of DocenteXCiclo existence

#### DC-S7 — User without GRADES can record daily attendance as preceptor

- GIVEN a DocenteXCiclo for User u2 (no GRADES module), assigned to a CursoXCiclo as preceptor
- AND u2 has the ATTENDANCE module
- WHEN the system evaluates whether u2 may record daily attendance for that course
- THEN access is granted — preceptor assignment (Door 2) + ATTENDANCE module (Door 1) both pass

---

### DC-R4 — Cycle-scoped historical record

`DocenteXCiclo` records are scoped to a specific cycle. Assignments in cycle C1 are
independent from assignments in cycle C2. Deactivating or archiving a cycle MUST NOT
delete or alter `DocenteXCiclo` records from prior cycles.

#### DC-S8 — Cross-cycle independence

- GIVEN User u1 has a DocenteXCiclo for cycle C1 (2024) and a DocenteXCiclo for cycle C2 (2025)
- WHEN C1 is archived
- THEN the DocenteXCiclo for C1 is preserved in history; the C2 record is unaffected

---

### DC-R5 — Multi-tenant scoping

All `DocenteXCiclo` records MUST be scoped by `institutionId`. A User from institution I1
MUST NOT appear as a DocenteXCiclo in institution I2.

#### DC-S9 — Cross-tenant isolation

- GIVEN User u1 is a DocenteXCiclo in institution I1, cycle C1
- WHEN institution I2's tenant queries its DocenteXCiclo list for cycle C1
- THEN u1 does not appear in the result
