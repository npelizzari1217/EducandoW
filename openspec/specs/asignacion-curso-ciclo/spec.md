# Spec: Asignación Nivel Curso por Ciclo

> Capability: asignacion-curso-ciclo
> Changes: docente-ciclo-grupos · Fase 4 (archived 2026-06-16) · rolcurso-roles-extendidos (archived 2026-06-23)
> IDs: ACC-R* / ACC-S* / SC-*
>
> Implementation note (WARNING-3 fix): The preceptor check method in
> `AsignacionCursoXCicloRepository` is `isPreceptor(docenteXCicloId, courseCycleId)`,
> NOT `isPreceptor(userId, courseCycleId)`. The use-case resolves DocenteXCiclo from
> userId before calling this method. Tasks.md updated accordingly.
>
> Note (rolcurso-roles-extendidos, 2026-06-23): RolCurso extended from 2 to 6 values
> (PRECEPTOR, TITULAR, SECRETARIO, DIRECTOR, EOE, DOCENTE_AUXILIAR). Open items:
> W1 — front-end re-declares `const RolCurso` due to CJS/Rollup limitation; add a
> Vitest cross-check test comparing frontend const keys against `@educandow/domain`
> enum keys before the next enum extension.
> Deploy guard — migration `20260623110000_rolcurso_roles_extendidos` MUST be applied
> to ALL tenant DBs BEFORE the frontend with 6-option dropdown is deployed.

## Purpose

Define the assignment of functional roles (preceptor, titular, secretario, director,
EOE, docente auxiliar) of a `DocenteXCiclo` within a `CursoXCiclo`. This axis is
independent from the group-level teacher assignment. It is the basis for the daily
attendance ("presente diario") flow: the preceptor records presence per course per
day, not per subject group.

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

---

### ACC-R7 — RolCurso enum: 6 functional roles

_(Added by `rolcurso-roles-extendidos`, 2026-06-23)_

The domain enum `RolCurso` is the single source of truth for the functional role of a
`DocenteXCiclo` within a `CursoXCiclo`. The Prisma tenant schema and the front-end
MUST derive from it. After this change the enum contains 6 values.

> **Semantic note on DIRECTOR / SECRETARIO**: these tokens also exist as `UserRole`
> values at the institution level. Their meaning is context-dependent: `UserRole`
> encodes *who the person is institutionally*; `RolCurso` encodes *what function they
> perform in this course*. This overlap is an accepted tradeoff — spec does NOT
> conflate them; they live in separate bounded contexts.

**SPEC-1** The domain enum `RolCurso` (packages/domain) SHALL contain **exactly** the
following 6 values after the change is applied, in UPPER_SNAKE_CASE:

```
PRECEPTOR | TITULAR | SECRETARIO | DIRECTOR | EOE | DOCENTE_AUXILIAR
```

No value SHALL be removed or renamed. No value beyond these 6 SHALL be present.

**SPEC-2** The Prisma tenant schema `enum RolCurso` SHALL mirror the domain enum
exactly — same 6 values, same casing.

**SPEC-3** The Zod schema `z.nativeEnum(RolCurso)` in `asignacion-curso.dto.ts` SHALL
accept all 6 values without modification. Because it derives from the domain enum at
runtime, no explicit code change to the DTO is required; the invariant is verified by
type-checking and tests.

**SPEC-4 (uniqueness — singleton rule)**

- `TITULAR` SHALL retain the existing ACC-S5 singleton rule: assigning a `TITULAR` to
  a `CursoXCiclo` MUST first remove all previous `TITULAR` assignments for that course.
- `PRECEPTOR`, `SECRETARIO`, `DIRECTOR`, `EOE`, and `DOCENTE_AUXILIAR` SHALL NOT have
  a singleton constraint. Multiple simultaneous assignments per `CursoXCiclo` with any
  of these roles are valid and MUST be accepted.

**SPEC-5 (backward compatibility)** Existing `AsignacionCursoXCiclo` rows with
`rol = PRECEPTOR` or `rol = TITULAR` SHALL remain valid and unmodified after the
migration. The migration MUST NOT backfill, alter, or delete any existing rows.

**SPEC-6 (migration strategy)** The tenant database migration SHALL be additive:
`ALTER TYPE "RolCurso" ADD VALUE '...'` for each of the 4 new values. It SHALL NOT use
`DROP TYPE`, `DROP TABLE`, or any destructive DDL. It MUST be applied to **every**
tenant database before the new roles are exposed in the UI or accepted by the API.

**SPEC-7 (front-end labels)** The role dropdown in the "Asignar Docente" form SHALL
present all 6 options with the following human-readable Spanish labels:

| Enum value       | Display label    |
|------------------|------------------|
| PRECEPTOR        | Preceptor        |
| TITULAR          | Titular          |
| SECRETARIO       | Secretario       |
| DIRECTOR         | Director         |
| EOE              | EOE              |
| DOCENTE_AUXILIAR | Docente Auxiliar |

**SPEC-8 (level scope)** This change is level-agnostic. It SHALL apply uniformly to
`CursoXCiclo` records belonging to Inicial, Primario, Secundario, and Terciario cycles.
No conditional branching by pedagogical level is permitted.

#### SC-01 — Domain enum contains exactly 6 values

- GIVEN the domain enum `RolCurso` is defined in
  `packages/domain/src/asignacion-curso-ciclo/entities/asignacion-curso-x-ciclo.ts`
- WHEN the implementation is applied
- THEN `Object.values(RolCurso)` returns exactly
  `['PRECEPTOR', 'TITULAR', 'SECRETARIO', 'DIRECTOR', 'EOE', 'DOCENTE_AUXILIAR']`
  (order may vary, membership is fixed)
- AND no previously existing value (`PRECEPTOR`, `TITULAR`) is absent

#### SC-02 — Assigning a new role persists correctly

- GIVEN a valid `CursoXCiclo` and a valid `DocenteXCiclo` for the same cycle
- WHEN a POST to `/course-cycles/:id/asignaciones` is made with `rol = SECRETARIO`
  (or `DIRECTOR`, `EOE`, `DOCENTE_AUXILIAR`)
- THEN the API responds with HTTP 201
- AND the returned `AsignacionCursoXCiclo` has `rol` equal to the submitted value
- AND the record persists in the tenant database with the correct `RolCurso` value

#### SC-03 — No singleton for new roles — multiple assignments allowed

- GIVEN a `CursoXCiclo` that already has one `AsignacionCursoXCiclo` with `rol = SECRETARIO`
- WHEN a second POST is made for the same `CursoXCiclo` with `rol = SECRETARIO`
- THEN the API responds with HTTP 201
- AND both records coexist in the database (no prior `SECRETARIO` assignment is removed)
- AND `GET /course-cycles/:id/asignaciones` returns both records
- (The same behaviour applies independently to `DIRECTOR`, `EOE`, `DOCENTE_AUXILIAR`, and `PRECEPTOR`)

#### SC-04 — ACC-S5 singleton for TITULAR is preserved

- GIVEN a `CursoXCiclo` that already has one `AsignacionCursoXCiclo` with `rol = TITULAR`
- WHEN a second POST is made for the same `CursoXCiclo` with `rol = TITULAR`
- THEN the API responds with HTTP 201
- AND the previous `TITULAR` assignment is removed from the database
- AND only the new `TITULAR` assignment exists for that `CursoXCiclo`

#### SC-05 — Existing assignments are unaffected after migration

- GIVEN the tenant database contains `AsignacionCursoXCiclo` rows with `rol = PRECEPTOR`
  or `rol = TITULAR` created before this migration
- WHEN the additive migration `ALTER TYPE "RolCurso" ADD VALUE` is applied
- THEN all pre-existing rows are present with their original `rol` values unchanged
- AND no row count changes

#### SC-06 — API rejects unknown role values (unchanged behaviour)

- GIVEN a POST to `/course-cycles/:id/asignaciones` with `rol = 'COORDINADOR'` (not in enum)
- WHEN the request is processed
- THEN the API responds with HTTP 400 (Bad Request) from Zod validation
- AND the error body identifies the `rol` field as invalid

#### SC-07 — Front-end dropdown renders all 6 options

- GIVEN the "Asignar Docente" form is rendered in the web application
- WHEN the user opens the role `<select>`
- THEN it contains exactly 6 `<option>` elements
- AND each option's `value` matches the enum key (PRECEPTOR, TITULAR, SECRETARIO,
  DIRECTOR, EOE, DOCENTE_AUXILIAR)
- AND each option's display text matches the Spanish label from SPEC-7

#### SC-08 — Zod schema accepts all 6 roles without DTO modification

- GIVEN `AssignDocenteToCursoSchema` uses `z.nativeEnum(RolCurso)`
- WHEN the domain enum is extended to 6 values
- THEN `AssignDocenteToCursoSchema.parse({ ..., rol: 'EOE' })` succeeds without
  modifying the DTO file
- AND `AssignDocenteToCursoSchema.parse({ ..., rol: 'DOCENTE_AUXILIAR' })` succeeds

#### SC-09 — Migration is applied to every tenant database

- GIVEN N tenant databases exist
- WHEN `prisma migrate deploy` is executed against each tenant
- THEN `SELECT enum_range(NULL::"RolCurso")` on each tenant returns all 6 values
- AND no tenant is left with the 2-value enum

#### SC-10 — Build and tests pass after change

- GIVEN all layers are updated (domain, migration, front-end type + form)
- WHEN `pnpm build` is executed from the monorepo root
- THEN the build exits with code 0
- WHEN `pnpm test` is executed from the monorepo root
- THEN all test suites pass and coverage meets the configured threshold (>= 80%)

#### Out-of-Scope Constraints (ACC-R7)

The following are explicitly excluded from this change and MUST NOT be introduced:

- Singleton / uniqueness constraints for `SECRETARIO`, `DIRECTOR`, `EOE`, or `DOCENTE_AUXILIAR`.
- Any change to `UserRole` or institution-level role logic.
- Any change to `assign-docente-to-curso.use-case.ts` beyond making it accept the 4 new
  enum values (the `ACC-S5` guard for `TITULAR` MUST remain unchanged; no new guards added).
- Any change to `GrupoXCursoXMateriaXCiclo` or group-level assignment logic.
- Any new business rules scoped to a specific pedagogical level (Inicial, Primario, etc.).
