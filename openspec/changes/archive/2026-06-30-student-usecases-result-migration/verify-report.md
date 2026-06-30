# Verify Report: student-usecases-result-migration

**Date**: 2026-06-30  
**Verdict**: PASS (clean)  
**CRITICAL**: 0 | **WARNING**: 0 | **SUGGESTION**: 1

---

## Test Suite Results

| Workspace | Files | Tests | Status |
|-----------|-------|-------|--------|
| `api` | 184 | 1815 | ALL PASS |
| `web` | 46 | 533 | ALL PASS |
| **Total** | **230** | **2348** | **ALL PASS** |

Run command: `pnpm --filter api test` + `pnpm --filter web test`  
Known pre-existing item: `subject-group-filter.db.test.ts` excluded from vitest run (pre-existing, not a regression of this change).

---

## REQ Coverage Table

| REQ | Description | Check | Status |
|-----|-------------|-------|--------|
| REQ-01 | 4 use-cases return Result, never throw DomainError | `rg "throw new (NotFoundError\|ForbiddenError\|ValidationError\|DomainError)"` on `student.use-cases.ts` → empty; `rg "throw new"` on same file → empty | PASS |
| REQ-02 | throwGuardianError() ForbiddenError → ForbiddenException (403) | Controller lines 214-216: `if (error instanceof ForbiddenError) throw new ForbiddenException(msg)` — placed before DomainError fallthrough. Tests: `throw-guardian-error.spec.ts` (positive + negative assertions) | PASS |
| REQ-03 | PATCH /students/:id HTTP status parity (404/403×3/400/200) | `patch` handler (lines 86-88): unwraps Result, throws unwrapErr → AppExceptionFilter maps NotFoundError→404, ForbiddenError→403, ValidationError→400. Success → `{ data: mapStudent(unwrap()) }`. All 5 sub-scenarios confirmed by `patch-student.use-case.spec.ts` + `patch-student.use-case.test.ts` | PASS |
| REQ-04 | DELETE /students/:id/guardians/:guardianId HTTP status parity (404/204) | `removeGuardian` handler (lines 194-195): drops try/catch, uses `throwGuardianError(result.unwrapErr())`. NotFoundError→404 via mapper. Success → 204 (HttpCode.NO_CONTENT, void return). Tests: `remove-guardian.use-case.spec.ts` (A/B/C), `student-controller-guardian-error.test.ts` | PASS |
| REQ-05 | GET /students/:id/guardians HTTP status parity (404/200) | `listGuardians` handler (lines 121-124): throws unwrapErr → AppExceptionFilter → 404 on err; returns `{ data: result.unwrap() }` on ok. Tests: `list-guardians.use-case.spec.ts` | PASS |
| REQ-06 | GET /students/me HTTP status parity (404/200) | `me` handler (lines 48-51): throws unwrapErr → AppExceptionFilter → 404 on err; returns `{ data: mapStudent(result.unwrap()) }` on ok. Tests: `get-my-student-data.use-case.spec.ts`, `get-my-student-data.use-case.test.ts` | PASS |
| REQ-07 | Success paths unchanged (body shape, status, headers) | All handler success branches return `{ data: ... }` with the same shape as pre-migration. `mapStudent()` function untouched. | PASS |
| REQ-08 | Non-domain errors still propagate as throws | All 4 migrated use-case `execute()` methods have bare `await` on repo calls (no try/catch). PatchStudent.save (line 188): bare await. RemoveGuardian.delete (line 638): bare await. ListGuardians repo calls (lines 686-690): bare awaits. GetMyStudentData.findByUserId (line 304): bare await. Infra exceptions propagate directly → AppExceptionFilter → 500. | PASS |
| REQ-09-A | 5 stale assertions in patch-student-email-guard.test.ts updated | 6 assertions updated (exceeds requirement — see SUGGESTION-01). All use `r.isOk()`, `result.isOk()`, `.resolves.toSatisfy(r => r.isOk() === true)`, `result.unwrap().[property]` | PASS |
| REQ-09-B | 7 required error-path unit tests added | All 7 scenarios covered: PatchStudent (not found, STUDENT editing other, invalid email — Tests A/B/E in `patch-student.use-case.spec.ts`); RemoveGuardian (missing, mismatch — Tests A/B in `remove-guardian.use-case.spec.ts`); ListGuardians (student not found — `list-guardians.use-case.spec.ts`); GetMyStudentData (no student — `get-my-student-data.use-case.spec.ts`) | PASS |

---

## Zero-Throw Verification (REQ-01)

Scoped to `PatchStudentUseCase`, `RemoveGuardianUseCase`, `ListGuardiansUseCase`, `GetMyStudentDataUseCase` in `api/src/application/student/use-cases/student.use-cases.ts`.

Command run: `rg "throw new (NotFoundError|ForbiddenError|ValidationError|DomainError)"` — no output (empty).  
Command run: `rg "throw new"` — no output (empty) for the entire file.

Infra-rethrow `throw e` in `AssignGuardianUseCase`, `CreateStudyTutorUseCase`, `UpdateStudyTutorUseCase` are out-of-scope (pre-existing, intentional convention per REQ-08 and spec Out of Scope clause).

---

## Private Method Purity Verification (REQ-01 / Design)

- `checkOwnership()`: returns `Promise<Result<void, ForbiddenError>>` — no throws (lines 196-218)
- `validateAllowedFields()`: returns `Result<void, ForbiddenError>` — no throws (lines 224-238)
- `resolveEmailField(bodyVal, stored)`: returns `Result<Email|undefined, ValidationError>` — 4 branches: absent→ok(stored), falsy→ok(undefined), unchanged→ok(stored), changed→Email.create(raw) — no throws (lines 249-257)
- `applyChanges(student, body, emails)`: pure — receives 3 resolved Email VOs, no email logic inside, no throws (lines 263-294)

---

## throwGuardianError() Branch Order (REQ-02 / Design)

Confirmed order in controller (lines 206-222):
1. `GUARDIAN_ALREADY_ASSIGNED` / `TUTOR_DUPLICATE_NAME` → ConflictException (409)
2. `NotFoundError` / `GUARDIAN_NOT_FOUND` → NotFoundException (404)
3. `ForbiddenError` → ForbiddenException (403) ← **NEW in PR-1**
4. `ValidationError` / `DomainError` → BadRequestException (400)
5. unknown/infra → re-throw (500 via AppExceptionFilter)

ForbiddenError branch is correctly placed BEFORE the DomainError catch-all — ForbiddenError extends DomainError, so order matters.

---

## Tasks Completion (openspec tasks.md)

All 15 tasks marked `[x]`:
- TASK-01 [x] through TASK-15 [x] — confirmed via grep on `openspec/changes/student-usecases-result-migration/tasks.md`

---

## Findings

### SUGGESTION-01: patch-student-email-guard.test.ts updated 6 assertions instead of spec's 5

**Severity**: SUGGESTION  
**File**: `api/src/application/student/use-cases/__tests__/patch-student-email-guard.test.ts`  
**Detail**: TASK-09 spec prescribed updating exactly 5 assertions (2 `.resolves.toBeDefined()` + 3 raw property accesses). Implementation updated 6 (2 + 4 raw property accesses). The extra assertion caught an additional stale access to `result.unwrap().motherEmail` that was not in the original audit. This is a positive outcome — no risk, more complete coverage. No action required.

---

## New Files Created

| File | Role |
|------|------|
| `api/src/presentation/student/__tests__/throw-guardian-error.spec.ts` | REQ-02 test (2 tests) |
| `api/src/application/student/use-cases/__tests__/list-guardians.use-case.spec.ts` | REQ-09-B ListGuardians (2 tests) |
| `api/src/application/student/use-cases/__tests__/remove-guardian.use-case.spec.ts` | REQ-09-B RemoveGuardian A/B/C (3 tests) |
| `api/src/application/student/use-cases/__tests__/patch-student.use-case.spec.ts` | REQ-09-B PatchStudent Tests A-E (5 tests) |
| `api/src/application/student/use-cases/__tests__/get-my-student-data.use-case.spec.ts` | REQ-09-B GetMyStudentData (1 test) |

## Modified Files

| File | Changes |
|------|---------|
| `api/src/application/student/use-cases/student.use-cases.ts` | 4 use-cases migrated; PatchStudent private methods threaded |
| `api/src/presentation/student/student.controller.ts` | 4 handlers unwrapped; ForbiddenError/403 branch added to throwGuardianError() |
| `api/src/application/student/use-cases/__tests__/patch-student-email-guard.test.ts` | 6 stale assertions made Result-aware |
| `api/test/unit/patch-student.use-case.test.ts` | Result-aware assertions |
| `api/test/unit/get-my-student-data.use-case.test.ts` | Result-aware assertions |
| `api/test/unit/remove-guardian.use-case.test.ts` | Result-aware assertions |
| `api/test/unit/student-controller-guardian-error.test.ts` | Updated for Result migration |
| `api/test/integration/guardians.test.ts` | 6 stale assertions updated |

---

## Conclusion

The implementation fully satisfies all 9 requirements. No CRITICAL or WARNING issues found. The change is safe to archive.

**Next recommended phase**: `sdd-archive`
