# Design: Bootstrap Enhancements

## 1. Overview

This document outlines the technical design for enhancing the `api/scripts/bootstrap.ts` script. The changes introduce two new steps to the bootstrap process: applying a system-wide SQL sync file and creating a dedicated test institution with its own tenant database. It also modifies the script's final output to display credentials for the pre-seeded ROOT user.

The design adheres to the principles of the existing script:
-   **Idempotency**: All new steps are safe to re-run.
-   **No NestJS Dependency**: The script remains a standalone `ts-node` script.
-   **Clear Output**: Each step provides clear success, failure, or skip messages.

## 2. Existing Script Structure

The current script executes 6 steps. The new steps will be integrated as Step 6 and Step 7, shifting the existing "Seed database" step to become Step 5.

1.  Validate environment variables
2.  Extract DB name & build maintenance connection URL
3.  Create master database (if not exists)
4.  Run `prisma generate` (master schema)
5.  Run `prisma migrate deploy` (master schema)
6.  **[NEW]** Apply `sync-system.sql`
7.  **[NEW]** Create Test institution and tenant DB
8.  **[MODIFIED]** Final output with ROOT credentials

## 3. Detailed Design

### Step 6: Apply `sync-system.sql`

This step will synchronize system-level data (e.g., `permission_groups`, `permissions`) from a canonical SQL file.

**Location:** Inserted after master migration (current step 5) and before the new step 7.

**Implementation:**

1.  **File Path Resolution:**
    -   Construct the absolute path to `scripts/sync-system.sql` relative to the `api/` directory.
    -   `const syncSqlPath = path.resolve(__dirname, '..', '..', 'scripts', 'sync-system.sql');`

2.  **File Read:**
    -   Read the file content into a string using `fs.readFileSync(syncSqlPath, 'utf8')`.
    -   Wrap in a `try...catch` block to handle potential `ENOENT` (file not found) errors.

3.  **Database Execution:**
    -   Create a new `pg.Pool` instance connected to the `MASTER_DATABASE_URL`.
    -   Execute the entire SQL string using `pool.query(sqlContent)`. The file contains its own `BEGIN` and `COMMIT` transactions.
    -   On success, log `✅ System data synchronized.`.
    -   On failure, log the error from `pg` and call `process.exit(1)`.
    -   Ensure the pool is closed in a `finally` block using `pool.end()`.

**Code Snippet:**

```typescript
// ── Step 6: Apply sync-system.sql ─────────────────────
console.log('⏳ Synchronizing system data...');
const masterPool = new Pool({ connectionString: masterUrl });
try {
  const syncSqlPath = path.resolve(__dirname, '..', '..', 'scripts', 'sync-system.sql');
  const sqlContent = fs.readFileSync(syncSqlPath, 'utf8');
  await masterPool.query(sqlContent);
  console.log('✅ System data synchronized.\n');
} catch (err) {
  console.error('❌ Failed to apply sync-system.sql:', (err as Error).message);
  process.exit(1);
} finally {
  await masterPool.end();
}
```

### Step 7: Create Test Institution & Tenant DB

This step creates a fixed, well-known institution for immediate testing and verification after bootstrap.

**Location:** After Step 6.

**Implementation:**

1.  **Constants:**
    -   Define constants for the test institution:
        -   `TEST_INSTITUTION_UUID = '00000000-0000-0000-0000-000000000001'`
        -   `TEST_INSTITUTION_DB_NAME = 'educandow_test'`
        -   `TEST_INSTITUTION_NAME = 'Test Institution'`

2.  **Insert Institution Record (Master DB):**
    -   Create a `pg.Pool` connected to the `MASTER_DATABASE_URL`.
    -   Execute an `INSERT` statement:
        ```sql
        INSERT INTO institutions (id, name, db_name)
        VALUES ($1, $2, $3)
        ON CONFLICT (db_name) DO NOTHING;
        ```
    -   Use the `result.rowCount` to determine if a row was inserted.
        -   If `rowCount === 1`, log `✅ Test institution record created.`.
        -   If `rowCount === 0`, log `⏩ Test institution record already exists, skipping.`.

3.  **Create Tenant Database (Maintenance DB):**
    -   Create a `pg.Pool` connected to the maintenance database (`maintenanceUrl` from Step 2).
    -   Execute `CREATE DATABASE "${TEST_INSTITUTION_DB_NAME}"`.
    -   Wrap in a `try...catch` block. If the error code is `42P04` (duplicate_database), it's a skip condition. Otherwise, it's a fatal error.
        -   On success: `✅ Tenant database 'educandow_test' created.`.
        -   On skip: `⏩ Tenant database 'educandow_test' already exists, skipping.`.
        -   On failure: log error and exit.

4.  **Run Tenant Migrations:**
    -   Construct the `DATABASE_URL` for the new tenant DB.
    -   `const tenantDbUrl = masterUrl.replace(/\/[^/]+$/, `/${TEST_INSTITUTION_DB_NAME}`);`
    -   Use `execSync` to run the tenant migrations. The `cwd` must be the `api/` directory.
        ```typescript
        execSync('npx prisma migrate deploy --schema=prisma_tenant/schema.prisma', {
          stdio: 'inherit',
          cwd: path.resolve(__dirname, '..'),
          env: { ...process.env, DATABASE_URL: tenantDbUrl },
        });
        ```
    -   Log `✅ Tenant migrations applied for 'educandow_test'.\n` on success.
    -   Wrap in `try...catch` to handle non-zero exit codes from `execSync`.

### Modified Final Output

The final success message will be replaced with a more informative block.

**Implementation:**

-   Replace the existing `console.log` lines at the end of the `main` function.
-   Use a formatted block to clearly display the credentials and local development URL.

**Code Snippet:**

```typescript
// ── Done ─────────────────────────────────────────────
console.log('🎉 Bootstrap complete! Master database is ready.');
console.log('──────────────────────────────────────────────────');
console.log('  ROOT Credentials:');
console.log('    Email:    npelizzari@gmail.com');
console.log('    Password: ***REMOVED***');
console.log('');
console.log('  Development URL:');
console.log('    http://localhost:5173');
console.log('──────────────────────────────────────────────────');
```

## 4. Error Handling

-   **File Not Found:** Reading `sync-system.sql` will throw an error if the file is missing, causing the script to exit gracefully with a clear message.
-   **SQL Errors:** Any database query failure (e.g., syntax error, constraint violation) will be caught, logged, and will cause the script to exit with a non-zero code.
-   **Command Execution Errors:** `execSync` will throw an error on a non-zero exit code (e.g., if a migration fails), which is caught to provide context and terminate the script.
-   **Idempotency Checks:** Errors for existing databases (`42P04`) and existing institution records (`ON CONFLICT`) are handled as skip conditions, not failures.

## 5. Dependencies

-   `pg`: Already used in the script.
-   `fs`, `path`, `child_process`: Node.js built-in modules already in use.
-   The script relies on the presence of `scripts/sync-system.sql` and `prisma_tenant/schema.prisma`.

This design directly implements the requirements from the proposal and spec documents, integrating seamlessly into the existing bootstrap logic.
