# Proposal: Promotion & Printing Flags for Enrollments

## Intent

Admin/secretary staff need per-student boolean flags to control report card printing and grade promotion, mirroring WINDEV legacy `ImprimeSN`/`PromueveSN`. Current `Enrollment` lacks both flags and bulk-toggle.

## Pedagogical Level

ALL (INICIAL, PRIMARIO, SECUNDARIO, TERCIARIO).

## Scope

### In Scope
- Add `printable` (default `true`) and `promoted` (default `false`) to Enrollment DB model
- Extend domain entity with boolean props and toggle methods
- `EnrollmentRepository.findByCourse()` query by cycle, level, year, grade, division
- `PATCH /enrollments/:id/flags` — toggle per enrollment
- `PATCH /enrollments/course/:cycleId/flags` — bulk-toggle all students in a course
- ADMIN/SECRETARIO role guard on both endpoints

### Out of Scope
- Report card PDF generation (future `report-cards-pdf`)
- UI table with flag checkboxes (separate frontend change)
- WINDEV historical data migration

## Capabilities

### Modified Capabilities
- **`enrollment-status`**: Enrollment entity gains `printable` and `promoted` booleans with defaults; repository adds `findByCourse`; two new PATCH endpoints for single and bulk flag toggling.

## Approach

Additive change — no existing fields or endpoints modified. New Prisma columns with migration. Entity gets `togglePrintable()` and `togglePromoted()`. `ToggleEnrollmentFlagsUseCase` uses existing `findById`/`save`; `BulkToggleEnrollmentFlagsUseCase` queries by course criteria and iterates. Controller exposes two PATCH routes.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `api/prisma_tenant/schema.prisma` | Modified | New boolean columns |
| `packages/domain/.../enrollment/entities/` | Modified | Props, getters, toggle methods |
| `packages/domain/.../enrollment/repositories/` | Modified | `findByCourse()` interface |
| `api/.../application/enrollment/` | Modified | Two new use cases |
| `api/.../presentation/enrollment/` | Modified | PATCH routes, DTOs, Zod schemas |
| `api/.../infrastructure/db/` | Modified | Prisma impl for new columns + query |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Default mismatch with WINDEV legacy data | Low | Safe defaults; migration script can override later |
| Bulk toggle perf on large courses | Low | Filtered queries; `updateMany` where appropriate |

## Rollback Plan

1. Revert migration (drop columns)
2. Remove PATCH routes and use cases
3. Revert entity and repository changes
Backward-safe: no data cleanup needed.

## Dependencies

None. Consumed by future `report-cards-pdf`.

## Success Criteria

- [ ] `printable` (default `true`) and `promoted` (default `false`) columns added
- [ ] `PATCH /enrollments/:id/flags` toggles single enrollment
- [ ] `PATCH /enrollments/course/:cycleId/flags` bulk-toggles by course
- [ ] Entity rejects non-boolean values with `ValidationError`
- [ ] All existing tests pass (no regression)
- [ ] Endpoints return 401 unauthenticated / 403 unauthorized
