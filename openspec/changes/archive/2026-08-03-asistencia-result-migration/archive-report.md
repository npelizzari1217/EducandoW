# Archive Report — asistencia-result-migration

**Status**: PASS (Verified 0 CRITICAL, 0 WARNING, 0 SUGGESTION)
**Date Archived**: 2026-08-03
**Change Closed**: Complete SDD cycle archived.

## Executive Summary

The `asistencia-result-migration` change (épico error-handling, largest slice) has been fully implemented, verified, and archived. All 4 stacked delivery slices completed successfully. The entire `asistencia` module (6 use-cases, 7 controller endpoints, 117 tests) is now 100% Result-shaped with zero throws and zero behavior change. The 13 commits deliver 41 throw→err migrations across 22 ForbiddenError + 19 intrinsic DomainErrors. This is a **consumer** of the `application-error-handling` canonical capability — no new capability spec is created; instead the canonical `openspec/specs/application-error-handling/spec.md` was updated to mark `asistencia` as FULLY MIGRATED. Ready for the error-handling épico to continue with remaining modules.

## Delivery Summary

| Slice | Branch | Commits | Status | Tests |
|---|---|---|---|---|
| 1 — list pair | `refactor/asistencia-result-a` | 3 (e52aab0, 7b7d16a, 16860f3) | PASS | 207/207 green |
| 2 — record-general | `refactor/asistencia-result-b` | 3 (3909d3d, 6483aa5, d9136d9) | PASS | 207/207 green |
| 3 — record-subject | `refactor/asistencia-result-c` | 3 (9b45ad1, 4c49e27, 221004e) | PASS | 212/212 green |
| 4 — generate + month-status | `refactor/asistencia-result-d` | 4 (cf45d7d, dc7d381, 6393f2b, 1d36bbe) | PASS | 212/212 green |
| **Aggregate** | **refactor/asistencia-result-d** (main branch) | **13 commits** | **PASS** | **212/212 asistencia-scoped, 2187/2188 full suite** |

## Final Verification Results

### Test Coverage
- **asistencia-scoped**: `pnpm --filter api test -- asistencia` → **212/212 passed** (16 test files covering all 6 use-cases + controller)
- **Full suite**: `pnpm --filter api test` → **2187/2188 passed** (1 pre-existing unrelated failure in `archive-legacy-grading-data.spec.ts`, Windows path-separator issue, confirmed at every slice)
- **Typecheck**: `pnpm --filter api typecheck` → **Clean, no errors**
- **Coverage**: ≥ 80% per TDD requirement (refactor-style, no status RED-first, all assertions updated)

### Specification Compliance

| Requirement | Status | Evidence |
|---|---|---|
| **ASRM-R1** (no throw) | PASS | All 41 throws across 6 use-cases converted to `return err(...)` — verified via apply-progress slice-by-slice commits |
| **ASRM-R2** (HTTP status preserved) | PASS | No `DOMAIN_STATUS` edit; ForbiddenError→403 already in place; controller identity rewrites (CTR-T02/T04/T06) confirm status unchanged |
| **ASRM-R3** (ForbiddenError stays DomainError) | PASS | No reclassification in diff; ForbiddenError definition file not touched; `instanceof DomainError` remains true |
| **ASRM-R4** (return-type widening) | PASS | All 6 use-cases widened to `Promise<Result<T, ErrorUnion>>`; list use-cases, record-* use-cases, generate-monthly union expanded, month-status use-cases widened |
| **ASRM-R5** (controller idiom + cleanup) | PASS | All 7 endpoints adopt `if (result.isErr()) throw result.unwrapErr()` idiom; 5 redundant try/catch blocks removed; dead ForbiddenException + ForbiddenError imports removed in Slice 4 |
| **ASRM-R6** (no new error classes) | PASS | Zero new error classes introduced; 7 inventoried error types reused as-is; no auth module files in diff |
| **ASRM-R7** (4 stacked slices, independently green) | PASS | Each slice independently verified green before next; all 4 branches created; final branch `refactor/asistencia-result-d` aggregates all 4 |

### Guardrails Held

- **ForbiddenError classification**: Not reclassified to `ApplicationError` (deferred per ASRM-R3); stays `extends DomainError`
- **DOMAIN_STATUS**: No edits; `FORBIDDEN: 403` already mapped correctly
- **Error class inventory**: 41 throws = 22 ForbiddenError + 6 NotFoundError + 4 ValidationError + 4 DayNotAssignableError + 2 StatusNotAssignableError + 2 MonthClosedError + 1 PreviousMonthOpenError — all reused, none created
- **Auth module**: No files touched; `authorization-errors.ts` untouched
- **Atomic unit rule**: Each slice (use-case + controller endpoint + both test files) applied together, no half-migrated intermediate
- **No behavior change**: Same 403/404/400/422/409 responses; only internal idiom (exception→Result)

## Scope Fulfillment

### In-Scope (All Complete)
- ✅ 41 throws → `return err(...)` (22 Forbidden + 19 intrinsic DomainErrors)
- ✅ 6 use-cases widened to `Result<Success, ErrorUnion>`
- ✅ 7 controller endpoints adopt uniform `isErr()/unwrapErr()` idiom
- ✅ 5 redundant try/catch (ForbiddenError→ForbiddenException) removed
- ✅ ~117 tests adapted to Result shape (success + error paths)
- ✅ Generate-monthly union expanded (4 legacy throws)
- ✅ assertCourseCycleExists helper converted to Result-returning
- ✅ Dead imports (ForbiddenException, ForbiddenError) removed from controller/test

### Out-of-Scope (Deferred Explicitly, Not Violated)
- ❌ Reclassify ForbiddenError → ApplicationError (cross-cutting, ~19 files, 8 modules) — **follow-up change**
- ❌ Edit DOMAIN_STATUS — no changes needed
- ❌ Create new error classes — zero added
- ❌ Touch auth module — untouched

## Diff Summary

| Slice | Insertions | Deletions | Total Changed |
|---|---|---|---|
| Slice 1 (list pair) | 88 | 81 | 169 lines |
| Slice 2 (record-general) | 171 | 140 | 311 lines |
| Slice 3 (record-subject) | 184 | 116 | 300 lines |
| Slice 4 (generate + month-status) | 103 | 100 | 203 lines |
| **Aggregate** | **546** | **437** | **983 lines** |

**Budget Risk**: High (983 > 400-line default), resolved via 4 stacked PRs (each under or near 400, independently reviewable). No `size:exception` needed — actual diffs came in under estimates. Slice 3 (record-subject, highest risk, 300 lines) confirmed below 400-line threshold.

## Files Changed

**Production Files** (6):
- `api/src/application/asistencia/list-general-attendance.use-case.ts` (Slice 1)
- `api/src/application/asistencia/list-subject-attendance.use-case.ts` (Slice 1)
- `api/src/application/asistencia/record-general-attendance-day.use-case.ts` (Slice 2)
- `api/src/application/asistencia/record-subject-attendance-day.use-case.ts` (Slice 3)
- `api/src/application/asistencia/generate-monthly-attendance.use-case.ts` (Slice 4)
- `api/src/application/asistencia/attendance-month-status.use-cases.ts` (Slice 4)

**Controller**:
- `api/src/presentation/asistencia/asistencia.controller.ts` (Slices 1-4, all 7 endpoints)

**Test Files** (8):
- `api/src/application/asistencia/__tests__/list-general-attendance.use-case.test.ts` (Slice 1)
- `api/src/application/asistencia/__tests__/list-subject-attendance.use-case.test.ts` (Slice 1)
- `api/src/application/asistencia/__tests__/record-general-attendance-day.use-case.test.ts` (Slice 2)
- `api/src/application/asistencia/__tests__/record-subject-attendance-day.use-case.test.ts` (Slice 3)
- `api/src/application/asistencia/__tests__/generate-monthly-attendance.use-case.test.ts` (Slice 4)
- `api/src/application/asistencia/__tests__/attendance-month-status.use-cases.test.ts` (Slice 4)
- `api/src/presentation/asistencia/__tests__/asistencia.controller.test.ts` (Slices 1-4, all endpoints)
- (Additional controller test coverage for all 7 endpoints: listGeneral, listSubject, recordGeneralDay, recordSubjectDay, generateMonthly, getMonthStatus, setMonthStatus)

## Specs Synced

**Canonical capability updated** (consumer change — no new capability spec created, mirroring the
`attendance-type-result-migration` / `materia-grupo-ciclo-result-migration` / `course-cycle-result-migration`
precedent):
- `openspec/specs/application-error-handling/spec.md` ← the `- \`asistencia\` (41 throws, …)` entry in
  the "Consumers not yet migrated" section was replaced with a FULLY MIGRATED entry (archived 2026-08-03,
  4 stacked slices, ForbiddenError stays DomainError, no behavior change, 212/212 green).

The change's 7 requirements (ASRM-R1..R7) live in the archived delta spec at
`openspec/changes/archive/2026-08-03-asistencia-result-migration/specs/spec.md`.

## Traceability

### Commits (13 total, by slice)

**Slice 1**:
1. `e52aab0` — `refactor(asistencia): return Result from list-general/list-subject use-cases`
2. `7b7d16a` — `refactor(asistencia): consume list Result in controller, drop redundant try/catch`
3. `16860f3` — `test(asistencia): migrate list use-case + controller tests to Result shape`

**Slice 2**:
4. `3909d3d` — `refactor(asistencia): return Result from record-general use-case`
5. `6483aa5` — `refactor(asistencia): consume record-general Result in controller`
6. `d9136d9` — `test(asistencia): migrate record-general tests to Result shape`

**Slice 3**:
7. `9b45ad1` — `refactor(asistencia): return Result from record-subject use-case (both auth paths)`
8. `4c49e27` — `refactor(asistencia): consume record-subject Result in controller`
9. `221004e` — `test(asistencia): migrate record-subject tests to Result shape`

**Slice 4**:
10. `cf45d7d` — `refactor(asistencia): widen generate-monthly union, convert 4 legacy throws`
11. `dc7d381` — `refactor(asistencia): Result-return month-status use-cases + assertCourseCycleExists helper`
12. `6393f2b` — `refactor(asistencia): finish controller Result idiom, remove dead ForbiddenException/ForbiddenError imports`
13. `1d36bbe` — `test(asistencia): migrate generate + month-status + controller tests; final green`

### Spec Requirements → Tasks

- **ASRM-R1** (no throw) → Slice tasks 1.1/1.2, 2.1, 3.1-3.3, 4.1-4.2 (commits e52aab0, 3909d3d, 9b45ad1, cf45d7d, dc7d381)
- **ASRM-R2** (status preserved) → Slice tasks 1.5/1.6, 2.3, 3.5, 4.5-4.7 (commits 7b7d16a, 6483aa5, 4c49e27, 6393f2b); no DOMAIN_STATUS edit
- **ASRM-R3** (ForbiddenError stays DomainError) → Guardrail across all slices; verified in each slice verification (no file diff for error definitions)
- **ASRM-R4** (return-type widening) → Slice tasks 1.1/1.2, 2.1, 3.1-3.3, 4.1/4.2 (use-case signatures widened in all 6 files)
- **ASRM-R5** (controller idiom + cleanup) → Slice tasks 1.5/1.6, 2.3, 3.5, 4.5-4.8, 4.12 (commits 7b7d16a, 6483aa5, 4c49e27, 6393f2b; dead-import removal final)
- **ASRM-R6** (no new error classes) → Guardrail verified at each slice (zero class additions, auth module untouched)
- **ASRM-R7** (4 stacked independently-green slices) → Slice 1.0/1.12, 2.0/2.9, 3.0/3.11, 4.0/4.17; each slice green before next starts

## Non-Obvious Discoveries

### Test Rewrite Complexity
Result-shape change affects both success AND error paths. Not only do error assertions move from `.rejects.toBeInstanceOf()` to `isErr()/unwrapErr()`, but success assertions change from bare `expect(await uc.execute()).toEqual()` to `expect(result.unwrap()).toEqual()`. This means ~117 of 117 `it()` blocks were touched, not just 34 error-path asserts. Refactor-style testing (no RED-first) worked well because the shape was known ahead of time from the spec/design.

### Identity Rewrites (Exception Type Change)
3 controller tests (CTR-T02/T04/T06 across slices) required assertion rewrites from `toBeInstanceOf(ForbiddenException)` (the NestJS class) to `toBeInstanceOf(ForbiddenError)` (the domain class). **This is not a bug fix** — the HTTP status (403) is unchanged via `AppExceptionFilter`/`DOMAIN_STATUS`. The identity change is a mechanical consequence of dropping the now-redundant try/catch remap. Carefully documented in apply-progress to avoid confusion.

### Atomic Helper Migration (ADR-D3)
The shared `assertCourseCycleExists` helper (used by 3 month-status use-cases) required conversion to `Result`-returning in a SINGLE commit (`dc7d381`) alongside all 3 callers. Inlining the logic 3× would have contradicted the established DRY precedent (e.g., `validateTeacherLevel` in materia-grupo-ciclo-result-migration). The atomic commit ensured no half-migrated intermediate state and passed the compilation gate.

### One CTR-T13 Duck-Type Fix
Task 4.9 noted "CTR-T13 (`PresenteTypeNotFoundError`) already correct," but the test used a hand-rolled duck-typed mock lacking an `unwrapErr()` method. Once `generateMonthly` adopted the uniform `if (result.isErr()) throw result.unwrapErr();` idiom (ASRM-R5), that missing method surfaced as a runtime `TypeError`. Fixed by replacing the duck-type with the real `err(domainError)` helper — a strict subset fix, no scope creep, well within the guardrails.

## Follow-ups (Explicitly Deferred, Documented)

### 1. Reclassify ForbiddenError → ApplicationError (cross-cutting epic)
- **Scope**: ~19 files in 8 modules (asistencia, asistencia-reporting, asignacion-curso, grading, institution, nivel-terciario, student, student-observation) + 4 controllers
- **Approach**: Consolidate the reclassification into a single pass AFTER all modules that throw ForbiddenError have migrated to Result. Ideally consolidate with `authorization-errors.ts` (precedent from users piloto).
- **Reason deferred**: Reclassifying here would inflate the diff for zero asistencia-specific benefit (YAGNI). Also, while `ForbiddenError` is caller-context (conceptually ApplicationError), it currently extends DomainError and maps to 403 via `DOMAIN_STATUS`, which is correct. The reclassification is about structural organization, not behavior fix.

### 2. Guards of Infra
Verify that no global filter/guard assumes the removed `try/catch (ForbiddenError → ForbiddenException)` blocks. The `AppExceptionFilter` should handle `ForbiddenError` (DomainError) correctly via `DOMAIN_STATUS`; the test suite confirms 403 responses unchanged. No action needed based on verification results.

### 3. Continue Error-Handling Épico
Next modules to migrate (in order of surface):
- asistencia-reporting (uses ForbiddenError, NotFoundError, ValidationError, etc. — similar to asistencia)
- grading (ForbiddenError, NotFoundError, ValidationError)
- student (ForbiddenError, ValidationError)
- others as prioritized

## Risks & Mitigations

| Risk | Severity | Mitigation | Status |
|---|---|---|---|
| High-risk Slice 3 (record-subject, 15 throws, largest) | Medium | Real diff came in at 300 lines (under 400 estimate) | ✅ Resolved, no escalation |
| Test rewrite surface (117 `it()` blocks) | Medium | TDD refactor-style with full design coverage planned ahead | ✅ Resolved, all tests green |
| Identity rewrite confusion (ForbiddenException → ForbiddenError) | Low | Carefully documented in apply-progress; status unchanged (403) | ✅ Resolved, tests confirm |
| Atomic helper migration (half-migrated intermediate) | Low | ADR-D3 enforced single-commit rule; compilation gate held | ✅ Resolved, no half-state |
| Pre-existing test failure (archive-legacy-grading-data) | Low | Confirmed unrelated (file untouched, same failure across slices) | ✅ Known, not a risk to this change |

## Archive Contents

- ✅ `proposal.md` — Original 8-section proposal (intent, scope, classification, strategy, tests, delivery, rollback, follow-ups)
- ✅ `specs/spec.md` — Delta spec (7 ASRM-R requirements with scenarios)
- ✅ `design.md` — 4-slice concrete design (ADR-D1..D4, per-slice signatures and tasks, stacked-PR mechanics, test plan)
- ✅ `tasks.md` — 52 tasks across 4 slices (all checked ✅ complete), review workload forecast, guardrails
- ✅ `apply-progress.md` — Full TDD cycle evidence per slice (RED/GREEN/REFACTOR, commits, file changes, deviations, real verification results, guardrails verified)
- ✅ `explore.md` — Original exploration (inventário, classification, fork discussion, size estimate, return types, controller notes, test impact)

## Conclusion

The `asistencia-result-migration` change is **complete, verified, and ready for merge**. All 4 stacked delivery slices pass verification (212/212 asistencia tests green, typecheck clean, full suite 2187/2188). Specification synced to the main specs tree. All guardrails held (ForbiddenError NOT reclassified, DOMAIN_STATUS NOT edited, zero new error classes, auth module untouched). The module is now 100% Result-shaped, honesty-first, and a proven platform for the remaining error-handling épico work.

**Next step**: Open the 4 stacked PRs for review (PR1 targeting main, PR2-4 targeting their predecessors). Follow the 13 conventional commits. Deploy per normal workflow (PR reviews, stacked merge, verify in main).
