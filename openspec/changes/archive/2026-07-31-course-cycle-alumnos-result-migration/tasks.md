# Tasks: course-cycle-alumnos-result-migration

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~225-265 (median ~245) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

Note: use-case return-type changes couple to the controller through the type system — commits 1-5 do NOT compile in isolation (controller still expects raw returns). Do NOT run `pnpm build`/`pnpm typecheck` green-check after each use-case commit; only after commit 6 (controller retrofit) does the tree compile. Run `pnpm --filter api test` (unit-scoped, mocks isolate the type coupling) after each commit instead.

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | All 6 commits (below) | PR 1 (single) | One PR; commits are review units, not independently shippable/buildable |

## Phase 1: AddStudent + Remove use-cases → Result (CCAM-R1)

- [x] 1.1 `api/src/application/course-cycle/add-student-to-course-cycle.use-case.ts` — add `ok, err, Result` to `@educandow/domain` import; change signature to `Promise<Result<AlumnosXCursoXCiclo, Error>>`; replace both `throw new NotFoundError(...)` with `return err(...)`; wrap success in `ok(enrollment)`.
- [x] 1.2 `api/src/application/course-cycle/__tests__/add-student-to-course-cycle.use-case.test.ts` — rewrite S-07 (l.109), S-06 (l.122), "validates cc before student" (l.135) from `.rejects.toBeInstanceOf`/`.catch` to `isErr()`/`unwrapErr() instanceof NotFoundError`; wrap S-01/S-02 happy-path asserts in `r.unwrap()`/`r.isOk()`. Status-preserving, non-RED.
- [x] 1.3 `api/src/application/course-cycle/remove-student-from-course-cycle.use-case.ts` — add `ok, err, Result` import; change signature to `Promise<Result<void, Error>>`; replace `throw new NotFoundError(...)` (cc, enrollment/IDOR) and `throw new StudentHasPaseError()` with `return err(...)`; success path returns `ok(undefined)`.
- [x] 1.4 `api/src/application/course-cycle/__tests__/remove-student-from-course-cycle.use-case.test.ts` — rewrite "cc not found" (l.106), S-08 (l.120), S-08 IDOR (l.133), S-5-A (l.148) to `isErr()`/`unwrapErr() instanceof NotFoundError|StudentHasPaseError`; S-05 (l.93) and S-5-B (l.163) happy paths assert `r.isOk()`. Status-preserving, non-RED.
- [x] 1.5 Commit: `refactor(course-cycle): AddStudent + Remove use-cases return Result` (1.1-1.4). Run `pnpm --filter api test add-student-to-course-cycle remove-student-from-course-cycle` — expect GREEN (rewrites only). **Done: commit `e7d7c69`, 11/11 tests GREEN.**

## Phase 2: TogglePrintable use-case → Result (CCAM-R1)

- [x] 2.1 `api/src/application/course-cycle/toggle-printable.use-case.ts` — add `ok, err, Result` import; change signature to `Promise<Result<AlumnosXCursoXCiclo, Error>>`; replace `throw new NotFoundError(...)` (missing/IDOR) with `return err(...)`; success returns `ok(updated)`.
- [x] 2.2 `api/src/application/course-cycle/__tests__/toggle-printable.use-case.test.ts` — rewrite Scenario E IDOR (l.75) and "row does not exist" (l.88) to `isErr()`/`unwrapErr() instanceof NotFoundError`; Scenario D ×2 (l.50, l.63) change `result.printable` reads to `result.unwrap().printable`. Status-preserving, non-RED.
- [x] 2.3 Commit: `refactor(course-cycle): TogglePrintable use-case returns Result` (2.1-2.2). Run `pnpm --filter api test toggle-printable` — expect GREEN. **Done: commit `f8e97c1`, 4/4 tests GREEN.**

## Phase 3: RegistrarPase → Result, bridge PaseFechaInvalidaError (CCAM-R1, CCAM-R2)

- [x] 3.1 **RED first**: `api/src/application/course-cycle/__tests__/registrar-pase.use-case.test.ts` — rewrite S-4-B (l.191) from `.rejects.toBeInstanceOf(PaseFechaInvalidaError)` to `isErr()`/`unwrapErr() instanceof PaseFechaInvalidaError`. Run test now and confirm it FAILS (production code still throws — this is the genuine RED for the bridge). **RED confirmed: test failed with the entity's `PaseFechaInvalidaError` escaping as a rejection, not a Result.**
- [x] 3.2 `api/src/application/course-cycle/registrar-pase.use-case.ts` — add `PaseFechaInvalidaError, ok, err, Result` to `@educandow/domain` import; change signature to `Promise<Result<void, Error>>`; replace the 3 `throw new NotFoundError(...)` guards with `return err(...)`; wrap `student.registrarPase(fecha)` / `student.revertirPase()` in `try/catch`, on catch `return err(e as PaseFechaInvalidaError)`; both success branches `return ok(undefined)` after `setFechaDePase` (kept outside the try, per D4).
- [x] 3.3 Run S-4-B again — confirm GREEN (bridge closes it). **Confirmed GREEN.**
- [x] 3.4 Same test file — rewrite S-2-C (l.131), S-3-D IDOR (l.146), S-3-D missing (l.162), S-4-A (l.176) to `isErr()`/`unwrapErr() instanceof NotFoundError`; add to S-2-A (l.104) and S-2-B (l.118) `expect(r.isOk()).toBe(true); expect(r.unwrap()).toBeUndefined()`. Status-preserving, non-RED.
- [x] 3.5 Commit: `refactor(course-cycle): RegistrarPase returns Result, bridge PaseFechaInvalidaError` (3.1-3.4, includes the RED→GREEN bridge test). Run `pnpm --filter api test registrar-pase` — expect GREEN. **Done: commit `54cb4f1`, 7/7 tests GREEN.**

## Phase 4: Cascade use-case → Result (CCAM-R1, CCAM-R5)

- [x] 4.1 `api/src/application/course-cycle/cascade-student-materias-competencias.use-case.ts` — add `ok, err, Result` import; change signature to `Promise<Result<CascadeResult, Error>>`; l.47 `throw new NotFoundError(...)` → `return err(...)`; wrap all 4 success return sites (l.60, l.82, l.91, l.107) in `ok(...)` — `CascadeResult` shape unchanged.
- [x] 4.2 `api/src/application/course-cycle/__tests__/cascade-student-materias-competencias.use-case.test.ts` — rewrite UC-01 (l.98), UC-02 (l.110) to `isErr()`/`unwrapErr() instanceof NotFoundError`; wrap the 5 real happy-path reads (UC-03 l.129, UC-04 l.155, UC-05 both l.209/l.227, MGC-S17 l.328) in `result.unwrap()`. Leave the 3 return-agnostic awaited tests (UC-04 "resolves competencies" l.185, MGC-S15 ×2, MGC-S16, UC-06) untouched — they don't read the return. Status-preserving, non-RED.
- [x] 4.3 Commit: `refactor(course-cycle): Cascade use-case returns Result` (4.1-4.2). Run `pnpm --filter api test cascade-student-materias-competencias` — expect GREEN. **Done: commit `a88e761`, 12/12 tests GREEN.**

## Phase 5: RED — new togglePrintable controller-spec coverage (CCAM-R7)

- [x] 5.1 **RED first**: `api/src/presentation/course-cycle-alumnos/__tests__/alumnos-x-curso-x-ciclo.controller.spec.ts` — add `describe('PATCH .../:id/printable')` block with 3 NEW tests: C-19 success (mock `togglePrintableUC.execute → ok(row)`, assert resolves `undefined`, UC called with `{courseCycleId, id, value}`); C-20 not-found (mock `→ err(new NotFoundError('AlumnosXCursoXCiclo','axcc-999'))`, assert `.rejects.toBeInstanceOf(NotFoundError)`); C-21 IDOR (mock `→ err(new NotFoundError(...))` for a row of another CC, assert same as C-20). Add `import { ok, err } from '@educandow/domain';` if not already present in the file's mock-migration edit (see Phase 6). Run the 3 new tests and confirm they FAIL (controller doesn't yet call `togglePrintableUC` via the `isErr`/`unwrapErr` idiom against a Result mock). **RED confirmed: C-20/C-21 failed (controller resolved undefined instead of rejecting); C-19 coincidentally passed (no guard needed for the happy path).**
- [x] 5.2 Commit: `test(course-cycle): RED — togglePrintable controller-spec coverage (C-19..C-21)` (5.1). Confirm failing state committed as the documented RED step (per strict-TDD); this commit is expected to be red until Phase 6 lands. **Done: commit `4ca1bee`.**

## Phase 6: Controller retrofit — compile-closing unit (CCAM-R3, CCAM-R4, CCAM-R7)

- [x] 6.1 `api/src/presentation/course-cycle-alumnos/alumnos-x-curso-x-ciclo.controller.ts` — `addStudent`: insert `if (result.isErr()) throw result.unwrapErr();` after `await this.addUC.execute(...)`, unwrap via `result.unwrap()` before building the `{ data }` response.
- [x] 6.2 Same file — `removeStudent`: insert the same guard after `await this.removeUC.execute(...)`; no unwrap needed (void, 204).
- [x] 6.3 Same file — `togglePrintable`: insert the same guard after `await this.togglePrintableUC.execute(...)`; no unwrap needed (void, 204, ok payload discarded).
- [x] 6.4 Same file — `registrarPase`: insert the same guard after `await this.registrarPaseUC.execute(...)`; no unwrap needed (void, 204).
- [x] 6.5 Same file — `cascade`: insert the same guard after `await this.cascadeUC.execute(...)`; unwrap via `result.unwrap()` for the `{ data }` response.
- [x] 6.6 Confirm the 4 non-in-scope endpoints (`listStudents`, `setBulkPrintable`, `cascadeAll`, `listStudentMemberships`) are left byte-identical (CCAM-R4 scenario "non-in-scope endpoints unaffected"). **Confirmed — no changes to those 4 methods.**
- [x] 6.7 `api/src/presentation/course-cycle-alumnos/__tests__/alumnos-x-curso-x-ciclo.controller.spec.ts` — add `import { ok, err } from '@educandow/domain';`; migrate mocks to Result: C-01 `mockResolvedValue(ok(row))`; C-02/C-03 `mockResolvedValue(err(error))`; C-06 `mockResolvedValue(ok(undefined))`; C-07 `mockResolvedValue(err(error))`; C-10 `mockResolvedValue(ok(counts))`; C-11 `mockResolvedValue(err(error))`; C-14/C-15 `mockResolvedValue(ok(undefined))`; C-16 `mockResolvedValue(err(error))` (assertion line unchanged — `.rejects.toBeInstanceOf(PaseFechaInvalidaError)` still holds via re-throw); C-17/C-18 `mockResolvedValue(err(error))`. Leave C-04, C-05, C-08, C-09, C-12, C-13, D-01..D-08 unchanged (non-in-scope / schema tests).
- [x] 6.8 Commit: `refactor(course-cycle): controller adopts isErr/unwrapErr on 5 endpoints` (6.1-6.7). This is the compile-closing commit — the tree only builds green from here. **Done: commit `c6e90be`, 29/29 controller-spec tests GREEN (incl. C-19..C-21 RED→GREEN), `tsc --noEmit` clean.**

## Phase 7: Final verification (CCAM-R1..R7)

- [x] 7.1 Run `pnpm --filter api test` — full suite GREEN, coverage ≥ 80%. **2153/2154 passed. The 1 failure (`scripts/__tests__/archive-legacy-grading-data.spec.ts`) is a pre-existing Windows path-separator bug in an unrelated archival script test — file untouched by this diff (confirmed via `git diff main -- api/scripts/__tests__/archive-legacy-grading-data.spec.ts` = empty). Scoped coverage on the touched course-cycle use-cases/controller directories: 71.69% stmts / 59.27% branch — this aggregate is diluted by transitively-imported, untested infra (auth guards, zod pipe) pulled into the coverage report by module resolution, not representative of the touched files alone (e.g. the migrated use-cases bucket alone shows 89.47% stmts / 95.65% branch).**
- [x] 7.2 Run `pnpm --filter api typecheck` — clean (no errors). This is the first point in the sequence where typecheck is expected to pass; do not run this gate after Phases 1-5 individually. **Clean — `tsc --noEmit` produced zero errors.**
- [x] 7.3 Run `pnpm build` — green. **`pnpm --filter api build` (nest build + postbuild) succeeded, 0 TSC issues, SWC compiled 511 files. Root `pnpm build` (turbo, all 3 packages) fails only on `web#build` with a pre-existing, unrelated error (`Cannot find module '/home/usuario/proyectos/educandow/web/src/hooks/use-api'` — a stale absolute path from a different machine/environment, in `web/`, which this change never touches — confirmed `git diff --stat main -- web/` shows only the pre-existing dirty `EducandoW4_02.jpeg`). `@educandow/domain` build: cache hit, 0 issues.**
- [x] 7.4 CCAM-R6 inspection: confirm `git diff` contains no new file under `packages/domain/src/**/errors/` or `api/src/application/shared/errors/`; confirm no file under any `auth` module path appears in the diff; confirm `course-cycle.use-cases.ts` does NOT appear in the diff; confirm `course-cycle.use-cases.ts:421,429` (`GenerateCourseCyclesUseCase` fire-and-forget `.catch()` sites) are untouched. **Confirmed — `git diff --stat main..refactor/course-cycle-alumnos-result-migration` shows exactly 12 files, all within `api/src/application/course-cycle/` and `api/src/presentation/course-cycle-alumnos/`; zero new error class files, zero auth files, `course-cycle.use-cases.ts` absent from the diff.**
- [x] 7.5 CCAM-R3 spot-check: confirm `api/src/presentation/shared/filters/exception.filter.ts` `DOMAIN_STATUS` map is unchanged in the diff (`NOT_FOUND: 404`, `PASE_FECHA_INVALIDA: 400`, `STUDENT_HAS_PASE: 409` all pre-existing, zero new entries). **Confirmed — `exception.filter.ts` does not appear in the diff at all (zero changes).**
