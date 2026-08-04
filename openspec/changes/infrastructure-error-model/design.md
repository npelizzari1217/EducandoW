# Design: infrastructure-error-model

> Architecture for the 3rd error tier `InfrastructureError` + wiring + 3 pilots.
> Verified against real code on `main` (symbols located; line numbers below reflect current file state).
> Store: hybrid. Satisfies IEM-R1..R9 (spec.md). Delivery: 2 stacked PRs.

## Executive Summary

Mirror the proven `ApplicationError`/`PdfError` precedent to add an `abstract InfrastructureError`
(fixed `httpStatus = 500`, required `code`) plus two wiring branches (filter + `unwrapResultOrThrow`),
then migrate the 3 pilot guards that already type-mismatch a bare `throw` against a `Result` signature.
PR1 is purely additive (nothing consumes the class yet → all existing tests stay green); PR2 flips the
3 guards, with the fire-and-forget competency call-site as the single load-bearing edit.

## Architecture Approach

- **Pattern**: layered error model `DomainError → ApplicationError → InfrastructureError → Presentation`.
  This change adds the missing middle-application infra tier. No new architectural pattern is invented —
  it is a structural clone of the `ApplicationError` tier already in the repo.
- **Layering / boundaries** (clean-arch standard, obeyed):
  - `InfrastructureError` base + subclasses live in `api/src/application/shared/errors/` — same folder as
    `application-error.ts` / `pdf.error.ts`. **No new directory** (matches the `ApplicationError` /
    `ForbiddenError` precedent).
  - Application layer RETURNS `err(InfrastructureError)` on the `Result` channel — it does NOT throw for
    expected-at-runtime infra failures (error-handling standard).
  - Presentation is the only layer that throws: either the controller re-throws `unwrapErr()` directly
    (pilot 1) or via `unwrapResultOrThrow` (pilot 3). `AppExceptionFilter` is the single HTTP mapping point.
- **Why a fixed `httpStatus` field (divergence from `ApplicationError`)**: an infra failure is BY
  DEFINITION an unexpected server condition, always `500`. Making it a field (not a constructor param)
  makes "no subclass may override it" a type-level guarantee, not a convention (IEM-R1).

## Component & Data-Flow Map

```
[UseCase guard] --err(InfrastructureError)--> Result channel
      |                                            |
      | pilot 1 (controller: throw unwrapErr())    | pilot 3 (controller: unwrapResultOrThrow)
      v                                            v
 raw InfrastructureError instance          unwrapResultOrThrow re-throws SAME instance
      |                                            |
      +---------------------+----------------------+
                            v
                 AppExceptionFilter.catch()
             (instanceof InfrastructureError branch)
                            v
              response 500 { error: { status:500, code, message } }
```

Pilot 2 has no HTTP path: it is fire-and-forget from `GenerateCourseCyclesUseCase`; its `Result` is
inspected in-process (`.then(isErr → log)`), never reaching the filter.

---

## 1. Base class + subclasses (exact code)

### `api/src/application/shared/errors/infrastructure-error.ts` (NEW)

Confirmed against the real `ApplicationError` (constructor sets `this.name = this.constructor.name`;
`code` is a public readonly ctor-assigned field). Divergence: `httpStatus` is a fixed field, not a param.

```ts
/**
 * InfrastructureError — 3rd tier of the layered error model (ADR: layered errors).
 *
 * Models failures whose cause is the INFRASTRUCTURE ITSELF (a dependency unavailable,
 * an artifact missing) — not a domain invariant (`DomainError`) and not the caller's
 * context (`ApplicationError`). Always an unexpected server condition → HTTP 500.
 *
 * Co-located with `ApplicationError` in `application/shared/errors/` (no new dir).
 * `httpStatus` is a FIXED field (not a ctor param) so no subclass can override it.
 * `code` is REQUIRED (no default): the structural bound of `unwrapResultOrThrow` needs it.
 */
export abstract class InfrastructureError extends Error {
  public readonly httpStatus = 500;

  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}
```

### `api/src/application/shared/errors/infrastructure-errors.ts` (NEW)

Plural filename follows the `authorization-errors.ts` precedent. Each concrete class fixes its own `code`.

```ts
import { InfrastructureError } from './infrastructure-error';

/**
 * TenantClientUnavailableError — the tenant Prisma client is not present on the
 * async TenantContext. Reused by pilot 1 (update-grupo) and pilot 2 (competency);
 * same infra failure, not duplicated per call site.
 */
export class TenantClientUnavailableError extends InfrastructureError {
  constructor(context?: string) {
    super(
      context ? `No tenant client available (${context})` : 'No tenant client available',
      'TENANT_CLIENT_UNAVAILABLE',
    );
  }
}

/**
 * TemplateNotFoundError — an HTML/Handlebars report template could not be resolved.
 * `code` deliberately aligns with the legacy `TEMPLATE_NOT_FOUND` string so the
 * `reporting-errors-reclassification` follow-up can reuse it verbatim.
 */
export class TemplateNotFoundError extends InfrastructureError {
  constructor(templateName: string) {
    super(`Template ${templateName} no encontrado`, 'TEMPLATE_NOT_FOUND');
  }
}
```

Note: pilot 1 uses `new TenantClientUnavailableError()` (no context) → message stays exactly
`'No tenant client available'`, so the existing MGCM-R6 message assertion can be adapted 1:1.
Pilot 3 uses `new TemplateNotFoundError('attendance-types.hbs')` → message
`'Template attendance-types.hbs no encontrado'`, identical to the current bare `throw` string.

**Satisfies**: IEM-R1 (base), IEM-R2 (subclasses). `abstract` + `extends Error` gives the
`instanceof Error === true`, `instanceof ApplicationError/DomainError === false` guarantees for free
(disjoint prototype chains).

---

## 2. Filter branch (exact edit)

`api/src/presentation/shared/filters/exception.filter.ts`. Current branch order (verified):
`HttpException → ApplicationError → DomainError → Error`. Insert the new branch **after
`ApplicationError`**, before `DomainError`/`Error` (any position after `ApplicationError` and before the
generic `Error` fallback satisfies the spec; placing it right after `ApplicationError` groups the two
application-tier branches).

Add import at top (next to the existing `ApplicationError` import, line ~4):

```ts
import { InfrastructureError } from '../../../application/shared/errors/infrastructure-error';
```

Current (lines ~94-104):

```ts
    } else if (exception instanceof ApplicationError) {
      status = exception.httpStatus;
      message = exception.message;
      code = exception.code;
    } else if (exception instanceof DomainError) {
```

After:

```ts
    } else if (exception instanceof ApplicationError) {
      status = exception.httpStatus;
      message = exception.message;
      code = exception.code;
    } else if (exception instanceof InfrastructureError) {
      status = exception.httpStatus; // fixed 500
      message = exception.message;
      code = exception.code;
    } else if (exception instanceof DomainError) {
```

Why mandatory: pilot 1's controller does `throw grupoResult.unwrapErr()` (verified
`materia-grupo-ciclo.controller.ts:443`), bypassing `unwrapResultOrThrow`. Without this branch the raw
instance falls through to the generic `instanceof Error` branch (line ~102) which sets `message` only and
NEVER reads `.code` → the `500` would silently drop `TENANT_CLIENT_UNAVAILABLE`. The existing 5xx-logging
block (`status >= 500`) still fires — logging is preserved.

**Satisfies**: IEM-R3 (all 3 scenarios: 500+code+message, no fall-through, other branches unchanged).

---

## 3. `unwrapResultOrThrow` branch (exact edit)

`api/src/presentation/shared/http/unwrap-result-or-throw.ts`. The generic bound
`E extends { httpStatus: number; code: string; message: string }` ALREADY admits `InfrastructureError`
(it has all three), so no signature change — only a dedicated re-throw branch mirroring `ApplicationError`.

Add import (next to the `ApplicationError` import, line ~29):

```ts
import { InfrastructureError } from '../../../application/shared/errors/infrastructure-error';
```

Current (lines ~34-42):

```ts
  if (result.isErr()) {
    const error = result.unwrapErr();
    if (error instanceof ApplicationError) {
      throw error;
    }
    throw new HttpException(
```

After:

```ts
  if (result.isErr()) {
    const error = result.unwrapErr();
    if (error instanceof ApplicationError) {
      throw error;
    }
    if (error instanceof InfrastructureError) {
      throw error; // preserve instanceof identity so AppExceptionFilter reads code/httpStatus
    }
    throw new HttpException(
```

Why (not just the structural fallback): without it, an `InfrastructureError` reaching the helper (pilot 3)
would be re-wrapped in a generic `HttpException`, losing `instanceof InfrastructureError` before the
filter — the filter's new branch would be half-dead and the same error would take two shapes depending on
which controller materializes it. Cost: 3 lines, buys cross-call-site consistency.

**Satisfies**: IEM-R4 (identity-preserving re-throw).

---

## 4. Pilot 1 — update-grupo (exact before/after)

`api/src/application/materia-grupo-ciclo/update-grupo.use-case.ts`.

Add to the domain import (line 3, `err`/`ok`/`Result` already imported) and add the subclass import:

```ts
import { TenantClientUnavailableError } from '../shared/errors/infrastructure-errors';
```

Signature widen (line ~30):

```ts
// before
): Promise<Result<GrupoXCursoXMateriaXCiclo, NotFoundError | ValidationError>> {
// after
): Promise<Result<GrupoXCursoXMateriaXCiclo, NotFoundError | ValidationError | TenantClientUnavailableError>> {
```

Guard (lines ~43-44):

```ts
// before
      const client = TenantContext.getClient();
      if (!client) throw new Error('No tenant client available');
// after
      const client = TenantContext.getClient();
      if (!client) return err(new TenantClientUnavailableError());
```

**Controller UNTOUCHED**: `materia-grupo-ciclo.controller.ts:442-443` already does
`if (grupoResult.isErr()) throw grupoResult.unwrapErr();` — the widened union is assignable, and the new
filter branch (§2) maps the thrown instance. HTTP status stays `500`, now carries `code`.

**Satisfies**: IEM-R5.

---

## 5. Pilot 2 — competency (the hard one; exact before/after)

`api/src/application/pedagogy/use-cases/competency.use-cases.ts` +
`api/src/application/course-cycle/use-cases/course-cycle.use-cases.ts`.

**Caller uniqueness CONFIRMED**: `rg autoCreateUC` → the ONLY real `.execute` call site is
`course-cycle.use-cases.ts:421`. `cascade-student-materias-competencias.use-case.ts` mentions
`AutoCreate...UC` only in JSDoc comments (no call). Test refs are in
`course-cycle.use-cases.test.ts`. So exactly one production caller to update.

### 5a. `execute` signature + guard (`competency.use-cases.ts`)

Add imports: `TenantClientUnavailableError` (from `../../shared/errors/infrastructure-errors`); `ok`, `err`,
`Result` are already imported (line 2).

Signature (line ~221) — change `Promise<void>` and inline the getter's guard as the first statement:

```ts
// before
  async execute({ courseCycleId }: { courseCycleId: string }): Promise<void> {
    // 1. Resolve CourseCycle row directly via TenantContext ...
    const cc = await this.client.courseCycle.findUnique({
// after
  async execute({ courseCycleId }: { courseCycleId: string }): Promise<Result<void, TenantClientUnavailableError>> {
    const client = TenantContext.getClient();
    if (!client) return err(new TenantClientUnavailableError());

    // 1. Resolve CourseCycle row directly via TenantContext ...
    const cc = await client.courseCycle.findUnique({
```

### 5b. Inline the `private get client()` getter at its 2 usages

The getter (lines ~256-260) is used at line 224 (`this.client.courseCycle.findUnique`) and line 242
(`findEnrolledStudentsByCourseCycle(this.client, ...)`). After 5a introduces a local `const client`, both
usages become `client`:

- Line ~224: `const cc = await client.courseCycle.findUnique({ ... })` (done in 5a).
- Line ~242: `const enrolled = await findEnrolledStudentsByCourseCycle(client, courseCycleId);`

Then **DELETE** the getter entirely (lines ~256-260):

```ts
// REMOVE:
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no client available');
    return c;
  }
```

All the early `return;` statements inside `execute` (`if (!cc) return;`, `if (spsIds.length === 0) return;`,
etc.) MUST become `return ok(undefined);`, and the final `await this.valuationRepo.bulkCreate(...)` MUST be
followed by `return ok(undefined);`. This is mechanical but MUST cover every exit path (5 `return;` +
implicit fall-through end = 6 sites → all `return ok(undefined);`).

Import cleanup: `TenantPrismaClient` type import (line 20) is only used by the deleted getter → remove it if
no longer referenced (tsc will flag it under the project's noUnusedLocals if enabled; verify).

### 5c. Fire-and-forget caller rewrite (`course-cycle.use-cases.ts`)

Current (lines 421-423, verified verbatim):

```ts
        this.autoCreateUC.execute({ courseCycleId: courseCycleUuid }).catch((e) => {
          console.error('[GenerateCourseCycles] AutoCreate failed (non-blocking):', e);
        });
```

After:

```ts
        this.autoCreateUC
          .execute({ courseCycleId: courseCycleUuid })
          .then((r) => {
            if (r.isErr()) {
              console.error(
                '[GenerateCourseCycles] AutoCreate failed (non-blocking):',
                r.unwrapErr(),
              );
            }
          })
          .catch((e) => {
            console.error('[GenerateCourseCycles] AutoCreate rejected (non-blocking):', e);
          });
```

Rationale: the guard no longer throws → a `TenantClientUnavailableError` now surfaces as a RESOLVED
`err(...)`, not a rejection. The `.then(isErr → log)` restores the "log on failure" behavior that the
`.catch` alone used to provide for that path. The `.catch` is KEPT because the repos/Prisma calls inside
`execute` can still reject (real rejection path, spec scenario "Rejection path still logged via .catch").
Neither blocks course-cycle generation (still fire-and-forget, no `await`).

**Lint consideration (`no-floating-promises`)**: the current code already floats this promise; the rewrite
keeps it floating (still no `await`). If `@typescript-eslint/no-floating-promises` is active it would have
already flagged the current `.catch` chain (a `.catch` returns a promise), so behavior is unchanged — but
apply MUST run `pnpm --filter api lint` to confirm the `.then().catch()` chain does not newly trip it. If it
does, prefix with `void`. Flagged for tasks/apply, not resolved here.

**Satisfies**: IEM-R6 (guard returns err; caller logs via `.then` isErr; `.catch` retained for rejections).

---

## 6. Pilot 3 — attendance-types-pdf (exact before/after)

`api/src/application/attendance-type/use-cases/generate-attendance-types-pdf.use-case.ts`.

Add subclass import (`err` already imported, line 27):

```ts
import { TemplateNotFoundError } from '../../shared/errors/infrastructure-errors';
```

`render` guard (lines 113-116):

```ts
// before
  private async render(types: AttendanceType[]): Promise<Result<Buffer, PdfError>> {
    if (!this.template) {
      throw new Error('Template attendance-types.hbs no encontrado');
    }
// after
  private async render(types: AttendanceType[]): Promise<Result<Buffer, PdfError | TemplateNotFoundError>> {
    if (!this.template) {
      return err(new TemplateNotFoundError('attendance-types.hbs'));
    }
```

`execute` signature widen (line ~88-90) — it returns `this.render(types)`, so its union must include the
new member:

```ts
// before
  ): Promise<Result<Buffer, PdfError | AttendanceTypeLevelOutOfScopeError>> {
// after
  ): Promise<Result<Buffer, PdfError | AttendanceTypeLevelOutOfScopeError | TemplateNotFoundError>> {
```

**Controller UNTOUCHED**: `attendance-type.controller.ts:103` does `unwrapResultOrThrow(result)` — the
widened union satisfies the helper's structural bound, and §3's branch re-throws the instance. Status stays
`500` (was already 500 via the type-mismatched throw → generic filter branch), now carries `code`.

**Satisfies**: IEM-R7. This also removes a genuine bug: the old `throw` inside a `Result`-declared method
violated the no-throw rule and dropped the code.

---

## 7. Test strategy (strict TDD, `pnpm --filter api test`)

Every artifact RED→GREEN (test authored first, fails, then impl makes it pass). Runner: Vitest.
**Docker IS available** (integration `*.db.test.ts` runnable), but ALL of these pilots are unit-level —
guards over mocked `TenantContext`/template/repos. No new `*.db.test.ts` needed; do NOT add DB integration
tests for this change (would be scope creep). Existing e2e (`attendance-type.controller.e2e.test.ts`) stays
green untouched.

| Artifact | Test file | RED→GREEN assertions |
|---|---|---|
| Base class | `infrastructure-error.test.ts` (NEW, via a local concrete stub) | `instanceof Error` true; NOT `instanceof ApplicationError`/`DomainError`; `httpStatus === 500`; ctor sets `name`/`message`/`code` (IEM-R1 S1-S4) |
| Subclasses | `infrastructure-errors.test.ts` (NEW) | `new TenantClientUnavailableError()` → code `TENANT_CLIENT_UNAVAILABLE`, status 500, msg `No tenant client available`; `new TemplateNotFoundError('attendance-types.hbs')` → code `TEMPLATE_NOT_FOUND`, status 500, msg references template (IEM-R2 S1-S2) |
| Filter branch | `exception.filter.spec.ts` (extend; mirror the `AEM-R2: ApplicationError branch` block at line ~233) | new `IEM-R3` describe: InfrastructureError instance → body `error.status=500`, `error.code='TENANT_CLIENT_UNAVAILABLE'`, message; assert `code` present (no fall-through) |
| Helper branch | `unwrap-result-or-throw.test.ts` (extend; mirror the ATRM-R4 case at line ~44) | `err(InfrastructureError)` → throws SAME instance, `instanceof InfrastructureError`, NOT `instanceof HttpException` |
| Pilot 1 | `update-grupo.use-case.test.ts` — **REWRITE** MGCM-R6 (lines 222-239) | replace `.rejects.toThrow('No tenant client available')` with `expect(result.isErr()).toBe(true)` + `expect(result.unwrapErr()).toBeInstanceOf(TenantClientUnavailableError)`; note: this reverts the documented "must stay a throw" deferral — this change is the follow-up that lifts it (documented, not a regression) |
| Pilot 2 guard | `competency.use-cases.test.ts` (NEW test) | `TenantContext.getClient()` → null → `execute` resolves `isErr()` true, `unwrapErr() instanceof TenantClientUnavailableError`, does NOT throw; plus a happy path returning `ok(undefined)` |
| Pilot 2 caller | `course-cycle.use-cases.test.ts` (NEW test; existing ACT-5 rejection case at line ~874 stays) | auto-create resolves `err(TenantClientUnavailableError)` → `console.error` spy called via `.then` branch, `GenerateCourseCycles` still returns ok (not blocked) |
| Pilot 3 | new test in `generate-attendance-types-pdf` suite (or `__tests__/`) | template unresolved (mock `this.template = null` via constructing with a non-existent sentinel, or inject) → `execute`/`render` resolves `isErr()`, `unwrapErr() instanceof TemplateNotFoundError`, no throw |

Coverage gate ≥ 80% (project standard) — new classes are trivial and fully covered by the above.

**Satisfies**: IEM-R8 (base+subclasses+both wiring+each pilot, RED→GREEN).

---

## 8. PR split

### PR1 — base + wiring (purely additive)

Files: `infrastructure-error.ts`, `infrastructure-errors.ts`, `exception.filter.ts` (branch),
`unwrap-result-or-throw.ts` (branch) + their tests
(`infrastructure-error.test.ts`, `infrastructure-errors.test.ts`, `exception.filter.spec.ts` +case,
`unwrap-result-or-throw.test.ts` +case).

**PR1 is verifiably additive**: NOTHING in production returns an `InfrastructureError` yet (the 3 guards
still throw). The two new branches are dead-but-covered by their own unit tests (which construct instances
directly). Therefore `tsc` compiles and ALL pre-existing tests stay green with zero behavior change. PR1
alone unblocks the `reporting-errors-reclassification` follow-up.

### PR2 — the 3 pilots

Files: `update-grupo.use-case.ts`, `competency.use-cases.ts`, `course-cycle.use-cases.ts`,
`generate-attendance-types-pdf.use-case.ts` + their test edits/additions.

**Sub-split recommendation (decision deferred to `sdd-tasks`)**: PR2 could split into
- **2a** = sites 1 + 3 (pure mechanical `throw → return err` + widen, low risk), and
- **2b** = site 2 (the 2-file fire-and-forget mini-migration, medium risk).

Recommendation: keep PR2 as ONE PR — site 2's blast radius is contained (1 caller, confirmed) and ~110-150
total lines is comfortably reviewable. Split to 2a/2b only if the reviewer wants site 2 isolated. Final call
in tasks.

---

## 9. Verification checklist (per IEM-R1..R9)

- **IEM-R1/R2** (base/subclasses): `pnpm --filter api test` green for `infrastructure-error*.test.ts`;
  assert fixed `httpStatus=500`, disjoint `instanceof`, fixed codes.
- **IEM-R3** (filter): filter spec green; new branch after `ApplicationError`, before generic `Error`.
- **IEM-R4** (helper): helper test green; identity preserved.
- **IEM-R5/R6/R7** (pilots): each pilot test green; guards return `err(...)`; pilot-2 caller `.then` logs.
- **IEM-R8** (coverage): all new/edited tests RED→GREEN; coverage ≥ 80%.
- **IEM-R9** (scope boundary — grep-provable):
  - `rg 'BoletinError|ConstanciaError|AsistenciaReportingError' <diff>` → MUST be empty (reporting untouched).
  - HTTP status unchanged: all 3 pilot endpoints were `500` before (pilots 1 & 3 via 500-mapped throw/
    type-mismatch, all infra) and remain `500` — only `error.code` presence is new. No entry added/changed
    in `DOMAIN_STATUS`.
  - No infra guard outside the 4 wiring/pilot files + the 3 pilot use-case files is modified.
- **Global gates**: `pnpm --filter api typecheck` (tsc `--noEmit`) green; `pnpm --filter api test` green;
  `pnpm --filter api lint` green (esp. `no-floating-promises` on the pilot-2 `.then().catch()` chain).

---

## ADR-style decisions

### ADR-1: `httpStatus` as a fixed field, not a constructor parameter
- **Decision**: `public readonly httpStatus = 500;` (field), diverging from `ApplicationError`'s
  `httpStatus: number = 422` (param).
- **Rationale**: infra failure ⇒ always an unexpected server condition ⇒ always 500. A field makes
  "unoverridable" a compile-time property.
- **Rejected**: ctor param with 500 default (mirrors ApplicationError but lets a subclass pass a different
  status, contradicting IEM-R1 S2).

### ADR-2: Dedicated `unwrapResultOrThrow` branch vs relying on the structural fallback
- **Decision**: add an explicit `if (error instanceof InfrastructureError) throw error;`.
- **Rationale**: preserves `instanceof` identity for helper-based controllers (pilot 3), keeps the error's
  shape consistent regardless of which controller materializes it, keeps the filter branch live.
- **Rejected**: rely on the generic bound (`{httpStatus,code,message}`) that already admits the class —
  works for status/code but wraps in `HttpException`, losing identity and dual-shaping the error.

### ADR-3: Concrete subclasses vs `new InfrastructureError(...)` directly
- **Decision**: `TenantClientUnavailableError` / `TemplateNotFoundError` concrete classes (base stays
  `abstract`).
- **Rationale**: `TenantClientUnavailableError` reused across sites 1 & 2 (no duplicated magic string);
  matches every repo precedent; `TEMPLATE_NOT_FOUND` code forward-compatible with the reporting follow-up.
- **Rejected**: instantiate the base directly (loses the shared code, breaks the established pattern).

### ADR-4: Inline the `private get client()` getter in pilot 2
- **Decision**: replace the throwing getter with a single `const client = TenantContext.getClient();
  if (!client) return err(...)` at the top of `execute`, delete the getter.
- **Rationale**: the getter's `throw` is exactly the infra guard being converted; a Result-returning method
  cannot delegate its guard to a throwing getter. Two usages → one local.
- **Rejected**: keep the getter and try/catch around it (reintroduces throw-based control flow the whole
  change is removing).

### ADR-5: Keep `.catch` alongside the new `.then(isErr)` in the pilot-2 caller
- **Decision**: `.then(r => isErr → log).catch(e => log)` — both retained.
- **Rationale**: guard failures now resolve as `err`; but repo/Prisma calls inside `execute` can still
  reject. Dropping `.catch` would re-introduce unhandled rejections (spec R6 rejection scenario).
- **Rejected**: replace `.catch` with only `.then` (loses real-rejection logging).

---

## Risks / assumptions requiring validation

- **Pilot 2 fire-and-forget** is the load-bearing edit: if the `.then(isErr)` is omitted, tenant-client
  failures during course-cycle generation go silent. Mitigation: same-commit caller update + `.then` branch
  test (IEM-R6). One caller confirmed via grep.
- **MGCM-R6 test rewrite** reverts a previously documented "must stay a throw" deferral. This change is the
  authorized follow-up lifting it — documented, NOT a regression.
- **`no-floating-promises` lint**: assumption that the rewritten `.then().catch()` chain does not newly trip
  the rule (the current code already floats). MUST be validated by `pnpm --filter api lint` in apply; `void`
  prefix is the fallback.
- **`TenantPrismaClient` unused import** in pilot 2 after getter deletion — remove to avoid tsc/lint noise.
- **Naming convergence** `TENANT_CLIENT_UNAVAILABLE` vs the reporting legacy `INTERNAL_ERROR` — explicitly
  NOT this change's decision; flagged to the reporting follow-up.

## Review Workload Forecast

- **PR1** ~150-180 lines (additive, review trivial). **PR2** ~110-150 lines (site 2 is the focus).
- **Total** ~260-330 lines — under the 400-line budget.
- **Chained PRs recommended: Yes** (2 stacked: PR1 additive/unblocking, PR2 behavior). 400-line budget risk:
  Low. Decision needed before apply: only the PR2 2a/2b sub-split (deferred to tasks; recommendation = single
  PR2).
