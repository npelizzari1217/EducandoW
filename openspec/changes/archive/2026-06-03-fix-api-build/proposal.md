# Proposal: Fix API Build After Domain VOs Migration

## Intent

`domain-cleanup` introduced `Id`, `EducationalLevel`, `EducationalModality`, and `EnrollmentStatus` VOs in the domain layer. The API layer still passes raw types (`string` for IDs, `number` for levels/modalities, raw strings for status), causing 11 TypeScript build errors.

## Scope

### In Scope
- Fix 4 repository files: `academic-cycle`, `enrollment`, `student`, `teacher` — update `toDomain`/`toPersistence` to use VOs
- Fix 3 use case files: pedagogy, student, teacher — wrap raw inputs in VOs before passing to domain entities
- Fix `enrollment.status` serialization: convert `EnrollmentStatus` VO to `string` for Prisma writes
- Verify `pnpm build` passes, 284+ tests pass, `pnpm lint` passes

### Out of Scope
- Domain layer changes (already done in `domain-cleanup`)
- Controller/DTO layer (no build errors there)
- New features or behavior changes

## Capabilities

### New Capabilities
<!-- None — this is a pure type-fix, no new capabilities -->

### Modified Capabilities
<!-- No spec-level changes — all fixes are implementation-level adaptations to existing VOs -->
- None

## Approach

Apply VO constructors at the boundary layer (repositories, use cases):
- Repository `toDomain`: wrap raw DB values with `EducationalLevel.fromCode()`, `EducationalModality.fromCode()`, `Id.create()`/`Id.reconstruct()`, `EnrollmentStatus.reconstruct()`
- Repository `toPersistence`: extract primitive from VOs (`.code`, `.value`, `.get()`) for Prisma writes
- Use cases: wrap DTO inputs with `Id.create()`, `EducationalLevel.fromCode()`, `EducationalModality.fromCode()` before passing to domain entity factories

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `api/src/infrastructure/persistence/prisma/repositories/prisma-academic-cycle.repository.ts` | Modified | Fix level/modality in toDomain/toPersistence |
| `api/src/infrastructure/persistence/prisma/repositories/prisma-enrollment.repository.ts` | Modified | Fix status serialization + toDomain cast |
| `api/src/infrastructure/persistence/prisma/repositories/prisma-student.repository.ts` | Modified | Fix institutionId in toDomain |
| `api/src/infrastructure/persistence/prisma/repositories/prisma-teacher.repository.ts` | Modified | Fix institutionId in toDomain |
| `api/src/application/pedagogy/use-cases/pedagogy.use-cases.ts` | Modified | Fix level/modality in create |
| `api/src/application/student/use-cases/student.use-cases.ts` | Modified | Fix institutionId in create |
| `api/src/application/teacher/use-cases/teacher.use-cases.ts` | Modified | Fix institutionId in create |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Prisma runtime serialization fails (VOs objects instead of primitives) | Low | Fix `toPersistence` to extract `.code`/`.value`/`.get()` |
| Test fixtures use old types | Medium | Update test files after build passes |
| Missed a file with implicit type cast | Low | Verify with full `pnpm build` + `pnpm test` |

## Rollback Plan

`git stash` the fix-api-build changes. Domain VOs are in `packages/domain/dist/` (committed in domain-cleanup). If fix breaks, revert API commits only.

## Dependencies

- `domain-cleanup` change (already applied to `packages/domain/dist/`)

## Success Criteria

- [ ] `pnpm build` passes in API (0 TypeScript errors)
- [ ] `pnpm test` passes in API (284+ tests)
- [ ] `pnpm lint` passes in API
