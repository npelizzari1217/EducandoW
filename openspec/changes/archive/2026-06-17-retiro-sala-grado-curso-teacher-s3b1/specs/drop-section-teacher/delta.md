# Delta Spec: drop-section-teacher

> Change: `retiro-sala-grado-curso-teacher-s3b1`
> Fase: sdd-spec · Store: hybrid · 2026-06-17
> RFC 2119 + Given/When/Then

---

## 1. Context

`Sala` (Inicial), `Grado` (Primario), and `Curso` (Secundario) each carry a `teacherId` FK pointing to the `Teacher` table. The field is a raw UUID input with no downstream consumers after Stage 2. Approach A is selected: pure drop of column, FK, and index. No data migration. The `Teacher` table itself is out of scope and stays.

---

## 2. Invariants (always true after the change)

### 2.1 Database schema (tenant schema)

- I-DB-1: The `salas` table MUST NOT contain a `teacher_id` column.
- I-DB-2: The `grados` table MUST NOT contain a `teacher_id` column.
- I-DB-3: The `cursos` table MUST NOT contain a `teacher_id` column.
- I-DB-4: No FK constraint referencing `teachers.id` MUST exist on `salas`, `grados`, or `cursos`.
- I-DB-5: No index on `teacher_id` MUST exist on `salas` or `grados`.
- I-DB-6: The `teachers` table MUST remain intact and unmodified.

### 2.2 Prisma schema (`api/prisma_tenant/schema.prisma`)

- I-PS-1: The `Sala` model MUST NOT declare a `teacherId` field or a `teacher` relation field.
- I-PS-2: The `Grado` model MUST NOT declare a `teacherId` field or a `teacher` relation field.
- I-PS-3: The `Curso` model MUST NOT declare a `teacherId` field or a `teacher` relation field.
- I-PS-4: The `Teacher` model MUST NOT declare `salas`, `grados`, or `cursos` back-relation fields (if they exist prior to this change). [DESIGN-OWNED: confirm existence before implementing]
- I-PS-5: `prisma generate` MUST complete with zero errors after the change.

### 2.3 Domain layer (`packages/domain`)

- I-DM-1: `SalaProps` MUST NOT include a `teacherId` property.
- I-DM-2: `CreateSalaProps` MUST NOT include a `teacherId` property.
- I-DM-3: `SalaFilters` MUST NOT include a `teacherId` property (teacher-based sala filtering is removed).
- I-DM-4: `GradoProps` MUST NOT include a `teacherId` property.
- I-DM-5: `CreateGradoProps` MUST NOT include a `teacherId` property.
- I-DM-6: `Curso` domain type/interface MUST remain unchanged with respect to `teacherId` (it was already absent prior to this change).

### 2.4 Application layer (use-cases / input DTOs)

- I-APP-1: `CreateSalaInput` (use-case input) MUST NOT accept a `teacherId` field.
- I-APP-2: `UpdateSalaInput` (use-case input) MUST NOT accept a `teacherId` field.
- I-APP-3: `CreateGradoInput` (use-case input) MUST NOT accept a `teacherId` field.
- I-APP-4: `UpdateGradoInput` (use-case input) MUST NOT accept a `teacherId` field.

### 2.5 Infrastructure layer (Prisma repositories)

- I-INF-1: The Prisma sala repository's `create` and `update` calls MUST NOT pass `teacherId` to Prisma.
- I-INF-2: The Prisma sala repository's `toDomain` mapping MUST NOT read or propagate `teacherId`.
- I-INF-3: The sala repository filter builder MUST NOT apply a `teacherId` where clause.
- I-INF-4: The Prisma grado repository's `create`, `update`, and `toDomain` MUST NOT reference `teacherId`.
- I-INF-5: The Prisma curso repository's `create`, `update`, and `toDomain` MUST NOT reference `teacherId` (cleanup of any ghost references).

### 2.6 Presentation layer (controllers + HTTP DTOs)

- I-CTRL-1: The Sala controller response payload MUST NOT include a `teacherId` field.
- I-CTRL-2: The Grado controller response payload MUST NOT include a `teacherId` field.
- I-CTRL-3: `SalaDto` (HTTP response DTO) MUST NOT declare a `teacherId` property.
- I-CTRL-4: `GradoDto` (HTTP response DTO) MUST NOT declare a `teacherId` property.

### 2.7 Frontend (`web`)

- I-WEB-1: The Sala form component MUST NOT render a teacher/docente input field.
- I-WEB-2: The Grado form component MUST NOT render a teacher/docente input field.
- I-WEB-3: The Grado list/table component MUST NOT render a "Docente" column.
- I-WEB-4: Frontend TypeScript interfaces for Sala and Grado MUST NOT include a `teacherId` property.
- I-WEB-5: The Sala list/table component behavior MUST remain unchanged (it did not display teacherId before this change, as confirmed by exploration).

### 2.8 Migration

- I-MIG-1: The migration MUST be implemented as a hand-written SQL file targeting the tenant schema.
- I-MIG-2: The migration MUST use `IF EXISTS` guards on each DROP CONSTRAINT, DROP INDEX, and DROP COLUMN statement.
- I-MIG-3: The migration file MUST include a documented rollback DDL block (as a SQL comment or companion file) with the exact `ADD COLUMN`, `ADD CONSTRAINT`, and `CREATE INDEX` statements to reverse each drop.
- I-MIG-4: The migration MUST be deployable per-tenant via `pnpm --filter api migrate-tenants`.
- I-MIG-5: The migration MUST NOT include any backfill or data transformation statements.

### 2.9 Build and type integrity

- I-BUILD-1: `pnpm --filter api typecheck` MUST produce zero new TypeScript errors after the change.
- I-BUILD-2: `pnpm build` (turbo) MUST succeed with zero errors.
- I-BUILD-3: All pre-existing tests (`pnpm --filter api test`) MUST remain green; no test regressions are permitted.

### 2.10 Preservation of unrelated functionality

- I-PRES-1: All other Sala CRUD operations (create, read, update, delete, list, filter by non-teacher fields) MUST continue to function identically.
- I-PRES-2: All other Grado CRUD operations MUST continue to function identically.
- I-PRES-3: All other Curso CRUD operations MUST continue to function identically.
- I-PRES-4: The `/teachers` endpoints and the `Teacher` domain MUST remain unaffected.
- I-PRES-5: `MesaExamen` and `ActaExamen` and any other Teacher consumers MUST remain unaffected.

---

## 3. Acceptance Scenarios

### SC-01: Migration drops the columns in the database

```
Given: a tenant database with the current schema (salas.teacher_id, grados.teacher_id, cursos.teacher_id present)
When: the hand-written migration SQL is executed against the tenant DB
Then:
  - `SELECT column_name FROM information_schema.columns WHERE table_name='salas' AND column_name='teacher_id'` returns 0 rows
  - `SELECT column_name FROM information_schema.columns WHERE table_name='grados' AND column_name='teacher_id'` returns 0 rows
  - `SELECT column_name FROM information_schema.columns WHERE table_name='cursos' AND column_name='teacher_id'` returns 0 rows
  - No FK constraint referencing teachers.id exists on salas, grados, or cursos
  - No index on teacher_id exists on salas or grados
  - The teachers table row count is unchanged
```

### SC-02: Migration is reversible via rollback DDL

```
Given: a tenant database after the migration has been applied
When: the rollback DDL (from migration comments or companion file) is executed
Then:
  - teacher_id column is re-added to salas, grados, and cursos as nullable
  - FK constraints referencing teachers.id are re-added with SetNull behavior
  - Index on teacher_id is re-created on salas and grados
  - No data is restored (drop was data-destructive — accepted risk R1)
```

### SC-03: API — POST /salas ignores teacherId and returns no teacherId

```
Given: a valid POST /salas request body
When: the request body includes a `teacherId` field (legacy client)
Then:
  - The field is silently ignored (not stored, not returned)
  - The response payload does not contain a `teacherId` property
  - HTTP 201 is returned with the created sala (without teacherId)
```

### SC-04: API — POST /salas without teacherId succeeds normally

```
Given: a valid POST /salas request body without `teacherId`
When: the request is processed
Then:
  - Sala is created successfully
  - HTTP 201 is returned
  - Response does not contain `teacherId`
```

### SC-05: API — GET /salas does not filter by teacherId

```
Given: the GET /salas endpoint
When: a request includes a `teacherId` query parameter
Then:
  - The parameter is ignored (not treated as a filter)
  - All salas are returned (or filtered only by other supported fields)
  - No 400 or 500 error is thrown due to the unrecognized filter
```

### SC-06: API — POST /grados and PUT /grados/:id ignore teacherId

```
Given: a valid create or update grado request body
When: the body includes a `teacherId` field
Then:
  - The field is silently ignored
  - The response payload does not contain `teacherId`
  - HTTP 201/200 is returned
```

### SC-07: API — GET /grados response contains no teacherId

```
Given: existing grado records in the database
When: GET /grados is called
Then:
  - Each grado item in the response does not contain a `teacherId` property
```

### SC-08: Web — Sala form has no docente/teacher input

```
Given: the Sala create or edit form is rendered
When: a user views the form
Then:
  - No input field labeled "Docente", "Teacher", "teacherId" or equivalent is visible
  - All other sala fields (nombre, turno, grupoEtario, etc.) are present and functional
```

### SC-09: Web — Grado form has no docente/teacher input

```
Given: the Grado create or edit form is rendered
When: a user views the form
Then:
  - No input field for docente/teacher is visible
  - All other grado fields remain present and functional
```

### SC-10: Web — Grado list has no "Docente" column

```
Given: the Grado list/table component is rendered with existing grado records
When: a user views the list
Then:
  - No "Docente" column header is present in the table
  - No teacher UUID or "-" value is displayed in any column for docente
  - All other columns remain present
```

### SC-11: prisma generate succeeds after schema changes

```
Given: the Prisma tenant schema with teacherId fields, FKs, and back-relations removed
When: `pnpm --filter api prisma:generate` is run
Then:
  - Exit code 0
  - No type errors in generated client
```

### SC-12: TypeScript compilation is clean

```
Given: all source code changes (domain, app, infra, controllers, web interfaces) applied
When: `pnpm --filter api typecheck` is run
Then:
  - Zero new TypeScript errors introduced by this change
  - Exit code 0
```

### SC-13: Existing unit tests remain green

```
Given: updated test files for sala.test, grado.test, sala.use-cases.test
When: `pnpm --filter api test` is run
Then:
  - All tests pass
  - No test references teacherId on sala or grado domain objects
```

### SC-14: Teacher endpoints unaffected

```
Given: /teachers CRUD endpoints and Teacher-dependent routes (MesaExamen, ActaExamen)
When: those endpoints are called after the migration and code changes
Then:
  - All /teachers responses are identical to pre-change behavior
  - MesaExamen and ActaExamen endpoints function without error
```

---

## 4. Out of scope (spec boundary)

- Replacement of any "docente de sala/grado" concept in the cycle model (no viable target exists per exploration).
- Removal of the `Teacher` table (deferred to later phases).
- Any data preservation or backfill of existing `teacherId` values (R1 accepted).
- `generator erd` block (explicitly excluded from scope).

---

## 5. Design-owned items (not specced here)

The following are DEFERRED to the design phase:

- DO-1: Whether the `Teacher` Prisma model currently has `salas`, `grados`, `cursos` back-relation fields — design MUST confirm and specify removal if present.
- DO-2: Exact file paths and line numbers for each touch point across domain/app/infra/controller/web layers.
- DO-3: Whether `CursoRow` in the infra layer has any ghost `teacherId` reference that requires cleanup.
- DO-4: Migration file naming convention and placement within the tenant migrations directory.

---

## 6. Risks accepted at spec level

| ID | Risk | Disposition |
|----|------|-------------|
| R1 | Non-null `teacherId` values in prod salas/grados are permanently lost | ACCEPTED — field is primitive (raw UUID, no lookup, no downstream consumers after S2) |
| R4 | `Curso.teacherId` is a ghost column — drop has zero app impact | CONFIRMED SAFE — no code reads or writes it |
