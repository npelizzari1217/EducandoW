# Delta for Tenant Database

## ADDED Requirements

### Requirement: Tenant Seed Scripts MUST Be Idempotent

All tenant database seed scripts (`seed-tenant.ts`, `seed.ts` exported functions) MUST use `upsert()` for reference data insertion. Running any tenant seed script multiple times against the same database MUST NOT crash with unique constraint violations.

#### Scenario: Tenant seed runs twice without error

- GIVEN a tenant database with seed already applied
- WHEN `seed-tenant.ts` is executed a second time
- THEN no unique constraint violation occurs
- AND all reference data (attendance statuses, grade scales, grade scale values) remains correct
- AND the script exits with code 0

#### Scenario: seedAttendanceStatuses is idempotent

- GIVEN attendance statuses PRE, AUS, TAR, JUS, RET already exist in the tenant DB
- WHEN `seedAttendanceStatuses()` is called again
- THEN existing records are updated in-place (not duplicated)
- AND no error is thrown

#### Scenario: seedGradeScales is idempotent

- GIVEN grade scales (gs-primaria, gs-inicial, gs-secundaria, gs-terciaria) and their values already exist
- WHEN `seedGradeScales()` is called again
- THEN existing records are updated in-place (not duplicated)
- AND no error is thrown

#### Scenario: Non-idempotent seed file detected

- GIVEN any tenant seed file using `create()` or `createMany()` without `skipDuplicates` for reference data
- WHEN a developer or CI pipeline reviews or runs it
- THEN it SHALL be rejected as non-conformant with this requirement
