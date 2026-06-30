# Proposal: student-guardian-cleanups

## Intent
Three low-risk mechanical cleanups deferred from PR #82 code-review comment #7.
No behavioral changes to existing features — correctness and response-shape preserved throughout.

## Scope
- **Fix 8**: Add pass-through guard for `fatherEmail`/`motherEmail` on PATCH, mirroring the guard already in place for `student.email`. Prevents re-validation of unchanged legacy values.
- **Fix 9**: Consolidate duplicate guardian projections (`toGuardianOutput` + `mapGuardian`) into a single null-normalizing projection. Removes dead code path; HTTP response shape unchanged.
- **Fix 10**: Remove redundant `GET /students/:id` in `loadStudentDetail`. Read `fatherEmail`/`motherEmail` from the already-loaded list row via `deriveDetailStudent` utility.

## Risk
LOW — all three are cleanups with no user-visible behavior changes. Full TDD coverage.
