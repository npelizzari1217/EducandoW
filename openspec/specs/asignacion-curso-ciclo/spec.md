# Spec: Asignación Nivel Curso por Ciclo

> Capability: asignacion-curso-ciclo
> Change: docente-ciclo-grupos · Fase 4 (archived 2026-06-16)
> IDs: ACC-R* / ACC-S*
>
> Implementation note (WARNING-3 fix): The preceptor check method in
> `AsignacionCursoXCicloRepository` is `isPreceptor(docenteXCicloId, courseCycleId)`,
> NOT `isPreceptor(userId, courseCycleId)`. The use-case resolves DocenteXCiclo from
> userId before calling this method. Tasks.md updated accordingly.

## Purpose

Define the assignment of preceptors and homeroom teacher (titular) to a `CursoXCiclo`.
This axis is independent from the group-level teacher assignment. It is the basis for
the daily attendance ("presente diario") flow: the preceptor records presence per
course per day, not per subject group.

## Requirements

### ACC-R1 — Preceptors assigned at CursoXCiclo level with turno

A `DocenteXCiclo` MAY be assigned to a `CursoXCiclo` as preceptor, carrying a `turno`
(shift) field. Multiple `DocenteXCiclo` records MAY be assigned to the same `CursoXCiclo`
— including multiple preceptors sharing the same turno. There is no uniqueness constraint
on (CursoXCiclo, turno).

#### ACC-S1 — Preceptor assigned to CursoXCiclo with turno

- GIVEN CursoXCiclo CC1 has no preceptor
- AND DocenteXCiclo D1 exists for cycle C1 in institution I1
- WHEN D1 is assigned to CC1 as preceptor with turno = "Mañana"
- THEN the assignment (CC1, D1, turno = "Mañana") is persisted

#### ACC-S2 — Second preceptor assigned to the same turno

- GIVEN CC1 already has preceptor D1 with turno = "Mañana"
- WHEN DocenteXCiclo D2 is also assigned to CC1 with turno = "Mañana"
- THEN both D1 and D2 are valid preceptors for CC1 in that shift; no conflict is raised

#### ACC-S3 — Multiple preceptors across different turnos

- GIVEN CursoXCiclo CC1
- WHEN D1 is assigned turno = "Mañana" and D2 is assigned turno = "Tarde"
- THEN CC1 has two separate preceptor assignments with distinct turnos; both are active

---

### ACC-R2 — Titular assigned at CursoXCiclo level

A `CursoXCiclo` MAY have exactly one designated titular (`DocenteXCiclo`). Assigning a
titular is optional; its absence does not block preceptor assignment or daily attendance.

#### ACC-S4 — Titular assigned to CursoXCiclo

- GIVEN CursoXCiclo CC1 with no titular
- AND DocenteXCiclo D3 is to be set as titular
- WHEN D3 is assigned as titular of CC1
- THEN CC1.titular = D3; any existing preceptor assignments are unaffected

#### ACC-S5 — Titular replacement

- GIVEN CC1 already has titular D3
- WHEN D4 is assigned as the new titular
- THEN CC1.titular = D4; D3 is no longer the titular

---

### ACC-R3 — Assignment must be within the same cycle

The `DocenteXCiclo` being assigned to a `CursoXCiclo` MUST belong to the same `cycleId`
as the `CursoXCiclo`. Cross-cycle assignments MUST be rejected.

#### ACC-S6 — Cross-cycle assignment rejected

- GIVEN CursoXCiclo CC1 belongs to cycle C1
- AND DocenteXCiclo D4 belongs to cycle C2
- WHEN D4 is assigned to CC1 as preceptor
- THEN the operation is rejected with an error — cycleId mismatch

---

### ACC-R4 — Course-level assignment is independent from group assignment

Assigning a preceptor to a `CursoXCiclo` MUST NOT create, modify, or delete any
`GrupoXCursoXMateriaXCiclo` record. The two assignment axes are fully orthogonal.

#### ACC-S7 — Preceptor assignment does not create groups

- GIVEN DocenteXCiclo D1 is assigned to CC1 as preceptor
- WHEN the system reads GrupoXCursoXMateriaXCiclo records for CC1
- THEN no group is created as a side effect of the preceptor assignment

---

### ACC-R5 — Multi-tenant scoping

All CursoXCiclo-level assignments MUST be scoped by `institutionId`. An assignment in
institution I1 MUST NOT be visible from institution I2's tenant.

#### ACC-S8 — Cross-tenant isolation

- GIVEN DocenteXCiclo D1 is assigned as preceptor to CC1 in institution I1
- WHEN institution I2's tenant queries preceptor assignments for its CursoXCiclo records
- THEN D1 does not appear in the result

---

### ACC-R6 — Homeroom navigation: `findTitularCourseIdsByUser`

_(Added by S3a `retiro-homeroom-titular-s3a`, 2026-06-17)_

`AsignacionCursoXCicloRepository` MUST expose `findTitularCourseIdsByUser(userId: string): Promise<string[]>`.
The method MUST return deduplicated `courseCycleId` UUIDs for all `AsignacionCursoXCiclo` records
where `rol=TITULAR` AND `docenteXCiclo.userId=userId` AND `docenteXCiclo.active=true`.
It MUST return `[]` (not throw) when no matching rows exist.
All queries MUST be scoped to the tenant Prisma client (no cross-tenant access).
Deduplication is the method's responsibility — a user who is TITULAR of the same CC via two distinct
`turno` values MUST receive only one entry for that CC.

#### ACC-S9 — findTitularCourseIdsByUser returns deduplicated TITULAR course-cycle IDs

- GIVEN user U has DocenteXCiclo D1 (active=true) linked to two AsignacionCursoXCiclo rows
  both with rol=TITULAR and courseCycleId=CC1 (different turno values)
  AND DocenteXCiclo D2 (active=true) linked to AsignacionCursoXCiclo(rol=TITULAR, courseCycleId=CC2)
- WHEN findTitularCourseIdsByUser(U) is called
- THEN the result is ['CC1', 'CC2'] (CC1 deduplicated to one entry)
- AND no cross-tenant data is included

#### ACC-S10 — findTitularCourseIdsByUser returns [] for inactive or unassigned user

- GIVEN user U has DocenteXCiclo D1 with active=false linked to AsignacionCursoXCiclo(rol=TITULAR)
  OR user U has active DocenteXCiclo records but none linked to AsignacionCursoXCiclo(rol=TITULAR)
- WHEN findTitularCourseIdsByUser(U) is called
- THEN the result is [] with no error thrown
