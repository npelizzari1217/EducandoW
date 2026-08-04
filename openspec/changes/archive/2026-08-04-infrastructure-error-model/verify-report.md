# Verify Report: infrastructure-error-model

> Independent, adversarial verification. Branch `feat/infrastructure-error-model-pilots` (PR1 base+wiring
> + PR2 3 pilots stacked on `main`, 18 commits ahead). All evidence below was reproduced in this session -
> nothing taken from the apply report without independent confirmation.

**VEREDICTO: PASS**
**CRITICAL: 0 - WARNING: 0 - SUGGESTION: 1**

---

## 1. Diff scope (ground truth for everything below)

`git diff main...HEAD --stat` -> 21 files changed, 1586 insertions(+), 27 deletions(-):

- Production: `infrastructure-error.ts` (new), `infrastructure-errors.ts` (new),
  `exception.filter.ts`, `unwrap-result-or-throw.ts`, `update-grupo.use-case.ts`,
  `competency.use-cases.ts`, `course-cycle.use-cases.ts`,
  `generate-attendance-types-pdf.use-case.ts` - exactly the 8 files spec.md names.
- Tests: 8 corresponding test files (2 new base/subclass test files + 2 wiring spec extensions +
  4 pilot test rewrites/additions).
- Docs: `design.md`, `explore.md`, `proposal.md`, `spec.md`, `tasks.md` (SDD artifacts, expected).

No file outside this list is touched. Confirms the outer boundary of IEM-R9 before checking content.

## 2. IEM-R1 - InfrastructureError base class - PASS

`api/src/application/shared/errors/infrastructure-error.ts` read in full:
```ts
export abstract class InfrastructureError extends Error {
  public readonly httpStatus = 500;
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = this.constructor.name;
  }
}
```
- `httpStatus` is a `readonly` field fixed to `500`, not a constructor parameter - no subclass can
  override it (S2 satisfied structurally, not just by convention).
- `code` is a required constructor parameter, no default.
- `abstract class ... extends Error` gives disjoint prototype chain from `ApplicationError`/`DomainError`
  for free (S3), and `instanceof Error === true` (S4).
- Covering test: `infrastructure-error.test.ts` (via `StubInfraError`), part of the 401 tests run in
  the scoped suite below - all green.

## 3. IEM-R2 - Concrete infrastructure error classes - PASS

`api/src/application/shared/errors/infrastructure-errors.ts` read in full. Both subclasses `extends
InfrastructureError`, fix their own `code` in the constructor, pass `message` through `super()`:
- `TenantClientUnavailableError` -> `code = 'TENANT_CLIENT_UNAVAILABLE'`, message
  `'No tenant client available'` when constructed with no args (matches pilot 1/2 usage).
- `TemplateNotFoundError('attendance-types.hbs')` -> `code = 'TEMPLATE_NOT_FOUND'`, message
  `'Template attendance-types.hbs no encontrado'`.
- Covering test: `infrastructure-errors.test.ts`, green.

## 4. IEM-R3 - AppExceptionFilter maps InfrastructureError to HTTP - PASS

`exception.filter.ts:95-107` read directly:
```ts
} else if (exception instanceof ApplicationError) {
  status = exception.httpStatus; message = exception.message; code = exception.code;
} else if (exception instanceof InfrastructureError) {
  status = exception.httpStatus; // fixed 500
  message = exception.message; code = exception.code;
} else if (exception instanceof DomainError) {
  status = DOMAIN_STATUS[exception.code] ?? HttpStatus.BAD_REQUEST;
  ...
} else if (exception instanceof Error) {
  message = exception.message;
}
```
- Branch order confirmed exactly as spec requires: after `ApplicationError`, before `DomainError`/generic
  `Error` - an `InfrastructureError` instance can never reach the code-dropping generic fallback.
- `exception.filter.spec.ts` new `IEM-R3` describe block (3 tests) asserts: 500+code+message; `code`
  present (not dropped by fallback); `ApplicationError`(403)/`DomainError`(404, `NOT_FOUND`) branches
  unaffected. All 3 pass (confirmed in the scoped test run, section 11).

## 5. IEM-R4 - unwrapResultOrThrow re-throws InfrastructureError as-is - PASS

`unwrap-result-or-throw.ts:35-46`:
```ts
if (error instanceof ApplicationError) { throw error; }
if (error instanceof InfrastructureError) { throw error; } // preserve instanceof identity
throw new HttpException(...);
```
Dedicated branch, placed before the generic `HttpException` fallback - mirrors the `ApplicationError`
branch exactly. Test asserts `expect(e).toBe(infraError)` (same instance, not `toEqual`), `instanceof
InfrastructureError === true`, `not.toBeInstanceOf(HttpException)`. Green.

## 6. IEM-R5 - Pilot 1 (update-grupo) - PASS

`update-grupo.use-case.ts:31,44-45`: return type widened to include `TenantClientUnavailableError`;
guard is `if (!client) return err(new TenantClientUnavailableError());` - no `throw` left in the guard.
`git diff main...HEAD` on `materia-grupo-ciclo.controller.ts` is empty - controller genuinely
untouched (independently confirmed, not taken on trust). Test rewritten (MGCM-R6) from
`.rejects.toThrow(...)` to `expect(result.isErr()).toBe(true); expect(result.unwrapErr()).toBeInstanceOf(TenantClientUnavailableError)`,
with an inline comment documenting the deferral lift. Green.

## 7. IEM-R6 - Pilot 2 (competency + course-cycle) - PASS (load-bearing slice, audited closely)

`competency.use-cases.ts`, `AutoCreateCompetenciasXMateriaXAlumnoXCursoXCicloUC.execute`:
- Signature: `Promise<Result<void, TenantClientUnavailableError>>`.
- Guard is now the first statement: `const client = TenantContext.getClient(); if (!client) return
  err(new TenantClientUnavailableError());`.
- `private get client()` getter: confirmed absent (`rg 'TenantPrismaClient|private get client'` on
  the file -> no matches) - deleted as designed, including its now-unused `TenantPrismaClient` import.
- All 4 remaining early exits inside `execute` (`if (!cc) return ok(undefined);`, `if (spsIds.length ===
  0) return ok(undefined);`, `if (competencies.length === 0) return ok(undefined);`,
  `if (studentIds.length === 0) return ok(undefined);`) plus the final `return ok(undefined);` after
  `bulkCreate` - audited line-by-line, every exit path returns `ok(undefined)`, no bare `return;` left
  (would have failed `tsc` against the new `Result` return type - and `pnpm --filter api typecheck` is
  green, corroborating).
- `course-cycle.use-cases.ts:421-433`, the fire-and-forget caller, read directly:
  ```ts
  this.autoCreateUC.execute({ courseCycleId: courseCycleUuid })
    .then((r) => { if (r.isErr()) console.error('[GenerateCourseCycles] AutoCreate failed (non-blocking):', r.unwrapErr()); })
    .catch((e) => { console.error('[GenerateCourseCycles] AutoCreate rejected (non-blocking):', e); });
  ```
  Both `.then(isErr -> log)` and `.catch(rejection -> log)` present, no `await` added - still fire-and-forget.
- Tests: `competency.use-cases.test.ts` T12 guard-err case + T12 happy-path (`ok(undefined)`) case, both
  green. `course-cycle.use-cases.test.ts` T15 asserts `console.error` called via the `.then` branch with
  a `TenantClientUnavailableError`, AND that overall course-cycle generation still resolves `ok` - not
  blocked. Green. Pre-existing ACT-5 rejection case (`.catch` path) confirmed untouched in the diff.

## 8. IEM-R7 - Pilot 3 (attendance-types-pdf) - PASS

`generate-attendance-types-pdf.use-case.ts` diff is exactly 2 lines changed + 1 import added (verified
via `git diff`): `render`'s `throw new Error(...)` -> `return err(new TemplateNotFoundError('attendance-types.hbs'))`;
`render`/`execute` signatures widened to include `TemplateNotFoundError`. `attendance-type.controller.ts`
diff is empty (independently confirmed) - already used `unwrapResultOrThrow`, no change needed. Test
`T18` forces `(uc as any).template = null`, asserts `isErr()`, `unwrapErr() instanceof TemplateNotFoundError`,
and that `pdfGenerator.generatePdf` was never called. Green.

## 9. IEM-R8 - Test coverage, RED to GREEN - PASS

- Git log (`git log --oneline`) shows strict test-then-impl commit pairing for every artifact:
  `183cf8c test -> b8cd3fb feat` (base), `ad336f4 test -> 503177b feat` (subclasses), `59cda1d test ->
  ebe3013 feat` (filter), `8d5f94c test -> 24d2fdf feat` (helper), `93de50b test -> 06f59cf feat` (pilot 1),
  `7aa6d32 test -> a1e9362 feat` (pilot 2 guard), `38de45c test -> 4662c38 feat` (pilot 2 caller),
  `5dde2d6 test -> b4085d6 feat` (pilot 3) - RED to GREEN discipline structurally evidenced by commit
  order, not merely asserted.
- Full suite run (section 11): 2205/2206 passing; the 1 failure is pre-existing and unrelated (section 11).
- Scoped run targeting exactly this change's test files (section 11): 35 files / 401 tests, all green.

## 10. IEM-R9 - Scope boundary - PASS

- `git diff main...HEAD | grep -iE 'BoletinError|ConstanciaError|AsistenciaReportingError'` -> only hits
  inside `spec.md`/`design.md`/`tasks.md` prose (discussing the boundary itself) and one test-file
  comment (`unwrap-result-or-throw.test.ts`, "mirrors AsistenciaReportingError/BoletinError/
  ConstanciaError shape") - zero hits in actual production logic. Reporting classes untouched.
- `git diff main...HEAD | grep -i 'DOMAIN_STATUS'` -> only doc prose + the pre-existing filter line itself
  (unchanged, not part of the diff's +/- - grep matched the surrounding context, not an addition). No
  entry added/changed.
- File list (section 1) is exactly the 4 wiring/base files + 4 pilot files + their tests - no extra infra
  guard touched.
- Both pilot 1 and pilot 3 controllers independently confirmed empty-diffed (sections 6, 8) - not just
  claimed.

## 11. Global regression gates (all executed in this session, not reused from the apply report)

- `pnpm --filter api typecheck` -> exit 0, zero output beyond the command echo. Green.
- `pnpm --filter api build` -> `nest build` + `postbuild`: `TSC Found 0 issues`, SWC compiled 522
  files, dist artifacts copied. Green.
- `pnpm --filter api test` (full suite) -> Test Files 1 failed | 217 passed (218), Tests 1
  failed | 2205 passed (2206). The 1 failure is
  `scripts/__tests__/archive-legacy-grading-data.spec.ts > ... escribe los 5 archivos ...` - a Windows
  path-separator assertion (`\tmp\...` produced vs `/tmp/...` expected). This file is not in the
  diff (section 1 file list) - confirmed structurally pre-existing and unrelated, not just per the
  KNOWN-issues hint but by the fact the file was never touched by this change.
- Scoped test run (`vitest run "infrastructure-error" "exception.filter" "unwrap-result-or-throw"
  "update-grupo" "competency" "course-cycle" "generate-attendance-types-pdf"`) -> 35 test files, 401
  tests, all green. This isolates every suite this change added or edited plus their sibling suites in
  the same files.
- `pnpm --filter api lint` (repo-wide) -> 5 errors, 118 warnings. Errors found, independently
  triaged one by one:
  1. `scripts/__tests__/cleanup-ingresantes-sin-ciclo.test.ts:6` - unused `beforeEach` import.
  2. `src/application/pedagogy/use-cases/competency.use-cases.ts:310` - `'child' is never reassigned,
     use const` inside `GradePeriodValuationUC.execute` (a different class in the same file from
     the one this change touched, `AutoCreateCompetenciasXMateriaXAlumnoXCursoXCicloUC`).
  3. `src/application/pedagogy/use-cases/pedagogy.use-cases.ts:227` - `'academicYear' is never
     reassigned, use const`.
  4. `test/integration/asistencia/subject-group-filter.db.test.ts:89` - unused `axm2`.
  5. `test/integration/guardians.test.ts:15` - unused `ValidationError` import.

  All 5 independently confirmed pre-existing via `git show main:<file> | sed -n '<line-range>p'` -
  byte-identical content on `main`, none of these 5 files appear in this change's diff (section 1).
  None introduced by this change.
- Lint scoped to only the 16 files this change touches (all 8 production + 8 test files) ->
  1 error, 2 warnings - exactly error #2 above (the pre-existing, unrelated `GradePeriodValuationUC`
  line) plus 2 pre-existing "unused eslint-disable directive" warnings in
  `generate-attendance-types-pdf.use-case.test.ts` and `exception.filter.spec.ts`. Zero new lint
  issues in the code this change actually wrote. `no-floating-promises` does not trip on the pilot-2
  `.then().catch()` chain (confirmed both scoped and repo-wide).

## Task completeness (tasks.md)

All T1-T21 checked `[x]`. The only non-fully-green DoD line is explicitly marked `[~]` (repo-wide lint,
5 pre-existing errors, documented and out of scope per IEM-R9) - consistent with what was independently
reproduced above, not just copied from the apply report.

## Issues

**CRITICAL**: none.

**WARNING**: none.

**SUGGESTION** (informational, not blocking):
- The verify task's "KNOWN pre-existing" hint listed only 2 files for the 5 lint errors
  (`subject-group-filter.db.test.ts`, `guardians.test.ts`). Independent reproduction found the 5 errors
  actually span 5 files, matching what the apply report (T20) already documented more precisely. Not
  a defect in this change - flagging only so the next verify run's hint text can be corrected upstream if
  reused.

## Verdict

**PASS.** All 9 requirements (IEM-R1..R9) independently reproduced and confirmed against source, not
inferred from the apply report. `typecheck`, `build`, and the full test suite are green modulo the one
pre-existing, out-of-diff failure. Lint has 5 pre-existing, out-of-diff errors and zero new issues in the
code this change wrote. Task list complete. Ready for `sdd-archive`.
