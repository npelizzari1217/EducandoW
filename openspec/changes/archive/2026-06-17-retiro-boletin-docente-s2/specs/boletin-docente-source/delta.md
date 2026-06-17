# Delta Spec: boletin-docente-source

> Change: retiro-boletin-docente-s2
> Phase: sdd-spec · Store: hybrid · 2026-06-17
> RFC 2119 + Given/When/Then. DESIGN-OWNED items are noted explicitly.

---

## Context

`generate-boletin.use-case.ts` currently resolves the teacher name for `MateriaBoletin.docente` by querying `SubjectAssignment` (3 call sites). This spec describes the observable behavior AFTER S2 replaces those lookups with the DocenteXCiclo/grupo model (Approach B, student-scoped). It is a delta: only what changes or is newly constrained is stated here.

**Levels in scope:** INICIAL (docente field rendered → resolved via new model), PRIMARIO, SECUNDARIO, TERCIARIO (docente field NOT rendered → `docente = ""`). The new-model resolver applies to INICIAL only.

**Scope correction (design):** `SubjectAssignment` CANNOT be removed from the boletín in S2. The legacy Inicial/Terciario branch query is the backbone of that branch — it supplies the subject list AND is the only join key to grades (`NotaTrimestral.assignmentId → SubjectAssignment.id`; `NotaTrimestral` has no `subjectId`). S2 removes only the reads of the **`Teacher`** table (the `include: { teacher }` and the Primario/Secundario teacher queries). Dropping `SubjectAssignment` is a later stage requiring migration of Inicial/Terciario grading off `NotaTrimestral`.

---

## Invariants (RFC 2119)

### INV-1 — No Teacher-table reads

After S2, the boletín generation pipeline MUST NOT read the `Teacher` table in any branch — no `include: { teacher }`, no `teacher` select, no direct `teacher.findMany` — neither in the legacy Inicial/Terciario branch nor in Primario/Secundario nor any helper they call. (The legacy branch MAY still query `SubjectAssignment` for the subject list and the `NotaTrimestral` join key — see scope correction — but WITHOUT the `teacher` relation.)

### INV-2 — SubjectAssignment data preserved

The `SubjectAssignment` Prisma model, its migration history, and all existing rows MUST remain untouched after S2. No `DROP TABLE`, no migration, no seed truncation. Removal is deferred to S3.

### INV-3 — MateriaBoletin type unchanged

`MateriaBoletin.docente` MUST remain typed as `string`. No template changes. No type narrowing to `string | null | undefined`.

### INV-4 — Tenant/master client separation

Queries to the DocenteXCiclo/grupo chain (MateriaXCursoXCiclo, AlumnosXMateriaXCursoXCiclo, AlumnosXGrupo, GrupoXCursoXMateriaXCiclo, DocenteXCiclo) MUST use the **tenant** Prisma client. The lookup of `User.firstName` / `User.lastName` MUST use the **master** Prisma client (`PrismaService`). These two clients MUST NOT be swapped or merged in any code path introduced by S2.

### INV-5 — Boletín generation never errors on missing docente

A resolved docente count of zero for any (student, subject) combination MUST NOT cause the boletín generation to throw, reject, or produce a partial document. The document MUST still be generated with `docente = ""` for the affected subject(s).

### INV-6 — Teacher-name source is master User

The name displayed in the boletín for any docente MUST be derived from `User.firstName` and `User.lastName` in the master database. The tenant `Teacher` record (firstName, lastName) MUST NOT be read as the name source in any S2 code path. This is a documented behavioral change: if `Teacher` was edited post-backfill and differs from `User`, the boletín shows the `User` value.

---

## Scenarios

### SC-1 — INICIAL: single docente resolved

**Given** an INICIAL student's boletín is being generated
AND the new model resolves exactly one `DocenteXCiclo` for a given (student, subject) combination
AND that `DocenteXCiclo` has a valid `userId` pointing to a master `User` record

**When** the use-case builds `MateriaBoletin` for that subject

**Then** `docente` MUST equal `"${User.lastName}, ${User.firstName}"` (last name first, comma-space separator)
AND the value MUST be sourced from the master `User` record, not from the tenant `Teacher` record.

---

### SC-2 — INICIAL: co-docencia (N > 1 docentes)

**Given** an INICIAL student's boletín is being generated
AND the new model resolves N ≥ 2 distinct `DocenteXCiclo` records for a given (student, subject) combination after deduplication by `docenteXCicloId`
AND each resolved record has a valid `userId` pointing to a master `User` record

**When** the use-case builds `MateriaBoletin` for that subject

**Then** `docente` MUST equal the names joined with `" / "` in the format `"Apellido1, Nombre1 / Apellido2, Nombre2"`.
AND the join MUST include only deduplicated docentes (duplicate `docenteXCicloId` values MUST be collapsed before building the string).
AND `MateriaBoletin.docente` type remains `string` (no array, no template change).

> Note: ordering within the join is DESIGN-OWNED (the design phase defines the sort key).

---

### SC-3 — INICIAL: zero docentes resolved (blank degradation)

**Given** an INICIAL student's boletín is being generated
AND the new model resolves zero `DocenteXCiclo` records for a given (student, subject) combination
(reasons: MateriaXCursoXCiclo not materialized, student has no grupo, or docente has no `userId`)

**When** the use-case builds `MateriaBoletin` for that subject

**Then** `docente` MUST equal `""` (empty string)
AND the boletín document MUST be generated successfully (no error thrown, no partial result)
AND no `SubjectAssignment` fallback query MUST be issued.

> Deploy precondition (operational, not a code constraint): the backfill of the materia-grupo model MUST be verified across all tenants before deploying S2 to production. This spec does not block code; it documents the accepted degradation.

---

### SC-4 — PRIMARIO: docente always blank, no query issued

**Given** a PRIMARIO student's boletín is being generated

**When** the use-case builds `MateriaBoletin` for any subject

**Then** `docente` MUST equal `""` (empty string)
AND no query against `SubjectAssignment` MUST be issued for this branch
AND no query against the DocenteXCiclo/grupo chain MUST be issued for this branch.

---

### SC-5 — SECUNDARIO: docente always blank, no query issued

**Given** a SECUNDARIO student's boletín is being generated

**When** the use-case builds `MateriaBoletin` for any subject

**Then** `docente` MUST equal `""` (empty string)
AND no query against `SubjectAssignment` MUST be issued for this branch
AND no query against the DocenteXCiclo/grupo chain MUST be issued for this branch.

---

### SC-6 — No Teacher-table access in any branch (integration guard)

**Given** the boletín generation is triggered for a student of any level (INICIAL, PRIMARIO, SECUNDARIO, TERCIARIO)

**When** the full execution of `generate-boletin.use-case.ts` completes

**Then** the set of Prisma queries executed MUST contain zero reads of the `Teacher` table (no `teacher` include/select, no `teacher.*` query)
AND the legacy branch's `SubjectAssignment` query (if present) MUST NOT include the `teacher` relation
AND this MUST be verifiable via test-level Prisma mock/spy assertions.

---

### SC-7 — SubjectAssignment data integrity after S2 deploy

**Given** S2 has been deployed

**When** the database schema and data are inspected

**Then** the `SubjectAssignment` table MUST exist with its original columns and all pre-S2 rows intact
AND no migration targeting `SubjectAssignment` MUST have been applied in S2.

---

## Out of scope for this spec

- The exact bulk query structure and intermediate join model (DESIGN-OWNED).
- Whether TERCIARIO shares the INICIAL legacy code path or has its own branch (DESIGN-OWNED; SC-6 applies to TERCIARIO regardless).
- The sort order of joined names in co-docencia (DESIGN-OWNED).
- S3 archival and `SubjectAssignment` drop.
- Changes to PDF templates or `MateriaBoletin` type signature.
- The `Teacher` tenant record (not read in any S2 code path).
