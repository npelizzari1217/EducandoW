# Proposal: Bootstrap Enhancements

## Intent

The existing bootstrap script creates a bare master DB. New instances need system data matching dev, a working test institution to verify the system immediately, and clear first-login credentials visible in the output.

## Scope

### In Scope
- Execute `scripts/sync-system.sql` against master DB after migrations (step 6)
- Create a "Test" institution with dedicated tenant DB (step 7)
- Display ROOT user credentials (`npelizzari@gmail.com` / `***REMOVED***`) in final output

### Out of Scope
- Institution deletion or cleanup commands
- Tenant DB seeding (grade scales, attendance statuses)
- Interactive prompts or multi-institution creation
- Environment variable additions beyond existing `.env`

## Capabilities

### New Capabilities
None — all additions are extensions of the existing bootstrap flow.

### Modified Capabilities
- `master-database-bootstrap`: Bootstrap flow expands from 5 to 7 steps. System data sync step MUST execute before institution creation. Final output MUST include ROOT credentials.

## Approach

**Step 6 — Sync system data**: Read `scripts/sync-system.sql` as a string, execute via `pg.Pool.query()` against the master DB URL. The SQL file uses `BEGIN/COMMIT` with `INSERT ... ON CONFLICT DO UPDATE`, making it safely idempotent. Run AFTER step 5 (seed) so master tables exist but the sync file is the authoritative source of dev system configuration.

**Step 7 — Test institution**: Connect to maintenance DB via Pool (same pattern as step 3). Generate a fixed UUID (`00000000-0000-0000-0000-000000000001`), compute `db_name` as `educandow_{id}`. INSERT into `institutions` with `ON CONFLICT (id) DO NOTHING`. CREATE DATABASE for the tenant. Run `npx prisma migrate deploy --schema=prisma_tenant/schema.prisma` with `DATABASE_URL` pointing to the tenant DB. All steps are idempotent — re-running bootstrap skips existing DB and institution record.

**Output enhancement**: Print a dedicated credentials block after the final success line with email and password.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `api/scripts/bootstrap.ts` | Modified | Add 2 new steps (sync-system.sql execution, Test institution creation), update final output |
| `scripts/sync-system.sql` | Referenced | Read and executed at runtime — no modifications needed |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| sync-system.sql fails because master tables don't exist | Low | Runs after step 5 (seed), which creates all tables |
| Tenant migrations fail (schema mismatch) | Low | Uses same `prisma migrate deploy` as production institution creation; tested per deploy |
| Fixed UUID collision with real institution | Low | UUID is all-zeros, statistically impossible to collide; `ON CONFLICT DO NOTHING` as safety net |

## Rollback Plan

Drop the tenant database `educandow_00000000-0000-0000-0000-000000000001` and delete the institution row from master. The bootstrap script itself is idempotent — re-running it skips already-completed steps.

## Dependencies

- `scripts/sync-system.sql` must exist (already present)
- `prisma_tenant/schema.prisma` must exist (already present)
- `MASTER_DATABASE_URL` must be set

## Success Criteria

- [ ] `pnpm bootstrap` completes all 7 steps without errors on a fresh PostgreSQL instance
- [ ] `pnpm bootstrap` is idempotent — second run skips existing DBs and records
- [ ] ROOT user credentials are explicitly printed in the final output
- [ ] Test institution appears in institutions list after bootstrap
- [ ] Test institution tenant DB has all 42 pedagogical tables created
