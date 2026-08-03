# Design — asistencia-result-migration

> Concrete implementation design, read from the real code (6 use-cases + controller + 7 test files).
> Consumes `application-error-handling`. Pure signature-honesty (throw → `Result`), **zero behavior change**.
> Organized by the 4 stacked slices (ASRM-R7). No production code written here — design only.

## 0. Architecture decisions (ADR-style, decision-first)

### ADR-D1 — Propagation idiom: `isErr()` guard, no `unwrapResultOrThrow`

Every migrated `execute` returns `Promise<Result<T, Union>>`. Private auth helpers that today
`throw ForbiddenError` become `Result`-returning and are propagated with the project guard:

```ts
const check = await this.checkDoor2(...);
if (check.isErr()) return err(check.unwrapErr());
```

Controller boundary uniformly adopts:

```ts
const result = await this.someUC.execute({ ... });
if (result.isErr()) throw result.unwrapErr();
return { data: <map>(result.unwrap()) };
```

**Rejected**: `unwrapResultOrThrow` — that helper exists for `ApplicationError | PdfError` unions
(reporting). Here every union member is a pure `DomainError`, so the plain `isErr()/unwrapErr()`
idiom (attendance-type precedent) is correct and lighter. No new helper (YAGNI).

### ADR-D2 — `ForbiddenError` stays `DomainError` (ASRM-R3)

All 22 `ForbiddenError` become `err(new ForbiddenError(...))`, class and file untouched. `FORBIDDEN`→403
is already in `DOMAIN_STATUS`. Reclassification to `ApplicationError` is a deferred cross-cutting epic
(~19 files). This design does NOT touch `ForbiddenError`'s definition, `DOMAIN_STATUS`, or the filter.

### ADR-D3 — `assertCourseCycleExists` → shared `Result`-returning helper (RESOLVED)

**Decision: keep it shared, convert it to return `Promise<Result<void, NotFoundError>>`.** All 3
month-status use-cases (Get/Open/Close) call it identically and propagate identically. Inlining would
triple ~8 lines of `TenantContext` + `findUnique` boilerplate across 3 methods for zero benefit —
anti-DRY. Precedent: the `validateTeacherLevel` shared helper migrated the same way in
`materia-grupo-ciclo-result-migration` slice B. Resulting shape:

```ts
async function assertCourseCycleExists(
  courseCycleId: string,
): Promise<Result<void, NotFoundError>> {
  const client = TenantContext.getClient();
  if (!client) return err(new NotFoundError('CourseCycle', courseCycleId));
  const cc = await client.courseCycle.findUnique({
    where: { uuid: courseCycleId },
    select: { uuid: true },
  });
  if (!cc) return err(new NotFoundError('CourseCycle', courseCycleId));
  return ok(undefined);
}
```

Each of the 3 callers propagates:

```ts
const guard = await assertCourseCycleExists(courseCycleId);
if (guard.isErr()) return err(guard.unwrapErr());
```

**Rejected — inline per use-case**: duplicates the tenant-client guard 3×, contradicts the established
shared-helper precedent, no benefit.

### ADR-D4 — Atomic unit = use-case + its tests + its controller endpoint(s) + controller tests

Because `Result` changes the SUCCESS return shape (not only the error path), the controller call-site
MUST migrate in the SAME slice as its use-case. This drives the 4-slice cut (ASRM-R7).

### Import delta (all 6 files)

Each use-case adds `ok, err` (value) and `Result` (type) from `@educandow/domain`. `generate-monthly`
already imports all three. List files today import only `ForbiddenError` + repo types → add the three.

---

## Slice 1 — list pair (branch `refactor/asistencia-result-a` from `main`)

9 `ForbiddenError` throws. Confirmed array element types by reading: `EnrichedGeneralAttendance[]`
and `EnrichedMateriaAttendance[]` (both `type` imports already present).

### `list-general-attendance.use-case.ts` (4 ForbiddenError → err)

New signature:
```ts
async execute(
  input: ListGeneralAttendanceInput,
): Promise<Result<EnrichedGeneralAttendance[], ForbiddenError>>
```

Body:
```ts
const scope = resolveAccessScope({ roles: userRoles });
if (!scope.isAdministrative) {
  const check = await this.checkDoor2(courseCycleId, userId);
  if (check.isErr()) return err(check.unwrapErr());
}
const rows = await this.generalRepo.findByScopeAndMonthEnriched(courseCycleId, year, month, undefined);
return ok(rows);
```

`checkDoor2` → `Promise<Result<void, ForbiddenError>>`; the 4 throws map 1:1:

| Line | Today | After |
|---|---|---|
| 56 | `throw new ForbiddenError('Tenant context unavailable')` | `return err(new ForbiddenError('Tenant context unavailable'))` |
| 64 | `throw new ForbiddenError('CourseCycle not found — authorization failed')` | `return err(new ForbiddenError(...))` |
| 69 | `throw new ForbiddenError('User is not a DocenteXCiclo in this cycle')` | `return err(new ForbiddenError(...))` |
| 74 | `throw new ForbiddenError('User is not a preceptor for this CursoXCiclo')` | `return err(new ForbiddenError(...))` |

Final line of `checkDoor2`: `return ok(undefined);`

### `list-subject-attendance.use-case.ts` (5 ForbiddenError → err)

New signature:
```ts
async execute(
  input: ListSubjectAttendanceInput,
): Promise<Result<EnrichedMateriaAttendance[], ForbiddenError>>
```

Same structure. `checkDoor2` → `Promise<Result<void, ForbiddenError>>`, throws at lines 70, 79, 87,
92, 97 → `return err(...)`, ends `return ok(undefined)`. Execute wraps: `return ok(rows)`.
The `grupoId` filter block (studentIds resolution) is unchanged — it never throws.

### Controller — Slice 1 endpoints (2): `listGeneral`, `listSubject`

**`listGeneral`** (lines 132-154) — before has try/catch (ForbiddenError→ForbiddenException):
```ts
// AFTER
const result = await this.listGeneralUC.execute({ courseCycleId: ccId, year: query.year, month: query.month, userId: user.userId, userRoles: user.roles });
if (result.isErr()) throw result.unwrapErr();
return { data: result.unwrap().map((e) => this.toGeneralResponse(e.attendance, e.studentName)) };
```
The `try { ... } catch (err) { if (err instanceof ForbiddenError) throw new ForbiddenException(...) }` block is DELETED.

**`listSubject`** (lines 194-217) — identical pattern; try/catch DELETED:
```ts
const result = await this.listSubjectUC.execute({ materiaXCursoXCicloId: materiaId, year: query.year, month: query.month, grupoId: query.grupoId, userId: user.userId, userRoles: user.roles });
if (result.isErr()) throw result.unwrapErr();
return { data: result.unwrap().map((e) => this.toMateriaResponse(e.attendance, e.studentName)) };
```

### Test plan — Slice 1 (refactor-style, no status RED-first)

- **`__tests__/list-general-attendance.use-case.test.ts`** (LGA-T01..T04):
  - Success (T01/T02/T04): `const result = await uc.execute(...)` then `result` is now a `Result`.
    `expect(result).toHaveLength(3)` → `expect(result.unwrap()).toHaveLength(3)`;
    `expect(result[0])...` → `expect(result.unwrap()[0])...`; `expect(result).toEqual([])` →
    `expect(result.unwrap()).toEqual([])`. Add `isOk()` assertion where clear.
  - Error (T03): `await expect(uc.execute(...)).rejects.toBeInstanceOf(ForbiddenError)` →
    `const result = await uc.execute(...); expect(result.isErr()).toBe(true); expect(result.unwrapErr()).toBeInstanceOf(ForbiddenError)`.
  - Import add: `ok`/nothing needed for reading; keep `ForbiddenError`.
- **`__tests__/list-subject-attendance.use-case.test.ts`**: same pattern for its LSA-T* (success + the
  5-Forbidden error paths).
- **Controller test** (`__tests__/asistencia.controller.test.ts`) — Slice-1 portion only:
  - Factory `makeController` default mocks: `listGeneralUC` `mockResolvedValue([makeEnrichedGeneral()])`
    → `mockResolvedValue(ok([makeEnrichedGeneral()]))`; same for `listSubjectUC`. (`ok` already imported.)
  - CTR-T03, CTR-T07, CTR-T08 (success): mocks now wrapped in `ok(...)`; endpoint maps `result.unwrap()`.
  - **CTR-T04 (identity rewrite #1)**: `execute: vi.fn().mockRejectedValue(new ForbiddenError('no access'))`
    + `.rejects.toBeInstanceOf(ForbiddenException)` → `execute: vi.fn().mockResolvedValue(err(new ForbiddenError('no access')))`
    + `.rejects.toBeInstanceOf(ForbiddenError)`. Add `err` to the domain import. 403 unchanged.

**Shared-file note**: this slice only touches the `listGeneralUC`/`listSubjectUC` factory defaults and
CTR-T03/T04/T07/T08. Record/generate/estado defaults and tests are untouched → file stays green.

---

## Slice 2 — record-general (branch `-b` from `-a`)

`record-general-attendance-day.use-case.ts` — 11 throws. Current return
`Promise<AsistenciaXAlumnoXCursoXCiclo>`.

New signature:
```ts
async execute(
  input: RecordGeneralAttendanceDayInput,
): Promise<Result<
  AsistenciaXAlumnoXCursoXCiclo,
  ForbiddenError | MonthClosedError | NotFoundError | ValidationError | DayNotAssignableError | StatusNotAssignableError
>>
```

Throw → err map (exact lines):

| Line | Class | After |
|---|---|---|
| 80 | `MonthClosedError` | `return err(new MonthClosedError(courseCycleId, year, month))` |
| 86 | `NotFoundError` | `return err(new NotFoundError('AsistenciaXAlumnoXCursoXCiclo', ...))` |
| 91 | `ValidationError` | `return err(new ValidationError('day must be an integer between 1 and 31'))` |
| 97 | `DayNotAssignableError` | `return err(new DayNotAssignableError(...))` |
| 105 | `DayNotAssignableError` | `return err(new DayNotAssignableError(...))` |
| 114 | `ValidationError` | `return err(new ValidationError(...))` |
| 121 | `StatusNotAssignableError` | `return err(new StatusNotAssignableError(...))` |
| 131 | `ForbiddenError` (checkDoor2) | `return err(...)` |
| 140 | `ForbiddenError` (checkDoor2) | `return err(...)` |
| 145 | `ForbiddenError` (checkDoor2) | `return err(...)` |
| 150 | `ForbiddenError` (checkDoor2) | `return err(...)` |

`checkDoor2` → `Promise<Result<void, ForbiddenError>>`, ends `return ok(undefined)`. Execute:
```ts
if (!scope.isAdministrative) {
  const check = await this.checkDoor2(courseCycleId, userId);
  if (check.isErr()) return err(check.unwrapErr());
}
```
Final success line 125 `return this.generalRepo.setDay(...)` → `return ok(await this.generalRepo.setDay(row.id.get(), day, statusCode))`.

### Controller — Slice 2 endpoint (1): `recordGeneralDay` (lines 161-186)

```ts
const result = await this.recordGeneralUC.execute({ courseCycleId: ccId, studentId: body.studentId, year: body.year, month: body.month, day: body.day, statusCode: body.statusCode, userId: user.userId, userRoles: user.roles });
if (result.isErr()) throw result.unwrapErr();
return { data: this.toGeneralResponse(result.unwrap(), '') };
```
try/catch DELETED.

### Test plan — Slice 2

- **`__tests__/record-general-attendance-day.use-case.test.ts`**: rewrite every `it` — success
  (`expect(await uc.execute()).toEqual(row)` → `.unwrap()` / `isOk()`), and each error branch
  (`.rejects.toBeInstanceOf(MonthClosedError | NotFoundError | ValidationError | DayNotAssignableError | StatusNotAssignableError | ForbiddenError)`
  → `const r = await uc.execute(...); expect(r.isErr()).toBe(true); expect(r.unwrapErr()).toBeInstanceOf(...)`).
- **Controller test** — Slice-2 portion: factory default `recordGeneralUC` `mockResolvedValue(makeGeneralRow())`
  → `mockResolvedValue(ok(makeGeneralRow()))`. CTR-T05 (studentName '') uses `result.unwrap()`.
  **CTR-T06 (identity rewrite #2)**: `mockRejectedValue(new ForbiddenError('preceptor only'))`
  + `.rejects.toBeInstanceOf(ForbiddenException)` → `mockResolvedValue(err(new ForbiddenError('preceptor only')))`
  + `.rejects.toBeInstanceOf(ForbiddenError)`.

**Shared-file note**: touches only the `recordGeneralUC` default + CTR-T05/T06. Slice-1 changes stay green.

---

## Slice 3 — record-subject (branch `-c` from `-b`, the largest)

`record-subject-attendance-day.use-case.ts` — 15 throws. Current return
`Promise<AsistenciaXMateriaXAlumnoXCursoXCiclo>`.

New signature (identical error union to record-general — same 6 classes):
```ts
async execute(
  input: RecordSubjectAttendanceDayInput,
): Promise<Result<
  AsistenciaXMateriaXAlumnoXCursoXCiclo,
  ForbiddenError | MonthClosedError | NotFoundError | ValidationError | DayNotAssignableError | StatusNotAssignableError
>>
```

Throw → err map:

| Line | Class | Location |
|---|---|---|
| 88 | `MonthClosedError` | execute body |
| 94 | `NotFoundError` | execute body |
| 102 | `ValidationError` | execute body |
| 108 | `DayNotAssignableError` | execute body |
| 116 | `DayNotAssignableError` | execute body |
| 125 | `ValidationError` | execute body |
| 132 | `StatusNotAssignableError` | execute body |
| 147, 156, 165, 171, 178, 184 | `ForbiddenError` (×6) | `checkDoor2` |
| 197 | `ForbiddenError` | `resolveCourseCycleId` |
| 204 | `NotFoundError` | `resolveCourseCycleId` |

**Helper return-type change** (the tricky part — both helpers return the resolved `courseCycleId`):
- `checkDoor2(...)` → `Promise<Result<string, ForbiddenError>>`; each throw → `return err(...)`;
  final `return ok(materia.courseCycleId)`.
- `resolveCourseCycleId(...)` → `Promise<Result<string, ForbiddenError | NotFoundError>>`;
  line 197 → `return err(new ForbiddenError('Tenant context unavailable'))`, line 204 →
  `return err(new NotFoundError('MateriaXCursoXCiclo', materiaXCursoXCicloId))`;
  final `return ok(materia.courseCycleId)`.

Execute wiring (both branches yield a `Result<string, ...>`):
```ts
const scope = resolveAccessScope({ roles: userRoles });
const ccResult = scope.isAdministrative
  ? await this.resolveCourseCycleId(materiaXCursoXCicloId)
  : await this.checkDoor2(materiaXCursoXCicloId, studentId, userId);
if (ccResult.isErr()) return err(ccResult.unwrapErr());
const courseCycleId = ccResult.unwrap();
```
Final success line 136 → `return ok(await this.materiaAsistRepo.setDay(row.id.get(), day, statusCode))`.

### Controller — Slice 3 endpoint (1): `recordSubjectDay` (lines 224-249)

```ts
const result = await this.recordSubjectUC.execute({ materiaXCursoXCicloId: materiaId, studentId: body.studentId, year: body.year, month: body.month, day: body.day, statusCode: body.statusCode, userId: user.userId, userRoles: user.roles });
if (result.isErr()) throw result.unwrapErr();
return { data: this.toMateriaResponse(result.unwrap(), '') };
```
try/catch DELETED.

### Test plan — Slice 3

- **`__tests__/record-subject-attendance-day.use-case.test.ts`**: same dual rewrite as Slice 2 across
  the (largest) set of branches, including both Door-2 (`checkDoor2`, 6 Forbidden) and admin-bypass
  (`resolveCourseCycleId`, Forbidden + NotFound) paths.
- **Controller test** — Slice-3 portion: factory default `recordSubjectUC` `mockResolvedValue(makeMateriaRow())`
  → `mockResolvedValue(ok(makeMateriaRow()))`. CTR-T09 uses `result.unwrap()`. **CTR-T10**
  (non-Forbidden propagates): mock changes `mockRejectedValue(domainError)` →
  `mockResolvedValue(err(domainError))`; assertion `.rejects.toBe(domainError)` stays valid
  (`unwrapErr()` re-throws the same instance). No `ForbiddenException` in T10 → NOT one of the 3 identity rewrites.

**Shared-file note**: touches only `recordSubjectUC` default + CTR-T09/T10. Earlier slices stay green.

---

## Slice 4 — generate + month-status (branch `-d` from `-c`)

### `generate-monthly-attendance.use-case.ts` — union widening (4 legacy throws)

Already `Result`-returning: `Promise<Result<GenerationResult, PresenteTypeNotFoundError>>`, mixing
`ok`/`err` with 4 remaining legacy throws. Widen the union and convert the 4 throws:

New signature:
```ts
async execute(
  input: GenerateMonthlyAttendanceInput,
): Promise<Result<
  GenerationResult,
  PresenteTypeNotFoundError | ForbiddenError | NotFoundError | PreviousMonthOpenError
>>
```

| Line | Class | After |
|---|---|---|
| 105 | `ForbiddenError` (non-admin gate) | `return err(new ForbiddenError('Monthly attendance generation requires an administrative role (D3)'))` |
| 111 | `ForbiddenError` (no tenant client) | `return err(new ForbiddenError('Tenant context unavailable'))` |
| 118 | `NotFoundError` (CC not found) | `return err(new NotFoundError('CourseCycle', courseCycleId))` |
| 125 | `PreviousMonthOpenError` | `return err(new PreviousMonthOpenError(courseCycleId, year, month))` |

The existing `ok(...)` returns (lines 144, 213) and the `err(PresenteTypeNotFoundError)` (line 166)
are unchanged. Imports already present.

### `attendance-month-status.use-cases.ts` — 3 use-cases + helper

`assertCourseCycleExists` → `Result`-returning per **ADR-D3**. The 3 use-cases change signature to
`Promise<Result<AttendanceMonthStatusResult, NotFoundError>>` and propagate the helper:

```ts
// Get / Close / Open — same head:
const guard = await assertCourseCycleExists(courseCycleId);
if (guard.isErr()) return err(guard.unwrapErr());
// ...existing logic unchanged...
return ok(toResult(status));   // Get default-open branch → return ok({ ...closed:false })
```

`toResult` / `AttendanceMonthStatus` logic unchanged; only the return channel wraps in `ok(...)`.
Imports add `ok, err, Result` to the file. Note: these 3 have NO other throws — only the shared helper.

### Controller — Slice 4 endpoints (3): `generateMonthly`, `getMonthStatus`, `setMonthStatus`

**`generateMonthly`** (lines 99-125) — today wraps `result.unwrap()` in try/catch. Now ALL errors are
in the Result channel → replace with the guard, DELETE try/catch:
```ts
const result = await this.generateMonthlyUC.execute({ courseCycleId: ccId, year: body.year, month: body.month, userId: user.userId, userRoles: user.roles });
if (result.isErr()) throw result.unwrapErr();
return { data: result.unwrap() };
```

**`getMonthStatus`** (lines 256-268) — **no try/catch today** (gains `isErr`):
```ts
const result = await this.getMonthStatusUC.execute({ courseCycleId: ccId, year: query.year, month: query.month });
if (result.isErr()) throw result.unwrapErr();
return { data: this.toStatusResponse(result.unwrap()) };
```

**`setMonthStatus`** (lines 276-288) — **no try/catch today** (gains `isErr`); both branches now
return `Result`:
```ts
const input = { courseCycleId: ccId, year: body.year, month: body.month, userId: user.userId };
const result = body.status === 'CLOSED'
  ? await this.closeMonthUC.execute(input)
  : await this.openMonthUC.execute(input);
if (result.isErr()) throw result.unwrapErr();
return { data: this.toStatusResponse(result.unwrap()) };
```

**Import cleanup**: after Slice 4, `ForbiddenException` and `ForbiddenError` imports in the controller
become unused (all 5 try/catch blocks removed across slices 1-4) → remove both from the import block.
This is the final dead-code sweep; it MUST land in Slice 4 (the last slice) so no earlier slice breaks
on a still-referenced import.

### Test plan — Slice 4

- **`__tests__/generate-monthly-attendance.use-case.test.ts`**: success paths already use
  `.unwrap()`/`isOk()` (lines 203/262/283/532/551) — untouched. Convert the 4 legacy error asserts:
  lines ~174, 181 (`.rejects.toBeInstanceOf(ForbiddenError)`), ~190 (`NotFoundError`), ~314
  (`PreviousMonthOpenError`) → `const r = await uc.execute(...); expect(r.isErr()).toBe(true); expect(r.unwrapErr()).toBeInstanceOf(...)`.
  The `PresenteTypeNotFoundError` Result assert (489/490) is already correct.
- **`__tests__/attendance-month-status.use-cases.test.ts`**: rewrite Get/Open/Close success
  (`expect(await uc.execute()).toEqual(...)` → `.unwrap()`) and the CC-not-found error path
  (`.rejects.toBeInstanceOf(NotFoundError)` → `isErr()`/`unwrapErr()`).
- **Controller test** — Slice-4 portion + final green:
  - `generateMonthlyUC` default already `ok(generationCounts)` — unchanged. CTR-T01 success stays.
  - **CTR-T02 (identity rewrite #3)**: `mockRejectedValue(new ForbiddenError('not allowed'))`
    + `.rejects.toBeInstanceOf(ForbiddenException)` → `mockResolvedValue(err(new ForbiddenError('not allowed')))`
    + `.rejects.toBeInstanceOf(ForbiddenError)`.
  - CTR-T13 (`PresenteTypeNotFoundError` Result err) already correct.
  - `getMonthStatusUC`/`openMonthUC`/`closeMonthUC` defaults `mockResolvedValue(make*StatusResult())`
    → `mockResolvedValue(ok(make*StatusResult()))`; CTR-T11/T12 use `result.unwrap()`.
  - After this slice, `ForbiddenException` import may be removable from the test file iff no remaining
    assertion references it (all 3 identity rewrites now assert `ForbiddenError`). Verify and drop.

**Shared-file note (last slice)**: Slice 4 is the LAST to touch the controller test file and MUST leave
the WHOLE file green — by now all 8 factory defaults are `ok(...)` and CTR-T02/T04/T06 all assert
`ForbiddenError` (the 3 identity rewrites), CTR-T10 asserts the same domain instance via `unwrapErr()`.

---

## Stacked-PR mechanics

```
main
 └─ refactor/asistencia-result-a   (Slice 1 — list pair)
     └─ refactor/asistencia-result-b   (Slice 2 — record-general)   [-b from -a]
         └─ refactor/asistencia-result-c   (Slice 3 — record-subject)   [-c from -b]
             └─ refactor/asistencia-result-d   (Slice 4 — generate + month-status)   [-d from -c]
```

Each PR targets its predecessor. Precondition: `attendance-type-result-migration` merged to `main`,
no active changes. Conventional commits, NO AI attribution.

### Per-slice commit plan (work-unit commits)

Each slice is ONE atomic work unit but split into readable conventional commits:

- **Slice 1**: `refactor(asistencia): return Result from list-general/list-subject use-cases` ·
  `refactor(asistencia): consume list Result in controller, drop redundant try/catch` ·
  `test(asistencia): migrate list use-case + controller tests to Result shape`
- **Slice 2**: `refactor(asistencia): return Result from record-general use-case` ·
  `refactor(asistencia): consume record-general Result in controller` ·
  `test(asistencia): migrate record-general tests to Result shape`
- **Slice 3**: `refactor(asistencia): return Result from record-subject use-case (both auth paths)` ·
  `refactor(asistencia): consume record-subject Result in controller` ·
  `test(asistencia): migrate record-subject tests to Result shape`
- **Slice 4**: `refactor(asistencia): widen generate-monthly union, convert 4 legacy throws` ·
  `refactor(asistencia): Result-return month-status use-cases + assertCourseCycleExists helper` ·
  `refactor(asistencia): finish controller Result idiom, remove dead ForbiddenException/ForbiddenError imports` ·
  `test(asistencia): migrate generate + month-status + controller tests; final green`

### Per-slice line estimate (diff lines, + and -)

| Slice | Prod | Tests | Total (est.) | 400 risk |
|---|---|---|---|---|
| 1 — list pair | ~55 (2 UC + 2 endpoints) | ~90 (2 UC tests + controller subset) | **~140-180** | Low |
| 2 — record-general | ~50 | ~180-230 (branch-heavy test) | **~240-300** | Moderate |
| 3 — record-subject | ~65 (2 helpers + execute) | ~230-300 (most branches) | **~300-380** | **High** |
| 4 — generate + month-status | ~70 (widen + 3 UC + helper + 3 endpoints) | ~180-230 | **~250-300** | Moderate |
| **Aggregate** | ~240 | ~700-990 | **~950-1160** | — |

### PR1 (list pair) sizing verdict

**PR1 does NOT need splitting.** The two list use-cases are the smallest (77 + 100 prod lines, ~55 diff
lines total), their test files are ~140-150 lines with only assertion/success-shape edits (~90 diff),
and the controller touches 2 endpoints (~30 diff) + 4 CTR tests. Best estimate **~140-180 diff lines —
comfortably under 400**. The proposal's "may roze 400" caveat was conservative; the real success-shape
rewrite for lists is thin (`.map` moved behind one `.unwrap()`). **Keep the list pair together.** If the
real diff surprises, the natural split is list-general alone / list-subject alone (each ~70-90 lines),
but I do NOT recommend pre-splitting.

**Highest 400-risk is Slice 3 (record-subject)**, not PR1 — 15 throws, 2 helpers returning the resolved
id, and the largest branch-per-`it` test set. If any slice needs `size:exception` or a further split, it
is Slice 3. `sdd-tasks` should re-forecast Slice 3 against the real test file line count.

---

## Review Workload Forecast

| Slice | Est. diff | Chained PRs | 400-budget risk | Decision before apply |
|---|---|---|---|---|
| 1 — list pair | ~140-180 | Yes (base of stack) | Low | No |
| 2 — record-general | ~240-300 | Yes (on PR1) | Moderate | No |
| 3 — record-subject | ~300-380 | Yes (on PR2) | **High** | **Yes** (watch 400; possible `size:exception` or split) |
| 4 — generate + month-status | ~250-300 | Yes (on PR3) | Moderate | No |
| **Aggregate** | **~950-1160** | **Yes (4 stacked)** | **High** | **Yes** |

- **Chained PRs recommended: Yes** (4 stacked, each independently green).
- **400-line budget risk: High** at aggregate; per-slice only Slice 3 is High.
- **Decision needed before apply: Yes** — confirm the stacked-PR strategy and pre-clear Slice 3's
  possible `size:exception`.

## Traceability

Design ↔ spec: ADR-D1→ASRM-R1/R5, ADR-D2→ASRM-R3/R6, ADR-D3→ASRM-R4 (month-status), ADR-D4→ASRM-R7,
signatures→ASRM-R4, controller idiom→ASRM-R5, status preservation→ASRM-R2 (no `DOMAIN_STATUS` edit).
