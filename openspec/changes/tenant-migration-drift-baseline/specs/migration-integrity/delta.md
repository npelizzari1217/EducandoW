# Delta: tenant-migration-drift-baseline → migration-integrity

> Change: tenant-migration-drift-baseline
> Date: 2026-06-22
> Capability: migration-integrity
> Canonical spec: openspec/specs/migration-integrity/spec.md
> Pedagogical level: NONE (infra)
> IDs added: MI-11 / MI-S11
> Numbering note: migration `20260608210000_competency_instantiation_fase3` line 3 references
>   "Spec: migration-integrity/spec.md MI-1..MI-10". MI-11 is the first available slot.

## Context

`api/prisma_tenant/schema.prisma` diverged from the actual tenant DB state on 5 axes:

1. FK renames — 7 relations with handwritten short names not matching Prisma conventions
2. Index/unique renames — 13 indexes with handwritten or PostgreSQL-truncated (63-char) names
3. Timestamp type annotations — 8 tables created with `TIMESTAMPTZ` lack `@db.Timestamptz(6)`
4. `updated_at` DB-level `DEFAULT NOW()` on 8 tables — not reflected in schema (`@updatedAt` is
   client-managed; the DB default is unreachable but present)
5. `asistencia*.id` DB-level `DEFAULT gen_random_uuid()` on 2 tables — Prisma generates IDs
   client-side; the DB default is unreachable but present

As a result, `prisma migrate dev` emitted ~31 lines of spurious drift on every run (confirmed via
`prisma migrate diff` on sandbox `educandow_tenant_dev`). Drift had to be manually stripped from
each migration.

This change eliminates drift through:
- 20 additive-only schema annotations (7 FK `map:`, 13 index `map:`, `@db.Timestamptz(6)`)
- 1 forward migration with 11 instant DDL statements:
  - `DROP INDEX "competency_valuations_studentId_competencyId_key"` (1 statement)
  - `ALTER COLUMN "updated_at" DROP DEFAULT` on 8 tables (8 statements)
  - `ALTER COLUMN "id" DROP DEFAULT` on 2 asistencia tables (2 statements)

Empirically verified on sandbox: after schema annotations + forward migration applied,
`prisma migrate diff` output is `-- This is an empty migration.`

## Requirements added

### MI-11 — Tenant schema MUST produce a zero-diff against any fully-migrated tenant DB

After all migrations in `api/prisma_tenant/migrations/` have been applied to a tenant database,
running `prisma migrate diff` comparing `api/prisma_tenant/schema.prisma` against that database
MUST yield an empty changeset. The output MUST be the empty-migration sentinel
(`-- This is an empty migration.`). No DDL MUST be pending. Any future edit to `schema.prisma`
that cannot be expressed as a pure annotation (i.e., that would change actual DB structure) MUST
be accompanied by a corresponding migration.

## Acceptance scenario

### MI-S11 — Empty diff on a fully-migrated tenant DB

**Given** a tenant database to which every migration in `api/prisma_tenant/migrations/` has been applied  
**When** `prisma migrate diff` is executed comparing `api/prisma_tenant/schema.prisma` against that database  
**Then** the output MUST be `-- This is an empty migration.` with zero pending DDL statements
