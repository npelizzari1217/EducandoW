# Tasks: vitest-swc-metadata (issue #100)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~45 (+52 / −7) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending (not needed — single PR) |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | RED guard + GREEN wiring + Gate B cleanup | PR 1 | Single PR, 3 atomic commits (see below) |

## Phase 1: RED — Guard Test (fails on current esbuild transform)

- [x] 1.1 Create `api/src/presentation/student/__tests__/student.controller.di.test.ts`: light `Test.createTestingModule({ controllers: [StudentController], providers: [...] })` with 12 stubs `{ provide: UCClass, useValue: { execute() {} } }` for the constructor use-cases (createUC, listUC, getUC, deleteUC, patchUC, myDataUC, myChildrenUC, assignGuardianUC, removeGuardianUC, listGuardiansUC, createStudyTutorUC, updateStudyTutorUC) plus `{ provide: 'StudentRepository', useValue: { search() {} } }`. Do NOT import `StudentModule`. `.compile()`, `moduleRef.get(StudentController)`, assert (as any) all 12 fields `toBeDefined()`. Satisfies VSM-S2a/S5.
- [x] 1.2 Run isolated: `pnpm --filter api exec vitest run src/presentation/student/__tests__/student.controller.di.test.ts` against current config (esbuild, no unplugin-swc). MUST fail — either compile-throw ("can't resolve dependencies") or undefined fields. Both forms are valid RED; do not assume only one. Satisfies VSM-R5/VSM-S5 (RED half).
- [x] 1.3 Commit red guard, isolated from wiring changes.
  - `git commit -m "test(student): add DI parity guard for StudentController (RED)"` — `835bdf5`

## Phase 2a: Fix mixed type/runtime import (discovered during Gate A rehearsal — see gotcha/swc-mixed-type-runtime-imports)

A first (reverted) attempt tried to fix this footgun globally with the ESLint rule
`@typescript-eslint/consistent-type-imports` + `eslint --fix`. That rule is
INCOMPATIBLE with NestJS DI under `emitDecoratorMetadata` (see
`gotcha/consistent-type-imports-nestjs-di`): it strips constructor-param imports
of `@Injectable()`/`@Controller()` classes to `import type`, deleting the
`design:paramtypes` metadata NestJS needs for implicit DI. That attempt produced
247 files / 923+/879− for a ~45-line problem and was reverted via `git reset`.
The correct, minimal fix touches only the ONE file that actually breaks under SWC
(the only site with a strict `vi.mock('@educandow/domain')`), done by hand.

- [x] 2a.1 Edit `api/src/application/materia-grupo-ciclo/list-grupos-global.use-case.ts`: split the mixed import from `@educandow/domain` — `import type { GrupoRepository, GrupoGlobalRow, GrupoGlobalFilters, DocenteXCicloRepository }` (all `export type` in `packages/domain/src/index.ts`) separate from `import { resolveAccessScope }` (runtime).
- [x] 2a.2 Run full suite under the STILL-esbuild config → verified green (2083 passed + 1 expected RED guard = 2084), proving `import type` is a no-op under esbuild.
- [x] 2a.3 Commit standalone, before wiring.
  - `git commit -m "fix(api): split type-only imports in list-grupos-global use-case"` — `46f0eaf`

## Phase 2b: GREEN — Wire unplugin-swc + Gate A (full suite)

- [x] 2b.1 Edit `api/vitest.config.ts`: import `swc from 'unplugin-swc'`; add `plugins: [swc.vite({ jsc: { target: 'es2022', parser: { syntax: 'typescript', decorators: true }, transform: { legacyDecorator: true, decoratorMetadata: true }, keepClassNames: true }, module: { type: 'es6' } })]` at ROOT level (sibling to `test:` and `resolve:`, NOT nested inside `test:`). Satisfies VSM-R1/VSM-S1.
- [x] 2b.2 Re-run guard from 1.1 isolated → now passes (GREEN, all 12 fields defined). Required adding `.overrideGuard(AuthGuard).useValue({ canActivate: () => true })` to the guard's `Test.createTestingModule` — with real metadata, Nest instantiates `@UseGuards` guards eagerly during `.compile()`, and `AuthGuard` needs `JwtAuthPort` which this light module doesn't provide (`RolesGuard` only needs the built-in `Reflector`, no override needed). Confirms VSM-S2a/S5 (GREEN half).
- [x] 2b.3 Run full suite: `pnpm --filter api test` (205 files / 2084 tests) → exit 0, wall-time 57.14s. No regression beyond the one fixed in Phase 2a. Satisfies VSM-R6/VSM-S6 (first pass, pre-cleanup).
- [x] 2b.4 Commit config wiring + green guard together (same commit — Gate A is atomic).
  - `git commit -m "feat(api): wire unplugin-swc in vitest for design:paramtypes parity"` — `a55eb1a`

## Phase 3: Gate B — Remove Scaffolding (only after suite is green)

- [x] 3.1 Edit `api/src/presentation/attendance-type/attendance-type.controller.ts:43-48`: remove the 6 `@Inject(UseCaseClass)` decorators from the constructor params (createUC, listUC, getUC, updateUC, deleteUC, generatePdfUC) — leave params typed by class only, no decorator. Removed `Inject` from the `@nestjs/common` import list (line 3) — confirmed unused elsewhere in the file. Satisfies VSM-R3.
- [x] 3.2 Run `api/src/presentation/attendance-type/__tests__/attendance-type.controller.e2e.test.ts` — stays green (14/14) without touching assertions/mocks. Satisfies VSM-S3/VSM-S2b.
- [x] 3.3 Commit scaffolding removal separately from wiring (rollback isolation: if this breaks, root cause is cleanup, not transform).
  - `git commit -m "refactor(api): drop redundant @Inject scaffolding from AttendanceTypeController"` — `efa3977`

## Phase 4: Verification (no code — review checklist)

- [x] 4.1 Manual inspection: confirmed the 8 legitimate `@Inject(TOKEN)` sites (Symbol/string) are untouched — `PDF_PORT` x4, `MATERIA_PREVIA_REPOSITORY` x2, `'StudentRepository'`, `'EventBus'`. No dedicated test per design §6 (suite is the guardrail). Satisfies VSM-R4/VSM-S4.
- [x] 4.2 Re-ran full suite once more post-cleanup: `pnpm --filter api test` → exit 0, 205/205 files, 2084/2084 tests, wall-time 59.15s. Confirms VSM-R6/VSM-S6 holds after Gate B too.
- [x] 4.3 Wall-time comparison (informal): esbuild baseline ~54.2s (Phase 2a.2 run) vs SWC 57.14s (Gate A) / 59.15s (Gate B) — SWC slightly slower (~5-9%), within noise for a single machine run. No formal performance budget in scope (proposal exclusion); not a blocker.
- [x] 4.4 `pnpm --filter api typecheck` → exit 0, clean.

## Golden Rule (enforced by task order above)

NEVER wire unplugin-swc before the RED guard (Phase 1) is committed. Phase 2a (import fix) and Phase 2b (wiring) both depend on Phase 1's commit existing; Phase 3 depends on Phase 2b's suite being green.

## Final scope note

The single ESLint-rule-based attempt (`@typescript-eslint/consistent-type-imports`)
described above was reverted. Final approach is 4 atomic commits (RED guard was
already committed separately): `835bdf5` (RED), `46f0eaf` (Phase 2a fix),
`a55eb1a` (Phase 2b wiring), `efa3977` (Phase 3 cleanup). Diff since the RED
guard commit: 4 files, +26/−10 (36 lines) — proportionate to the ~45-line
estimate in this file's Review Workload Forecast above.
