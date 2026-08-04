# Verify Report -- reporting-errors-reclassification

**Date**: 2026-08-04
**Branch**: refactor/reporting-errors-constancia (4 slices stacked on main, 7 commits ahead, working tree clean)
**Verdict**: PASS
**Counts**: CRITICAL 0 / WARNING 0 / SUGGESTION 1

## Commits verified

40eb68c docs(sdd): sync application-error-handling canonical spec for reporting-errors-reclassification
3387fcf refactor(constancia): reclassify errors to DomainError/InfrastructureError subclasses
f132ae9 docs(sdd): mark reporting-errors-reclassification Slice 2 tasks complete
09cbe3b refactor(boletin): reclassify errors to DomainError/InfrastructureError subclasses
7f47d8e refactor(asistencia-reporting): reclassify errors to DomainError/InfrastructureError subclasses
c4c0728 feat(errors): add reporting DomainError subclasses, InstitutionNotFoundError, and unwrapResultOrThrow DomainError branch
c0d4f7d docs(sdd): plan reporting-errors-reclassification

Diff vs main: 30 files changed, 1519 insertions(+), 329 deletions(-).

## Build / test / lint sequence (mandatory order respected)

| Step | Command | Result |
|---|---|---|
| 1 | pnpm --filter @educandow/domain build | GREEN -- 0 errors |
| 2 | pnpm --filter api typecheck (tsc --noEmit) | GREEN -- 0 errors |
| 3 | pnpm --filter api test (vitest) | GREEN -- 218 test files, 2219 tests, all passed (85.86s) |
| 4 | pnpm --filter api lint (eslint) | 5 pre-existing errors, 116 warnings (all pre-existing, see below) |
| 5 | pnpm build (full monorepo: domain + api + web) | GREEN -- 3/3 successful |

No false RED/GREEN risk: domain was rebuilt before typecheck, per the design build-resolution gotcha.

### Lint errors -- confirmed pre-existing, unrelated, unchanged by this diff

git diff main --stat for each of the 5 files with lint errors returns EMPTY (zero diff vs main):
- api/scripts/__tests__/cleanup-ingresantes-sin-ciclo.test.ts:6 -- unused beforeEach
- api/test/integration/asistencia/subject-group-filter.db.test.ts:89 -- unused axm2
- api/test/integration/guardians.test.ts:15 -- unused ValidationError
- api/src/application/pedagogy/use-cases/competency.use-cases.ts:310 -- prefer-const
- api/src/application/pedagogy/use-cases/pedagogy.use-cases.ts:227 -- prefer-const

All files touched by this change (generate-boletin.use-case.ts, generate-boletin-batch.use-case.ts,
generate-constancia-regular.use-case.ts, generate-asistencia-mensual-pdf.use-case.ts,
infrastructure-errors.ts, exception.filter.ts, unwrap-result-or-throw.ts, packages/domain/src/reportes/**)
show zero new lint errors -- only pre-existing no-explicit-any warnings.

archive-legacy-grading-data.spec.ts (the documented Windows-path pre-existing issue) did NOT fail in
this run -- all 218 test files passed, so it is currently green on this machine; not a regression
either way.
## Requirement-by-requirement verification (reproduced independently)

### RER-R1 -- Reclassification per tier -- PASS
- packages/domain/src/reportes/errors/index.ts: 8 classes (AxccNotFoundError,
  ReporteStudentNotFoundError, ReporteCourseCycleNotFoundError, MateriaXCursoXCicloNotFoundError,
  StudentNotPrintableError, StudentNotEligibleError, BoletinLevelUnknownError, BatchAllFailedError) --
  all extend DomainError directly, codes preserved exactly as spec designed.
- InstitutionNotFoundError in api/src/application/shared/errors/infrastructure-errors.ts:33-37 --
  extends InfrastructureError, code INSTITUTION_NOT_FOUND, default message matches the single call site.
- TEMPLATE_NOT_FOUND and the 3 tenant guards reuse the Change-1 classes verbatim
  (TemplateNotFoundError, TenantClientUnavailableError) -- confirmed no reportes-local infra class
  exists for either.
- Call-site spot-checks match design exactly: generate-boletin.use-case.ts L128/131/147/165/212/893/933;
  generate-boletin-batch.use-case.ts L114/151; generate-constancia-regular.use-case.ts
  L119/127/135/138/149/161/196; generate-asistencia-mensual-pdf.use-case.ts L163/200/209/243/384.

### RER-R2 -- HTTP status via DOMAIN_STATUS -- PASS
- 8 entries present in exception.filter.ts:62-69, exactly matching the spec 404/422 mapping, zero
  dupes with existing entries.
- Table-driven regression guard exception.filter.spec.ts:340-365 runs it.each over all 8 codes,
  asserts statusFn called with the expected status and explicitly asserts not.toHaveBeenCalledWith(400).
  Ran green as part of the 2219-test suite.

### RER-R3 -- Tenant wire-code is the only code change -- PASS
- All 3 tenant guards (generate-boletin.use-case.ts:893, generate-boletin-batch.use-case.ts:151,
  generate-constancia-regular.use-case.ts:119, generate-asistencia-mensual-pdf.use-case.ts:384)
  construct new TenantClientUnavailableError -- code TENANT_CLIENT_UNAVAILABLE, status 500 (from
  InfrastructureError base).
- Grepped the whole api/src/application/reportes and api/src/application/asistencia-reporting trees
  for INTERNAL_ERROR -- zero production hits (only test names/comments referencing the migration).
- Grepped the 8 preserved domain codes at their call sites -- byte-identical strings to the design
  table (spot-checked, no unexpected code drift).

### RER-R4 -- unwrapResultOrThrow admits DomainError -- PASS
- unwrap-result-or-throw.ts:36-57: generic bound relaxed to admit an optional httpStatus; the
  instanceof DomainError branch (L47-49) sits after ApplicationError/InfrastructureError and before the
  fallback; fallback reads error.httpStatus with a default of HttpStatus.INTERNAL_SERVER_ERROR (L50).
- unwrap-result-or-throw.test.ts covers: DomainError re-thrown identity-preserving, the bare-Error-with-code
  fallback still applying, and a tsc-checked caller typed as a DomainError-or-PdfError union.
  All green in the vitest run.

### RER-R5 -- Old bare-Error classes gone -- PASS
- Ripgrep for BoletinError, ConstanciaError, AsistenciaReportingError across the entire repo returns
  hits ONLY under openspec (spec/design/proposal/archive docs) -- zero hits in any production or test
  source file (api, packages trees).
- asistencia-reporting.errors.ts file confirmed deleted (does not exist).
- ConstanciaError confirmed removed from templates/constancia.template.ts (grep for the class name in
  that file returns nothing).
### RER-R6 -- No behavior change beyond tenant code -- PASS
- Confirmed via RER-R3 grep (only tenant code changed) and RER-R2 status-table guard (all 8 domain
  codes keep their pre-change HTTP status). Body shape (error/status/code/message envelope) unchanged --
  AppExceptionFilter response-building code (L129-135) untouched by this diff.
- TemplateNotFoundError applied to the constancia-regular.hbs template name produces a message
  byte-identical to the pre-change string -- verified by reading infrastructure-errors.ts:24.

### RER-R7 -- Scope boundary -- PASS
- git diff main for application-error.ts, infrastructure-error.ts, and domain-error.ts returns an
  EMPTY diff, confirming the base classes are untouched.
- No throw-to-Result conversions found in the diff (all touched use-cases were already Result-based
  per prior changes); no number-3b module appears in the 30-file diff list.

### RER-R8 -- Coverage -- PASS
All 11 codes have a dedicated instanceof+code+status test:
1. AXCC_NOT_FOUND -- domain class test + filter guard + use-case tests
2. STUDENT_NOT_FOUND -- domain class test + filter guard + use-case tests
3. COURSE_CYCLE_NOT_FOUND -- domain class test + filter guard + use-case tests
4. MATERIA_X_CURSO_X_CICLO_NOT_FOUND -- domain class test + filter guard + use-case test
5. STUDENT_NOT_PRINTABLE -- domain class test + filter guard + use-case test
6. STUDENT_NOT_ELIGIBLE -- domain class test + filter guard + use-case test
7. BOLETIN_LEVEL_UNKNOWN -- domain class test + filter guard + use-case tests (2 sites)
8. BATCH_ALL_FAILED -- domain class test + filter guard + use-case test
9. TEMPLATE_NOT_FOUND -- infrastructure-errors.test.ts (reused Change-1 test) + use-case tests
   (3 modules)
10. INSTITUTION_NOT_FOUND -- infrastructure-errors.test.ts:25-34, instanceof InfrastructureError,
    code, httpStatus 500
11. TENANT_CLIENT_UNAVAILABLE -- dedicated tests in all 4 use-case suites (boletin, boletin-batch,
    constancia, asistencia), each asserting code + 500 + instanceof InfrastructureError

unwrapResultOrThrow DomainError branch has a dedicated test (unwrap-result-or-throw.test.ts:105-117)
plus a tsc-compile-checked union test.
## Design coherence

- Slicing matches tasks.md/design.md section 8 exactly: Slice 0 (shared, additive) then Slice 1
  (asistencia) then Slice 2 (boletin+batch) then Slice 3 (constancia + close-out), one commit per
  slice, each independently green per the mandatory build sequence.
- Old-class deletion timing matches design (asistencia-reporting.errors.ts in Slice 1, inline
  BoletinError in Slice 2 only after both boletin files migrated, ConstanciaError in Slice 3).
- Canonical spec sync (task 3.6) verified: openspec/specs/application-error-handling/spec.md diff
  confirms the reportes/asistencia-reporting follow-up entry updated from DEFERRED to DONE with
  accurate detail, and the InfrastructureError tier follow-up line marks the reporting consumer closed.

## Tasks completeness

All 30 checkboxes across Slices 0-3 in tasks.md are marked complete. Cross-checked against actual
code state -- no gap between the marked-complete boxes and the diff contents (each design-mapped call
site, deletion, and test file exists as described).

## Issues

CRITICAL: none.

WARNING: none.

SUGGESTION (non-blocking):
1. The tenant guard message delta (from the original context-oriented text to the reused Change-1
   default message) is an accepted cosmetic change per design section 6 note -- not a defect, just
   worth keeping in mind if any future consumer scrapes the 500 body text (none currently do, per
   design verification in the prior infrastructure-error-model change).

## Regression scope confirmation

- 2219/2219 tests passed, 218/218 test files passed -- no test regressions introduced.
- tsc --noEmit (api) and tsc (domain) both 0 errors.
- Full monorepo pnpm build (domain + api + web) succeeded, 3/3 tasks.
- Lint: 5 pre-existing errors confirmed byte-for-byte unchanged vs main (zero diff on those 5 files) --
  none attributable to this change. Zero new lint errors in any file touched by this change.

## Next recommended

sdd-archive -- change is clean, all 8 requirements (RER-R1..R8) independently verified with
reproduced evidence, no CRITICAL or WARNING issues block archival.
