# Spec: User Persona Data

> Capability area: personal identity fields (persona data) on the User master entity
> Change: docente-ciclo-grupos · Fase 1 (archived 2026-06-16) — DEFERRED-2 resolved 2026-06-16
> IDs: UP-R* / UP-S*

## Purpose

Define the state that MUST be true regarding persona fields on the `User` entity in the
master database. `User` is the single stable source of person data across academic cycles
and tenants. This spec does NOT cover user authentication, role assignment, or CRUD
operations beyond persona fields (see `user-management/spec.md`).

## Requirements

### UP-R1 — Persona fields on User

The `User` entity in the master database MUST expose the following fields:
`firstName`, `lastName`, `dni`, `titulo` (academic/professional title), `telefono` (phone).
All five fields are nullable. No existing `User` fields SHALL be removed by this change.

#### UP-S1 — Persona fields readable from User

- GIVEN a User record with dni = "27123456", titulo = "Lic.", telefono = "351-555-1234",
  firstName = "Ana", lastName = "García"
- WHEN the system reads that User by id
- THEN all five persona fields are returned in the response

#### UP-S2 — Persona fields are nullable

- GIVEN a User created with only email and name (no DNI, no title, no phone)
- WHEN the system reads that User by id
- THEN `dni`, `titulo`, `telefono` are null — no error or default is substituted

---

### UP-R2 — Teacher persona fields migrated to User [COMPLETED — historical migration]

> **Status: completed migration. This requirement records a one-time data migration that
> has already executed in production. It is NOT ongoing behavior. It is preserved here
> for traceability and rollback reference only. UP-R1 and UP-R3 are the active ongoing
> requirements.**

All non-null `dni`, `titulo`, `telefono`, `nombre`, `apellido` values from `Teacher`
records that have a non-null `userId` link MUST have been copied to the corresponding
`User` record during the migration script. Post-migration, `Teacher` persona fields are
superseded by `User`; the Teacher fields are legacy-read-only until retirement in a future
change.

#### UP-S3 — Migration preserves all persona fields

- GIVEN Teacher T { userId: "u1", dni: "30000001", titulo: "Prof.", telefono: "351-100",
  nombre: "Luis", apellido: "Pérez" }
- AND User u1 currently has no dni / titulo / telefono / firstName / lastName
- WHEN the migration script runs
- THEN User u1 has { dni: "30000001", titulo: "Prof.", telefono: "351-100",
  firstName: "Luis", lastName: "Pérez" }

#### UP-S4 — Teacher without userId is skipped silently

- GIVEN a Teacher record with userId = null
- WHEN the migration script runs
- THEN no User record is updated; the script proceeds without error

#### UP-S5 — Migration is idempotent

- GIVEN the migration script has already run once
- WHEN the script runs a second time on the same dataset
- THEN no duplicate data is created and no already-populated User persona field is overwritten with null

---

### UP-R3 — User is the authoritative persona source after migration

After the migration (UP-R2), any read path that previously sourced `dni`, `titulo`,
`telefono`, `nombre`, `apellido` from `Teacher` MUST source them from the linked `User`
instead. Stale `Teacher` fields MUST NOT take precedence over `User` fields.

#### UP-S6 — User value wins over stale Teacher value

- GIVEN User u1 has titulo = "Mg." (updated post-migration)
- AND the linked Teacher still has titulo = "Lic." (legacy stale value)
- WHEN any read operation returns personnel data for u1
- THEN titulo = "Mg." is returned (User value), not "Lic." (Teacher value)
