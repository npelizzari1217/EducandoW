# Design: Fix Critical Issues — Migration Architecture & Runtime Bugs

## Technical Approach

The implementation will be executed in two parallel streams:

1.  **Migration Architecture Overhaul**: The core of this change is to separate the monolithic Prisma migration directory into two distinct, independently managed directories: `migrations_master` and `migrations_tenant`. This involves generating clean, idempotent baseline migrations for each schema that perfectly reflect the current database state. Existing migrations will be archived, and all relevant scripts will be updated to target the new, separated migration paths.
2.  **Targeted Bug Fixes**: Four discrete, high-impact bugs identified in the audit will be resolved through small, isolated code changes. These fixes address a raw SQL error, a redundant query filter, dead UI links, and a test file syntax error.

## Architecture Decisions

### Decision: Baseline Migration Generation Strategy

-   **Choice**: Generate baseline SQL using `prisma migrate diff --from-empty --to-schema-datamodel --script`. This creates a pure DDL script from Prisma's schema definition.
-   **Alternatives considered**:
    -   Using `prisma migrate dev --create-only` against a fresh database. This is more of a black box and depends on having a live, correctly configured empty database, making it less portable.
-   **Rationale**: The `diff` approach is declarative, repeatable, and provides a plain SQL file that can be inspected and manually verified for correctness before being used as the official baseline. It has no dependency on a live database for its generation, which is a significant advantage for CI/CD and developer onboarding.

### Decision: Baseline Migration Naming and Timestamping

-   **Choice**: Use a fixed, early timestamp for the baseline migrations, e.g., `20240101000000_init_master.sql` and `20240101000000_init_tenant.sql`.
-   **Alternatives considered**:
    -   Using a "zero" timestamp like `00000000000000_baseline.sql`. While functional, it's less conventional and might not be correctly ordered by all tools.
    -   Using the current timestamp. This would falsely imply the schema was created now, which is historically inaccurate.
-   **Rationale**: A fixed, "genesis" timestamp clearly communicates that this is a foundational migration representing the entire schema up to a certain point. It ensures these migrations always run first.

### Decision: Applying Baselines to Existing Databases

-   **Choice**: Use `prisma migrate resolve --applied "migration_name"` for both the master and all tenant databases.
-   **Alternatives considered**: Manually inserting a row into the `_prisma_migrations` table. This is risky, error-prone, and bypasses Prisma's internal checks.
-   **Rationale**: `prisma migrate resolve` is the official, safe, and idempotent command provided by Prisma for this exact scenario. It correctly updates the migration history table to prevent the baseline from being re-run on databases that are already up-to-date.

### Decision: Fixing the seed.ts Raw SQL Query

-   **Choice**: Replace the raw SQL query (`$executeRawUnsafe`) with a type-safe Prisma Client query (`prisma.institutionLevel.update`).
-   **Alternatives considered**: Correctly quoting the column name in the raw SQL: `il."institutionId"`.
-   **Rationale**: While fixing the quote works, it maintains technical debt. Migrating to a Prisma Client call eliminates raw SQL, provides compile-time type safety, makes the code easier to read and maintain, and aligns with the project's overall use of the ORM.

## Data Flow

This change does not introduce any new data flows. It corrects existing data access patterns (the `listar-alumnos` query) and refactors the database migration structure.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `api/prisma/migrations_master/20240101000000_init_master/migration.sql` | Create | New baseline migration for the master schema. |
| `api/prisma/migrations_tenant/20240101000000_init_tenant/migration.sql` | Create | New baseline migration for the tenant schema. |
| `api/prisma/migrations_archive/` | Create | Directory to store the old, mixed migrations for historical reference. |
| `api/prisma/migrations/` | Delete | The original, mixed migrations directory will be removed after its contents are archived. |
| `api/package.json` | Modify | Update `prisma` scripts (e.g., `migrate:master`, `migrate:tenant`) to point to the new schema and migration directory paths. |
| `api/scripts/create-tenant-db.ts` | Modify | Update the Prisma client invocation to use `--schema=./prisma/schema_tenant.prisma` for running tenant migrations. |
| `api/src/infrastructure/persistence/postgres-admin.service.ts` | Modify | Update the migration command to target the new `migrations_tenant` directory. |
| `api/prisma/seed.ts` | Modify | Replace the raw SQL query with a type-safe Prisma `update` query. |
| `api/src/application/shared/queries/listar-alumnos.query.ts` | Modify | Remove the redundant `institutionId` from the `where` clause. |
| `web/src/components/layout/sidebar.tsx` | Modify | Remove the `ListItem` components for the three dead links. |
| `web/src/__tests__/App.test.tsx` | Modify | Replace `require` with `import` for `react-router-dom`. |

## Interfaces / Contracts

No new interfaces, API contracts, or data structures are being introduced in this change.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|--------------|----------|
| Unit | `listar-alumnos.query` logic | Verify the query handler functions correctly without the `institutionId` parameter. |
| Unit | `App.test.tsx` syntax fix | The fix is within a test file. Running the existing test suite (`pnpm test`) will confirm its correctness. |
| Snapshot | `sidebar.tsx` UI changes | An existing or new snapshot test will verify that the links are removed without breaking the sidebar layout. |
| Integration | Tenant Creation | A manual or automated test will be run to create a new institution from scratch, ensuring the new `migrations_tenant` are correctly applied. |
| Integration | Seeding | The `seed` script will be run to confirm the Prisma query works and correctly populates the required data. |

## Migration / Rollout

The rollout requires a two-step process for existing environments:

1.  **Deploy the Code**: The new code with the updated scripts and separated migration directories is deployed.
2.  **Apply Baselines**: For the master database and every existing tenant database, an operator must run:
    ```bash
    # For master DB
    pnpm --filter api exec prisma migrate resolve --applied 20240101000000_init_master --schema=./prisma/schema_master.prisma

    # For each tenant DB (scripted)
    pnpm --filter api exec prisma migrate resolve --applied 20240101000000_init_tenant --schema=./prisma/schema_tenant.prisma
    ```
This action marks the baselines as "applied" without running them, preventing any data loss. All subsequent migrations will apply cleanly on top of this baseline. For new databases (new tenants), `prisma migrate deploy` will work automatically.

## Open Questions

- None. The path forward is clear.
