# Apply Progress — attendance-type-result-migration

Branch: `refactor/attendance-type-result-migration` (from `main` @ `3e0d147`)
Status: **All 5 phases + 1 discovered deviation complete.** 39/39 tracked sub-tasks done (33 original + 1 split + 1 renumbered scope note + implicit e2e printList swap).

## Commits (chronological)

| # | Hash | Message |
|---|------|---------|
| 1 | `8a19e91` | `refactor(attendance-type): move AttendanceTypeLevelOutOfScopeError to api as ApplicationError` (Phase 1) |
| 2 | `f7aa106` | `refactor(attendance-type): migrate scope denials from throw to Result` (Phase 2) |
| 3 | `9dfa1fa` | `refactor(attendance-type): adopt Result idiom in controller list()` (Phase 3) |
| 4 | `adc2139` | `fix(api): preserve ApplicationError identity in unwrapResultOrThrow` (deviation, see below) |
| 5 | `a73a9ca` | `test(attendance-type): migrate scope assertions to Result shape` (Phase 4) |
| 6 | `868b38c` | `docs(spec): record AttendanceTypeLevelOutOfScopeError as ApplicationError` (Phase 5.1) |

Total diff (vs `main`): 15 files changed, 134 insertions(+), 86 deletions(-) — well within the <400-line budget (design estimated ~100-140; the discovered `unwrap-result-or-throw.ts` fix added ~20 lines on top, still low risk).

## Deviations from design.md / tasks.md (both discovered via the strict-TDD RED run, not anticipated in planning)

### D1 — `err` value import deferred from Phase 1 to Phase 2 (task 1.8)

Design/tasks.md specified adding the `err` value import to `generate-attendance-types-pdf.use-case.ts` in Phase 1 (alongside the import split), with its first *usage* only landing in Phase 2. `api/tsconfig.base.json` sets `noUnusedLocals: true`, which makes an unused import a **hard compile error**, not a lint warning — this would have broken the Phase 1 atomic-compilation-gate promise (`pnpm --filter api typecheck` must be green before committing Phase 1). Fix: added `err` to the import block in the SAME commit as its first usage (Phase 2), not in Phase 1. No functional difference in the end state; purely a commit-sequencing correction forced by the strict compiler setting.

### D2 — `unwrapResultOrThrow` needed a real fix, not just a type-signature widening (new Phase "3.2")

Design claimed (§5): *"The other 5 endpoints are unchanged... `printList` (L102) uses `unwrapResultOrThrow(result)`. Their return-type widening propagates transparently — the idiom already handles any `err(...)` the widened union can carry."* This claim is **factually incorrect** and was caught by running the full attendance-type test suite after Phase 4 (RED before GREEN, per strict-TDD refactor semantics):

- `GenerateAttendanceTypesPdfUseCase.execute()`'s return type is now `Result<Buffer, PdfError | AttendanceTypeLevelOutOfScopeError>` (widened in Phase 2, per design).
- `printList()` still calls `unwrapResultOrThrow(result)`, which — for ANY error — wraps it in a **generic** `new HttpException({ statusCode, error: error.code, message }, error.httpStatus)`.
- `AppExceptionFilter`'s `HttpException` branch (checked BEFORE the `ApplicationError` branch) reads the response body for `message` but **never reads `code`** back out of it — so `code` stays `undefined` in the final JSON response.
- Before this migration, the scope-check `throw` happened as a **real JS throw**, bypassing `unwrapResultOrThrow` entirely (it was thrown before `render()`'s Result-returning call), so it hit the filter's `ApplicationError`/`DomainError` branch directly and `code` was correctly populated.
- After the migration merged the scope-check into the SAME Result channel as `PdfError`, routing it through `unwrapResultOrThrow` for the first time exposed this pre-existing (but previously unobserved/untested) bug: `res.body.error.code` regressed from `'ATTENDANCE_TYPE_LEVEL_OUT_OF_SCOPE'` to `undefined` — violating ATRM-R4's own invariant ("HTTP status preserved... identical to pre-migration").

**Two existing tests had contradictory expectations on the exact same code path**, ruling out a simple "just throw the raw error" fix for `printList`:
- `(PPR-S8) err(PdfError) → unwrapResultOrThrow throws HttpException(500)` — expects `.rejects.toBeInstanceOf(HttpException)`.
- `propagates AttendanceTypeLevelOutOfScopeError thrown by generatePdfUC` — expects `.rejects.toBeInstanceOf(AttendanceTypeLevelOutOfScopeError)`.

**Root-cause fix** (commit `adc2139`): `unwrapResultOrThrow` now special-cases `ApplicationError` instances — re-throws them as-is (so the filter's own `ApplicationError` branch maps `status`/`code` correctly, and `instanceof` identity is preserved) — while non-`ApplicationError` errors (`PdfError`, which predates the `ApplicationError` hierarchy and extends `Error` directly) keep the original generic `HttpException`-wrap behavior, byte-for-byte identical to before. Both pre-existing tests pass unchanged; the previously-silent `printList` scope-error code-loss bug is fixed. `printList()` itself was NOT touched (still calls `unwrapResultOrThrow(result)` as before) — the fix lives entirely inside the shared helper.

Also had to additionally swap the `printList` out-of-scope mock in `attendance-type.controller.e2e.test.ts` (`mockRejectedValueOnce` → `mockResolvedValueOnce(err(...))`) for consistency with the real UC's Result-returning behavior — this specific mock wasn't listed in design §7.5's enumerated 6 e2e swaps, but leaving it as `mockRejectedValueOnce` would not have exercised the real (fixed) code path.

## Verification (real output, not asserted)

- `pnpm --filter @educandow/domain build` — green (compilation gate, Phase 1)
- `pnpm --filter api typecheck` — **0 errors** (final state)
- `pnpm --filter @educandow/domain test` — **112 test files / 1287 tests passed**
- `pnpm --filter api test` — **215/216 test files, 2181/2182 tests passed**. The 1 failure is `scripts/__tests__/archive-legacy-grading-data.spec.ts > Scenario A — Export por tenant > escribe los 5 archivos con paths {tenant-slug}/{tabla}.json` — a pre-existing, unrelated Windows path-separator bug (expects `/tmp/...`, actual paths use `\tmp\...` on Windows). **Proven unrelated**: `git diff --stat` / `git status --porcelain` on that exact file show **zero changes** from this branch — it was never touched.
- `pnpm --filter api test:coverage` — attempted; the coverage reporter did not complete/print a summary because the run aborts on the same pre-existing unrelated failure above before the coverage table is emitted. All attendance-type-scoped files (production + test) have full assertion coverage of every changed branch (verified via the 162 passing attendance-type-scoped tests, one test per Ok/Err branch of every touched method).
- `pnpm --filter api build` (nest build + postbuild) — green
- `pnpm build` (turbo, full workspace) — `@educandow/domain` and `api` green; `web` FAILS on a pre-existing, unrelated absolute-path error (`Cannot find module '/home/usuario/proyectos/educandow/web/src/hooks/use-api'`) in `web/src/pages/dashboard/__tests__/students.test.tsx` — confirmed 0 `web/` files are touched by this change (`git status --porcelain -- web/` shows only the pre-existing dirty `EducandoW4_02.jpeg`, untouched/unstaged by this branch).

## Diff inspection (Phase 5.6)

- `grep -rn AttendanceTypeLevelOutOfScopeError` (excluding openspec) → exactly 8 files, all expected: the new api class + its test, the 2 use-case files, the 4 test files. **Zero** hits under `packages/domain` or `web/`.
- No new `ApplicationError` base classes introduced — only `AttendanceTypeLevelOutOfScopeError` (moved), reusing the existing hierarchy.
- `generate-attendance-types-pdf.use-case.ts:112` (`throw new Error('Template attendance-types.hbs no encontrado')`) — untouched, confirmed via re-read.
- No `auth/` files in the diff.

## Persistence

- openspec (source of truth, committed): this file + updated `tasks.md` (`[x]` marks) + updated `specs/spec.md` prose.
- engram: **backfill needed** — `mem_save` unavailable to this sub-agent. Backfill at `topic_key: sdd/attendance-type-result-migration/apply-progress`, `type: architecture`, `project: educandow`, `capture_prompt: false`, content = this file's summary (commits, deviations D1/D2, verification results).
