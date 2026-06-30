# Tasks: student-guardian-cleanups

## Checklist

- [x] **Fix 8** — pass-through guard for fatherEmail/motherEmail on PATCH
  - File: `api/src/application/student/use-cases/student.use-cases.ts` (~lines 238-255)
  - Test: `api/src/application/student/use-cases/__tests__/patch-student-email-guard.test.ts` (6 tests, RED→GREEN)

- [x] **Fix 9** — consolidate duplicate guardian projections
  - Files: `api/src/application/student/use-cases/student.use-cases.ts` (GuardianOutput type + toGuardianOutput), `api/src/presentation/student/student.controller.ts` (remove mapGuardian, update 4 call sites)
  - Updated: `api/test/integration/guardians.test.ts:427` (userId: undefined → null)
  - Test: `api/src/application/student/use-cases/__tests__/guardian-output.test.ts` (9 tests, RED→GREEN)

- [x] **Fix 10** — drop redundant student refetch in web detail
  - Files: `web/src/pages/dashboard/students.tsx` (remove loadStudentDetail, update handleSelectDetail), `web/src/pages/dashboard/student-detail.utils.ts` (new: deriveDetailStudent pure function)
  - Updated: `web/src/pages/dashboard/__tests__/students.test.tsx` (T3.3: remove old GET assertion, add fatherEmail to mockStudent)
  - Test: `web/src/pages/dashboard/__tests__/student-detail-utils.test.ts` (6 tests, RED→GREEN)
