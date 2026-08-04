# Design — asistencia-reporting-result

> Concrete implementation design, read from the REAL code (4 use-cases + 2 controllers + the
> `unwrapResultOrThrow` helper + the `AppExceptionFilter` + 7 test files). Consumes
> `application-error-handling`. Pure `throw` → `Result` conversion, **no reclassification**
> (ARR-R3). Organized by the 4 stacked slices A/B/C/D. No production code is written here — design only.
>
> **Base = `main`** after #124 (`forbidden-error-reclassification`) merges and this branch is rebased.
> The apply of the slices WAITS for that (proposal decision #3).

---

## 0. Load-bearing verification — `unwrapResultOrThrow` status+body invariance (underpins ARR-R2)

This is the single most important thing to get right, because ARR-R2 claims **no behavior change**
and the proposal/exploration asserted the generic branch "reproduces the EXACT body/status today".
I read the actual code end to end. **The status claim holds. The body claim does NOT.** Details below.

### 0.1 The three code paths, quoted

**`unwrap-result-or-throw.ts` (real code):**
```ts
export function unwrapResultOrThrow<T, E extends PdfError | ApplicationError>(result: Result<T, E>): T {
  if (result.isErr()) {
    const error = result.unwrapErr();
    if (error instanceof ApplicationError) {
      throw error;                                   // (branch 1) ApplicationError → re-thrown as-is
    }
    throw new HttpException(                          // (branch 2) everything else (bare Error)
      { statusCode: error.httpStatus, error: error.code, message: error.message },
      error.httpStatus,
    );
  }
  return result.unwrap();
}
```

**`exception.filter.ts` (`AppExceptionFilter`, global `@Catch()`), the relevant branches:**
```ts
let status = 500; let message = 'Internal server error'; let code: string | undefined;
if (exception instanceof HttpException) {
  status = exception.getStatus();
  const res = exception.getResponse();               // our { statusCode, error, message } object
  // ... only extracts message; NEVER assigns `code` from the response object ...
  if (typeof obj.message === 'string') message = obj.message;
} else if (exception instanceof ApplicationError) {
  status = exception.httpStatus; message = exception.message; code = exception.code;   // code SET
}
// ...
response.status(status).json({ error: { status, code, message } });   // ALWAYS this envelope
```

**Today's manual mapping (both controllers), e.g. `asistencia-reporting.controller.ts#handleError`:**
```ts
res.status(err.httpStatus).json({ statusCode: err.httpStatus, error: err.code, message: err.message });
```
This is a **raw Express `res.json`** — it bypasses `AppExceptionFilter` entirely. Its body is the
**flat** `{ statusCode, error, message }`. Proven live by `constancia-controller.test.ts:48-54`, which
asserts exactly `{ statusCode: 404, error: 'AXCC_NOT_FOUND', message }`.

### 0.2 Status + body: before vs after, per surfaced error

| Error (example) | Class kind | TODAY status / body | AFTER status / body | Status? | Body? |
|---|---|---|---|---|---|
| `COURSE_CYCLE_NOT_FOUND` (404) | `AsistenciaReportingError` (bare `Error`) | 404 / flat `{ statusCode:404, error:"COURSE_CYCLE_NOT_FOUND", message }` (manual `res.json`) | 404 / nested `{ error:{ status:404, code:undefined, message } }` (branch 2 → filter) | ✅ same | ❌ shape changes AND `code` dropped |
| `AXCC_NOT_FOUND` / `STUDENT_NOT_PRINTABLE` / `BOLETIN_LEVEL_UNKNOWN` / `BATCH_ALL_FAILED` | `BoletinError` (bare `Error`) | flat, code present | nested, `code:undefined` | ✅ | ❌ same gap |
| `AXCC_NOT_FOUND` / `STUDENT_NOT_ELIGIBLE` / `INSTITUTION_NOT_FOUND` / `TEMPLATE_NOT_FOUND` | `ConstanciaError` (bare `Error`) | flat, code present | nested, `code:undefined` | ✅ | ❌ same gap |
| `ForbiddenError` (403) | `ApplicationError` (post-#124) | 403 / nested `{ error:{ status:403, code:undefined, message } }` (was `ForbiddenException` → filter) | 403 / nested `{ error:{ status:403, code:"FORBIDDEN", message } }` (branch 1 → filter ApplicationError branch) | ✅ same | ~ nearly same (GAINS `code:"FORBIDDEN"`) |
| `PdfError` (500) | bare `Error`, already migrated | 500 / nested `{ error:{ status:500, code:undefined, message } }` | unchanged | ✅ | ✅ unchanged |

**Verdict:** HTTP **status is invariant for all 28 sites** (proven — branch 2 preserves `error.httpStatus`
via `HttpException(..., httpStatus)`; branch 1 preserves 403 via `ApplicationError.httpStatus`). The
**body is NOT byte-identical** for the 3 bare-`Error` classes: (a) the envelope changes from the
hand-rolled **flat** `{ statusCode, error, message }` to the app-standard **nested**
`{ error: { status, code, message } }`, and (b) the machine-readable `code` is **dropped**
(`code: undefined`) because the filter's `HttpException` branch never reads it back out of the response
object. `ForbiddenError` is fine (already nested today; only gains its `code`).

### ADR-1 — RESOLVED: **Option B (preserve `code`)** — chosen by user 2026-08-03

> **DECISION: Option B.** Retrofit to `unwrapResultOrThrow` + the 2-line additive fix so the filter
> preserves `code`. Verified pre-decision: the frontend's `extractErrorMessage` (`web/src/hooks/use-api.ts`)
> is shape-tolerant and reads only `message` (present in both shapes), and the boletin/constancia hooks
> fetch blobs and never parse the error body — so there is **no user-visible regression**; Option B is
> chosen for API-contract hygiene (keep the machine-readable `code`). Spec ARR-R2 reframed (status
> invariant; body → standard `{ error: { status, code, message } }` envelope preserving code+message) and
> ARR-R7 amended to allow the 2 shared-file touch strictly for `code` preservation. The 2-line fix lands
> in **Slice A**. Ignore the "Option A" branches below — they are retained for rationale only.

Byte-identical body is **impossible** once the manual `res.json` mapping is removed (ARR-R5), because
`AppExceptionFilter` **always** re-nests into `{ error: { status, code, message } }`. So ARR-R2's
literal "same JSON body shape" and ARR-R5's "drop `handleError()`/try-catch" are in direct tension.
Three ways out:

- **Option A — accept the canonical envelope, drop `code`.** Migrated bodies become
  `{ error: { status, code: undefined, message } }` — the SAME envelope the rest of the app already
  emits, and the one `ForbiddenError` already used. Zero extra code. **Cost:** the 3 bare-`Error`
  classes lose their machine-readable `code` in error responses (a real API-contract regression if any
  client parses `error`/`code`). Requires amending ARR-R2 wording to "status-invariant; body converges
  to the canonical filter envelope; `code` not preserved for bare-`Error` classes".

- **Option B — preserve `code` with a 2-line surgical, additive change (RECOMMENDED).**
  1. `unwrap-result-or-throw.ts` branch 2: put the code under a `code` key →
     `throw new HttpException({ statusCode: error.httpStatus, code: error.code, message: error.message }, error.httpStatus)`.
  2. `exception.filter.ts` `HttpException` branch: add `if (typeof obj.code === 'string') code = obj.code;`.
  Result: migrated bodies `{ error: { status, code: <original code>, message } }` — canonical envelope
  **with status + code + message all preserved** (no information loss; only the flat→nested nesting
  changes, which is app-wide standard). **Inert** for every other `HttpException` (Nest built-ins don't
  set a `code` key → stays `undefined`, no regression). Blast radius: also surfaces `PdfError`'s code on
  the already-migrated endpoints (purely additive). Touches 2 shared presentation files + their 2 tests
  (`unwrap-result-or-throw.test.ts`, `exception.filter.spec.ts`). **ARR-R7-compliant**: no
  reclassification, no `InfrastructureError`, no status change.

- **Option C — keep the manual mapping.** Rejected: contradicts ARR-R5 and the épico goal.

**Recommendation: Option B.** It is the senior-correct answer — do not silently drop a machine-readable
error code clients may depend on. It satisfies ARR-R2's *intent* (no information loss: status + code +
message identical) and ARR-R5 (idiom unified, try/catch gone), at the cost of a tiny, contained,
additive filter tweak. If the team confirms no client reads `error`/`code` on these endpoints, fall back
to Option A (lighter, no shared-file change).

**This is a `Decision needed before apply: Yes`.** Under `delivery_strategy: ask-on-risk` the apply must
STOP and get the A-vs-B decision. If B is chosen, it lands in **Slice A** (first slice) since it is a
shared dependency for all four; if A is chosen, no shared change is needed. The rest of this design is
identical either way; only the "expected error body" in the controller-test assertions differs (flat
`code` present under B / `code: undefined` under A).

---

## ADR-2 — No reclassification of the 3 error classes (ARR-R3 / ARR-R7)

`AsistenciaReportingError`, `BoletinError`, `ConstanciaError` stay exactly as they are today: bare
`extends Error` with `(message, code, httpStatus)`. Verified files:
- `api/src/application/asistencia-reporting/asistencia-reporting.errors.ts` — `AsistenciaReportingError`.
- `api/src/application/reportes/generate-boletin.use-case.ts:37-46` — `BoletinError` (inline).
- `api/src/application/reportes/templates/constancia.template.ts:33-40` — `ConstanciaError` (inline).

We DO NOT touch their `extends`, `code`, or `httpStatus`. The correct `DomainError`/`InfrastructureError`
split is deferred to follow-up #3. Only `ForbiddenError` is already `ApplicationError` (via #124) and
just needs `throw` → `err()`.

## ADR-3 — Atomic slice unit = use-case + its tests + its controller endpoint(s) + controller tests

`Result` changes the SUCCESS return shape at the call site (`buffer` → `Result<Buffer, …>`), not only the
error path. So each use-case MUST migrate together with its controller endpoint(s) in the SAME slice, or
the controller won't compile. This drives the 4-slice cut (mirrors ASRM ADR-D4).

## ADR-4 — `GenerateBoletinBatchUseCase`: `Promise<Buffer>` → `Promise<Result<Buffer, BoletinError>>`

The batch use-case is the only one NOT on `Result` today (`execute(): Promise<Buffer>`). Its two throws
(`tenantClient()` `INTERNAL_ERROR` L148; `BATCH_ALL_FAILED` L109) become `err(...)`, and its two happy
returns (empty-ZIP L57 `return this.buildZip(...)`; final L126 `return done`) become `ok(...)`. The
internal per-row `try/catch` that swallows single-PDF failures (L77-105) is **unchanged** — it already
`continue`s and never throws; `singleUC.execute` already returns `Result` and is consumed via
`result.isErr()`. Only the OUTER signature and the 2 aggregate throws change. **Caller:** the only caller
is `ReportesController#getBoletinBatch` (Slice C retrofit); no other production caller exists (grep).

## Import delta

- Slice A `generate-asistencia-mensual-pdf.use-case.ts`: already imports `Result` (type). Add value
  imports `ok, err` from `@educandow/domain`. `ForbiddenError` + `AsistenciaReportingError` already imported.
- Slice B `generate-boletin.use-case.ts`: already imports `ok` + `Result`. Add `err`.
- Slice C `generate-boletin-batch.use-case.ts`: add `ok, err` (value) + `Result` (type) from
  `@educandow/domain`; `BoletinError` already imported.
- Slice D `generate-constancia-regular.use-case.ts`: already imports `Result`. Add `ok, err`.
  (`ok` is needed because the final `return this.pdfGenerator.generatePdf(html)` already returns a
  `Result` and passes through unchanged, but the widened union may need explicit `ok` only if a non-port
  success is added — it is not, so `ok` may be unused in D; add only `err`. Confirm at apply.)

---

## Slice A — `asistencia-reporting` (branch `refactor/asistencia-reporting-result` → `main`)

`generate-asistencia-mensual-pdf.use-case.ts` — **12 throws**. Two public methods share the private
`render` + `checkDoor2*` + `tenantClient` helpers.

### Signatures (ARR-R4)
```ts
async executeGeneral(input: GenerateAsistenciaGeneralInput):
  Promise<Result<Buffer, PdfError | AsistenciaReportingError | ForbiddenError>>
async executeMateria(input: GenerateAsistenciaMateriaInput):
  Promise<Result<Buffer, PdfError | AsistenciaReportingError | ForbiddenError>>
private render(params): Promise<Result<Buffer, PdfError | AsistenciaReportingError>>   // gains AsistenciaReportingError (TEMPLATE_NOT_FOUND)
private checkDoor2General(courseCycleId, userId): Promise<Result<void, ForbiddenError>>   // was Promise<void>
private checkDoor2Materia(materiaXCursoXCicloId, userId): Promise<Result<void, ForbiddenError>>   // was Promise<void>
private tenantClient(): ...   // see note below
```

### Throw → err map (verified line numbers vs real code)

| Line | Today | After | Home |
|---|---|---|---|
| 153 | `throw new AsistenciaReportingError('CourseCycle no encontrado','COURSE_CYCLE_NOT_FOUND',404)` | `return err(new AsistenciaReportingError('CourseCycle no encontrado','COURSE_CYCLE_NOT_FOUND',404))` | `executeGeneral` |
| 185 | `throw new AsistenciaReportingError('MateriaXCursoXCiclo no encontrada','MATERIA_X_CURSO_X_CICLO_NOT_FOUND',404)` | `return err(...)` | `executeMateria` |
| 196 | `throw new AsistenciaReportingError('CourseCycle no encontrado','COURSE_CYCLE_NOT_FOUND',404)` | `return err(...)` | `executeMateria` |
| 230 | `throw new AsistenciaReportingError('Template asistencia-mensual.hbs no encontrado','TEMPLATE_NOT_FOUND',500)` | `return err(...)` | `render` (infra guard) |
| 313 | `throw new ForbiddenError('CourseCycle not found — authorization failed')` | `return err(new ForbiddenError(...))` | `checkDoor2General` |
| 318 | `throw new ForbiddenError('User is not a DocenteXCiclo in this cycle')` | `return err(...)` | `checkDoor2General` |
| 323 | `throw new ForbiddenError('User is not a preceptor for this CursoXCiclo')` | `return err(...)` | `checkDoor2General` |
| 334 | `throw new ForbiddenError('MateriaXCursoXCiclo not found — authorization failed')` | `return err(...)` | `checkDoor2Materia` |
| 342 | `throw new ForbiddenError('CourseCycle not found — authorization failed')` | `return err(...)` | `checkDoor2Materia` |
| 347 | `throw new ForbiddenError('User is not a DocenteXCiclo in this cycle')` | `return err(...)` | `checkDoor2Materia` |
| 352 | `throw new ForbiddenError('User has no group assignment for this materia')` | `return err(...)` | `checkDoor2Materia` |
| 359 | `throw new AsistenciaReportingError('No tenant context available','INTERNAL_ERROR',500)` | see `tenantClient` note | `tenantClient` |

### One concrete before/after (representative)
```ts
// BEFORE (executeGeneral, L152-154)
if (!cc) {
  throw new AsistenciaReportingError('CourseCycle no encontrado', 'COURSE_CYCLE_NOT_FOUND', 404);
}
// AFTER
if (!cc) {
  return err(new AsistenciaReportingError('CourseCycle no encontrado', 'COURSE_CYCLE_NOT_FOUND', 404));
}
```

### `tenantClient()` gotcha (L356-362) — the one that is NOT a simple 1:1

`tenantClient()` is a **synchronous private that returns the client and throws** on missing context.
Two callers: `executeGeneral`/`executeMateria` (L147/179) AND `render` never calls it. Converting it to
return `Result<TenantClient, AsistenciaReportingError>` is the clean move:
```ts
private tenantClient(): Result<TenantPrismaClient, AsistenciaReportingError> {
  const c = TenantContext.getClient();
  if (!c) return err(new AsistenciaReportingError('No tenant context available', 'INTERNAL_ERROR', 500));
  return ok(c);
}
```
Each caller then:
```ts
const clientResult = this.tenantClient();
if (clientResult.isErr()) return err(clientResult.unwrapErr());
const client = clientResult.unwrap();
```
Note `executeGeneral`/`executeMateria` currently `const client = this.tenantClient()` at L147/179 and the
`(client as any)` casts stay. **checkDoor2General/Materia also call `this.tenantClient()`** (L307/328) —
same propagation there (their union already includes only `ForbiddenError` today, but `tenantClient` can
now surface `AsistenciaReportingError`; widen `checkDoor2*` to
`Promise<Result<void, ForbiddenError | AsistenciaReportingError>>`, OR — simpler and behavior-preserving —
keep `tenantClient` returning the client but have the caller in `checkDoor2*` treat a missing client as
its existing `ForbiddenError('...not found — authorization failed')`? **No** — that would change the
error class/status for the Door-2 tenant-missing case (500 → 403). Preserve it: widen `checkDoor2*` unions
to include `AsistenciaReportingError`). Net `executeGeneral`/`executeMateria` union stays
`PdfError | AsistenciaReportingError | ForbiddenError` (superset already covers it).

Wiring for the auth gate (both methods, L143-145 / L175-177):
```ts
if (!scope.isAdministrative) {
  const check = await this.checkDoor2General(courseCycleId, userId);   // or checkDoor2Materia
  if (check.isErr()) return err(check.unwrapErr());
}
```
Final `checkDoor2*` line: `return ok(undefined);`. `render`'s final line already
`return this.pdfGenerator.generatePdf(html, { landscape: true })` (a `Result`) — unchanged; its L229-233
template guard becomes `return err(new AsistenciaReportingError(..., 'TEMPLATE_NOT_FOUND', 500))`.

### Controller — `asistencia-reporting.controller.ts` (2 endpoints)

Delete `handleError()` (L118-131), the `try/catch` in both endpoints, and the now-unused imports
`ForbiddenException`, `ForbiddenError`, `AsistenciaReportingError` (verify none remain referenced).
```ts
// printGeneral — AFTER (no try/catch)
const pdfBuffer = unwrapResultOrThrow(await this.generateUC.executeGeneral({
  courseCycleId: ccId, year: query.year, month: query.month, userId: user.userId, userRoles: user.roles,
}));
res.set({ 'Content-Type': 'application/pdf',
  'Content-Disposition': `attachment; filename="asistencia-mensual-${ccId}-${query.year}-${query.month}.pdf"`,
  'Content-Length': pdfBuffer.length.toString() });
res.send(pdfBuffer);
```
`printMateria` identical shape. `unwrapResultOrThrow` now receives a union that includes
`AsistenciaReportingError` (bare `Error`) and `ForbiddenError` (`ApplicationError`) — the helper's generic
type bound `E extends PdfError | ApplicationError` does NOT include bare `AsistenciaReportingError`.
**tsc gate:** the helper signature must accept it. Under **Option B** we keep the helper generic but the
bound must widen to also allow bare `Error`-with-`code` — simplest: relax the bound to
`E extends { httpStatus: number; code: string; message: string }` (structural) OR add `AsistenciaReportingError`
to the union. **Decision folded into ADR-1** (the helper is touched under Option B anyway); under Option A
the bound must STILL widen to admit the bare classes — so **the helper's type bound must widen regardless
of A/B.** Flag: this is a required helper edit even in Option A (bound only, no runtime change), landing in
Slice A. Confirm `ForbiddenError` still 403 via branch 1.

### Tests — Slice A

- `generate-asistencia-mensual-pdf.use-case.test.ts` (general) + `.materia.test.ts`: rewrite every
  error-path `await expect(uc.execute*()).rejects.toBeInstanceOf(AsistenciaReportingError|ForbiddenError)`
  → `const r = await uc.execute*(...); expect(r.isErr()).toBe(true); expect(r.unwrapErr()).toBeInstanceOf(...)`.
  Success paths already assert on the `Result` (PdfPort already returns `Result`) — `.unwrap()`/`isOk()`
  where a raw buffer was previously read.
- `asistencia-reporting.controller.test.ts` — **identity rewrites:**
  - L59-67 `maps AsistenciaReportingError` (general): `mockRejectedValue(new AsistenciaReportingError(...))`
    → `mockResolvedValue(err(new AsistenciaReportingError(...)))`. Assertion changes from
    `res.status(404)`/`res.json({error:'COURSE_CYCLE_NOT_FOUND'})` (flat manual body) to the **new**
    behavior: the promise **rejects with `HttpException`** (status 404); under **Option B** additionally
    assert the thrown `HttpException.getResponse()` carries `code:'COURSE_CYCLE_NOT_FOUND'`; under Option A,
    only status 404. Add `err` to the `@educandow/domain` import.
  - L127-134 `maps AsistenciaReportingError` (materia): same rewrite.
  - L75-81 `maps ForbiddenError → ForbiddenException`: `mockRejectedValue(new ForbiddenError(...))`
    → `mockResolvedValue(err(new ForbiddenError(...)))`; assertion `.rejects.toBeInstanceOf(ForbiddenException)`
    → `.rejects.toBeInstanceOf(ForbiddenError)` (helper branch 1 re-throws the instance; filter maps 403).
    Remove `ForbiddenException` import if unreferenced afterwards.
  - L83-90 `rethrows unknown errors`: unchanged in spirit — a raw `Error` returned as `err(...)` now hits
    the helper generic branch → `HttpException`. Rewrite to `mockResolvedValue(err(boom))` and assert
    `.rejects.toBeInstanceOf(HttpException)` (or keep as a genuine thrown-Error case → still `.rejects.toBe(boom)`
    if the use-case can still throw a non-Result Error; prefer the `err(...)` form for consistency).
  - L92-103 / L142-153 `(PPR-S8) err(PdfError)`: already `Result`-shaped — unchanged.

**Slice A green independently:** compiles + all asistencia-reporting suites pass with no dependency on B/C/D.

---

## Slice B — `reportes`/boletin (branch `-b` from Slice A)

`generate-boletin.use-case.ts` — **7 throws** (note the `BOLETIN_LEVEL_UNKNOWN` **duplicate** at L211 in
`execute` and L934 in `getBaseLevel`).

### Signatures (ARR-R4)
```ts
async execute(alumnosXCursoXCicloId: string): Promise<Result<Buffer, PdfError | BoletinError>>   // was Result<Buffer, PdfError>
private tenantClient(): Result<TenantPrismaClient, BoletinError>   // was TenantPrismaClient (throws)
getBaseLevel(levelCode: number): Result<string, BoletinError>      // was string (throws) — PUBLIC, used by execute L209
```

### Throw → err map

| Line | Code | After | Home |
|---|---|---|---|
| 129 | `AXCC_NOT_FOUND` (404) | `return err(new BoletinError('Alumno×Curso×Ciclo no encontrado','AXCC_NOT_FOUND',404))` | `execute` |
| 132 | `STUDENT_NOT_PRINTABLE` (422) | `return err(...)` | `execute` |
| 148 | `COURSE_CYCLE_NOT_FOUND` (404) | `return err(...)` | `execute` |
| 166 | `STUDENT_NOT_FOUND` (404) | `return err(...)` | `execute` |
| 211 | `BOLETIN_LEVEL_UNKNOWN` (422) | `return err(...)` | `execute` (template map miss) |
| 894 | `INTERNAL_ERROR` (500, infra) | via `tenantClient` Result | `tenantClient` |
| 934 | `BOLETIN_LEVEL_UNKNOWN` (422) | `return err(...)` | `getBaseLevel` |

### `BOLETIN_LEVEL_UNKNOWN` duplicate — DO NOT double-convert (proposal risk)

L211 is a guard on `this.templates.get(baseLevel)` being missing inside `execute`. L934 is inside the
**public** `getBaseLevel(levelCode)` helper. `execute` calls `getBaseLevel` at L185
(`const baseLevel = this.getBaseLevel(resolvedEnrollment.level)`). Making `getBaseLevel` return
`Result<string, BoletinError>` means L185 must propagate:
```ts
const baseLevelResult = this.getBaseLevel(resolvedEnrollment.level);
if (baseLevelResult.isErr()) return err(baseLevelResult.unwrapErr());
const baseLevel = baseLevelResult.unwrap();
```
Then the L209-216 `this.templates.get(baseLevel)` guard (L211) remains a **separate** legitimate error
(template file absent for a *known* level) → `return err(new BoletinError('Nivel pedagógico no soportado…','BOLETIN_LEVEL_UNKNOWN',422))`.
**Both stay** — they are distinct call sites for the same code; NOT a double-conversion. Confirmed by
reading: L934 fires for an *unrecognised* level code; L211 fires when the level is recognised but its
`.hbs` template didn't load.

### `tenantClient()` (L892-896)
```ts
private tenantClient(): Result<TenantPrismaClient, BoletinError> {
  const c = TenantContext.getClient();
  if (!c) return err(new BoletinError('No tenant context available', 'INTERNAL_ERROR', 500));
  return ok(c);
}
```
`execute` L122 `const client = this.tenantClient();` → propagate via `isErr()`/`unwrap()`. **Caller
impact:** `getBaseLevel` is also called by `GenerateBoletinBatchUseCase`? No — grep confirms batch calls
only `singleUC.execute`. `getBaseLevel`'s only caller is `execute` (L185). Safe.

### One concrete before/after
```ts
// BEFORE (L128-130)
if (!axcc) { throw new BoletinError('Alumno×Curso×Ciclo no encontrado', 'AXCC_NOT_FOUND', 404); }
// AFTER
if (!axcc) { return err(new BoletinError('Alumno×Curso×Ciclo no encontrado', 'AXCC_NOT_FOUND', 404)); }
```
The existing `ok(...)` returns (L139 cached buffer, L229 final) and the PdfPort passthrough (L220-222)
are unchanged.

### Controller — `reportes.controller.ts#getBoletin` (L30-56)
Delete the `try/catch` + the `if (err instanceof BoletinError)` manual mapping:
```ts
const pdfBuffer = unwrapResultOrThrow(await this.singleUC.execute(alumnosXCursoXCicloId));
res.set({ 'Content-Type':'application/pdf',
  'Content-Disposition':`attachment; filename="boletin-${alumnosXCursoXCicloId}.pdf"`,
  'Content-Length': pdfBuffer.length.toString() });
res.send(pdfBuffer);
```
Keep the `BoletinError` import ONLY if still referenced (it is — batch endpoint until Slice C, and the
import is shared at L8). Remove per-import in the last slice that stops using it.

### Tests — Slice B
- `generate-boletin.use-case.test.ts` + `generate-boletin.{inicial,terciario,docente-s2}.test.ts`:
  rewrite error-path `.rejects.toBeInstanceOf(BoletinError)` → `isErr()`/`unwrapErr()`. Success paths
  already `Result` (PdfPort) — adjust `.unwrap()` where a raw buffer was consumed. The `inicial`/`terciario`/
  `docente-s2` suites are mostly `buildMaterias*` unit tests that never touch the throw sites — verify they
  compile against the new `execute`/`getBaseLevel` signatures (they call the private builders directly, not
  `execute`), likely untouched except the shared import.
- `reportes.controller.test.ts`:
  - L36 default `singleUC.execute` already `mockResolvedValue(ok(Buffer))` — unchanged.
  - L68-76 `still maps a thrown BoletinError to its httpStatus` (`mockRejectedValue` + `res.status(404)`):
    **rewrite** → `mockResolvedValue(err(new BoletinError('no encontrado','AXCC_NOT_FOUND',404)))` and assert
    `.rejects.toBeInstanceOf(HttpException)` (status 404); Option B additionally asserts `code:'AXCC_NOT_FOUND'`
    in `getResponse()`. This test currently locks in the OLD flat body — it MUST change (ARR-R2 evidence).
  - L55-66 `(PPR-S8) err(PdfError)` — unchanged.

**Slice B green independently:** compiles + boletin suites + reportes.controller (getBoletin portion) pass.

---

## Slice C — `reportes`/boletin-batch + `getBoletinBatch` retrofit (branch `-c` from Slice B)

`generate-boletin-batch.use-case.ts` — **2 throws** + **signature change** (ADR-4).

### Signature
```ts
async execute(courseCycleId: string): Promise<Result<Buffer, BoletinError>>   // was Promise<Buffer>
private tenantClient(): Result<TenantPrismaClient, BoletinError>              // was TenantPrismaClient (throws)
```
`buildZip(...)` stays `Promise<Buffer>` (internal, never throws).

### Throw → err / return → ok map

| Line | Today | After |
|---|---|---|
| 31 | `const client = this.tenantClient();` | `const clientResult = this.tenantClient(); if (clientResult.isErr()) return err(clientResult.unwrapErr()); const client = clientResult.unwrap();` |
| 57 | `return this.buildZip([], []);` (empty ZIP) | `return ok(await this.buildZip([], []));` |
| 109-113 | `throw new BoletinError('…todos fallaron','BATCH_ALL_FAILED',422);` | `return err(new BoletinError('No se pudo generar ningún boletín del lote — todos fallaron','BATCH_ALL_FAILED',422));` |
| 126 | `return done;` (final Buffer) | `return ok(await done);` |
| 148 | `tenantClient()` `INTERNAL_ERROR` throw | wrapped in `tenantClient` Result above |

The per-row `try/catch` loop (L74-105) is **unchanged** — it consumes `singleUC.execute`'s `Result` via
`result.isErr()`/`continue` and never rethrows.

### Controller — `reportes.controller.ts#getBoletinBatch` (L63-88) — the retrofit
Today consumes a **raw Buffer** (`const zipBuffer = await this.batchUC.execute(...)`) with a
`try/catch(BoletinError)` manual map. After:
```ts
const zipBuffer = unwrapResultOrThrow(await this.batchUC.execute(courseCycleId));
res.set({ 'Content-Type':'application/zip',
  'Content-Disposition':`attachment; filename="boletines-curso-${courseCycleId}.zip"`,
  'Content-Length': zipBuffer.length.toString() });
res.send(zipBuffer);
```
Delete the try/catch. `BATCH_ALL_FAILED` (bare `BoletinError`, 422) → helper generic branch → 422
(status preserved; body per ADR-1). Empty-ZIP success → `ok(buffer)` → `res.send(buffer)` unchanged.

### Tests — Slice C
- `generate-boletin-batch.use-case.test.ts` (~11 tests): the success cases (`toEqual(buffer)` /
  buffer-length checks) wrap in `.unwrap()`/`isOk()`; the `BATCH_ALL_FAILED` case
  `.rejects.toBeInstanceOf(BoletinError)` → `isErr()`/`unwrapErr()`; the empty-ZIP zero-rows case →
  `isOk()` + `.unwrap()` is a valid (empty) ZIP buffer. The `singleUC` mock already returns `Result`.
- **NET-NEW** `getBoletinBatch` controller test (no legacy to diff — specify assertions):
  Add cases to `reportes.controller.test.ts` (`batchUC` mock is already declared at L31/37):
  - **success**: `batchUC.execute.mockResolvedValue(ok(Buffer.from('ZIP')))` →
    `await controller.getBoletinBatch('cc-1', res)` → `res.set` with `Content-Type: application/zip`,
    `res.send(Buffer.from('ZIP'))`, `res.status` not called.
  - **empty ZIP** (zero printable rows): `mockResolvedValue(ok(<emptyZipBuffer>))` → still `res.send`, 200,
    no error.
  - **BATCH_ALL_FAILED → 422**: `mockResolvedValue(err(new BoletinError('…todos fallaron','BATCH_ALL_FAILED',422)))`
    → `.rejects.toBeInstanceOf(HttpException)` with `getStatus() === 422`; Option B additionally
    `getResponse().code === 'BATCH_ALL_FAILED'`; `res.send` not called.
  - **INTERNAL_ERROR → 500** (no tenant): `mockResolvedValue(err(new BoletinError('No tenant context available','INTERNAL_ERROR',500)))`
    → `.rejects.toBeInstanceOf(HttpException)`, `getStatus() === 500`.

**Slice C green independently:** compiles + batch suite + reportes.controller (getBoletinBatch portion) pass.

---

## Slice D — `reportes`/constancia + docs (branch `-d` from Slice C)

`generate-constancia-regular.use-case.ts` — **7 throws**.

### Signature
```ts
async execute(axccId: string, input: ConstanciaInput): Promise<Result<Buffer, PdfError | ConstanciaError>>   // was Result<Buffer, PdfError>
```
No private `tenantClient()` helper here — the tenant guard is inline at L91-94 (uses
`TenantContext.getClient()` directly).

### Throw → err map

| Line | Code | After | Home |
|---|---|---|---|
| 93 | `INTERNAL_ERROR` (500, infra) | `return err(new ConstanciaError('No tenant context available','INTERNAL_ERROR',500))` | inline tenant guard |
| 101 | `AXCC_NOT_FOUND` (404) | `return err(...)` | Step 1 |
| 113 | `STUDENT_NOT_FOUND` (404) | `return err(...)` | Step 2 |
| 120 | `STUDENT_NOT_ELIGIBLE` (422) | `return err(...)` | Step 2 eligibility |
| 133 | `COURSE_CYCLE_NOT_FOUND` (404) | `return err(...)` | Step 3 |
| 149 | `INSTITUTION_NOT_FOUND` (500, ambiguous — keep class+status) | `return err(...)` | Step 4 |
| 188 | `TEMPLATE_NOT_FOUND` (500, infra) | `return err(...)` | Step 8 template guard |

Final `return this.pdfGenerator.generatePdf(html)` (L200) already returns `Result<Buffer, PdfError>` —
unchanged. `constancia.template.ts` (`ConstanciaError` class) is **not modified** (ADR-2); the proposal's
"constancia.template" mention refers only to the import site, not a code change there.

### One concrete before/after
```ts
// BEFORE (L92-94)
if (!tenantClient) { throw new ConstanciaError('No tenant context available', 'INTERNAL_ERROR', 500); }
// AFTER
if (!tenantClient) { return err(new ConstanciaError('No tenant context available', 'INTERNAL_ERROR', 500)); }
```

### Controller — `reportes.controller.ts#createConstanciaRegular` (L95-122)
Delete try/catch + `if (err instanceof ConstanciaError)` map:
```ts
const pdfBuffer = unwrapResultOrThrow(await this.constanciaUC.execute(axccId, dto));
res.set({ 'Content-Type':'application/pdf',
  'Content-Disposition':`inline; filename="constancia-regular-${axccId}.pdf"`,
  'Content-Length': pdfBuffer.length.toString() });
res.send(pdfBuffer);
```
**Final import sweep (last slice):** after D, remove `BoletinError` + `ConstanciaError` imports from
`reportes.controller.ts` (L8/L11) iff no longer referenced — by now all 3 endpoints use the helper and no
`instanceof` remains. Verify and drop. This dead-code sweep MUST land in D so no earlier slice breaks.

### Tests — Slice D
- `generate-constancia-regular.use-case.test.ts` (~13 tests, ~600 lines): rewrite every
  `.rejects.toBeInstanceOf(ConstanciaError)` (7 error paths) → `isErr()`/`unwrapErr()`; success shape via
  `.unwrap()`.
- `reportes.controller.test.ts` — `createConstanciaRegular` portion:
  - L38 default `constanciaUC.execute` already `ok(Buffer)` — unchanged.
  - L107-115 `still maps a thrown ConstanciaError` (`mockRejectedValue` + `res.status(422)`): **rewrite** →
    `mockResolvedValue(err(new ConstanciaError('no elegible','STUDENT_NOT_ELIGIBLE',422)))` +
    `.rejects.toBeInstanceOf(HttpException)` (422); Option B asserts `code:'STUDENT_NOT_ELIGIBLE'`.
  - L94-105 `(PPR-S8) err(PdfError)` — unchanged.
- **DELETE** `api/src/presentation/reportes/__tests__/constancia-controller.test.ts` (149 lines, proposal
  decision #6). It is a legacy duplicate that instantiates the controller via `Object.create(prototype)`
  and asserts the OLD flat `{ statusCode, error, message }` body (L48-54) — exactly the behavior this
  change removes. Its coverage is fully subsumed by the rewritten `reportes.controller.test.ts`.

### ARR-R8 — Canonical consumer-tracking correction (do it HERE, in Slice D)
Edit `openspec/specs/application-error-handling/spec.md` lines **206-210**. Replace:
```
- `reportes` / `asistencia-reporting` / `attendance-type-pdf` (30 throws) — UNBLOCKED (PR #111 merged
  2026-07-12). Its `ForbiddenError` throws were already reclassified by `forbidden-error-reclassification`
  (import + `ApplicationError` parent only, throw idiom preserved); remaining: migrate
  `BoletinError`/`ConstanciaError`/`AsistenciaReportingError` to `extends ApplicationError` + `Result`.
  Next up as épico follow-up #2.
```
with:
```
- `reportes` / `asistencia-reporting` — FULLY MIGRATED (throw → `Result`) by change
  `asistencia-reporting-result` (épico follow-up #2, 4 stacked slices A asistencia-reporting /
  B boletin / C boletin-batch / D constancia). All 28 throws across the 4 use-cases moved into the
  `Result` channel; `GenerateBoletinBatchUseCase` also changed `Promise<Buffer>` → `Promise<Result<…>>`.
  `ForbiddenError` (already `ApplicationError` via `forbidden-error-reclassification` #124) just moved
  throw → `err`. The 3 bare-`Error` classes `BoletinError`/`ConstanciaError`/`AsistenciaReportingError`
  were **NOT reclassified** — verification proved none of their sites are caller-context/authz (they are
  NOT_FOUND, intrinsic invariants, and infra guards), so the earlier blanket instruction to migrate them
  to `extends ApplicationError` was semantically incorrect and has been removed. Their correct
  classification (candidate `DomainError` for NOT_FOUND/invariants, `InfrastructureError` for the 5 infra
  guards, plus a product decision on the ambiguous `INSTITUTION_NOT_FOUND` 500 and `BATCH_ALL_FAILED`
  aggregate) is DEFERRED to follow-up #3. `attendance-type-pdf` was already FULLY MIGRATED separately
  (module `attendance-type`, archived 2026-07-31) — it is not part of this change.
```

**Slice D green independently:** compiles + constancia suite + full reportes.controller pass;
`constancia-controller.test.ts` gone.

---

## Slice independence & base

All four slices share exactly two dependencies, both landing at/under Slice A: (1) `unwrapResultOrThrow`'s
type-bound widening (required even under Option A), and (2) `ForbiddenError` being `ApplicationError` (from
#124, in `main`). Beyond that, A/B/C/D touch **disjoint** production files (A = asistencia-reporting UC +
controller; B = boletin UC + `getBoletin`; C = boletin-batch UC + `getBoletinBatch`; D = constancia UC +
`createConstanciaRegular`). The only SHARED prod file across B/C/D is `reportes.controller.ts`, but each
slice edits a **different endpoint method** + its own import line, so each compiles green on its own. Base
= `main` after #124 merges + rebase (proposal decision #3); apply waits for that.

```
main (post-#124)
 └─ refactor/asistencia-reporting-result        (Slice A — asistencia-reporting, 12 throws) [+ helper bound / ADR-1 fix]
     └─ refactor/asistencia-reporting-result-b   (Slice B — boletin, 7 throws)
         └─ refactor/asistencia-reporting-result-c   (Slice C — boletin-batch, 2 throws + retrofit)
             └─ refactor/asistencia-reporting-result-d   (Slice D — constancia, 7 throws + docs + delete legacy)
```

### Per-slice conventional commits (work-unit)
- A: `refactor(asistencia-reporting): return Result from generate-asistencia-mensual-pdf (12 throws)` ·
  `refactor(asistencia-reporting): consume Result in controller, drop handleError/try-catch` ·
  `refactor(http): widen unwrapResultOrThrow bound [+ preserve error code — Option B]` ·
  `test(asistencia-reporting): migrate use-case + controller tests to Result`
- B: `refactor(reportes): return Result from generate-boletin (7 throws)` ·
  `refactor(reportes): consume boletin Result in getBoletin` ·
  `test(reportes): migrate boletin use-case + controller tests to Result`
- C: `refactor(reportes): Result-return generate-boletin-batch (Promise<Buffer> → Result)` ·
  `refactor(reportes): retrofit getBoletinBatch to unwrapResultOrThrow` ·
  `test(reportes): migrate batch tests + add net-new getBoletinBatch controller test`
- D: `refactor(reportes): return Result from generate-constancia-regular (7 throws)` ·
  `refactor(reportes): consume constancia Result, remove dead BoletinError/ConstanciaError imports` ·
  `test(reportes): migrate constancia tests, delete legacy constancia-controller.test.ts` ·
  `docs(spec): correct application-error-handling consumer entry (ARR-R8)`

---

## Test strategy notes (strict TDD active, `pnpm test`)

- **All suites here are Vitest UNIT tests with mocked repos/PdfPort/Response — NO `.db.test.ts` exists in
  these modules** (glob confirmed). So **no Docker/DB is required** for this change, even though
  `educandow-db` is up. Integration is N/A here.
- **No domain type is touched** (only `ok`/`err`/`Result` imports, already published in `@educandow/domain`
  dist). Therefore the "rebuild `packages/domain` dist before `tsc`" gotcha does **not** apply — confirmed
  these 3 error classes live in `api/`, not in `packages/domain`. `pnpm --filter api typecheck` needs no
  domain rebuild.
- TDD framing per slice: adjust the failing/removed error-path assertions FIRST (RED against the new
  `Result` contract), then convert the use-case (GREEN), then the controller. Success-shape assertions are
  mechanical (`.unwrap()`).

---

## Verification checklist (per ARR-R1..R8)

| Req | Check |
|---|---|
| ARR-R1 | `rg "throw new" api/src/application/{asistencia-reporting,reportes}/generate-*.use-case.ts` returns **0** (only presentation re-throw inside `unwrapResultOrThrow` remains). |
| ARR-R2 | Status invariant confirmed for all 28 sites (branch 2 preserves `httpStatus`, branch 1 preserves 403). Body: **decision from ADR-1** — Option B → `code` preserved in canonical envelope (assert in helper+filter tests); Option A → `code` dropped, envelope canonical (amend ARR-R2 text). No status literal changed anywhere. |
| ARR-R3 | `git diff` shows NO `extends` change on the 3 classes; `instanceof DomainError`/`instanceof ApplicationError` both false. |
| ARR-R4 | `pnpm --filter api typecheck` green after EACH slice; batch signature is `Promise<Result<Buffer, BoletinError>>`. |
| ARR-R5 | Both controllers: 0 bespoke `try/catch`; all 5 endpoints use `unwrapResultOrThrow`; `getBoletinBatch` consumes `Result`; `ForbiddenError` → 403. |
| ARR-R6 | Error-path tests use `isErr()`/`unwrapErr()` (0 `toThrow`/`rejects.toBeInstanceOf(<XError>)` on use-cases); `constancia-controller.test.ts` deleted; net-new `getBoletinBatch` test present. |
| ARR-R7 | No `InfrastructureError`, no `attendance-type-pdf` file in diff, no status literal changed for the 28 sites, no error class moved/reclassified. |
| ARR-R8 | Canonical `application-error-handling/spec.md` L206-210 edited (no "→ApplicationError" instruction; references follow-up #3). |
| Global | `pnpm test` green; `pnpm build` green. |

---

## Review Workload Forecast

| Slice | Content | Throws | Prod (est.) | Tests (est.) | Total (est.) | 400 risk |
|---|---|---|---|---|---|---|
| A — asistencia-reporting | UC (12) + controller + helper-bound[+ADR-1 fix] + 3 tests | 12 | ~90-120 | ~150-190 | **~240-310** | Moderate |
| B — boletin | UC (7) + getBoletin + tests | 7 | ~55-70 | ~120-160 | **~175-230** | Low-Mod |
| C — boletin-batch | UC (2, sig change) + retrofit getBoletinBatch + net-new test | 2 | ~45-60 | ~120-150 | **~165-210** | Low-Mod |
| D — constancia | UC (7) + endpoint + delete legacy + docs | 7 | ~55-70 | ~200-260 (−149 deleted) | **~200-280** | Moderate |
| **Aggregate** | | **28** | ~245-320 | ~590-760 | **~800-1030** | **High** |

- **Chained PRs recommended: Yes** (4 stacked, each independently green).
- **400-line budget risk: High** at aggregate; per-slice all Moderate/Low (none forecast over 400 alone —
  Slice A is the largest if Option B's helper+filter change lands here).
- **Decision needed before apply: Yes** — TWO decisions: (1) ADR-1 Option A vs B (body/`code`), which
  is a real behavior/contract call, and (2) confirm the stacked-PR strategy. Under `ask-on-risk` the apply
  MUST stop for both before implementing Slice A.

## Traceability

ADR-1→ARR-R2/R5 · ADR-2→ARR-R3/R7 · ADR-3→ARR-R5/R6 · ADR-4→ARR-R4 (batch) · throw maps→ARR-R1 ·
signatures→ARR-R4 · controller idiom→ARR-R5 · test plan + legacy delete + net-new→ARR-R6 · scope
notes→ARR-R7 · canonical edit→ARR-R8. Status-invariance proof (§0.2)→ARR-R2.
