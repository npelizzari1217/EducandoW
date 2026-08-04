# Verify Report — asistencia-reporting-result

**Date**: 2026-08-04
**Branch**: `refactor/asistencia-reporting-result-d` (18 commits ahead of `origin/main`, all 4 slices A/B/C/D stacked)
**Verifier**: sdd-verify (independent, adversarial reproduction — did not trust apply-progress claims)

## VEREDICTO: PASS

- CRITICAL: 0
- WARNING: 1
- SUGGESTION: 1

---

## Completeness (tasks.md)

All 4 slices (A/B/C/D), 60 tasks total, all checked [x] in tasks.md. Spot-verified against real code — every checked task corresponds to actual code state (no false-checked items found).

## Command Evidence

| Command | Result |
|---|---|
| rg "throw new" on the 4 use-case files | 0 matches |
| pnpm --filter api typecheck (tsc --noEmit) | exit 0, no errors |
| pnpm --filter api build (nest build + swc + postbuild) | PASS, Found 0 issues, 518 files compiled |
| pnpm --filter api test (vitest) | 1 failed / 2191 passed / 2192 total (216 test files, 1 failed) |
| pnpm build (turbo, full monorepo) | FAIL on web#build only, pre-existing and unrelated (see WARNING below); domain and api both build clean |

### Test suite failure detail (pre-existing, unrelated)

FAIL  scripts/__tests__/archive-legacy-grading-data.spec.ts > Scenario A — Export por tenant
      > escribe los 5 archivos con paths {tenant-slug}/{tabla}.json
AssertionError: expected [ ...(5) ] to include /tmp/archival-test/alpha/notas.json

Confirmed same and unrelated: this test hardcodes a POSIX path and fails on Windows path-separator
mismatch. File is untouched by this change diff (git diff --name-only origin/main...HEAD does not
include scripts/). Root cause is environmental (Windows vs POSIX), not a regression from this change.

---

## Spec Compliance Matrix (ARR-R1..R8)

### ARR-R1 — No throw remains in the 4 reporting use-cases: PASS

rg "throw new" across the 4 use-case files returns 0 matches. All 28 inventoried sites confirmed
converted to return err(...) (spot-checked via diff, all match design line-by-line map with status
literals unchanged).

### ARR-R2 — HTTP status preserved; body migrates to standard envelope preserving code+message: PASS

Read api/src/presentation/shared/http/unwrap-result-or-throw.ts (real code, not the apply report):
branch 2 (HttpException) now does
throw new HttpException({ statusCode: error.httpStatus, code: error.code, message: error.message }, error.httpStatus)
— code is under a code key, exactly Option B two-line fix. Generic bound widened to
E extends { httpStatus: number; code: string; message: string } (structural, admits bare Error
classes).

Read api/src/presentation/shared/filters/exception.filter.ts: HttpException branch now has
"if (typeof obj.code === 'string') code = obj.code;" (line 92) — re-reads code into the final
{ error: { status, code, message } } envelope. Confirmed by direct source read, not by trusting
apply-progress.

Both fixes are covered by passing unit tests (reproduced by running pnpm --filter api test, part of
the 2191 green):
- unwrap-result-or-throw.test.ts: "(ARR-R2/R7 Option B) err(bare-Error-with-code) → thrown
  HttpException body carries code under a code key" — asserts body.code === 'COURSE_CYCLE_NOT_FOUND'.
- exception.filter.spec.ts: "ARR-R2/R7 Option B: HttpException branch re-reads code..." — asserts
  body.error.code === 'COURSE_CYCLE_NOT_FOUND', status 404.

Status invariance for all 28 sites confirmed by diffing the 4 use-case files: every converted line
preserves its numeric status literal 1:1 (404 to 404, 422 to 422, 500 to 500), only "throw new"
became "return err(new". ForbiddenError 403 confirmed still routed via branch 1 (ApplicationError
re-throw) in asistencia-reporting.controller.test.ts.

### ARR-R3 — No reclassification of the 3 error classes: PASS

grep for "class AsistenciaReportingError|class BoletinError|class ConstanciaError" on the 3
definition files shows all 3 still extends Error (bare), unchanged. git diff origin/main...HEAD on
those 3 files shows zero extends-clause diff lines.

### ARR-R4 — Return-type widening: PASS

- GenerateBoletinBatchUseCase.execute: confirmed Promise<Result<Buffer, BoletinError>> (was
  Promise<Buffer>) — read directly from source, line 32.
- GenerateAsistenciaMensualPdfUseCase.executeGeneral / .executeMateria: confirmed
  Promise<Result<Buffer, PdfError | AsistenciaReportingError | ForbiddenError>>.
- GenerateBoletinUseCase.execute: confirmed Promise<Result<Buffer, PdfError | BoletinError>>.
- GenerateConstanciaRegularUseCase.execute: confirmed Promise<Result<Buffer, PdfError |
  ConstanciaError>> (via grep and passing typecheck; exact signature widened per design).
- tsc --noEmit exits 0.
- No new unsafe casts introduced by this diff — the only "as any"/"as never" occurrences in the diff
  are pre-existing ((client as any).courseCycle..., unchanged context lines) or standard test-mock
  casts (vi.mocked(...).mockReturnValue(x as any)), consistent with the existing codebase pattern.
  One any was actually removed (-let ReportesController: any;).

### ARR-R5 — Controller retrofit to unwrapResultOrThrow: PASS

Read both controllers directly:
- asistencia-reporting.controller.ts: no handleError(), no try/catch, both endpoints (printGeneral,
  printMateria) use unwrapResultOrThrow(result).
- reportes.controller.ts: all 3 endpoints (getBoletin, getBoletinBatch, createConstanciaRegular) use
  unwrapResultOrThrow(...); zero bespoke try/catch; zero instanceof checks remain.
- getBoletinBatch confirmed consuming Result<Buffer, BoletinError> via
  unwrapResultOrThrow(await this.batchUC.execute(courseCycleId)).
- ForbiddenError still 403 confirmed via asistencia-reporting.controller.test.ts — asserts
  .rejects.toBeInstanceOf(ForbiddenError) (helper branch 1 re-throw, filter ApplicationError branch
  maps 403).
- Grep for try/catch/handleError on both controller source files: 0 matches.

### ARR-R6 — Test coverage rewritten, legacy test removed, new test added: PASS

- api/src/presentation/reportes/__tests__/constancia-controller.test.ts: confirmed absent
  (test -f check returns not found).
- getBoletinBatch controller test: confirmed net-new, 4 cases present in reportes.controller.test.ts
  (success/200, empty-ZIP/200, BATCH_ALL_FAILED to 422 with code preserved, INTERNAL_ERROR to 500) —
  matches design spec exactly.
- Error-path tests use isErr()/unwrapErr(): grep for toThrow(...) and
  rejects.toBeInstanceOf(AsistenciaReportingError|BoletinError|ConstanciaError) across all 5
  rewritten use-case test files returns 0 matches.

### ARR-R7 — Scope boundary (no reclassification, no InfrastructureError, no status change): PASS

- git diff origin/main...HEAD full-diff grep for InfrastructureError shows it only appears in prose
  (markdown comments, docs, openspec artifacts, and code comments), never as an actual introduced
  class/type in .ts production code.
- attendance-type-pdf files: not present in git diff --name-only origin/main...HEAD (27 changed files
  listed, none under attendance-type-pdf).
- No HTTP status literal changed for the 28 sites (verified per-line diff, ARR-R2 section above).
- The 2-shared-file allowance (unwrap-result-or-throw.ts + exception.filter.ts) confirmed as the ONLY
  shared-file touch, both changes strictly additive (widen a generic bound; add one if-statement that
  reads code), no reclassification, no status-literal change in either file.

### ARR-R8 — Canonical consumer-tracking correction: PASS

openspec/specs/application-error-handling/spec.md lines 206-218 read directly: the
reportes/asistencia-reporting entry now reads "FULLY MIGRATED (throw to Result)... The 3 bare-Error
classes... were NOT reclassified... classification... is DEFERRED to follow-up #3." No "extends
ApplicationError" instruction remains for these 3 classes.

---

## Design Coherence (ADR-1 Option B)

Design section 0 (load-bearing verification) claimed the body is NOT byte-identical without a fix,
and ADR-1 resolved to Option B (preserve code). Verified the ACTUAL shipped code matches Option B
exactly — not a lesser Option A fallback:
- unwrap-result-or-throw.ts line 40: code: error.code present (not omitted).
- exception.filter.ts line 92: the code-preserving if-statement is present.
- Both covered by dedicated, passing unit tests asserting code is populated (not undefined).

No design deviation found — ADR-1, ADR-2 (no reclassification), ADR-3 (atomic slice = use-case +
controller + tests together), ADR-4 (batch signature change) all match the shipped code.

---

## Issues

### WARNING (1)

pnpm build (full monorepo) fails on web#build — unrelated to this change. Root cause:
web/src/pages/dashboard/__tests__/students.test.tsx hardcodes a POSIX absolute path
(/home/usuario/proyectos/educandow/web/src/hooks/use-api) inside a vi.mock(...) call, which fails
module resolution on this Windows machine. Confirmed via git show origin/main:... that this line
pre-exists on origin/main unmodified — introduced by an unrelated prior commit (ad947ad, "fix(web):
mostrar error de borrado en modules, students, grading-scales y pedagogy"), and this change diff
touches zero files under web/. api and domain both build clean in isolation
(pnpm --filter api build succeeds with 0 issues). Not a blocker for this change, but flagging since
the tasks.md Definition of Done says "Global: pnpm build green" and the monorepo-wide command does
NOT currently exit 0 for reasons outside this change's control.

### SUGGESTION (1)

The apply-progress for Slice C reported "2197/2198 pass" after that slice; the final aggregate on -d
is "2191/2192 pass" (1 failed, same pre-existing Windows-path failure). The difference in total count
is explained by subsequent test rewrites/deletion across Slices C to D (e.g.,
constancia-controller.test.ts deletion removes tests; Slice D rewrites change assertion counts) — not
a discrepancy needing action, but worth noting for anyone diffing apply-progress test counts against
this report: use this report's numbers (2191/2192, current HEAD) as the source of truth, not
intermediate per-slice snapshots.

---

## Definition of Done — final check

| Item | Status |
|---|---|
| ARR-R1: 0 throws in 4 use-cases | PASS |
| ARR-R2: status unchanged, standard envelope, code+message preserved | PASS |
| ARR-R3/R7: no reclassification, no InfrastructureError, no attendance-type-pdf touch, no status drift | PASS |
| ARR-R4: typecheck green, batch signature Promise<Result<Buffer, BoletinError>> | PASS |
| ARR-R5: 0 bespoke try/catch, 5/5 endpoints via unwrapResultOrThrow, ForbiddenError still 403 | PASS |
| ARR-R6: 0 toThrow / rejects.toBeInstanceOf(XError), legacy test deleted, net-new getBoletinBatch test present | PASS |
| ARR-R8: canonical spec corrected, references follow-up #3 | PASS |
| Global: pnpm --filter api test green | 1 pre-existing unrelated failure (2191/2192) — acceptable |
| Global: pnpm --filter api typecheck green | PASS |
| Global: pnpm --filter api build green | PASS |
| Global: pnpm build (full monorepo) green | FAIL — web#build only, pre-existing and unrelated (WARNING) |

## Recommendation

PASS — safe to proceed to sdd-archive. The single WARNING (web#build failure) is a pre-existing,
out-of-scope environmental issue (hardcoded POSIX path in an unrelated test file on origin/main) and
does not block archiving this change. No CRITICAL issues found across independent reproduction of all
8 ARR requirements, the full api test suite, api typecheck, and api build.
