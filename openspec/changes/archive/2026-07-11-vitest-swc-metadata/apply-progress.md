# Apply Progress: vitest-swc-metadata (issue #100)

Status: **DONE**. Branch `chore/vitest-swc-metadata`, 4 commits total (RED guard was
already committed at session start; this apply session added 3 more).

## Commits

1. `835bdf5` — `test(student): add DI parity guard for StudentController (RED)`
   (pre-existing at session start, working tree clean, HEAD == this commit before apply began)
2. `46f0eaf` — `fix(api): split type-only imports in list-grupos-global use-case`
3. `a55eb1a` — `feat(api): wire unplugin-swc in vitest for design:paramtypes parity`
4. `efa3977` — `refactor(api): drop redundant @Inject scaffolding from AttendanceTypeController`

## What happened this session

This is a **redo** of a previous apply attempt that was reverted (`git reset`)
before this session started. The previous attempt used
`@typescript-eslint/consistent-type-imports` + `eslint --fix` as a "deterministic"
global fix for mixed type/runtime imports from `@educandow/domain`. That rule is
fundamentally incompatible with this project's NestJS DI (constructor params typed
by class, resolved via `emitDecoratorMetadata`): the autofix converted ~120
constructor-param imports across ~40 `@Injectable()`/`@Controller()` classes to
`import type`, which deletes the `design:paramtypes` metadata NestJS needs for
implicit DI — this would have broken production boot (prod already builds with
SWC + emitDecoratorMetadata via nest-cli). Diff was 247 files / 923+/879− for what
should be a ~45-line change. Full details in engram
`gotcha/consistent-type-imports-nestjs-di` (#1794).

This session's approach is the **minimal, surgical** fix instead: no ESLint rule,
no `eslint.config.mjs` change, no global autofix. Only the one file that actually
breaks under SWC gets a manual `import type` split.

### Phase 2a — fix the one breaking file

`api/src/application/materia-grupo-ciclo/list-grupos-global.use-case.ts` mixed
`export type` interfaces (`GrupoRepository`, `GrupoGlobalRow`, `GrupoGlobalFilters`,
`DocenteXCicloRepository`) with the runtime function `resolveAccessScope` in one
import from `@educandow/domain`. esbuild silently elides the type-only names;
SWC with `decoratorMetadata: true` preserves the whole import (to emit
`design:paramtypes` for the `@Injectable()` ctor params), which breaks under
strict ESM + the strict `vi.mock('@educandow/domain')` in
`list-grupos-global.use-case.test.ts` — the only test in the codebase with that
exact strict mock pattern (audited: 87 files have mixed imports, only this one
breaks; 27 more are "medium risk" latent debt, 59 are "low risk" and elided
identically by both transforms — see engram `gotcha/swc-mixed-type-runtime-imports`
#1791 for the full classification). Fixed by splitting into `import type { ... }`
for the interfaces and a plain `import { resolveAccessScope }` for the runtime
piece. Verified as a no-op under the still-esbuild config first (2083 passed + 1
expected RED guard = 2084) before touching vitest config at all.

### Phase 2b — wire unplugin-swc (Gate A)

`api/vitest.config.ts`: added `plugins: [swc.vite({...})]` at the config root
(sibling to `test:`/`resolve:`), matching design.md §2. Guard test needed one
addition beyond the design/tasks description:
`.overrideGuard(AuthGuard).useValue({ canActivate: () => true })` on the
`Test.createTestingModule` call. Reason: with real `design:paramtypes` metadata,
Nest instantiates guards declared via `@UseGuards` **eagerly during `.compile()`**
— this is a difference from esbuild, where the guard's constructor dependency
(`JwtAuthPort` for `AuthGuard`) was silently never resolved. `RolesGuard` didn't
need an override — it only depends on the built-in `Reflector`, which
`TestingModule` provides automatically. **Gate A result**: full suite
`pnpm --filter api test` → 205/205 files, 2084/2084 tests green, wall-time 57.14s.
No file other than the Phase 2a fix broke — matches the audit prediction.

### Phase 3 — Gate B cleanup

Removed the 6 `@Inject(SomeClass)` decorators from
`AttendanceTypeController`'s constructor (createUC, listUC, getUC, updateUC,
deleteUC, generatePdfUC) — redundant scaffolding now that implicit class-based DI
resolves correctly under real metadata. Also dropped the now-unused `Inject`
import from `@nestjs/common` (confirmed no other use in the file). Did **not**
touch any of the 8 legitimate `@Inject(TOKEN)` sites (Symbol/string tokens:
`PDF_PORT` x4, `MATERIA_PREVIA_REPOSITORY` x2, `'StudentRepository'`,
`'EventBus'`). **Gate B result**: e2e `attendance-type.controller.e2e.test.ts` →
14/14 green. Full suite re-run → 205/205 files, 2084/2084 tests, wall-time
59.15s. `pnpm --filter api typecheck` → clean.

## Diff size

- Since RED guard (`835bdf5..HEAD`, excl. `openspec/`): 4 files, +26/−10 = 36 lines.
- Since `main` (excl. `openspec/`), including the RED guard test file itself:
  4 files, +65/−9 = 74 lines (44 of those insertion lines are the new guard test
  file, already committed before this apply session started).

Both are proportionate to the tasks.md Review Workload Forecast (~45 lines) —
no `size:exception` needed. Contrast with the reverted attempt's 247 files /
1800+ lines.

## Tests

- Full suite: 205/205 files, 2084/2084 tests passing (ran 3 times this session:
  esbuild pre-wiring sanity check, Gate A post-wiring, Gate B post-cleanup).
- Typecheck: clean (`tsc --noEmit`).
- Coverage: not measured separately this session (no coverage-affecting code
  paths changed — only import statements, config, and decorator removal).

## Reconciliation pending for verify/archive (NOT edited this session — spec/design are read-only for apply)

1. **`design.md §4`** states that guards declared via `@UseGuards` are not
   instantiated during `Test.createTestingModule().compile()`. This is **false**
   once real `design:paramtypes` metadata is present (post-wiring) — Nest
   instantiates them eagerly. Under esbuild this went unnoticed because the
   guard's own constructor dependency silently resolved to `undefined` rather
   than throwing. Mitigated in this session via `.overrideGuard(AuthGuard)` on
   the guard test. `design.md` needs a correction here.
2. **Line-count estimates** in `proposal.md`/`design.md`/`tasks.md`'s original
   Review Workload Forecast (~45 lines) predates the discovery of the mixed
   type/runtime import footgun (Phase 2a, not originally an explicit task line
   item) and undercounts by a small margin — actual is 36 lines since the RED
   guard, 74 including the guard file itself. Not a blocker, but the estimate
   should be updated to reflect the final 4-commit shape when archived.

Both points are informational for `sdd-verify`/`sdd-archive` — this session did
not modify `spec.md` or `design.md` per explicit instruction from the
orchestrator.

## Tasks completed

All of Phase 1 (pre-existing), Phase 2a (new, discovered), Phase 2b, Phase 3,
and Phase 4 in `tasks.md` are marked `[x]`. See `tasks.md` for the full
per-task checklist with commit references.
