# Migration Integrity Specification

## Purpose

Guarantee that `api/prisma_tenant/schema.prisma` never drifts from the actual tenant
database schema. A schema in sync with the DB produces an empty `prisma migrate diff`
output; drift produces spurious DDL that must be manually stripped from every subsequent
migration, introducing error risk and slowing the development cycle.

> **History**: Requirements MI-1 through MI-10 were established across earlier development
> phases and are referenced in migration file comments (e.g., migration
> `20260608210000_competency_instantiation_fase3` line 3: "Spec: migration-integrity/spec.md
> MI-1..MI-10"). Those requirements were never canonicalized in a file. The first
> requirement documented here is MI-11, added by `tenant-migration-drift-baseline`
> (2026-06-22) after a 5-axis schema/DB drift was identified and resolved.

---

### Requirement: Tenant Schema Zero-Drift Invariant (MI-11)

> Added: tenant-migration-drift-baseline (2026-06-22)

After all migrations in `api/prisma_tenant/migrations/` have been applied to a tenant
database, running `prisma migrate diff` comparing `api/prisma_tenant/schema.prisma` against
that database MUST yield an empty changeset. The output MUST be the empty-migration sentinel
(`-- This is an empty migration.`). No DDL MUST be pending.

Any future edit to `schema.prisma` that cannot be expressed as a pure annotation — i.e.,
that would change actual DB structure (column additions, type changes, constraint
modifications, index creation/deletion) — MUST be accompanied by a corresponding migration
file in `api/prisma_tenant/migrations/`.

The following schema-file changes are pure annotations and MUST NOT require a migration:

- `map:` values on `@relation`, `@@unique`, `@@index`, `@id` — affect Prisma naming only, not DB structure
- `@db.Timestamptz(6)` — type-mapping annotation for Prisma type inference; does not alter the column type in the DB

#### Scenario MI-S11: Empty diff on a fully-migrated tenant DB

- GIVEN a tenant database to which every migration in `api/prisma_tenant/migrations/` has been applied
- WHEN `prisma migrate diff` is executed comparing `api/prisma_tenant/schema.prisma` against that database
- THEN the output MUST be `-- This is an empty migration.` with zero pending DDL statements
