# Tasks: Bootstrap Enhancements

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 50-70 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | All bootstrap enhancements | PR 1 | Single file, single PR |

## Phase 1: System Sync SQL (Step 6)

- [x] 1.1 Add `applySyncSql(pool, sqlPath)` function — reads SQL file with `fs.readFileSync`, executes via `pool.query()`, closes pool in `finally`
- [x] 1.2 Insert Step 6 after seed (current Step 6) — call `applySyncSql` with master Pool, resolve path via `path.resolve(__dirname, '..', '..', 'scripts', 'sync-system.sql')`

## Phase 2: Test Institution Creation (Step 7)

- [x] 2.1 Insert institution record in master DB — `INSERT INTO institutions (id, name, db_name) VALUES (...)` with `ON CONFLICT (db_name) DO NOTHING`; use `rowCount` to print success or skip
- [x] 2.2 CREATE DATABASE `educandow_test` via maintenance Pool; catch `42P04` as skip, any other error exits
- [x] 2.3 Run `npx prisma migrate deploy --schema=prisma_tenant/schema.prisma` with `DATABASE_URL` set to tenant DB URL; on failure print error and exit

## Phase 3: Output & Verification

- [x] 3.1 Replace final output block with ROOT credentials (email, password, role, URL) and keep the success banner
- [x] 3.2 Run `pnpm bootstrap` twice — second run MUST complete without errors (idempotency check)
- [x] 3.3 Verify ROOT login works at `http://localhost:5173` with `npelizzari@gmail.com` / `***REMOVED***`
