# Proposal: student-usecases-result-migration

## Intent

The student application layer still throws to signal errors, violating the project standard that mandates `Promise<Result<T, DomainError>>` returns. Eliminate every `DomainError` throw across the student use-cases while preserving the EXACT current HTTP status codes (404 / 403 / 400). Success means the application layer no longer throws domain errors, behavior is byte-identical at the HTTP boundary, and the file fully matches the three already-migrated use-cases beside it (AssignGuardian, CreateStudyTutor, UpdateStudyTutor).

This is registered debt from the responsables-y-tutores verify report. Doing it now closes the standard-compliance gap in a single file before the pattern divergence grows.

## Scope

In scope (`api/src/application/student/use-cases/student.use-cases.ts`):
- PatchStudentUseCase — 5 throws (1×NotFound/404, 3×Forbidden/403, 1×Validation/400 via resolveEmail).
- RemoveGuardianUseCase — 2 throws (NotFound/404).
- ListGuardiansUseCase — 1 throw (NotFound/404).
- GetMyStudentDataUseCase — 1 throw (NotFound/404). INCLUDED: identical debt in the same file; excluding it would leave a partial, inconsistent migration.
- `throwGuardianError()` fix: add `ForbiddenError → ForbiddenException (403)` before the `DomainError` catch.
- `student.controller.ts`: unwrap `Result` at each affected handler.
- Tests: update 5 stale assertions in `patch-student-email-guard.test.ts`; add error-path tests per migrated use-case.

Out of scope:
- Infra-layer rethrows (`throw e` for non-domain errors) — intentional convention, kept.
- Any non-student use-cases or controllers.

## Approach (A — full migration)

Convert each `execute()` (and supporting private methods) to return `Result<T, DomainError>` using `ok()/err()`, mirroring the proven in-file pattern. PatchStudent threads email resolution out of `applyChanges()` into `execute()`.

Mandatory implementation order for HTTP parity:
1. Extend `throwGuardianError()` with ForbiddenError → 403 (safe additive change, FIRST).
2. Migrate ListGuardiansUseCase (1 site) + handler.
3. Migrate RemoveGuardianUseCase (2 sites) + handler.
4. Migrate PatchStudentUseCase (5 sites, most complex) + GetMyStudentData last.

## Acceptance

- Zero `DomainError` throws remain in the 4 use-cases.
- HTTP status codes byte-identical (404/403/400) at every affected endpoint.
- Full test suite green.
- New error-path tests added per migrated use-case.

## Risks

- HTTP parity: routing Patch errors through `throwGuardianError()` would downgrade 403→400 unless the ForbiddenError branch is added FIRST. Highest-priority guard.
- `applyChanges()` email-resolution threading: refactor must keep the ValidationError/400 path intact when lifting `resolveEmail()` into `execute()`.
