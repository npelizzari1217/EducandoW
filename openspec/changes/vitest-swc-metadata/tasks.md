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

- [ ] 1.1 Create `api/src/presentation/student/__tests__/student.controller.di.test.ts`: light `Test.createTestingModule({ controllers: [StudentController], providers: [...] })` with 12 stubs `{ provide: UCClass, useValue: { execute() {} } }` for the constructor use-cases (createUC, listUC, getUC, deleteUC, patchUC, myDataUC, myChildrenUC, assignGuardianUC, removeGuardianUC, listGuardiansUC, createStudyTutorUC, updateStudyTutorUC) plus `{ provide: 'StudentRepository', useValue: { search() {} } }`. Do NOT import `StudentModule`. `.compile()`, `moduleRef.get(StudentController)`, assert (as any) all 12 fields `toBeDefined()`. Satisfies VSM-S2a/S5.
- [ ] 1.2 Run isolated: `pnpm --filter api exec vitest run src/presentation/student/__tests__/student.controller.di.test.ts` against current config (esbuild, no unplugin-swc). MUST fail — either compile-throw ("can't resolve dependencies") or undefined fields. Both forms are valid RED; do not assume only one. Satisfies VSM-R5/VSM-S5 (RED half).
- [ ] 1.3 Commit red guard, isolated from wiring changes.
  - `git commit -m "test(student): add DI parity guard for StudentController (RED)"`

## Phase 2: GREEN — Wire unplugin-swc + Gate A (full suite)

- [ ] 2.1 Edit `api/vitest.config.ts`: import `swc from 'unplugin-swc'`; add `plugins: [swc.vite({ jsc: { target: 'es2022', parser: { syntax: 'typescript', decorators: true }, transform: { legacyDecorator: true, decoratorMetadata: true }, keepClassNames: true }, module: { type: 'es6' } })]` at ROOT level (sibling to `test:` and `resolve:`, NOT nested inside `test:`). Satisfies VSM-R1/VSM-S1.
- [ ] 2.2 Re-run guard from 1.1 isolated → MUST now pass (GREEN, all 12 fields defined). Confirms VSM-S2a/S5 (GREEN half).
- [ ] 2.3 Run full suite: `pnpm --filter api test` (~2083 tests / 192 files). MUST exit 0 — guard green AND no previously-passing test regresses. If it breaks here, root cause is the transform (config), not later cleanup. Watch regression vectors while running: `vi.mock` hoisting under SWC (`rg vi.mock` for top-level usage), CJS/ESM `__dirname` in PDF use-case tests (generate-boletin, constancia-regular, attendance-types-pdf, asistencia-mensual). Satisfies VSM-R6/VSM-S6 (first pass, pre-cleanup).
- [ ] 2.4 Commit config wiring + green guard together (same commit — Gate A is atomic).
  - `git commit -m "feat(api): wire unplugin-swc in vitest for design:paramtypes parity"`

## Phase 3: Gate B — Remove Scaffolding (only after suite is green)

- [ ] 3.1 Edit `api/src/presentation/attendance-type/attendance-type.controller.ts:43-48`: remove the 6 `@Inject(UseCaseClass)` decorators from the constructor params (createUC, listUC, getUC, updateUC, deleteUC, generatePdfUC) — leave params typed by class only, no decorator. Remove `Inject` from the `@nestjs/common` import list (line 3) if no longer used elsewhere in the file. Satisfies VSM-R3.
- [ ] 3.2 Run `api/src/presentation/attendance-type/__tests__/attendance-type.controller.e2e.test.ts` — MUST stay green without touching assertions/mocks. Satisfies VSM-S3/VSM-S2b.
- [ ] 3.3 Commit scaffolding removal separately from wiring (rollback isolation: if this breaks, root cause is cleanup, not transform).
  - `git commit -m "refactor(api): drop redundant @Inject scaffolding from AttendanceTypeController"`

## Phase 4: Verification (no code — review checklist)

- [ ] 4.1 Manual inspection: confirm the 8 legitimate `@Inject(TOKEN)` sites (Symbol/string) are untouched — `PDF_PORT` x4, `MATERIA_PREVIA_REPOSITORY` x2, `'StudentRepository'`, `'EventBus'`. No dedicated test per design §6 (suite is the guardrail: removing any would break PDF use-case tests, materia-previa tests, the guard's own `'StudentRepository'` stub, or the event handler). Satisfies VSM-R4/VSM-S4.
- [ ] 4.2 Re-run full suite once more post-cleanup: `pnpm --filter api test` → exit 0, confirms VSM-R6/VSM-S6 holds after Gate B too.
- [ ] 4.3 Compare wall-time before/after (informal — SWC native transform expected equal or faster than esbuild). No formal performance budget in scope (proposal exclusion).

## Golden Rule (enforced by task order above)

NEVER wire unplugin-swc before the RED guard (Phase 1) is committed. Phase 2 depends on Phase 1's commit existing; Phase 3 depends on Phase 2's suite being green.
