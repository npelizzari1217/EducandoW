# Design — attendance-type-result-migration

> Concrete implementation design (the HOW at architectural + code level).
> Épico **application-error-handling**, 2º consumidor real de `ApplicationError`.
> Decision settled: **Option B** — reclassify + move `AttendanceTypeLevelOutOfScopeError`
> `DomainError → ApplicationError`, migrate 6 throws to `Result`. **No behavior change: HTTP 403 before and after.**

## 0. Architecture approach (decision-first)

- **Pattern**: consume the existing canonical capability (`ApplicationError` hierarchy). **Zero new base classes** (YAGNI — reuse `application-error.ts`).
- **Layering**: the error class must physically live in `api/src/application/shared/errors/` because it `extends ApplicationError`, which lives in `api`. `packages/domain` cannot depend on `api` (Clean Arch, dependency points inward). The move is **forced**, not stylistic.
- **Boundaries**: `application/` becomes throw-free for scope denials (returns `Result`); `presentation/` (controller) is the single throw boundary via `if (result.isErr()) throw result.unwrapErr()`; `AppExceptionFilter` maps the `ApplicationError` branch to `exception.httpStatus` (403).
- **Verified facts** (read from source, not assumed):
  - `application-error.ts` ctor: `(message, code, httpStatus = 422)`, exposes readonly `code`/`httpStatus`, sets `this.name`.
  - Pilot subclasses in `authorization-errors.ts` take `message: string`. Our class is DIFFERENT: it keeps its existing `level?: number` ctor and builds the message internally — we preserve that shape (task requirement), only swapping the base + adding `403`.
  - **No barrel** `index.ts` exists in `api/src/application/shared/errors/` — pilot classes are imported by direct file path (`../authorization-errors`, `../shared/errors/pdf.error`). We follow the same convention: **no barrel to create/update**.
  - Filter branch order confirmed: `HttpException` → `ApplicationError` (L92) → `DomainError` (L96) → `Error` (L100). ApplicationError is evaluated BEFORE DomainError. ✅
  - `resolveAccessScope` stays in `domain` and is imported by the use-cases (not by the error class) → **no domain→api edge introduced**.
  - Grep for `AttendanceTypeLevelOutOfScopeError` across the repo: **0 hits under `web/`**. Frontend is unaffected.

---

## 1. The class move + reclassification

### 1.1 NEW file — `api/src/application/shared/errors/attendance-type-level-out-of-scope-error.ts`

```ts
import { ApplicationError } from './application-error';

export class AttendanceTypeLevelOutOfScopeError extends ApplicationError {
  constructor(level?: number) {
    super(
      level !== undefined
        ? `AttendanceType level ${level} is out of the caller's access scope`
        : "AttendanceType level is out of the caller's access scope",
      'ATTENDANCE_TYPE_LEVEL_OUT_OF_SCOPE',
      403,
    );
  }
}
```

Changes vs the old domain class: base `DomainError → ApplicationError`, import path `../../shared/errors/domain-error → ./application-error`, and the **third `super` arg `403`** (the only new token). The `level?` ctor arg and both message branches are preserved verbatim.

### 1.2 DELETE — `packages/domain/src/attendance-type/errors/attendance-type-level-out-of-scope-error.ts`

Remove the file entirely.

### 1.3 Barrel confirmation

No `index.ts` barrel in `api/src/application/shared/errors/`. **No export line to add.** Consumers import by direct path (matches the pilot convention). This keeps the diff minimal (no barrel churn — YAGNI).

---

## 2. Every import site (grep `AttendanceTypeLevelOutOfScopeError`) + exact change

Confirmed hits in production/test code (excluding the openspec docs and archived changes):

| # | File | Depth → new relative path | Change |
|---|------|---------------------------|--------|
| A | `packages/domain/src/index.ts:141` | — | **Remove** `export { AttendanceTypeLevelOutOfScopeError } from './attendance-type/errors/...'` |
| B | `packages/domain/src/attendance-type/index.ts:8` | — | **Remove** the `export { AttendanceTypeLevelOutOfScopeError } ...` line |
| C | `packages/domain/src/attendance-type/errors/index.ts:4` | — | **Remove** the `export { AttendanceTypeLevelOutOfScopeError } ...` line |
| D | `api/src/application/attendance-type/use-cases/attendance-type.use-cases.ts` | `../../shared/errors/attendance-type-level-out-of-scope-error` | Drop symbol from the `@educandow/domain` import; add local named import |
| E | `api/src/application/attendance-type/use-cases/generate-attendance-types-pdf.use-case.ts` | `../../shared/errors/attendance-type-level-out-of-scope-error` | Drop symbol from `@educandow/domain` import (L22); add local named import; also add value import `err` (see §4) |
| F | `api/src/application/attendance-type/__tests__/attendance-type.use-cases.test.ts` | `../../shared/errors/attendance-type-level-out-of-scope-error` | Split import: keep domain symbols, move Scope error to local path |
| G | `api/src/application/attendance-type/__tests__/generate-attendance-types-pdf.use-case.test.ts:11` | `../../shared/errors/attendance-type-level-out-of-scope-error` | Split import (keep `ok, err` from domain) |
| H | `api/src/presentation/attendance-type/__tests__/attendance-type.controller.test.ts:7` | `../../../application/shared/errors/attendance-type-level-out-of-scope-error` | Split import (keep `ok, err`, domain errors) |
| I | `api/src/presentation/attendance-type/__tests__/attendance-type.controller.e2e.test.ts:20` | `../../../application/shared/errors/attendance-type-level-out-of-scope-error` | Split import (keep `ok, err`, `AttendanceType`, etc.) |

**Split-import pattern** (all consumers currently bundle the class with other `@educandow/domain` symbols). Example for D:

```ts
// before
import {
  ok, err, Result,
  AttendanceType, AttendanceTypeRepository, AttendanceTypeFilters,
  AttendanceTypeCodeDuplicateError, AttendanceTypeNotFoundError,
  AttendanceTypeLevelOutOfScopeError,   // ← remove this line
  SystemAttendanceTypeError, AttendanceBehavior, AttendanceBehaviorValue,
  resolveAccessScope,
} from '@educandow/domain';

// after
import {
  ok, err, Result,
  AttendanceType, AttendanceTypeRepository, AttendanceTypeFilters,
  AttendanceTypeCodeDuplicateError, AttendanceTypeNotFoundError,
  SystemAttendanceTypeError, AttendanceBehavior, AttendanceBehaviorValue,
  resolveAccessScope,
} from '@educandow/domain';
import { AttendanceTypeLevelOutOfScopeError } from '../../shared/errors/attendance-type-level-out-of-scope-error';
```

**No other package/app imports it.** `web/` = 0 hits. Only `api` (2 use-cases + 4 tests) and the 3 domain export files reference it.

---

## 3. `DOMAIN_STATUS` removal (`exception.filter.ts`)

Delete exactly line 20:

```ts
  ATTENDANCE_TYPE_LEVEL_OUT_OF_SCOPE: 403,
```

Confirmed dead after the move: an instance is now `instanceof ApplicationError`, caught at L92 (`status = exception.httpStatus` = 403) **before** the `DomainError` branch at L96 ever runs. Leaving the entry would be unreachable code for this class. No other code reads this key.

---

## 4. Per-use-case migration

### 4.1 `attendance-type.use-cases.ts`

**Create** (`execute`, throw at L49):
- Signature: `Promise<Result<AttendanceType, AttendanceTypeCodeDuplicateError | AttendanceTypeLevelOutOfScopeError>>`
- Body: `throw new AttendanceTypeLevelOutOfScopeError(input.level);` → `return err(new AttendanceTypeLevelOutOfScopeError(input.level));`

**Update** (throw at L99):
- Signature: `Promise<Result<AttendanceType, AttendanceTypeNotFoundError | SystemAttendanceTypeError | AttendanceTypeLevelOutOfScopeError>>`
- `throw new AttendanceTypeLevelOutOfScopeError(entity.level);` → `return err(new AttendanceTypeLevelOutOfScopeError(entity.level));`

**Delete** (throw at L147):
- Signature: `Promise<Result<void, AttendanceTypeNotFoundError | SystemAttendanceTypeError | AttendanceTypeLevelOutOfScopeError>>`
- `throw ...(entity.level);` → `return err(new AttendanceTypeLevelOutOfScopeError(entity.level));`

**Get** (throw at L206):
- Signature: `Promise<Result<AttendanceType, AttendanceTypeNotFoundError | AttendanceTypeLevelOutOfScopeError>>`
- `throw ...(entity.level);` → `return err(new AttendanceTypeLevelOutOfScopeError(entity.level));`

**List** (bigger change — L169-184):
- Signature: `Promise<AttendanceType[]>` → `Promise<Result<AttendanceType[], AttendanceTypeLevelOutOfScopeError>>`
- Both success returns wrap in `ok(...)`:

```ts
async execute(
  filters: AttendanceTypeFilters | undefined,
  currentUser: AttendanceTypeCurrentUser,
): Promise<Result<AttendanceType[], AttendanceTypeLevelOutOfScopeError>> {
  const scope = resolveAccessScope(currentUser);

  if (scope.allLevels) {
    return ok(await this.repo.list(filters));                                    // was: return this.repo.list(filters);
  }

  if (filters?.level !== undefined && !scope.baseLevels.includes(filters.level)) {
    return err(new AttendanceTypeLevelOutOfScopeError(filters.level));           // was: throw ...
  }

  return ok(await this.repo.list({ ...filters, allowedLevels: scope.baseLevels })); // was: return this.repo.list(...);
}
```

`ok`/`err` are already imported from `@educandow/domain` in this file — no new import beyond the local Scope-error path.

### 4.2 `generate-attendance-types-pdf.use-case.ts`

- Imports: remove `AttendanceTypeLevelOutOfScopeError` from the `@educandow/domain` block (L20-28); add local named import (`../../shared/errors/attendance-type-level-out-of-scope-error`). Add **value** import `err` from `@educandow/domain` (currently only `import type { Result }` is imported — the file has no `err`/`ok` yet).
- `execute` signature: `Promise<Result<Buffer, PdfError>>` → `Promise<Result<Buffer, PdfError | AttendanceTypeLevelOutOfScopeError>>`
- Scope throw at **L100**: `throw new AttendanceTypeLevelOutOfScopeError(level);` → `return err(new AttendanceTypeLevelOutOfScopeError(level));`
- **L112 `throw new Error('Template attendance-types.hbs no encontrado')` stays UNTOUCHED.** Documented out of scope: it is a bare-`Error` infrastructure guard (missing compiled template = deploy/IO fault, not caller-context). It belongs to the future `InfrastructureError` follow-up, not the `ApplicationError` slice. Migrating it now would require introducing a base class the épico hasn't modeled yet → violates YAGNI + the scenario ATRM-R7.S2. It already 500s and will keep 500ing.

---

## 5. Controller `list()` retrofit (only endpoint that changes)

`attendance-type.controller.ts`, `list()` L71-85. **Before:**

```ts
const entities = await this.listUC.execute(Object.keys(filters).length ? filters : undefined, user);
return { data: entities.map(toResponse) };
```

**After:**

```ts
const result = await this.listUC.execute(Object.keys(filters).length ? filters : undefined, user);
if (result.isErr()) throw result.unwrapErr();
return { data: result.unwrap().map(toResponse) };
```

The other 5 endpoints are unchanged: `create` (L67), `getOne` (L115), `update` (L127), `remove` (L136) already use `if (result.isErr()) throw result.unwrapErr()`; `printList` (L102) uses `unwrapResultOrThrow(result)`. Their return-type widening propagates transparently — the idiom already handles any `err(...)` the widened union can carry.

---

## 6. Clean Architecture check (post-move invariants)

- ✅ The class lives in `api/src/application/shared/errors/` — co-located with `ApplicationError` + pilot subclasses.
- ✅ `domain` no longer references it (3 export lines removed; file deleted). No dangling export (ATRM-R2.S1).
- ✅ The error class imports only `./application-error` (same package) — **zero domain imports**, so no api→domain edge is even created by the class itself (api→domain would be legal anyway; there simply isn't one).
- ✅ No `domain → api` dependency introduced anywhere: `resolveAccessScope` stays in domain and is consumed by the use-cases (api→domain, legal). The moved class does not pull anything from domain.
- ✅ `application/` throw-free for scope denials; `presentation/` is the single throw boundary; `AppExceptionFilter.ApplicationError` branch maps 403.

---

## 7. Test plan (TDD, refactor-style — no status RED-first; 403 unchanged)

New/edited test files. Assertions on HTTP status stay 403 throughout; the RED is **structural** (Result-shaped assertions fail against code that still throws), then GREEN after the throw→return migration.

### 7.1 NEW — `api/src/application/shared/errors/__tests__/attendance-type-level-out-of-scope-error.test.ts`

Mirrors `authorization-errors.test.ts` (the pilot classification test). Adds the non-overlap assertion (ATRM-R1.S1):

```ts
import { describe, it, expect } from 'vitest';
import { DomainError } from '@educandow/domain';
import { ApplicationError } from '../application-error';
import { AttendanceTypeLevelOutOfScopeError } from '../attendance-type-level-out-of-scope-error';

describe('AttendanceTypeLevelOutOfScopeError', () => {
  it('is an ApplicationError, not a DomainError, with fixed code and 403', () => {
    const error = new AttendanceTypeLevelOutOfScopeError(3);
    expect(error).toBeInstanceOf(ApplicationError);
    expect(error).not.toBeInstanceOf(DomainError);
    expect(error.code).toBe('ATTENDANCE_TYPE_LEVEL_OUT_OF_SCOPE');
    expect(error.httpStatus).toBe(403);
    expect(error.message).toContain('3');
  });

  it('builds the generic message when no level is passed', () => {
    const error = new AttendanceTypeLevelOutOfScopeError();
    expect(error.httpStatus).toBe(403);
    expect(error.message).toBe("AttendanceType level is out of the caller's access scope");
  });
});
```

### 7.2 `attendance-type.use-cases.test.ts` (5 scope assertions + List result-shape)

- Import: split (move Scope error to local path).
- **Create** (L187) / **Update** (L335) / **Delete** (L428) / **Get** (L566): each currently
  `await expect(useCase.execute(...)).rejects.toBeInstanceOf(AttendanceTypeLevelOutOfScopeError)`.
  Rewrite to Result form:
  ```ts
  const result = await useCase.execute(/* out-of-scope args */);
  expect(result.isErr()).toBe(true);
  expect(result.unwrapErr()).toBeInstanceOf(AttendanceTypeLevelOutOfScopeError);
  expect(repo.save /* or delete/existsByLevelCode */).not.toHaveBeenCalled();
  ```
  Keep the existing side-effect assertions (`repo.save`/`repo.delete`/`entity.description` unchanged).
- **List** describe (L453-520) — the UC now returns `Result`:
  - `it('returns the array from the repo')` (L474): `expect(result).toBe(entities)` → `expect(result.isOk()).toBe(true); expect(result.unwrap()).toBe(entities);`
  - `it('0 niveles base ...')` (L514): `expect(result).toEqual([])` → `expect(result.unwrap()).toEqual([]);`
  - `it('filters.level explícito fuera de baseLevels ... rejects')` (L501): →
    ```ts
    const result = await useCase.execute({ level: 3 }, teacherLevel2);
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(AttendanceTypeLevelOutOfScopeError);
    expect(repo.list).not.toHaveBeenCalled();
    ```
  - The `repo.list.toHaveBeenCalledWith(...)` delegation tests (L462-511) just `await` the call; they don't assert on the return → **unchanged** (aside from being valid under the new signature).

### 7.3 `generate-attendance-types-pdf.use-case.test.ts` (1 scope assertion)

- Import: split (keep `ok, err` from domain; move Scope error to local path).
- L110-119 test: `await expect(uc.execute({ level: 3, currentUser: teacherLevel2 })).rejects.toBeInstanceOf(...)` →
  ```ts
  const result = await uc.execute({ level: 3, currentUser: teacherLevel2 });
  expect(result.isErr()).toBe(true);
  expect(result.unwrapErr()).toBeInstanceOf(AttendanceTypeLevelOutOfScopeError);
  expect(repo.list).not.toHaveBeenCalled();
  expect(pdfGenerator.generatePdf).not.toHaveBeenCalled();
  ```

### 7.4 `attendance-type.controller.test.ts` (6 — mock swap + list ok-wrap)

- Import: split (move Scope error to local path).
- **create/getOne/update/delete/printList** scope tests (L134, L238, L293, L349, L378): swap
  `execute: vi.fn().mockRejectedValue(new AttendanceTypeLevelOutOfScopeError(3))` →
  `execute: vi.fn().mockResolvedValue(err(new AttendanceTypeLevelOutOfScopeError(3)))`.
  The `.rejects.toBeInstanceOf(AttendanceTypeLevelOutOfScopeError)` assertion **stays** (controller re-throws via `unwrapErr()` / `unwrapResultOrThrow`).
- **list describe** (L149-200) — controller now Result-based, so success mocks must wrap in `ok(...)`:
  - L153 `mockResolvedValue(entities)` → `mockResolvedValue(ok(entities))`
  - L163, L173, L185 `mockResolvedValue([])` → `mockResolvedValue(ok([]))`
  - L195 `mockRejectedValue(new Scope(3))` → `mockResolvedValue(err(new Scope(3)))` (assertion `.rejects.toBeInstanceOf` unchanged).
- Also the controller factory default (L58): `mockList ?? { execute: vi.fn().mockResolvedValue([makeEntity()]) }` → wrap in `ok(...)` so the default (used by the "HTTP status codes" describe) still satisfies `result.unwrap()`.

### 7.5 `attendance-type.controller.e2e.test.ts` (6 — mock swap + list ok/err)

- Import: split (keep `ok, err, AttendanceType, ...`; move Scope error to local path).
- **list** out-of-scope (L105): `listExecute.mockRejectedValueOnce(new Scope(3))` → `listExecute.mockResolvedValueOnce(err(new Scope(3)))`.
- **list** in-scope (L115): `listExecute.mockResolvedValueOnce([])` → `listExecute.mockResolvedValueOnce(ok([]))`.
- **create/update/delete/get** out-of-scope (L124, L161, L184, L202): `mockRejectedValueOnce(new Scope(3))` → `mockResolvedValueOnce(err(new Scope(3)))`.
- Their in-scope mocks already use `ok(...)`. All status assertions (403 + envelope code, 200/201/204) stay identical — real filter maps the thrown `ApplicationError` via `exception.httpStatus`.

> Why no RED-first status test: the 403 contract is invariant. There is no assertion that legitimately starts red on status. The refactor RED is the Result-shaped assertions failing against still-throwing code; GREEN after throw→return. This satisfies strict-TDD refactor semantics without a false status delta.

---

## 8. Spec doc annotation (`openspec/specs/attendance-types/spec.md`)

Table row L840 keeps its 403. The prose L842-846 currently says the code "NO es un error de dominio... se documenta acá porque el HTTP mapping (403) es observable". Update to record that the classification is now **materialized in code as `ApplicationError`**, and that the `DOMAIN_STATUS` entry was removed:

Replace the L842-846 paragraph with (essence):

```
Los dos primeros DEBEN registrarse en `DOMAIN_STATUS` del `AppExceptionFilter`. El código
`ATTENDANCE_TYPE_LEVEL_OUT_OF_SCOPE` YA NO es un error de dominio: desde
`attendance-type-result-migration` está materializado en código como `ApplicationError`
(`api/src/application/shared/errors/attendance-type-level-out-of-scope-error.ts`,
`httpStatus = 403`). Su status HTTP (403, envelope `{error}`) lo produce la rama
`ApplicationError` del filter (`exception.httpStatus`), NO el mapa `DOMAIN_STATUS` — la entrada
correspondiente fue removida de `DOMAIN_STATUS` como código muerto. El 403 observable es
idéntico antes y después.
```

Consider retitling the section header (L832) from "Errores de dominio requeridos" is out of scope; a minimal in-place note is enough (keep churn low).

---

## 9. Work unit / commit plan (one PR, <400 lines, from `main`)

Conventional commits, no AI attribution. Ordered so each commit is coherent:

1. `refactor(attendance-type): move AttendanceTypeLevelOutOfScopeError to api as ApplicationError`
   — new api file (§1.1) + delete domain file (§1.2) + remove 3 domain exports (§2 A/B/C) + fix the 2 use-case imports (D/E, import lines only) + the new class unit test (§7.1).
2. `refactor(attendance-type): migrate scope denials from throw to Result`
   — the 6 throw→`return err(...)` + 5 signature widenings + List `ok()`-wrap + PDF `err` import (§4).
3. `refactor(attendance-type): adopt Result idiom in controller list()`
   — the `list()` retrofit (§5).
4. `refactor(api): drop dead DOMAIN_STATUS entry for ATTENDANCE_TYPE_LEVEL_OUT_OF_SCOPE`
   — filter L20 deletion (§3).
5. `test(attendance-type): migrate scope assertions to Result shape`
   — the 4 test-file rewrites (§7.2-7.5).
6. `docs(spec): record AttendanceTypeLevelOutOfScopeError as ApplicationError`
   — spec.md annotation (§8).

(Commits 1-4 can be squashed if preferred; the split is for review clarity. Single PR either way.)

---

## 10. Review Workload Forecast

- **Estimated changed lines**: ~100-140 (mechanical: import + `extends` + ctor arg + `err()`/`ok()` + test mock swaps).
- **Chained PRs recommended**: **No**.
- **400-line budget risk**: **Low**.
- **Decision needed before apply**: **No** — Option B already chosen; scope fully enumerated; 0 web impact; 403 invariant.
- **Delivery**: single PR from `main` (`attendance-type` disjoint from recent course-cycle / materia-grupo-ciclo merges → no conflicts expected).

---

## ADR-style decisions

- **ADR-1 — Reclassify to `ApplicationError` (Option B) over leaving it as `DomainError` (Option A).**
  Rationale: the failure depends on caller context (`resolveAccessScope`), the épico's dividing line; the spec flagged this a month ago. Rejected A: cheaper today (~60-90 lines, 0 file move) but re-commits a documented inconsistency; runtime-identical, so no correctness reason to keep it.
- **ADR-2 — Move the file (forced, not optional).** `extends ApplicationError` + Clean Arch (`domain` ⊄ `api`) ⇒ the class cannot remain in `packages/domain`. Rejected alternative: duplicating `ApplicationError` into domain — would fork the hierarchy and violate the non-overlap rule.
- **ADR-3 — Keep the `level?: number` ctor (don't align to the pilot's `message: string`).** Rationale: preserves all 6 call sites verbatim (`new ...(entity.level)`), minimizes diff, no message-string plumbing. The pilot shape is a convention, not a contract.
- **ADR-4 — No barrel `index.ts` in `shared/errors/`.** Matches the existing direct-path import convention (pilot + `pdf.error`). Rejected: creating a barrel now = churn with no consumer benefit (YAGNI).
- **ADR-5 — Leave the PDF template bare-`Error` (L112) untouched.** It's an infrastructure guard (missing template), not caller-context; belongs to the unmodeled `InfrastructureError` follow-up. Migrating it would need a new base class → YAGNI + explicitly out of scope (ATRM-R7).

---

**Persistence note (hybrid):** `mem_save` is NOT available to this sub-agent. Engram backfill still needed
at `topic_key: sdd/attendance-type-result-migration/design` (type `architecture`, project `educandow`,
`capture_prompt: false`). openspec is the committed source of truth for this artifact.
