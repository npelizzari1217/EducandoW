# Design — course-cycle-result-migration

> SDD design (HOW at architecture level). Store: hybrid. Consumer of the archived
> `application-error-handling` capability. Scope locked (Option A) — this is the concrete
> implementation design, verified by reading the actual code, not re-deciding scope.

## Decision summary (read this first)

| # | Question | Decision |
|---|---|---|
| 1 | `VALIDATION_ERROR` → HTTP status | **400** (present in `DOMAIN_STATUS`, line 12). Bug tests assert `400`. |
| 2 | `buildLevel` return type | `Result<Level, ValidationError>`; on double-fail return the **original** `err` from the string attempt. |
| 3 | `buildBimonthPeriod` return type | `Result<BimonthPeriod \| null, ValidationError>`; missing dates → `ok(null)` (NOT an error). |
| 4 | `DeleteCourseCycleUseCase` inactive-cycle | **Option A — predicate check** on the existing `cc.active` getter, return `err(new CourseCycleClosedError(uuid))`. No try/catch-as-flow. Keeps 409. |
| 5 | `ListStudentsByCourseCycleUC` | `Promise<Result<EnrolledStudent[], Error>>`; rewrite JSDoc (drop "Throws"). |
| 6 | `GenerateCourseCyclesUseCase` | `Promise<Result<CreateManyResult, Error>>`; migrate ONLY the 3 top-level guards; loop internals unchanged. |
| 7 | `Level.fromParts` | one-line: bare `Error` → `ValidationError`. Signature `: Level` unchanged. `ValidationError` already imported (line 2). |
| 8 | Controller `delete`/`listStudents`/`generate` | adopt `if (result.isErr()) throw result.unwrapErr();`. |
| 9 | New error classes | **Zero.** Reuse catalog only. |

Net effect: 3 real HTTP **500 → 400** corrections + 5 mechanical throw→Result migrations, one PR, ~200-260 lines, fully retrocompatible (domain signature preserved).

---

## 1. Filter mapping — VERIFIED

`api/src/presentation/shared/filters/exception.filter.ts` line 12:

```
VALIDATION_ERROR: 400,
```

The `DomainError` branch (line 95-98) resolves `DOMAIN_STATUS[exception.code] ?? BAD_REQUEST`.
`ValidationError.code === 'VALIDATION_ERROR'` → **HTTP 400**. It is explicitly in the map, so it
does NOT hit the `?? BAD_REQUEST` default (which is also 400 — belt and suspenders). Every bug test
in this change asserts **400**, not 422.

Ordering is safe: `ApplicationError` branch (91) precedes `DomainError` branch (95) precedes the
untyped `instanceof Error` fallback (99, leaves status at the 500 default). Today the helpers throw a
bare `Error` → they land on line 99 → **500**. After migration they surface a `ValidationError`
(a `DomainError`) → line 95 → **400**. This is the entire bug mechanism.

---

## 2. Helper signatures

### `buildLevel` — `Result<Level, ValidationError>`

The numeric fallback must compose so that when BOTH the string attempt and the numeric-code attempt
fail, we return the **original** `ValidationError` produced by `Level.create(levelStr)` (its message
`Invalid pedagogical level: "..."` is the user-facing one). `Level.create` is a `Result`, so the
err-state value can be returned directly.

```ts
function buildLevel(levelStr: string): Result<Level, ValidationError> {
  const primary = Level.create(levelStr);
  if (primary.isOk()) return primary;

  // Fallback: retry by numeric code (Level.create already parses numeric strings,
  // but this preserves the historical defensive retry for edge inputs).
  const numeric = parseInt(levelStr, 10);
  if (!isNaN(numeric)) {
    const fallback = Level.create(numeric);
    if (fallback.isOk()) return fallback;
  }

  // Both attempts failed → propagate the ORIGINAL ValidationError (string-attempt message).
  return primary;
}
```

`return primary` in the err path is intentional: `primary` is a `Result<Level, ValidationError>`
already in err state, so it carries the original error without re-wrapping.

### `buildBimonthPeriod` — `Result<BimonthPeriod | null, ValidationError>`

`BimonthPeriod.create(start, end): Result<BimonthPeriod, ValidationError>` (verified: returns
`err(new ValidationError('End date must be after start date'))` when `end ≤ start`). The **missing
dates** case is a valid `ok(null)`, NOT an error.

```ts
function buildBimonthPeriod(
  startStr?: string,
  endStr?: string,
): Result<BimonthPeriod | null, ValidationError> {
  if (!startStr || !endStr) return ok(null);           // valid absence, not a failure
  const result = BimonthPeriod.create(new Date(startStr), new Date(endStr));
  if (result.isErr()) return err(result.unwrapErr());
  return ok(result.unwrap());
}
```

### Call-site propagation in `CreateCourseCycleUseCase` (current lines 135-159)

```ts
const courseName = CourseName.create(input.courseName);
if (courseName.isErr()) return err(courseName.unwrapErr());

const level = buildLevel(input.level);
if (level.isErr()) return err(level.unwrapErr());          // was: const level = buildLevel(...)  (threw 500)

const passingGrade = PassingGrade.create(input.passingGrade);
if (passingGrade.isErr()) return err(passingGrade.unwrapErr());

const firstBim = buildBimonthPeriod(input.firstBimonthStart, input.firstBimonthEnd);
if (firstBim.isErr()) return err(firstBim.unwrapErr());
const secondBim = buildBimonthPeriod(input.secondBimonthStart, input.secondBimonthEnd);
if (secondBim.isErr()) return err(secondBim.unwrapErr());
const thirdBim = buildBimonthPeriod(input.thirdBimonthStart, input.thirdBimonthEnd);
if (thirdBim.isErr()) return err(thirdBim.unwrapErr());
const fourthBim = buildBimonthPeriod(input.fourthBimonthStart, input.fourthBimonthEnd);
if (fourthBim.isErr()) return err(fourthBim.unwrapErr());

const cc = CourseCycle.create({
  ...,
  level: level.unwrap(),
  firstBimonth: firstBim.unwrap(),
  secondBimonth: secondBim.unwrap(),
  thirdBimonth: thirdBim.unwrap(),
  fourthBimonth: fourthBim.unwrap(),
});
```

### Call-site propagation in `UpdateCourseCycleUseCase` (current lines 200-214)

The 4 bimonth blocks are guarded by `if (start && end)`, so inside the block `unwrap()` is always a
`BimonthPeriod` (never null), assignable to `updateData.firstBimonth: BimonthPeriod | null`:

```ts
if (input.firstBimonthStart && input.firstBimonthEnd) {
  const bim = buildBimonthPeriod(input.firstBimonthStart, input.firstBimonthEnd);
  if (bim.isErr()) return err(bim.unwrapErr());
  updateData.firstBimonth = bim.unwrap();
}
// …identical shape for second / third / fourth bimonth (4 fields total)…
```

`Update` has no `buildLevel` call (level is immutable on update), so only the 4 bimonth blocks change.

---

## 3. `DeleteCourseCycleUseCase` — Option A (predicate check)

The `CourseCycle` entity exposes a **non-throwing** predicate: `get active(): boolean` (line 127).
`ensureActive()` (line 175-179) is only a throwing convenience wrapper over `!this.props.active`.
Reading `cc.active` and returning `err(...)` is cleaner than wrapping a throw in try/catch (which the
`application-error-handling` capability explicitly discourages — "Result propagation only").

Return type changes `Promise<void>` → `Promise<Result<void, Error>>`.

```ts
async execute(uuid: string): Promise<Result<void, Error>> {
  const cc = await this.courseCycleRepo.findByUuid(uuid);
  if (!cc) {
    return err(new CourseCycleNotFoundError(uuid));      // 404 (unchanged)
  }
  if (!cc.active) {
    return err(new CourseCycleClosedError(cc.uuid));     // 409 (was cc.ensureActive() throw)
  }
  await this.courseCycleRepo.softDelete(cc.uuid);
  return ok(undefined);
}
```

Requires adding `CourseCycleClosedError` to the `@educandow/domain` import list (already exported —
the existing test imports it from there). Trade-off noted: this re-expresses the `!active` invariant
in the use case rather than delegating to `ensureActive()`. Accepted — it is a one-boolean
orchestration guard, fully typed, and keeps the single-throw-boundary principle. `ensureActive()`
stays on the entity untouched (still used elsewhere if any; no signature change).

---

## 4. `ListStudentsByCourseCycleUC`

Return type `Promise<EnrolledStudent[]>` → `Promise<Result<EnrolledStudent[], Error>>`. Rewrite the
JSDoc that currently says "Throws CourseCycleNotFoundError":

```ts
/**
 * Returns enrolled students for the given CourseCycle.
 * Returns err(CourseCycleNotFoundError) (→ HTTP 404) if the cycle does not exist.
 * Returns ok([]) when the cycle exists but has no active enrollments (SBC-3).
 */
async execute(uuid: string): Promise<Result<EnrolledStudent[], Error>> {
  const cc = await this.repo.findByUuid(uuid);
  if (!cc) return err(new CourseCycleNotFoundError(uuid));
  return ok(await this.repo.findEnrolledStudents(uuid));
}
```

---

## 5. `GenerateCourseCyclesUseCase`

Return type `Promise<CreateManyResult>` → `Promise<Result<CreateManyResult, Error>>`. Migrate ONLY
the 3 top-level guards (current lines 314/317/326):

```ts
async execute(input: GenerateCourseCyclesInput): Promise<Result<CreateManyResult, Error>> {
  const cycle = await this.academicCycleRepo.findByUuid(input.cycleId);
  if (!cycle) {
    return err(new NotFoundError('AcademicCycle', input.cycleId));   // 404
  }
  if (!cycle.active) {
    return err(new AcademicCycleClosedError(input.cycleId));         // 409
  }
  // …plan resolution…
  if (input.studyPlanId) {
    const plan = await this.studyPlanRepo.findById(input.studyPlanId);
    if (!plan) {
      return err(new NotFoundError('StudyPlan', input.studyPlanId)); // 404
    }
    …
  }
  // …loop unchanged…
  return ok({ created, updated, total });
}
```

### Loop internals UNCHANGED (CCRM-R6 preserved)

The per-plan-course loop (`Level.fromParts`, `CourseName.create(...).unwrap()`,
`PassingGrade.create(6).unwrap()`) is **not** migrated — batch semantics are a product decision and
out of scope. After the `Level.fromParts` fix (§6), an invalid composite inside the loop now throws
**`ValidationError`** instead of bare `Error`.

**Coherence check — is a mid-loop throw escaping a `Result`-returning method acceptable?** Yes:

| Aspect | Behavior | Coherent? |
|---|---|---|
| Escape path | `Level.fromParts` throws → not caught in `execute` → propagates through `await` in controller `generate` → `AppExceptionFilter` | ✓ single throw boundary is the filter |
| Status | `ValidationError` (DomainError) → `DOMAIN_STATUS['VALIDATION_ERROR']` = **400**, was 500 | ✓ satisfies CCRM-R3 |
| Abort semantics | `Level.fromParts(planRef.level, planRef.modality)` uses **plan-level** codes; an invalid composite fails on the FIRST course of that plan, aborting the batch before further saves in that plan — identical to today (only status differs) | ✓ satisfies CCRM-R6 (abort-on-first-error, no continue-past-bad) |

Note the nuance: "all-or-nothing" here means **abort-the-batch**, not transactional rollback. With
multiple plans (studyPlanId absent), earlier plans may already be persisted when a later plan's
composite is invalid — but that is EXACTLY the pre-migration behavior; we change only 500→400. No
regression introduced. The `.unwrap()` on `CourseName`/`PassingGrade` remains throw-on-err (their
error is also `ValidationError` → also 400 if it ever fires); unchanged, still all-or-nothing.

---

## 6. `Level.fromParts` fix (domain package)

`packages/domain/src/institution/value-objects/level.ts` line 223. `ValidationError` is **already
imported** at line 2 (`import { ValidationError } from '../../shared/errors/validation-error';`) —
same package, zero new import.

```ts
// before
throw new Error(
  `Invalid level composite: ${composite} ...`,
);
// after
throw new ValidationError(
  `Invalid level composite: ${composite} ...`,
);
```

Signature `static fromParts(...): Level` **unchanged** — non-breaking for its 6+ callers.

### Infra reconstruction path — VERIFIED SAFE

`api/src/infrastructure/persistence/prisma/repositories/prisma-subject.repository.ts:62-80`
(`toDomain`) normalizes the composite **before** calling `fromParts`:

```ts
const baseLevel = r.level >= 10 ? Math.floor(r.level / 10) : r.level;   // line 68
return Subject.reconstruct({
  …
  level: Level.fromParts(baseLevel as EducationalLevelCode, modality as EducationalModalityCode),  // line 72
});
```

The comment (lines 65-67) explicitly documents this normalization so `fromParts` never receives an
invalid composite (e.g. `fromParts(20,0)=200`). The stricter `ValidationError` throw therefore does
NOT fire on the reconstruction path for well-formed rows — the only behavioral delta is the error
TYPE for genuinely-invalid inputs (which previously also threw, just a bare `Error`). Retrocompatible.

---

## 7. Controller changes (`course-cycle.controller.ts`)

Three endpoints, exact idiom insertion. The idiom already appears in 9/12 endpoints of this file
(e.g. `create` line 102, `get` line 203, `update` line 233).

### `listStudents` (current lines 208-212)

```ts
@Get(':uuid/students')
@Roles('ROOT', { module: 'COURSE_CYCLES', action: 'READ' })
async listStudents(@Param('uuid') uuid: string) {
  const result = await this.listStudentsUC.execute(uuid);
  if (result.isErr()) throw result.unwrapErr();
  return { data: result.unwrap() };
}
```

### `delete` (current lines 237-242) — 204, no body

The `@HttpCode(HttpStatus.NO_CONTENT)` decorator stays. The `isErr` check runs BEFORE the (void)
return; on ok the method simply returns nothing:

```ts
@Delete(':uuid')
@HttpCode(HttpStatus.NO_CONTENT)
@Roles('ROOT', { module: 'COURSE_CYCLES', action: 'DELETE' })
async delete(@Param('uuid') uuid: string) {
  const result = await this.deleteUC.execute(uuid);
  if (result.isErr()) throw result.unwrapErr();
  // ok path: return void → 204
}
```

### `generate` (current lines 260-269)

```ts
@Post('generate')
@Roles('ROOT', { module: 'COURSE_CYCLES', action: 'CREATE' })
async generate(@Body(new ZodValidationPipe(GenerateCourseCyclesSchema)) body: GenerateCourseCyclesDto) {
  const result = await this.generateUC.execute({
    level: body.level,
    cycleId: body.cycleId,
    studyPlanId: body.studyPlanId,
  });
  if (result.isErr()) throw result.unwrapErr();
  return { data: result.unwrap() };
}
```

---

## 8. Clean Architecture check

| Layer | Rule | This change |
|---|---|---|
| `domain` (`Level.fromParts`, `CourseCycle.ensureActive`) | throws `DomainError` (established pattern) | ✓ `Level.fromParts` throws `ValidationError` (a `DomainError`); entity unchanged |
| `application` (use cases + helpers) | returns `Result<T, E>`, no throw for expected failures | ✓ all 3 use cases + 2 helpers return `Result`; zero throw remains in `course-cycle.use-cases.ts` |
| `presentation` (controller) | single throw boundary via `if (isErr) throw unwrapErr()` | ✓ 3 endpoints adopt the idiom; filter is the only place a thrown error is caught |
| import direction | no upward imports | ✓ domain imports nothing from api; api imports domain via `@educandow/domain` |

The one deliberate exception is the `Generate` loop's `Level.fromParts` throw escaping through the
controller `await` to the filter — this is consistent with the domain-throws-DomainError pattern and
was pre-existing behavior (only the status is corrected). No new layer violation.

---

## 9. Test plan mapping (TDD strict — Vitest, `pnpm test`, coverage ≥ 80%)

Two work units. Bug scenarios are **RED-first** (no current coverage — genuine gap); mechanical ones
are status-preserving rewrites.

### File: `api/src/application/course-cycle/__tests__/course-cycle.use-cases.test.ts` (exists)

| Req | Scenario | Kind | Action |
|---|---|---|---|
| CCRM-R2 | `Create` invalid level → `err(ValidationError)` | RED-first (new) | add test; assert `isErr()` + `instanceof ValidationError` |
| CCRM-R2 | `Create` bimonth `end ≤ start` → `err(ValidationError)` | RED-first (new) | add test |
| CCRM-R2 | `Update` invalid bimonth `end ≤ start` → `err(ValidationError)` | RED-first (new) | add test |
| CCRM-R1/R5 | `Delete` on inactive cycle → `err(CourseCycleClosedError)` | mechanical rewrite | line 244-250: `.rejects.toThrow(CourseCycleClosedError)` → `isErr()` + `instanceof` |
| CCRM-R1/R5 | `Delete` success → `ok`, softDelete called | mechanical | line 235-242: assert `result.isOk()` still calls softDelete |
| CCRM-R1/R5 | `ListStudents` missing cycle → `err(CourseCycleNotFoundError)` | mechanical rewrite | line 356-362: `.rejects.toThrow(...)` → `isErr()` + `instanceof` |
| CCRM-R1/R5 | `ListStudents` success / empty → `ok([...])` / `ok([])` | mechanical | lines 336-375: unwrap the `Result` (`result.unwrap()`) before length/equality asserts |
| CCRM-R1/R5 | `Generate` StudyPlan/AcademicCycle not-found → `err(NotFoundError)` | mechanical rewrite | lines 683-698: `.rejects.toThrow(NotFoundError)` → `isErr()` + `instanceof` |
| CCRM-R1/R5 | `Generate` inactive AcademicCycle → `err(AcademicCycleClosedError)` | mechanical rewrite | lines 701-712 |
| CCRM-R6 | `Generate` all-or-nothing / success counts | mechanical | lines 482-668: unwrap `Result` (`(await …).unwrap().created`) — assertions on counts otherwise unchanged |
| CCRM-R3 | `Generate` invalid composite on generate path → surfaces `ValidationError` | RED-first (new) | plan with `level`/`modality` composing an invalid code (e.g. level=5) → `execute` throws `ValidationError` (loop escape); assert with `.rejects.toThrow(ValidationError)` |

### File: `packages/domain/src/institution/__tests__/value-objects/level.test.ts` (exists)

| Req | Scenario | Kind | Action |
|---|---|---|---|
| CCRM-R3 | `fromParts` invalid composite → throws `ValidationError` | RED-first (new) | add: `expect(() => Level.fromParts(5, 0)).toThrow(ValidationError)` (import `ValidationError`) |
| CCRM-R3 | `fromParts` valid composite still returns `Level` | regression (exists) | keep line 195-199 (`fromParts(PRIMARIO, TALLERES)` → 21) — proves signature `: Level` intact |

### File: `api/src/presentation/course-cycle/course-cycle.controller.spec.ts` (MISSING — new)

No dedicated spec covers `delete`/`generate`/`listStudents` today (existing specs cover
admin-subjects, teacher-filter, grading-phase only). Model the new spec on
`__tests__/grading-phase.controller.spec.ts` (same directory, same idiom).

| Req | Scenario | Kind |
|---|---|---|
| CCRM-R4 | `listStudents` err result → controller rethrows `CourseCycleNotFoundError` (→404) | new controller spec |
| CCRM-R4 | `delete` err result → controller rethrows `CourseCycleClosedError` (→409) / `CourseCycleNotFoundError` (→404); ok → void (204) | new controller spec |
| CCRM-R4 | `generate` err result → controller rethrows `NotFoundError`/`AcademicCycleClosedError`; ok → `{ data }` | new controller spec |

CCRM-R7 (no new error class, auth untouched) is verified by inspection, not a runtime test: the diff
must not add files under `api/src/application/shared/errors/`, `packages/domain/src/**/errors/`, or
the `auth` module.

---

## 10. Work unit / commit plan (one PR, < 400 lines)

`work-unit-commits`: tests co-located with the behavior; group into reviewable units under ONE PR.
Suggested commit order (RED-first units precede their fix):

| # | Commit (conventional) | Files | ~lines |
|---|---|---|---|
| 1 | `test(domain): RED fromParts invalid composite → ValidationError` | `level.test.ts` | ~10 |
| 2 | `fix(domain): Level.fromParts throws ValidationError not bare Error` | `level.ts` | ~1 |
| 3 | `test(course-cycle): RED invalid level / bimonth end≤start → 4xx` | `course-cycle.use-cases.test.ts` | ~40 |
| 4 | `fix(course-cycle): buildLevel/buildBimonthPeriod return Result (500→400)` | `course-cycle.use-cases.ts` (helpers + Create/Update call sites) | ~50 |
| 5 | `refactor(course-cycle): Delete/ListStudents/Generate return Result` | `course-cycle.use-cases.ts` + `course-cycle.use-cases.test.ts` rewrites | ~70 |
| 6 | `refactor(course-cycle): controller adopts if(isErr) throw unwrapErr for delete/listStudents/generate` | `course-cycle.controller.ts` | ~15 |
| 7 | `test(course-cycle): controller specs for delete/generate/listStudents` | `course-cycle.controller.spec.ts` (new) | ~90 |

Estimated total ≈ **275 lines** → single PR, no chained PRs, no `size:exception`. Rollback =
revert the PR (additive/idiom-swap; only observable change is the 3 intended 500→400 corrections;
no schema, no migration, domain signature preserved).

## Review Workload Forecast

- Estimated changed lines: **~275** (< 400 budget).
- Chained PRs recommended: **No**.
- 400-line budget risk: **Low**.
- Decision needed before apply: **No**.

## Open risks / assumptions

1. **Coverage-gap regressions are RED-first**: no existing test asserts 500 for these inputs, so
   there is nothing to "flip". The RED step asserts the *target* 400/ValidationError and must fail
   BEFORE the fix commit lands (verify the failing run).
2. **`cc.active` predicate vs `ensureActive()`**: Option A re-expresses the `!active` guard in the
   use case. If a reviewer prefers zero duplication, the fallback is a local try/catch around
   `ensureActive()` — same 409, slightly less clean. Decision stands on Option A.
3. **`Generate` mid-loop throw**: intentionally left as a throw (batch semantics out of scope). If a
   future reviewer expects `Generate` to be 100% throw-free, point them to CCRM-R6 and the follow-up.
</content>
</invoke>
