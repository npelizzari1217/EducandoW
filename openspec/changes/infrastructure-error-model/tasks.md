# Tasks: infrastructure-error-model

> Ordered checklist derived from `design.md` (THE plan — follow exact code/edits there).
> Traces to `spec.md` requirements IEM-R1..R9. Strict TDD: RED (test first, fails) → GREEN (impl) for
> all NEW code. Pilot 1's test is a REWRITE (MGCM-R6), framed accordingly.
> Delivery: 2 stacked PRs (PR1 → PR2). PR2 kept as ONE PR (see decision below).

Legend: `[P]` = can run in parallel with sibling `[P]` tasks in the same group. Unmarked = sequential
(depends on the immediately preceding task or an earlier PR).

---

## PR1 — base + wiring (purely additive, ~150-180 lines)

Nothing in production consumes `InfrastructureError` yet in this PR — all pre-existing tests MUST stay
green with zero behavior change. This is what "additive" means and what the verification task proves.

### 1.1 Base class

- [x] **T1** `[P]` RED: write `api/src/application/shared/errors/infrastructure-error.test.ts` using a
  local concrete stub class (`class StubInfraError extends InfrastructureError { constructor() { super('msg', 'STUB_CODE'); } }`)
  asserting: `instanceof Error === true`; NOT `instanceof ApplicationError`; NOT `instanceof DomainError`;
  `httpStatus === 500`; `message`/`code`/`name` set correctly. Run `pnpm --filter api test` → confirm it
  fails (class doesn't exist yet).
  Traces: IEM-R1 (all 4 scenarios).
- [x] **T2** GREEN: create `api/src/application/shared/errors/infrastructure-error.ts` per design §1
  exact code (`abstract class InfrastructureError extends Error`, fixed `readonly httpStatus = 500`,
  ctor `(message: string, public readonly code: string)`, `this.name = this.constructor.name`). Run
  tests → green.
  Traces: IEM-R1.

### 1.2 Concrete subclasses

- [x] **T3** `[P]` RED: write `api/src/application/shared/errors/infrastructure-errors.test.ts` asserting
  `new TenantClientUnavailableError()` → `code === 'TENANT_CLIENT_UNAVAILABLE'`, `httpStatus === 500`,
  `message === 'No tenant client available'`; and `new TemplateNotFoundError('attendance-types.hbs')` →
  `code === 'TEMPLATE_NOT_FOUND'`, `httpStatus === 500`, message references `'attendance-types.hbs'`.
  Confirm RED (classes don't exist).
  Traces: IEM-R2 (both scenarios).
- [x] **T4** GREEN (depends on T2): create `api/src/application/shared/errors/infrastructure-errors.ts`
  per design §1 exact code (`TenantClientUnavailableError`, `TemplateNotFoundError`, both `extends
  InfrastructureError`). Run tests → green.
  Traces: IEM-R2.

### 1.3 Filter branch

- [x] **T5** RED (depends on T2): extend `exception.filter.spec.ts` with a new `IEM-R3` describe block
  (mirror the existing `ApplicationError` branch block, ~line 233) — case constructs an
  `InfrastructureError` instance (via the stub or a real subclass), asserts response body
  `error.status === 500`, `error.code === 'TENANT_CLIENT_UNAVAILABLE'`, `error.message` equals the
  exception's message, and that `code` is present (not silently dropped by the generic fallback). Confirm
  RED (branch doesn't exist → falls through to generic `Error` branch, `code` missing).
  Traces: IEM-R3 (all 3 scenarios).
- [x] **T6** GREEN: edit `api/src/presentation/shared/filters/exception.filter.ts` — add
  `import { InfrastructureError } from '../../../application/shared/errors/infrastructure-error';` next
  to the `ApplicationError` import; insert
  `} else if (exception instanceof InfrastructureError) { status = exception.httpStatus; message = exception.message; code = exception.code; }`
  branch immediately after the `ApplicationError` branch and before `DomainError`/generic `Error`. Run
  filter spec → green; confirm existing `ApplicationError`/`DomainError` cases unaffected.
  Traces: IEM-R3.

### 1.4 `unwrapResultOrThrow` branch

- [x] **T7** `[P]` RED (depends on T2): extend `unwrap-result-or-throw.test.ts` with a new case (mirror
  the `ATRM-R4` `ApplicationError` case, ~line 44) — `result.unwrapErr()` returns an `InfrastructureError`
  instance, asserts `unwrapResultOrThrow` throws the SAME instance (`toBe`, not just `toEqual`),
  `instanceof InfrastructureError === true`, NOT `instanceof HttpException`. Confirm RED.
  Traces: IEM-R4.
- [x] **T8** GREEN: edit `api/src/presentation/shared/http/unwrap-result-or-throw.ts` — add
  `import { InfrastructureError } from '../../../application/shared/errors/infrastructure-error';`; add
  `if (error instanceof InfrastructureError) { throw error; }` immediately after the `ApplicationError`
  branch, before the generic `HttpException` fallback. No signature change (structural bound already
  admits it). Run test → green.
  Traces: IEM-R4.

### 1.5 PR1 verification

- [x] **T9** Run `pnpm --filter api typecheck` (tsc `--noEmit`) → green. Run `pnpm --filter api test` →
  green, ALL suites (not just the new ones) — proves PR1 is additive: nothing in production yet
  constructs/consumes `InfrastructureError`, so zero pre-existing behavior changed. Run
  `pnpm --filter api lint` → green. `rg InfrastructureError api/src/application` outside
  `errors/infrastructure-error*.ts` and the two wiring files → MUST be empty (confirms no pilot touched
  yet).
  Traces: IEM-R8 (base+subclasses+both wiring covered), IEM-R9 (no extra sites touched in PR1).

### 1.6 PR1 commit plan (conventional, no Co-Authored-By)

- [x] `test(errors): add InfrastructureError base class spec` (T1)
- [x] `feat(errors): add InfrastructureError abstract base class` (T2)
- [x] `test(errors): add TenantClientUnavailableError and TemplateNotFoundError specs` (T3)
- [x] `feat(errors): add TenantClientUnavailableError and TemplateNotFoundError` (T4)
- [x] `test(filter): cover InfrastructureError branch in AppExceptionFilter` (T5)
- [x] `feat(filter): map InfrastructureError to HTTP 500 with code` (T6)
- [x] `test(http): cover InfrastructureError passthrough in unwrapResultOrThrow` (T7)
- [x] `feat(http): preserve InfrastructureError identity in unwrapResultOrThrow` (T8)

(Squash into fewer commits at merge time is fine; keep test+impl paired per work unit at minimum.)

---

## PR2 — the 3 pilots (~110-150 lines)

**PR2 sub-split decision**: kept as ONE PR, not split into 2a (sites 1+3)/2b (site 2), per design §8
recommendation — site 2's blast radius is contained (exactly one confirmed caller,
`course-cycle.use-cases.ts:421`) and total PR2 size (~110-150 lines) is comfortably reviewable as a
single unit. Split only if a reviewer explicitly requests site 2 isolated during review.

### 2.1 Pilot 1 — update-grupo (low risk, mechanical)

- [ ] **T10** `[P]` RED (depends on PR1 merged/available): rewrite the MGCM-R6 case in
  `update-grupo.use-case.test.ts` (lines ~222-239) — replace
  `.rejects.toThrow('No tenant client available')` with
  `expect(result.isErr()).toBe(true); expect(result.unwrapErr()).toBeInstanceOf(TenantClientUnavailableError)`.
  Add a comment noting this lifts the previously documented "must stay a throw" deferral (this change is
  the authorized follow-up, not a regression). Confirm RED (production code still throws).
  Traces: IEM-R5, IEM-R8 (pilot 1 test coverage), MGCM-R6 (rewritten, documented).
- [ ] **T11** GREEN: edit `api/src/application/materia-grupo-ciclo/update-grupo.use-case.ts` — add
  `import { TenantClientUnavailableError } from '../shared/errors/infrastructure-errors';`; widen return
  signature to `Promise<Result<GrupoXCursoXMateriaXCiclo, NotFoundError | ValidationError |
  TenantClientUnavailableError>>`; replace `if (!client) throw new Error('No tenant client available');`
  with `if (!client) return err(new TenantClientUnavailableError());`. Controller
  (`materia-grupo-ciclo.controller.ts`) UNTOUCHED — verify no edit needed. Run test → green.
  Traces: IEM-R5.

### 2.2 Pilot 2 — competency + course-cycle (medium risk — review focus)

> This is the load-bearing slice of PR2: the fire-and-forget caller is the only production consumer of
> the resolved `Result`. If the `.then(isErr)` branch is dropped, tenant-client failures during
> course-cycle generation go silent (see design "Risks").

- [ ] **T12** `[P]` RED (depends on PR1): write new guard test in `competency.use-cases.test.ts` —
  `TenantContext.getClient()` mocked to return `null` → `execute(...)` resolves (does NOT throw/reject),
  `result.isErr() === true`, `result.unwrapErr() instanceof TenantClientUnavailableError`; plus a happy
  path asserting `execute(...)` resolves `ok(undefined)` when the client is present and the flow
  completes normally. Confirm RED.
  Traces: IEM-R6 (guard scenario), IEM-R8.
- [ ] **T13** GREEN (2a — signature + top guard, depends on T12): edit
  `api/src/application/pedagogy/use-cases/competency.use-cases.ts` on
  `AutoCreateCompetenciasXMateriaXAlumnoXCursoXCicloUC.execute` per design §5a exact code — import
  `TenantClientUnavailableError`; change signature to
  `Promise<Result<void, TenantClientUnavailableError>>`; inline
  `const client = TenantContext.getClient(); if (!client) return err(new TenantClientUnavailableError());`
  as the first statement.
  Traces: IEM-R6.
- [ ] **T14** GREEN (2b — inline getter usages + delete + exit paths, depends on T13, same file): per
  design §5b —
  - replace the 2 usages of `this.client` (line ~224 `this.client.courseCycle.findUnique(...)` and line
    ~242 `findEnrolledStudentsByCourseCycle(this.client, ...)`) with the local `client` from T13
  - DELETE the `private get client(): TenantPrismaClient { ... throw new Error('TenantContext: no
    client available'); ... }` getter entirely
  - convert ALL early `return;` exit paths inside `execute` to `return ok(undefined);` (design counts 5
    `return;` sites + implicit fall-through end = 6 total sites needing `return ok(undefined);`) — audit
    every branch, none skipped
  - remove the now-unused `TenantPrismaClient` type import if no longer referenced (verify via tsc)
  Traces: IEM-R6, IEM-R9 (no other guard touched in this file beyond this one).
- [ ] **T15** `[P]` RED (depends on PR1; can be written alongside T12): write new caller test in
  `course-cycle.use-cases.test.ts` (existing ACT-5 rejection case at ~line 874 stays untouched) — mock
  `autoCreateUC.execute` to resolve `err(new TenantClientUnavailableError())`, assert `console.error` spy
  is called via the `.then(isErr)` branch with the expected log prefix, and assert
  `GenerateCourseCyclesUseCase` still returns/resolves `ok` for the overall cycle generation (not
  blocked). Confirm RED (current code only has `.catch`, no `.then` isErr inspection).
  Traces: IEM-R6 (caller scenario), IEM-R8.
- [ ] **T16** GREEN (2c — caller rewrite, depends on T14, T15): edit
  `api/src/application/course-cycle/use-cases/course-cycle.use-cases.ts` lines ~421-423 — rewrite the
  `this.autoCreateUC.execute(...).catch(...)` chain to the `.then((r) => { if (r.isErr()) console.error(...) }).catch((e) => console.error(...))`
  form per design §5c exact code. Keep the `.catch` (rejection path, ADR-5). No `await` added (stays
  fire-and-forget). Run both T12/T15 tests → green.
  Traces: IEM-R6 (all 3 scenarios: guard err, caller `.then` logs, `.catch` rejection retained).
- [ ] **T17** Lint check (depends on T16): run `pnpm --filter api lint` targeting the pilot-2 files —
  confirm `@typescript-eslint/no-floating-promises` does not newly trip on the `.then().catch()` chain.
  If it does, prefix the call with `void` per design's flagged fallback. Do NOT add `await` (would change
  fire-and-forget semantics, out of scope).
  Traces: IEM-R6, IEM-R9.

### 2.3 Pilot 3 — attendance-types-pdf (low risk, mechanical)

- [ ] **T18** `[P]` RED (depends on PR1): write new template-guard test in the
  `generate-attendance-types-pdf` suite (co-located or `__tests__/`, per existing convention) — force
  `this.template` to be unresolved (null/sentinel), assert `render`/`execute` resolves (does not throw),
  `result.isErr() === true`, `result.unwrapErr() instanceof TemplateNotFoundError`. Confirm RED.
  Traces: IEM-R7, IEM-R8.
- [ ] **T19** GREEN: edit
  `api/src/application/attendance-type/use-cases/generate-attendance-types-pdf.use-case.ts` per design §6
  exact code — import `TemplateNotFoundError`; widen `render` signature to
  `Promise<Result<Buffer, PdfError | TemplateNotFoundError>>`; replace
  `throw new Error('Template attendance-types.hbs no encontrado');` with
  `return err(new TemplateNotFoundError('attendance-types.hbs'));`; widen `execute` signature to
  `Promise<Result<Buffer, PdfError | AttendanceTypeLevelOutOfScopeError | TemplateNotFoundError>>`.
  Controller (`attendance-type.controller.ts`) UNTOUCHED — verify no edit needed (already uses
  `unwrapResultOrThrow`). Run test → green.
  Traces: IEM-R7.

### 2.4 PR2 verification

- [ ] **T20** (depends on T11, T17, T19) Run `pnpm --filter api typecheck` → green. Run
  `pnpm --filter api test` → green, full suite (all pilot tests + all pre-existing tests, incl.
  `attendance-type.controller.e2e.test.ts` untouched/green). Run `pnpm --filter api lint` → green
  (confirms T17's `no-floating-promises` check holds repo-wide, not just pilot 2).
  Traces: IEM-R8.
- [ ] **T21** Scope-boundary grep proof (depends on T20):
  - `rg 'BoletinError|ConstanciaError|AsistenciaReportingError' <PR2 diff>` → MUST be empty.
  - Confirm no HTTP status value changed for the 3 pilot endpoints (all remain `500`; only `error.code`
    presence is new) — manual diff review of the 3 controller call sites (all UNTOUCHED per T11/T19 and
    pilot 2 has no HTTP path).
  - `rg 'DOMAIN_STATUS'` diff scope → MUST show no entry added/changed.
  - Confirm the PR2 diff touches ONLY: `update-grupo.use-case.ts`, `update-grupo.use-case.test.ts`,
    `competency.use-cases.ts`, `competency.use-cases.test.ts`, `course-cycle.use-cases.ts`,
    `course-cycle.use-cases.test.ts`, `generate-attendance-types-pdf.use-case.ts`, its test file — no
    other infra guard touched.
  Traces: IEM-R9 (all 3 scenarios).

### 2.5 PR2 commit plan (conventional, no Co-Authored-By)

- [ ] `test(materia-grupo-ciclo): rewrite update-grupo tenant-client guard test to expect err()` (T10)
- [ ] `feat(materia-grupo-ciclo): return err(TenantClientUnavailableError) instead of throwing` (T11)
- [ ] `test(pedagogy): cover competency auto-create tenant-client guard` (T12)
- [ ] `feat(pedagogy): widen auto-create competency signature and return err on missing tenant client` (T13, T14)
- [ ] `test(course-cycle): cover auto-create failure logging via resolved Result` (T15)
- [ ] `feat(course-cycle): log auto-create Result errors alongside existing rejection handling` (T16, T17)
- [ ] `test(attendance-type): cover missing-template guard for attendance-types PDF` (T18)
- [ ] `feat(attendance-type): return err(TemplateNotFoundError) instead of throwing` (T19)

---

## Definition of Done

- [ ] IEM-R1..R9 all satisfied (spec.md scenarios pass).
- [ ] `pnpm --filter api typecheck` green (PR1 and PR2 independently, and combined).
- [ ] `pnpm --filter api test` green (PR1 and PR2 independently, and combined); coverage ≥ 80%.
- [ ] `pnpm --filter api lint` green, incl. `no-floating-promises` on pilot 2's `.then().catch()` chain.
- [ ] PR1 is additive-only: zero production code constructs/consumes `InfrastructureError` in PR1; all
  pre-existing tests unaffected.
- [ ] All 3 pilots return `err(...)` instead of throwing (or return `err` and re-throw only at the
  presentation boundary via existing controller mechanisms — pilot 1's `unwrapErr()` throw, pilot 3's
  `unwrapResultOrThrow`).
- [ ] Reporting error classes (`BoletinError`, `ConstanciaError`, `AsistenciaReportingError`) do not
  appear anywhere in either PR's diff.
- [ ] No HTTP status changed for any of the 3 pilot endpoints (all remain `500`); no `DOMAIN_STATUS`
  entry added or changed.
- [ ] No infra guard modified outside the 4 wiring/base files and the 4 pilot files (`update-grupo`,
  `competency`, `course-cycle`, `generate-attendance-types-pdf`).

---

## Review Workload Forecast

- **PR1**: ~150-180 lines, purely additive, review trivial (new files + dead-but-tested branches).
- **PR2**: ~110-150 lines, site 2 (competency + course-cycle) is the review focus (medium risk); sites 1
  and 3 are mechanical low-risk.
- **Total**: ~260-330 lines — under the 400-line budget.
- **Chained PRs recommended: Yes** — 2 stacked PRs, PR1 (additive/unblocking) → PR2 (behavior change),
  in that order.
- **PR2 sub-split: single PR, NOT split into 2a/2b** — site 2's blast radius is contained to one
  confirmed caller; total size stays comfortably reviewable as one unit.
- **400-line budget risk**: Low.
- **Decision needed before apply**: No.

---

## Task → Requirement traceability (summary)

| Task(s) | Requirement |
|---|---|
| T1, T2 | IEM-R1 |
| T3, T4 | IEM-R2 |
| T5, T6 | IEM-R3 |
| T7, T8 | IEM-R4 |
| T10, T11 | IEM-R5 |
| T12-T17 | IEM-R6 |
| T18, T19 | IEM-R7 |
| T1, T3, T5, T7, T9, T10, T12, T15, T18, T20 | IEM-R8 |
| T9, T21 | IEM-R9 |
