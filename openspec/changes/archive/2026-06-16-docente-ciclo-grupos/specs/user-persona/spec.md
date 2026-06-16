# Spec: User Persona Data

> Capability: user-persona
> Change: docente-ciclo-grupos · Fase 1
> IDs: UP-R* / UP-S*

## Purpose

Move personal identity fields (DNI, title, phone, first name, last name) from `Teacher`
(tenant DB) to `User` (master DB), establishing `User` as the single stable source of
person data across cycles and tenants. This is a prerequisite for all subsequent phases.

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

### UP-R2 — Teacher persona fields migrated to User

All non-null `dni`, `titulo`, `telefono`, `nombre`, `apellido` values from `Teacher`
records that have a non-null `userId` link MUST be copied to the corresponding `User`
record during the migration script. Post-migration, `Teacher` persona fields are
superseded by `User`; the Teacher fields become legacy-read-only until retirement in Fase 2.

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

After the migration, any read path that previously sourced `dni`, `titulo`, `telefono`,
`nombre`, `apellido` from `Teacher` MUST source them from the linked `User` instead.
Stale Teacher fields MUST NOT take precedence over User fields.

#### UP-S6 — User value wins over stale Teacher value

- GIVEN User u1 has titulo = "Mg." (updated post-migration)
- AND the linked Teacher still has titulo = "Lic." (legacy stale value)
- WHEN any read operation returns personnel data for u1
- THEN titulo = "Mg." is returned (User value), not "Lic." (Teacher value)
