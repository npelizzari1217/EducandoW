# Tasks: Bootstrap Script

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 140–170 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Configuration Setup

- [x] 1.1 Add `MASTER_DATABASE_URL` and `ENCRYPTION_KEY` (with format hints and `openssl rand -hex 32` comment) to `.env.example` (ROOT level — not api/.env.example)
- [x] 1.2 Add `"bootstrap": "ts-node scripts/bootstrap.ts"` to the `scripts` block in `api/package.json`

## Phase 2: Core Script (api/scripts/bootstrap.ts)

- [x] 2.1 Create `api/scripts/bootstrap.ts` — scaffold main async function with error boundary, load env from `.env` (using project's established minimal loader — no dotenv dependency needed), and validate `MASTER_DATABASE_URL` presence + `ENCRYPTION_KEY` is exactly 32 bytes (exit 1 on failure, warn if `NODE_ENV` ≠ `development`)
- [x] 2.2 Extract target database name from the last path segment of `MASTER_DATABASE_URL` (using URL constructor for reliable parsing), build maintenance connection URL (replace db name with `postgres`), and connect via `pg.Pool` — exit 1 on connection failure
- [x] 2.3 Execute `CREATE DATABASE` via the maintenance pool; catch error code `42P04` (already exists) as success with skip message; propagate other errors as fatal
- [x] 2.4 Shell out via `execSync` (stdio `inherit`) in order: `npx prisma generate --schema=prisma_master/schema.prisma`, `npx prisma migrate deploy --schema=prisma_master/schema.prisma`, `npx ts-node prisma/seed.ts` — exit 1 on any failure, pass full `process.env`
- [x] 2.5 Wrap each step with `⏳` / `✅` / `❌` / `⏩` emoji output per the design doc: announce step, print result, and print a final success summary on completion

## Phase 3: Verification

- [ ] 3.1 Run `pnpm bootstrap` from `api/` twice — confirm idempotent: second run succeeds as no-op (spec §Database Creation, §Migrations, §Seeding)
- [ ] 3.2 Run without `MASTER_DATABASE_URL` and with `ENCRYPTION_KEY` at wrong length — confirm clear error messages and non-zero exit (spec §Environment Validation)
- [ ] 3.3 Run with `ENCRYPTION_KEY` as 32 hex bytes and `NODE_ENV=production` — confirm warning prints but script proceeds (spec §NODE_ENV)

