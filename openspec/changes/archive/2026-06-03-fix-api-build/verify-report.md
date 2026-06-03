# Verify Report: Fix API Build

## Build

| Check | Result |
|-------|--------|
| `pnpm build` | ✅ Passed — 0 TypeScript errors, 211 files compiled |
| SWC compilation | ✅ 444ms |

## Tests

| Check | Result |
|-------|--------|
| Test files | 40 passed |
| Test count | 284 passed |
| Duration | 12.46s |

## Lint

| Check | Result |
|-------|--------|
| `pnpm lint` | ✅ No violations |

## Success Criteria

| Criterion | Status |
|-----------|--------|
| `pnpm build` passes in API | ✅ |
| `pnpm test` passes (284+ tests) | ✅ 284 passed |
| `pnpm lint` passes | ✅ |

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `packages/domain/src/index.ts` | Modify | Fixed `EnrollmentStatus` export from type-only to value export; added `EnrollmentStatusValue` type export |
| `packages/domain/src/enrollment/entities/index.ts` | Modify | Added `EnrollmentStatusValue` type re-export |
| `api/src/infrastructure/.../prisma-academic-cycle.repository.ts` | Modify | wrap level/modality in VOs in toDomain; extract `.code` in toPersistence |
| `api/src/infrastructure/.../prisma-enrollment.repository.ts` | Modify | status `.value` for writes; `EnrollmentStatus.reconstruct()` for reads |
| `api/src/infrastructure/.../prisma-student.repository.ts` | Modify | `Id.create()` for institutionId |
| `api/src/infrastructure/.../prisma-teacher.repository.ts` | Modify | `Id.create()` for institutionId |
| `api/src/application/pedagogy/use-cases/pedagogy.use-cases.ts` | Modify | import and wrap level/modality with VOs |
| `api/src/application/student/use-cases/student.use-cases.ts` | Modify | import `Id` and wrap institutionId |
| `api/src/application/teacher/use-cases/teacher.use-cases.ts` | Modify | import `Id` and wrap institutionId |

## Root Cause Discovery

`EnrollmentStatus` was exported as `export type` from the domain package main barrel (`packages/domain/src/index.ts` line 35), making it a type-only import in consumers. The class itself (with `reconstruct()`, `fromCode()`, `.value`) was not available at runtime. Fixed by changing to `export { EnrollmentStatus }` (value export).
