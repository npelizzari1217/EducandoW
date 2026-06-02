# Proposal: Academic Cycle Refactor

## Intent

`code` is locked to 4 numeric digits — institutions can't use natural IDs like `CICLO-2026-A`. `description` is redundant (`name` already conveys semantics). Remove both constraints.

## Scope

### In Scope
- `code`: 4 numeric → alphanumeric uppercase, max 15 chars, retains `@unique`
- `description`: delete from all layers (Prisma, entity, DTOs, use cases, controller, frontend types, UI forms, tables, seed, barrel exports, tests)
- DB migration: drop `description` column
- All affected tests updated

### Out of Scope
- Uniqueness semantics change
- New fields
- Cross-entity changes beyond dropping `description` from response data

## Capabilities

### Modified Capabilities
- **academic-cycle-query**: `code` format changes; `description` removed from response. Level: ALL.

### Implementation-Only Changes
- **course-cycle**: internal response drops `description` from joined cycle data
- **Frontend pages**: `academic-cycles` page

## Approach

Bottom-up: VO (`CycleCode` regex → alphanumeric 1–15) → entity (`description` removed from props/inputs/getter/update) → use cases (drop `CycleDescription` calls, update DTOs) → Prisma schema/repo (drop column/mapping) → controller (`toCycleResponse` drops description) → frontend types → UI. Delete `CycleDescription` VO, test file, and error class. Update barrel exports.

## Affected Areas

| Area | Impact |
|------|--------|
| `packages/domain/.../cycle-code.ts` + test | Modified |
| `packages/domain/.../cycle-description.ts` + test | Removed |
| `packages/domain/.../academic-cycle.ts` (entity + test) | Modified |
| `packages/domain/.../academic-cycle.errors.ts` | Modified |
| `packages/domain/.../pedagogy/index.ts` + `.../domain/src/index.ts` | Modified |
| `api/.../pedagogy.use-cases.ts` + test | Modified |
| `api/.../prisma-academic-cycle.repository.ts` | Modified |
| `api/prisma/schema_tenant.prisma` | Modified |
| `api/.../academic-cycle.dto.ts` | Modified |
| `api/.../pedagogy.controller.ts` | Modified |
| `web/src/types/academic-cycle.ts` | Modified |
| `web/src/pages/dashboard/academic-cycles.tsx` | Modified |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Existing 4-digit codes are subset of new format | None | Backward-compatible |
| `description` data lost | Certain | Intentional; no value in preserving |
| Code collisions across tenants | Low | `@unique` retained; institutions design per-tenant |

## Rollback Plan

1. Revert migration (restore `description` column)
2. Git revert commit
3. Revert `CycleCode` regex to `^\d{4}$`
4. Restore `CycleDescription` VO and re-add to all layers

## Dependencies

None. Standalone change.

## Success Criteria

- [ ] `CycleCode.create('2026-PRIM')` OK; `abc` (lowercase) rejected; 16-char rejected
- [ ] `code` present but `description` absent from `GET /v1/academic-cycles` response
- [ ] `description` column gone from `academic_cycles` table
- [ ] All existing tests pass with updated assertions
- [ ] Frontend code input accepts 15 chars; no description field visible
