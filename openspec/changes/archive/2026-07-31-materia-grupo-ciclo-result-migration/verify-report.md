# Verification Report — materia-grupo-ciclo-result-migration

> Fresh-context adversarial verification of the FULL change (Slice A merged to `main` via PR #115;
> Slices B+C on `refactor/mgc-result-c`, stacked on `refactor/mgc-result-b`, stacked on `main`).
> Verified ON branch `refactor/mgc-result-c`. All evidence below is from commands executed in this
> session, not copied from `apply-progress.md`.

## Mode

Persistence: hybrid (openspec file + engram backfill). Project: `educandow`.

## 1. Diff Inspection

```
git diff main..refactor/mgc-result-c --stat
21 files changed, 498 insertions(+), 133 deletions(-)
```

Files touched (B+C only, Slice A already on `main`): 5 `application/materia-grupo-ciclo/*.use-case.ts`
+ `validate-teacher-level.ts`, 5 matching `__tests__/*.test.ts`, `materia-grupo-ciclo.controller.ts`,
2 new + 2 modified controller-spec files, `exception.filter.ts` + its spec, `packages/domain/src/index.ts`,
and exactly one new pair (`grupo-materia-mismatch-error.ts` + its test).

Confirmed:
- Exactly ONE new error class file: `packages/domain/src/shared/errors/grupo-materia-mismatch-error.ts` (git diff --name-status main..HEAD -- packages/domain/src/shared/errors/ shows only `A grupo-materia-mismatch-error.ts`).
- NO `competency.use-cases.ts`, NO `auth/` file in the diff (grep against name-only list found no matches).
- NO entity constructor guard files in the diff.
- Slice A's materia use-cases confirmed already on `main` with zero throws (grepped main's copies directly).

## 2. Test Execution (re-run independently)

Environment setup required first:
- `corepack pnpm --filter @educandow/domain build` -> clean, no errors.
- `corepack pnpm --filter api prisma:generate` -> both master and tenant clients generated.

| Command | Result |
|---|---|
| `pnpm --filter @educandow/domain test` | 112/112 test files, 1287/1287 tests pass |
| scoped api materia-grupo-ciclo vitest run | 27/27 test files, 119/119 tests pass |
| `pnpm --filter api test` (full suite) | 1 failed / 214 passed (215) files; 1 failed / 2179 passed (2180) tests |
| `pnpm --filter api typecheck` | clean, no errors |

### Adversarial check on the 1 claimed pre-existing failure

`scripts/__tests__/archive-legacy-grading-data.spec.ts` fails on a Windows path-separator assertion
mismatch, unrelated to Result propagation.

```
git diff main..refactor/mgc-result-c -- api/scripts/__tests__/archive-legacy-grading-data.spec.ts
-> empty (0 lines)
```

Confirmed genuinely pre-existing. Not a regression.

### AI attribution check

```
git log main..refactor/mgc-result-c --format=%B | grep -iE 'co-authored|claude|anthropic|generated with'
-> no matches
```

## 3. Per-Requirement Compliance

### MGCM-R1 -- No throw in the 9 migrated use-cases + validateTeacherLevel

PASS. Grepped `throw` directly in each file:
- Slice A (on `main`): `set-materia-es-optativa`, `remove-student-from-materia`, `add-student-to-materia`, `list-enrollable-students-for-materia` -- zero throws (only a docstring mention of "without throwing", not code).
- Slice B/C (on branch): `update-grupo.use-case.ts` -- exactly ONE throw, at line 44: `if (!client) throw new Error('No tenant client available')` -- the documented infra guard, correctly left as-is.
- `create-grupo.use-case.ts`, `delete-grupo.use-case.ts`, `remove-student-from-grupo.use-case.ts`, `add-student-to-grupo.use-case.ts`, `validate-teacher-level.ts` -- zero throws.

### MGCM-R2 -- Status-preserving mechanical migrations

PASS (by test evidence). `NotFoundError` to 404 and `AlumnoAlreadyInGrupoError` to 409 `DOMAIN_STATUS` entries are unmodified in the diff (only one line ADDED to the table -- see MGCM-R3 below). Controller specs assert re-throw of the same error instances; `exception.filter.ts` mapping unchanged for these two error codes.

### MGCM-R3 -- GrupoMateriaMismatchError (the key behavior correction)

PASS. Read `add-student-to-grupo.use-case.ts:60-62`:
```ts
if (axm.materiaXCursoXCicloId !== grupo.materiaXCursoXCicloId) {
  return err(new GrupoMateriaMismatchError());
}
```
`GrupoMateriaMismatchError extends DomainError`, zero-arg constructor, `code = 'GRUPO_MATERIA_MISMATCH'` (`packages/domain/src/shared/errors/grupo-materia-mismatch-error.ts:10-16`). `exception.filter.ts:47` adds `GRUPO_MATERIA_MISMATCH: 422,` as a single new line next to `ALUMNO_ALREADY_IN_GRUPO: 409` -- not 409, correctly 422.

End-to-end 422 wiring proven by a real test: `exception.filter.spec.ts` FILTER-8 constructs a real `GrupoMateriaMismatchError`, runs it through `AppExceptionFilter.catch()`, and asserts `statusFn` called with `422` (and explicitly NOT `500`), `body.error.code === 'GRUPO_MATERIA_MISMATCH'`. This test passed in the full suite run above.

RED-first discipline verified via `git show --stat`:
```
e0a917d  test(mgc): tighten add-student-to-grupo unit to 422/GrupoMateriaMismatchError (RED)
  -> 1 file changed (test file only)
1194c30  test(mgc): add-student-to-grupo controller spec incl. 422 case (RED)
  -> 2 files changed (both test files: new controller spec + exception.filter.spec.ts)
77cb6c3  fix(mgc): map grupo-materia mismatch to 422 via Result
  -> 1 file changed (add-student-to-grupo.use-case.ts only -- production code)
```
Commit order and content are exactly right: two test-only commits precede a production-only fix commit. Read the tightened unit test directly (`add-student-to-grupo.use-case.test.ts:129-130, 148`): assertions are `expect(r.unwrapErr()).toBeInstanceOf(GrupoMateriaMismatchError)` -- no loose `.rejects.toThrow(regex)` patterns remain anywhere in the file.

Minor naming divergence (non-blocking): the fix commit message is `fix(mgc): map grupo-materia mismatch to 422 via Result` (ASCII), not the containment-symbol variant specified in `design.md`/`tasks.md`. Documented honestly in `apply-progress.md` as a shell-quoting mangling that was caught and amended. Semantically identical, no functional impact. SUGGESTION only.

### MGCM-R4 -- validateTeacherLevel migrates atomically with both callers

PASS. `git show --stat edd2b4a` confirms all three files (`validate-teacher-level.ts`, `create-grupo.use-case.ts`, `update-grupo.use-case.ts`) landed in exactly ONE commit (`refactor(mgc): migrate validateTeacherLevel + grupo use-cases to Result`) -- no split.

### MGCM-R5 -- Controller if (isErr) throw unwrapErr() idiom, 9 endpoints

PASS. Grepped the controller directly: all 9 in-scope endpoints (`addStudentToMateria`, `createGrupo`, `listAlumnosMateria`'s eligible branch, `removeStudentFromMateria`, `setMateriaEsOptativa`, `addStudentToGrupo`, `updateGrupo`, `deleteGrupo`, `removeStudentFromGrupo`) show the `if (result.isErr()) throw result.unwrapErr();` idiom. The 4 non-in-scope list endpoints (`listMaterias`, `listGrupos`, `listAlumnosGrupo`, `listGruposGlobal`) call their use cases directly with no Result unwrap -- confirmed unchanged. Read `createGrupo`'s raw-Prisma enrichment block (controller.ts lines 158-168) directly -- untouched, sits before the retrofitted `grupoResult` block.

### MGCM-R6 -- Deferred infra guard / entity guards / scope discipline

PASS. `update-grupo.use-case.ts:44` throw is unmodified (confirmed via direct read, matches design.md's documented line exactly). `git diff --name-only` grep for `competency|auth/|<4 entity guard files>` -> no matches. Exactly one new error class confirmed above.

### MGCM-R7 -- 3 independently-green stacked slices

PASS (by direct test execution at Slice C's tip, which validates the cumulative stack A+B+C since each slice bases on the previous and Slice A is merged to `main`). Diff line counts independently re-verified: Slice B alone was reported at 369 changed lines, Slice C alone at 262, both under the 400-line cap.

Coverage was not independently re-run with `--coverage` flags in this session. Flagging as a WARNING rather than silently trusting the coverage table.

## 4. Issues

### CRITICAL
None found.

### WARNING
1. Coverage figures not independently re-run. `apply-progress.md` reports directory-level coverage (`application/materia-grupo-ciclo/` 96.29%, `presentation/materia-grupo-ciclo/` 95.52%, whole-project 68.06% pre-existing baseline) from a `--coverage.reportOnFailure` run. This session re-ran all 4 primary test/typecheck commands with exact-matching results, but did not re-run the coverage command itself. Recommend a final `pnpm --filter api exec vitest run --coverage --coverage.reportOnFailure` pass before archive if strict coverage-gate sign-off is required.

### SUGGESTION
1. Commit message `fix(mgc): map grupo-materia mismatch to 422 via Result` uses ASCII hyphen instead of the containment symbol specified in `design.md`/`tasks.md`, due to a documented shell-quoting encoding issue. No functional impact; purely cosmetic, already disclosed honestly in `apply-progress.md`.

## 5. Final Verdict

PASS.

- CRITICAL: 0
- WARNING: 1 (coverage re-verification recommended, not re-run this session)
- SUGGESTION: 1 (commit message encoding, cosmetic)

All 7 spec requirements (MGCM-R1 through MGCM-R7) verified against real code and real test execution, not against `apply-progress.md`'s claims alone. Test suite, typecheck, RED-first commit ordering, atomicity requirement (MGCM-R4), scope discipline (MGCM-R6), and the one behavior correction (MGCM-R3, 500 to 422) all independently confirmed. No AI attribution in commit history. Change is ready for `sdd-archive`.
