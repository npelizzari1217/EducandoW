# Delta Spec: RolCurso — Roles Extendidos

**Change**: `rolcurso-roles-extendidos`
**Level**: ALL — applies to Inicial / Primario / Secundario / Terciario
**Capability**: `asignacion-curso` (asignación de DocenteXCiclo a CursoXCiclo)
**Status**: draft

---

## 1. Context

`RolCurso` is the domain enum that describes the functional role of a `DocenteXCiclo` within a
`CursoXCiclo`. It is the single source of truth; the Prisma tenant schema and the front-end
derive from it. Currently it holds 2 values: `PRECEPTOR` and `TITULAR`.

This change adds 4 values: `SECRETARIO`, `DIRECTOR`, `EOE`, `DOCENTE_AUXILIAR`.

> **Semantic note on DIRECTOR / SECRETARIO**: these tokens also exist as `UserRole` values at the
> institution level. Their meaning is context-dependent: `UserRole` encodes *who the person is
> institutionally*; `RolCurso` encodes *what function they perform in this course*. This overlap
> is an accepted tradeoff — spec does NOT conflate them; they live in separate bounded contexts.

---

## 2. Invariants (RFC 2119)

**SPEC-1** The domain enum `RolCurso` (packages/domain) SHALL contain **exactly** the following 6
values after the change is applied, in UPPER_SNAKE_CASE:

```
PRECEPTOR | TITULAR | SECRETARIO | DIRECTOR | EOE | DOCENTE_AUXILIAR
```

No value SHALL be removed or renamed. No value beyond these 6 SHALL be present.

**SPEC-2** The Prisma tenant schema `enum RolCurso` SHALL mirror the domain enum exactly — same 6
values, same casing.

**SPEC-3** The Zod schema `z.nativeEnum(RolCurso)` in `asignacion-curso.dto.ts` SHALL accept all 6
values without modification. Because it derives from the domain enum at runtime, no explicit code
change to the DTO is required; the invariant is verified by type-checking and tests.

**SPEC-4 (uniqueness — singleton rule)**
- `TITULAR` SHALL retain the existing ACC-S5 singleton rule: assigning a `TITULAR` to a
  `CursoXCiclo` MUST first remove all previous `TITULAR` assignments for that course.
- `PRECEPTOR`, `SECRETARIO`, `DIRECTOR`, `EOE`, and `DOCENTE_AUXILIAR` SHALL NOT have a singleton
  constraint. Multiple simultaneous assignments per `CursoXCiclo` with any of these roles are
  valid and MUST be accepted.

**SPEC-5 (backward compatibility)** Existing `AsignacionCursoXCiclo` rows with `rol = PRECEPTOR`
or `rol = TITULAR` SHALL remain valid and unmodified after the migration. The migration MUST NOT
backfill, alter, or delete any existing rows.

**SPEC-6 (migration strategy)** The tenant database migration SHALL be additive:
`ALTER TYPE "RolCurso" ADD VALUE '...'` for each of the 4 new values. It SHALL NOT use
`DROP TYPE`, `DROP TABLE`, or any destructive DDL. It MUST be applied to **every** tenant
database before the new roles are exposed in the UI or accepted by the API.

**SPEC-7 (front-end labels)** The role dropdown in the "Asignar Docente" form SHALL present all
6 options with the following human-readable Spanish labels:

| Enum value       | Display label    |
|------------------|------------------|
| PRECEPTOR        | Preceptor        |
| TITULAR          | Titular          |
| SECRETARIO       | Secretario       |
| DIRECTOR         | Director         |
| EOE              | EOE              |
| DOCENTE_AUXILIAR | Docente Auxiliar |

**SPEC-8 (level scope)** This change is level-agnostic. It SHALL apply uniformly to
`CursoXCiclo` records belonging to Inicial, Primario, Secundario, and Terciario cycles. No
conditional branching by pedagogical level is permitted.

---

## 3. Acceptance Scenarios

### SC-01: Domain enum contains exactly 6 values

**Given** the domain enum `RolCurso` is defined in
`packages/domain/src/asignacion-curso-ciclo/entities/asignacion-curso-x-ciclo.ts`
**When** the implementation is applied
**Then** `Object.values(RolCurso)` returns exactly
`['PRECEPTOR', 'TITULAR', 'SECRETARIO', 'DIRECTOR', 'EOE', 'DOCENTE_AUXILIAR']` (order may vary,
membership is fixed)
**And** no previously existing value (`PRECEPTOR`, `TITULAR`) is absent

---

### SC-02: Assigning a new role persists correctly

**Given** a valid `CursoXCiclo` and a valid `DocenteXCiclo` for the same cycle
**When** a POST to `/course-cycles/:id/asignaciones` is made with `rol = SECRETARIO`
  (or `DIRECTOR`, `EOE`, `DOCENTE_AUXILIAR`)
**Then** the API responds with HTTP 201
**And** the returned `AsignacionCursoXCiclo` has `rol` equal to the submitted value
**And** the record persists in the tenant database with the correct `RolCurso` value

---

### SC-03: No singleton for new roles — multiple assignments allowed

**Given** a `CursoXCiclo` that already has one `AsignacionCursoXCiclo` with `rol = SECRETARIO`
**When** a second POST is made for the same `CursoXCiclo` with `rol = SECRETARIO`
**Then** the API responds with HTTP 201
**And** both records coexist in the database (no prior `SECRETARIO` assignment is removed)
**And** `GET /course-cycles/:id/asignaciones` returns both records

The same behaviour applies independently to `DIRECTOR`, `EOE`, `DOCENTE_AUXILIAR`, and `PRECEPTOR`.

---

### SC-04: ACC-S5 singleton for TITULAR is preserved

**Given** a `CursoXCiclo` that already has one `AsignacionCursoXCiclo` with `rol = TITULAR`
**When** a second POST is made for the same `CursoXCiclo` with `rol = TITULAR`
**Then** the API responds with HTTP 201
**And** the previous `TITULAR` assignment is removed from the database
**And** only the new `TITULAR` assignment exists for that `CursoXCiclo`

---

### SC-05: Existing assignments are unaffected after migration

**Given** the tenant database contains `AsignacionCursoXCiclo` rows with `rol = PRECEPTOR`
  or `rol = TITULAR` created before this migration
**When** the additive migration `ALTER TYPE "RolCurso" ADD VALUE` is applied
**Then** all pre-existing rows are present with their original `rol` values unchanged
**And** no row count changes

---

### SC-06: API rejects unknown role values (unchanged behaviour)

**Given** a POST to `/course-cycles/:id/asignaciones` with `rol = 'COORDINADOR'` (not in enum)
**When** the request is processed
**Then** the API responds with HTTP 400 (Bad Request) from Zod validation
**And** the error body identifies the `rol` field as invalid

---

### SC-07: Front-end dropdown renders all 6 options

**Given** the "Asignar Docente" form is rendered in the web application
**When** the user opens the role `<select>`
**Then** it contains exactly 6 `<option>` elements
**And** each option's `value` matches the enum key (PRECEPTOR, TITULAR, SECRETARIO, DIRECTOR,
  EOE, DOCENTE_AUXILIAR)
**And** each option's display text matches the Spanish label from SPEC-7

---

### SC-08: Zod schema accepts all 6 roles without DTO modification

**Given** `AssignDocenteToCursoSchema` uses `z.nativeEnum(RolCurso)`
**When** the domain enum is extended to 6 values
**Then** `AssignDocenteToCursoSchema.parse({ ..., rol: 'EOE' })` succeeds without modifying the
  DTO file
**And** `AssignDocenteToCursoSchema.parse({ ..., rol: 'DOCENTE_AUXILIAR' })` succeeds

---

### SC-09: Migration is applied to every tenant database

**Given** N tenant databases exist
**When** `prisma migrate deploy` is executed against each tenant
**Then** `SELECT enum_range(NULL::"RolCurso")` on each tenant returns all 6 values
**And** no tenant is left with the 2-value enum

---

### SC-10: Build and tests pass after change

**Given** all layers are updated (domain, migration, front-end type + form)
**When** `pnpm build` is executed from the monorepo root
**Then** the build exits with code 0
**When** `pnpm test` is executed from the monorepo root
**Then** all test suites pass and coverage meets the configured threshold (≥ 80%)

---

## 4. Out-of-Scope Constraints

The following are explicitly excluded from this change and MUST NOT be introduced during
implementation:

- Singleton / uniqueness constraints for `SECRETARIO`, `DIRECTOR`, `EOE`, or `DOCENTE_AUXILIAR`.
- Any change to `UserRole` or institution-level role logic.
- Any change to `assign-docente-to-curso.use-case.ts` beyond making it accept the 4 new enum
  values (the `ACC-S5` guard for `TITULAR` MUST remain unchanged, and no new guards are added).
- Any change to `GrupoXCursoXMateriaXCiclo` or group-level assignment logic.
- Any new business rules scoped to a specific pedagogical level (Inicial, Primario, etc.).
