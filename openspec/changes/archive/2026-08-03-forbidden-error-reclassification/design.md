# Design — forbidden-error-reclassification

> Concrete implementation design (the HOW at architectural + code level).
> Épico **application-error-handling**, CONSUMER slice: reclassify `ForbiddenError`
> `DomainError → ApplicationError`. **No behavior change: HTTP 403 before and after.**
> Delivery settled by proposal: **Option A — one atomic, compilation-gated PR.**
> Mirrors the archived precedent `attendance-type-result-migration` (same DomainError→ApplicationError move).

## 0. Architecture approach (decision-first)

- **Pattern**: consume the existing canonical capability (`ApplicationError` hierarchy). **Zero new base classes** (YAGNI — reuse `application-error.ts`). This is a reclassification, not a new capability.
- **Layering (Clean Arch, forced move)**: `ForbiddenError` models an **authorization / caller-context** failure (AuthZ), which is an application-layer concern, not a domain invariant. Once it `extends ApplicationError` — which lives in `api/src/application/shared/errors/` — the class physically CANNOT remain in `packages/domain`, because `domain` must import nothing outside itself and `application` depends inward on `domain` (never the reverse). The move is architecturally forced, not stylistic.
- **Boundaries** (unchanged by this change — only the parent class moves):
  - `application/` returns `ForbiddenError` in a `Result` error channel (Result-migrated modules) OR still `throw`s it literally (`asistencia-reporting`, `asignacion-curso` — NOT converted here, per FER-R6).
  - `presentation/` re-throws via `if (result.isErr()) throw result.unwrapErr()`, or handlers special-case it via `instanceof ForbiddenError`.
  - `AppExceptionFilter` maps the `ApplicationError` branch to `exception.httpStatus` (403).
- **Verified facts** (read from source, not assumed):
  - `application-error.ts` ctor is `constructor(message: string, public readonly code: string, public readonly httpStatus: number = 422)`; it sets `this.name = this.constructor.name`. It is `abstract`. → subclassing with a fixed `403` third arg is exactly the pilot pattern.
  - Sibling classes in `authorization-errors.ts` (`InsufficientRoleHierarchyError`, `CrossInstitutionForbiddenError`) both `extends ApplicationError` with `super(message, '<CODE>', 403)`. Our class differs: it keeps `message = 'Forbidden'` **default** (generic, high-traffic, reusable) — that is why it gets its **own file**, not a slot inside `authorization-errors.ts` (FER-R2).
  - Current domain class (`packages/domain/src/shared/errors/forbidden-error.ts`): `extends DomainError`, `constructor(message = 'Forbidden') { super(message, 'FORBIDDEN'); }`. `DomainError` ctor is `(message, public readonly code)` — **no `httpStatus`**; the 403 today comes from `DOMAIN_STATUS['FORBIDDEN']` lookup in the filter.
  - Filter branch order confirmed: `HttpException` (L76) → `ApplicationError` (L91) → `DomainError` (L95) → `Error` (L99). **ApplicationError is evaluated BEFORE DomainError.** So once the class carries `httpStatus = 403`, the `DOMAIN_STATUS` entry is dead (FER-R7).
  - `packages/domain/src/shared/errors/` has **no barrel**; the only export is `packages/domain/src/index.ts:7`.
  - `api/src/application/shared/errors/` has **no barrel** either — consumers import by direct file path. We follow that convention (no barrel to create — FER-R2).
  - `resolveAccessScope` / `TerciarioAuthorizerPort` stay in `domain` / stay as ports; the error class pulls nothing from domain → **no `domain → api` edge introduced**.
  - Grep confirms **0 references under `web/`** and **0 throw-sites inside `packages/domain`** → the clean-arch move is safe.

---

## 1. The class move + reclassification (FER-R1, FER-R2)

### 1.1 NEW file — `api/src/application/shared/errors/forbidden-error.ts`

```ts
import { ApplicationError } from './application-error';

export class ForbiddenError extends ApplicationError {
  constructor(message = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
  }
}
```

Changes vs the old domain class: base `DomainError → ApplicationError`; import path `./domain-error → ./application-error`; the **third `super` arg `403`** (the only new token). The `message = 'Forbidden'` default and the `'FORBIDDEN'` code are preserved verbatim, so every one of the ~47 call sites (`new ForbiddenError()` / `new ForbiddenError('...')`) compiles unchanged.

### 1.2 DELETE — `packages/domain/src/shared/errors/forbidden-error.ts`

Remove the file entirely.

### 1.3 Remove the domain barrel export

`packages/domain/src/index.ts:7` — delete exactly:

```ts
export { ForbiddenError } from './shared/errors/forbidden-error';
```

After this, no path under `packages/domain` defines or re-exports `ForbiddenError` (FER-R1 scenario 2).

### 1.4 Barrel confirmation (api side)

No `index.ts` barrel in `api/src/application/shared/errors/`. **No export line to add** — consumers import by direct path, matching the `authorization-errors.ts` / precedent convention. Keeps the diff minimal (YAGNI).

---

## 2. The split-import pattern (FER-R2, FER-R4)

Every `api` consumer currently bundles `ForbiddenError` inside the `@educandow/domain` import block. The mechanical transform is identical everywhere: **drop the symbol from the domain block, add a local named import** pointing at the new file with the correct relative depth.

### 2.1 Concrete before/after (real file: `docente-materia.use-cases.ts`)

```ts
// before
import {
  ok,
  err,
  Result,
  ForbiddenError,            // ← remove from this block
  NotFoundError,
  DocenteXMateriaCarrera,
  DocenteAlreadyAssignedError,
  AssignmentAlreadyInactiveError,
  DomainError,
  resolveAccessScope,
} from '@educandow/domain';
import type { DocenteXMateriaCarreraRepository } from '@educandow/domain';

// after
import {
  ok,
  err,
  Result,
  NotFoundError,
  DocenteXMateriaCarrera,
  DocenteAlreadyAssignedError,
  AssignmentAlreadyInactiveError,
  DomainError,
  resolveAccessScope,
} from '@educandow/domain';
import type { DocenteXMateriaCarreraRepository } from '@educandow/domain';
import { ForbiddenError } from '../../shared/errors/forbidden-error';
```

### 2.2 Relative-path table (depth per consumer directory)

| Consumer directory | Relative import to add |
|---|---|
| `api/src/application/asistencia/*` | `../shared/errors/forbidden-error` |
| `api/src/application/asistencia-reporting/*` | `../shared/errors/forbidden-error` |
| `api/src/application/asignacion-curso/*` | `../shared/errors/forbidden-error` |
| `api/src/application/grading/*` | `../shared/errors/forbidden-error` |
| `api/src/application/institution/use-cases/*` | `../../shared/errors/forbidden-error` |
| `api/src/application/nivel-terciario/use-cases/*` | `../../shared/errors/forbidden-error` |
| `api/src/application/student-observation/*` | `../shared/errors/forbidden-error` |
| `api/src/application/student/use-cases/*` | `../../shared/errors/forbidden-error` |
| `api/src/presentation/asistencia-reporting/*.controller.ts` | `../../application/shared/errors/forbidden-error` |
| `api/src/presentation/student/*.controller.ts` | `../../application/shared/errors/forbidden-error` |

The 17 production files (8 modules) enumerated in `explore.md §Exact Scope` all follow this exact transform. **`instanceof ForbiddenError` checks are UNAFFECTED** (`student.controller.ts` `throwGuardianError()`, `asistencia-reporting.controller.ts` `handleError()`): the runtime constructor identity is preserved by the import; only the module path and the parent class change (FER-R4).

---

## 3. The 7 widened signatures (FER-R5) — exact current → widened

These 7 methods type their `Result` error channel as the bare generic `DomainError`. Once `ForbiddenError` stops extending `DomainError`, `return err(new ForbiddenError(...))` no longer satisfies the declared type → `tsc --noEmit` errors. Fix = explicit union `DomainError | ForbiddenError`. **No `any`, no `as` cast** (FER-R5 scenario 2).

### 3.1 `api/src/application/nivel-terciario/use-cases/nota-cursada-terciario.use-cases.ts`

| Method | Line | Current return type | Widened return type |
|---|---|---|---|
| `CreateNotaCursadaSlotUC.execute` | 57 | `Promise<Result<NotaCursadaTerciario, DomainError>>` | `Promise<Result<NotaCursadaTerciario, DomainError \| ForbiddenError>>` |
| `UpdateNotaCursadaSlotUC.execute` | 95 | `Promise<Result<NotaCursadaTerciario, DomainError>>` | `Promise<Result<NotaCursadaTerciario, DomainError \| ForbiddenError>>` |
| `ConfirmarNotaCursadaUC.execute` | 134 | `Promise<Result<void, DomainError>>` | `Promise<Result<void, DomainError \| ForbiddenError>>` |

Each returns `err(new ForbiddenError('No estás asignado a esta materia'))` on the authz gate, plus `NotFoundError` / `CondicionCursadaInvalidaError` (DomainError subclasses) — the union covers both.

### 3.2 `api/src/application/nivel-terciario/use-cases/docente-materia.use-cases.ts`

| Method | Line | Current return type | Widened return type |
|---|---|---|---|
| `AssignDocenteMateriaUC.execute` | 37 | `Promise<Result<DocenteXMateriaCarrera, DomainError>>` | `Promise<Result<DocenteXMateriaCarrera, DomainError \| ForbiddenError>>` |
| `ListAssignmentsUC.execute` | 77 | `Promise<Result<DocenteXMateriaCarrera[], DomainError>>` | `Promise<Result<DocenteXMateriaCarrera[], DomainError \| ForbiddenError>>` |
| `UnassignDocenteMateriaUC.execute` | 103 | `Promise<Result<DocenteXMateriaCarrera, DomainError>>` | `Promise<Result<DocenteXMateriaCarrera, DomainError \| ForbiddenError>>` |

> Note: this file's L4 header comment says `Return Result<T, DomainError>`. Optional micro-touch — not required for compile; leave or reword to `DomainError | ForbiddenError` for accuracy. Low priority, keep churn minimal.

### 3.3 `api/src/application/student/use-cases/student.use-cases.ts`

| Method | Line | Current return type | Widened return type |
|---|---|---|---|
| `PatchStudentUseCase.execute` | 151 | `Promise<Result<Student, DomainError>>` | `Promise<Result<Student, DomainError \| ForbiddenError>>` |

`PatchStudentUseCase.execute` forwards the `err` from `checkOwnership` (L162-163), whose signature is `private async checkOwnership(...): Promise<Result<void, ForbiddenError>>` (L199, confirmed). It also returns `NotFoundError` / `ValidationError` (DomainError). Union covers both.

**`checkOwnership` itself (L199) and `validateAllowedFields` (L227) already type their channel as `Result<void, ForbiddenError>`** — `ForbiddenError` imported locally there resolves fine, no widening needed (they never widened to `DomainError`). Only the class-level import swap applies.

### 3.4 Why the other consumers do NOT need widening

- `asistencia/*` (5 files), `grading/*` (2), `institution/*` — already list `ForbiddenError` **explicitly** in their `Result` unions → compile unchanged after the import swap.
- `student-observation/*` (2 files) — type the channel as bare `Error`; `ForbiddenError` (now `ApplicationError extends Error`) still structurally satisfies `Error` → safe.
- `asistencia-reporting/generate-asistencia-mensual-pdf.use-case.ts` — 7 **literal `throw`** (no `Result`), so no signature to widen (FER-R6).
- `asignacion-curso/assign-docente-to-curso.use-case.ts:44` — 1 literal `throw`, returns bare `Promise<T>` (no `Result`) → no widening (FER-R6).

---

## 4. Filter cleanup (FER-R7) — `exception.filter.ts`

Delete exactly line 13 from the `DOMAIN_STATUS` map:

```ts
  FORBIDDEN: 403,
```

**Safety proof (branch ordering):** in `catch()` the `instanceof ApplicationError` branch is L91 (`status = exception.httpStatus`), evaluated **before** the `instanceof DomainError` branch at L95 (`status = DOMAIN_STATUS[exception.code] ?? BAD_REQUEST`). After reclassification, every `ForbiddenError` is `instanceof ApplicationError`, so it resolves to `exception.httpStatus === 403` at L91 and never reaches the `DOMAIN_STATUS` lookup. The entry is unreachable dead code; removing it cannot change the observable 403 for any of the 8 modules (FER-R3, FER-R7). Same cleanup the attendance-type precedent performed. No other code reads the `FORBIDDEN` key (grep-verified).

---

## 5. Ordering / compilation gate (FER-R5, Option A atomicity)

**This is ONE atomic PR.** The class deletion (§1.2/§1.3), all 17 import swaps (§2), and the 7 widenings (§3) MUST land **together** — there is no intermediate `tsc`-green state, and that is by design:

- The moment `packages/domain/src/index.ts:7` export is removed, EVERY `@educandow/domain` import of `ForbiddenError` breaks. If done first, the tree is red until every consumer is patched.
- The moment the class is deleted from domain and re-created in `api`, `tsc` is the gate: a forgotten import swap or a forgotten widening = a hard compile error, **not** a silent runtime bug (this is the primary de-risking property — see proposal Risks).

**Recommended edit order within the single change** (so a mid-edit local `tsc` run is understood, even though only the final state must be green):

1. **Create** the new `api` class (§1.1) — additive, tree still green (old domain class still exists).
2. **Swap imports** in all 17 production consumers (§2) to point at the new `api` path — now consumers use the `api` class; the domain export is still present but unused.
3. **Widen** the 7 signatures (§3) — required because step 2's `ForbiddenError` is no longer a `DomainError`.
4. **Delete** the domain file (§1.2) + remove the barrel export (§1.3). Nothing imports it anymore → clean.
5. **Delete** the `DOMAIN_STATUS['FORBIDDEN']` entry (§4).
6. **Update test imports** + add the classification test (§6).
7. Run the gate: `pnpm --filter api typecheck` (`tsc --noEmit`) + `pnpm test`.

**Why no shim / re-export is needed:** Option A patches all consumers in the same commit, so there is never a window where a consumer imports a deleted symbol. A temporary domain re-export shim (the Option-B tax) would be pure ceremony here — more churn, not less (proposal decision 1).

---

## 6. Test strategy (FER-R8) — strict TDD active, `test_command: pnpm test`

### 6.1 NEW classification test — `api/src/application/shared/errors/__tests__/forbidden-error.test.ts`

Mirrors `authorization-errors.test.ts`. This is the RED→GREEN anchor: written first, it fails to compile/resolve until §1.1 exists, then goes green.

```ts
import { describe, it, expect } from 'vitest';
import { DomainError } from '@educandow/domain';
import { ApplicationError } from '../application-error';
import { ForbiddenError } from '../forbidden-error';

describe('ForbiddenError', () => {
  it('is an ApplicationError, not a DomainError, with fixed code and 403', () => {
    const error = new ForbiddenError();
    expect(error).toBeInstanceOf(ApplicationError);
    expect(error).not.toBeInstanceOf(DomainError);
    expect(error.code).toBe('FORBIDDEN');
    expect(error.httpStatus).toBe(403);
    expect(error.message).toBe('Forbidden');
  });

  it('accepts a custom message and keeps code/status fixed', () => {
    const error = new ForbiddenError('No estás asignado a esta materia');
    expect(error).toBeInstanceOf(ApplicationError);
    expect(error.code).toBe('FORBIDDEN');
    expect(error.httpStatus).toBe(403);
    expect(error.message).toBe('No estás asignado a esta materia');
  });
});
```

This test needs **no DB / Docker** — pure class instantiation. Fast, always runnable.

### 6.2 Existing test files — import-path split ONLY (16 files)

Every test that imports `ForbiddenError` from `@educandow/domain` gets the **same split-import transform** as production (§2), with the relative depth for its location. **Assertions such as `toBeInstanceOf(ForbiddenError)`, `.rejects.toBeInstanceOf(ForbiddenError)`, and `constructor.name === 'ForbiddenError'` are UNAFFECTED** — the runtime class identity is unchanged; only the module it is imported from changes. No assertion rewrites, no Result-shape changes (this change does NOT touch throw/return idiom — FER-R6).

Enumeration method (explore.md counted 16; it did not list all by name): before apply, run

```
rg -l "\bForbiddenError\b" api --glob "**/*.test.ts"
rg -l "\bForbiddenError\b" api/test
```

and split-import each hit. Known members of the set include:
- `api/test/unit/patch-student.use-case.test.ts` — legacy location, **import-path update ONLY, do not move/consolidate** (FER-R9, proposal decision 4).
- the `nivel-terciario`, `student`, `asistencia`, `grading`, `institution`, `student-observation` use-case test suites.
- `asistencia-reporting.controller` and `student.controller` presentation tests (the `instanceof` handlers).

**DB/Docker flag (FER verification constraint):** any of these existing suites that boots Prisma / a DB (e.g. e2e/integration controller tests) needs the project's DB harness to run. That is a pre-existing property of those tests, **not introduced by this change** — this change only edits import lines in them. If the DB harness is unavailable in the apply environment, run at minimum: the new §6.1 classification test + the unit-level use-case suites (mocked repos, no DB) + `tsc --noEmit`, and flag the DB-bound suites as "not executed here, no logic changed" in the apply report. Never report green without having run the suite (honest-reporting rule).

---

## 7. Verification checklist (FER-R1..R9)

1. **Compile gate**: `pnpm --filter api typecheck` (`tsc --noEmit`) exits 0 — proves all 7 widenings + 17 import swaps are complete (FER-R5).
2. **Test gate**: `pnpm test` green. New classification test asserts the full contract (FER-R8). Note DB-bound suites per §6.2.
3. **Zero domain residue** (FER-R1 scenario 2): both greps return empty —
   ```
   rg "\bForbiddenError\b" packages/domain        # → 0 hits (file deleted, export removed)
   ```
4. **Single-source import** (FER-R2): `rg "ForbiddenError.*@educandow/domain"` and `rg "@educandow/domain.*ForbiddenError"` return 0 hits — nothing imports it from domain anymore.
5. **No new base class** (FER-R9): the only class added under `api/src/application/shared/errors/` is `ForbiddenError` (moved).
6. **Throw idiom preserved** (FER-R6): `asistencia-reporting` still has 7 literal `throw new ForbiddenError`; `asignacion-curso` still `throw` + `Promise<T>`. No `throw`→`return err(...)` conversion in the diff.
7. **DOMAIN_STATUS cleaned** (FER-R7): `rg "FORBIDDEN" api/src/presentation/shared/filters/exception.filter.ts` → 0 hits.
8. **HTTP 403 invariant** (FER-R3): guaranteed structurally by §4's branch-order proof + the classification test's `httpStatus === 403`; no runtime status change for any of the 8 modules.

---

## 8. Review Workload Forecast

- **Estimated changed lines**: ~200–350 (1 new class + 1 delete + 1 barrel line + 1 filter line + ~17 production import swaps + 7 widenings + ~16 test import swaps + 1 new test file). Mechanical, low logic density.
- **Chained PRs recommended**: **No** — proposal settled Option A (single atomic PR). Same change class as the single-PR attendance-type precedent; `tsc` gates the whole tree. (Explore floated Option B for reviewability; the user chose A.)
- **400-line budget risk**: **Medium** — estimate is borderline; import-block reflow could push it up. If it exceeds 400 at apply time, honor the cached `delivery_strategy` (proposal chose Option A, so `size:exception` per the maintainer rule rather than splitting).
- **Decision needed before apply**: **No** — delivery, scope, and the 7 widenings are all enumerated against real code.
- **Blast radius**: touches 8 modules but zero behavior change; the 3 widening files (`nota-cursada-terciario`, `docente-materia`, `student`) are the review focus.

---

## ADR-style decisions

- **ADR-1 — Reclassify `ForbiddenError` to `ApplicationError` (settle the deferred debt) over leaving it `DomainError`.**
  Rationale: authorization failure is caller-context, an application concern — the épico's dividing line. It lived in `domain` by historical inertia. Rejected "leave as-is": runtime-identical, but re-commits a documented inconsistency and forces a double reclassification when follow-ups #2/#3 land.
- **ADR-2 — Move the file (forced, not optional).** `extends ApplicationError` + Clean Arch (`domain ⊄ api`) ⇒ the class cannot stay in `packages/domain`. Rejected alternative: duplicate `ApplicationError` into `domain` — forks the hierarchy, violates the single-source non-overlap rule.
- **ADR-3 — Own file `api/src/application/shared/errors/forbidden-error.ts`, not a slot in `authorization-errors.ts`.** Rationale: different constructor shape (default `message = 'Forbidden'`, generic reusable class vs. the per-rule pilot classes that require `message`), and it is the highest-traffic symbol of the épico. Matches the precedent's one-file-per-class convention. Rejected: co-locating in `authorization-errors.ts` mixes a generic error with per-rule ones.
- **ADR-4 — No barrel `index.ts` in `shared/errors/`.** Direct-path imports match the existing convention (pilot + `authorization-errors`). Rejected: creating a barrel now = churn with no consumer benefit (YAGNI).
- **ADR-5 — Option A: one atomic compilation-gated PR, no shim.** Rejected Option B (per-module chained PRs): would require a temporary domain re-export shim because deleting the class breaks all imports at once — more ceremony, not less. Same size class as the single-PR precedent; `tsc` gates the tree. (Proposal decision 1.)
- **ADR-6 — Widen to explicit `DomainError | ForbiddenError`, never `any`/cast.** Rationale: preserves full type safety; the union is the minimal honest type for methods that return both DomainError subclasses and `ForbiddenError`. Rejected: casting or broadening to `Error` — would silently erase type information the compiler currently enforces (FER-R5).
- **ADR-7 — Remove the `DOMAIN_STATUS['FORBIDDEN']` entry (dead-code cleanup).** Branch order (ApplicationError before DomainError) makes it unreachable; leaving it is misleading dead code. Same as the precedent. Rejected: keeping it "just in case" — it can never fire and confuses future readers.
- **ADR-8 — Do NOT convert any `throw` to `Result` in this change.** `asistencia-reporting` (7 throws) and `asignacion-curso` (1 throw, `Promise<T>`) keep their control-flow idiom. Rationale: those are separate Result-migration follow-ups; conflating them here inflates blast radius and violates the stated scope (FER-R6). Rejected: opportunistic Result-wrapping — scope creep.
- **ADR-9 — Legacy test `api/test/unit/patch-student.use-case.test.ts` stays put, import-only edit.** Consolidating/moving it is a separate concern (FER-R9, proposal decision 4). Rejected: relocating it now — unrelated churn in the same PR.

---

**Persistence note (hybrid):** openspec is the committed source of truth for this artifact. Engram backfill
at `topic_key: sdd/forbidden-error-reclassification/design` (type `architecture`, project `educandow`,
`scope: project`, `capture_prompt: false`).
