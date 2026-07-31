# Design — course-cycle-alumnos-result-migration

> Architecture-level HOW for migrating the 5 `AlumnosXCurso` use-cases from
> `throw` to `Result<T, Error>` and bridging the entity throw
> `PaseFechaInvalidaError`. Verified by reading the real code (paths confirmed:
> the use-cases live in `api/src/application/course-cycle/`, NOT
> `.../alumnos-x-curso-x-ciclo/`). Zero new classes, zero new `DOMAIN_STATUS`
> entries, zero status changes.

## Decision summary (decision-first)

| # | Decision | Rationale |
|---|---|---|
| D1 | Return `Result<T, Error>` from all 5 use-cases; every `throw new XError()` becomes `return err(new XError())` | Consumes `application-error-handling` "No throw in application/". Widest error type `Error` matches the archived `course-cycle-result-migration` precedent (controllers only `unwrapErr()` + re-throw). |
| D2 | Import `ok, err, Result` from `@educandow/domain` (verbatim, same barrel as `attendance-type.use-cases.ts:3`) | The Result monad ships from the domain barrel. No infra dependency. |
| D3 | Bridge `PaseFechaInvalidaError` with a single `try/catch` around the register/revert block in `RegistrarPaseUseCase`, `return err(e as PaseFechaInvalidaError)` | Mirrors `attendance-type.use-cases.ts:102-106`. The invariant lives inside the aggregate (`student.registrarPase`), so it cannot be flattened to `if/return err` like the other 10. |
| D4 | Only `student.registrarPase(fecha)` throws; `student.revertirPase()` does NOT | Verified `packages/domain/src/personnel/entities/student.ts:138-145`: `registrarPase` throws on `fecha > new Date()`; `revertirPase` only sets `undefined`. The `try` still wraps both branches (single catch) so the register branch is protected and both success paths land on one `ok(undefined)`. |
| D5 | Controller: insert `if (result.isErr()) throw result.unwrapErr();` on the 5 in-scope endpoints, unwrap AFTER the guard. Inline idiom — do NOT reuse `unwrap-result-or-throw.ts` | The PDF helper is typed to `Result<T, PdfError>`; generalizing it is out-of-scope YAGNI. Inline is the established `course-cycle.controller.ts` precedent (12 call sites). |
| D6 | Zero `DOMAIN_STATUS` changes | Pre-verified in `api/src/presentation/shared/filters/exception.filter.ts`: `NOT_FOUND: 404` (l.11), `PASE_FECHA_INVALIDA: 400` (l.51), `STUDENT_HAS_PASE: 409` (l.52). All three already mapped. |
| D7 | No module / DI change | Constructor signatures are byte-identical; only method return types change. `alumnos-x-curso-x-ciclo.module.ts` untouched. |
| D8 | `togglePrintable` gets 3 NEW controller-spec tests, RED-first | Genuine coverage gap (CCAM-R7): the endpoint has zero controller-spec tests today. |

## Architecture / layering (Clean Architecture check)

```
presentation (controller)   ← SINGLE throw boundary: `if (isErr) throw unwrapErr()`
        ↑ Result<T, Error>
application (5 use-cases)    ← returns Result; ONE bridge catches the entity throw (D3)
        ↑ throw (entity invariant)
domain (Student.registrarPase) ← keeps throwing DomainError (unchanged)
```

- **No layer violation.** Domain stays throw-based (its invariant API is unchanged). Application is the adapter: it returns `Result` and, in exactly one place, catches the domain throw and re-expresses it as `err(...)`. Presentation is the only place a throw re-enters the framework, where `AppExceptionFilter` maps `DomainError.code → HTTP status`.
- **The bridge is justified, not a smell.** The entity API (`student.registrarPase`) is throw-based by design (aggregate invariant). The use-case is the correct seam to adapt throw→Result — identical to the `attendance-type` precedent (`entity.assertMutable()` wrapped in try/catch). Application never re-throws; it only translates.
- No upward imports introduced. `ok/err/Result` come from the domain barrel (already an application dependency).

---

## 1. Per-use-case migration

Shared import edit for every file (add `ok, err, Result` to the existing `@educandow/domain` import; keep the error classes already imported):

```ts
import { ok, err, Result /*, existing error classes */ } from '@educandow/domain';
```

### 1.1 `AddStudentToCourseCycleUseCase` — `add-student-to-course-cycle.use-case.ts`

Signature: `Promise<AlumnosXCursoXCiclo>` → `Promise<Result<AlumnosXCursoXCiclo, Error>>`.

```ts
async execute(input: {
  courseCycleId: string;
  studentId: string;
}): Promise<Result<AlumnosXCursoXCiclo, Error>> {
  const cc = await this.ccRepo.findByUuid(input.courseCycleId);
  if (!cc) {
    return err(new NotFoundError('CourseCycle', input.courseCycleId));
  }

  const student = await this.studentRepo.findById(input.studentId);
  if (!student) {
    return err(new NotFoundError('Student', input.studentId));
  }

  const enrollment = await this.alumnosRepo.addStudent(input.courseCycleId, input.studentId);
  return ok(enrollment);
}
```

`AlumnosXCursoXCiclo` is already imported in this file — no new import beyond `ok/err/Result`.

### 1.2 `RemoveStudentFromCourseCycleUseCase` — `remove-student-from-course-cycle.use-case.ts`

Signature: `Promise<void>` → `Promise<Result<void, Error>>`.

```ts
async execute(input: { courseCycleId: string; id: string }): Promise<Result<void, Error>> {
  const cc = await this.ccRepo.findByUuid(input.courseCycleId);
  if (!cc) {
    return err(new NotFoundError('CourseCycle', input.courseCycleId));
  }

  const enrollment = await this.alumnosRepo.findById(input.id);
  if (!enrollment || enrollment.courseCycleId !== input.courseCycleId) {
    return err(new NotFoundError('AlumnosXCursoXCiclo', input.id));
  }

  const student = await this.studentRepo.findById(enrollment.studentId);
  if (student?.tienePase) return err(new StudentHasPaseError());

  await this.alumnosRepo.remove(input.courseCycleId, input.id);
  return ok(undefined);
}
```

### 1.3 `TogglePrintableUseCase` — `toggle-printable.use-case.ts`

Signature: `Promise<AlumnosXCursoXCiclo>` → `Promise<Result<AlumnosXCursoXCiclo, Error>>`.

```ts
async execute(input: {
  courseCycleId: string;
  id: string;
  value: boolean;
}): Promise<Result<AlumnosXCursoXCiclo, Error>> {
  const row = await this.alumnosRepo.findById(input.id);

  if (!row || row.courseCycleId !== input.courseCycleId) {
    return err(new NotFoundError('AlumnosXCursoXCiclo', input.id));
  }

  const updated = await this.alumnosRepo.setPrintable(input.id, input.value);
  return ok(updated);
}
```

### 1.4 `RegistrarPaseUseCase` — `registrar-pase.use-case.ts` (the bridge, D3/D4)

Signature: `Promise<void>` → `Promise<Result<void, Error>>`. Add `PaseFechaInvalidaError` to the `@educandow/domain` import.

```ts
import { NotFoundError, PaseFechaInvalidaError, ok, err, Result } from '@educandow/domain';
```

```ts
async execute(input: {
  courseCycleId: string;
  id: string;
  fechaDePase: Date | null;
}): Promise<Result<void, Error>> {
  const cc = await this.ccRepo.findByUuid(input.courseCycleId);
  if (!cc) {
    return err(new NotFoundError('CourseCycle', input.courseCycleId));
  }

  const row = await this.alumnosRepo.findById(input.id);
  if (!row || row.courseCycleId !== input.courseCycleId) {
    return err(new NotFoundError('AlumnosXCursoXCiclo', input.id));
  }

  const student = await this.studentRepo.findById(row.studentId);
  if (!student) {
    return err(new NotFoundError('Student', row.studentId));
  }

  // Bridge: the entity invariant (fecha futura) throws PaseFechaInvalidaError.
  // Adapt it to Result — same seam as attendance-type.use-cases.ts:102-106.
  try {
    if (input.fechaDePase) {
      student.registrarPase(input.fechaDePase);
    } else {
      student.revertirPase();
    }
  } catch (e) {
    return err(e as PaseFechaInvalidaError);
  }

  await this.studentRepo.setFechaDePase(student.id.get(), student.fechaDePase ?? null);
  return ok(undefined);
}
```

Note (D4): `revertirPase()` cannot throw, but it lives inside the `try` so the code reads as one bridge block; harmless. `setFechaDePase` persist stays OUTSIDE the try (its failure is infra, not the domain invariant — a rejected promise there propagates as today, out-of-scope).

### 1.5 `CascadeStudentMateriasCompetenciasUseCase` — `cascade-student-materias-competencias.use-case.ts`

Signature: `Promise<CascadeResult>` → `Promise<Result<CascadeResult, Error>>`. `CascadeResult` interface unchanged. 1 throw → `err`; 4 return sites → `ok(...)`.

| Line | Current | New |
|---|---|---|
| :47 | `throw new NotFoundError('AlumnosXCursoXCiclo', input.id)` | `return err(new NotFoundError('AlumnosXCursoXCiclo', input.id))` |
| :60 | `return { ...zeros }` | `return ok({ ...zeros })` |
| :82 | `return { materiasCreated, materiasSkipped, competenciasCreated: 0, competenciasSkipped: 0 }` | `return ok({ ... })` |
| :91 | `return { ...same shape... }` | `return ok({ ... })` |
| :107 | `return { materiasCreated, materiasSkipped, competenciasCreated, competenciasSkipped }` | `return ok({ ... })` |

Payload fields/counts structurally unchanged (CCAM-R5) — only the `ok(...)` wrapper is added.

---

## 2. Controller retrofit — `alumnos-x-curso-x-ciclo.controller.ts`

5 in-scope endpoints. Insert `if (result.isErr()) throw result.unwrapErr();` and unwrap after. The 4 non-throwing endpoints (`listStudents`, `setBulkPrintable`, `cascadeAll`, `listStudentMemberships`) are **untouched**.

### 2.1 `addStudent` (POST, 201, returns `{ data }`)

```ts
const result = await this.addUC.execute({ courseCycleId: ccId, studentId: body.studentId });
if (result.isErr()) throw result.unwrapErr();
const enrollment = result.unwrap();
return {
  data: {
    id: enrollment.id,
    courseCycleId: enrollment.courseCycleId,
    studentId: enrollment.studentId,
  },
};
```

### 2.2 `removeStudent` (DELETE, 204, returns `void`)

```ts
const result = await this.removeUC.execute({ courseCycleId: ccId, id });
if (result.isErr()) throw result.unwrapErr();
```

### 2.3 `togglePrintable` (PATCH, 204, returns `void`)

```ts
const result = await this.togglePrintableUC.execute({ courseCycleId: ccId, id, value: body.value });
if (result.isErr()) throw result.unwrapErr();
```

(The endpoint returns 204 and discards the `ok(AlumnosXCursoXCiclo)` payload — same 204 contract as today.)

### 2.4 `registrarPase` (PATCH, 204, returns `void`)

```ts
const fechaDePase = body.fechaDePase
  ? new Date(`${body.fechaDePase}T00:00:00.000Z`)
  : null;
const result = await this.registrarPaseUC.execute({ courseCycleId: ccId, id, fechaDePase });
if (result.isErr()) throw result.unwrapErr();
```

### 2.5 `cascade` (POST, 200, returns `{ data }`)

```ts
const result = await this.cascadeUC.execute({ id, ccId });
if (result.isErr()) throw result.unwrapErr();
return { data: result.unwrap() };
```

No new controller imports: the payload types (`AlumnoXCursoCicloResponse`, `CascadeResult`) are already imported; the controller only reads unwrapped fields.

---

## 3. DI / wiring check

- **No module change.** `api/src/presentation/course-cycle-alumnos/alumnos-x-curso-x-ciclo.module.ts` and the controller constructor (l.50-60) are unchanged — every use-case keeps its exact constructor signature; only return types change (compile-time only).
- **Type importability.** `AlumnosXCursoXCiclo` is already imported in `add-student-...` and `toggle-printable...` use-cases; `Result<AlumnosXCursoXCiclo, Error>` compiles with the existing import. `ok/err/Result` resolve from `@educandow/domain` (confirmed exported — used by `attendance-type.use-cases.ts`).
- **No `DOMAIN_STATUS` edit** (D6). Verified before apply per CCAM-R3.

---

## 4. Test plan mapping (TDD strict, Vitest, `pnpm test`, ≥80%)

Two natures: **status-preserving rewrites** (throw-assert → Result-assert) and **RED-first new coverage** (bridge already covered by `S-4-B` rewrite; `togglePrintable` controller specs are net-new).

### 4.1 Use-case test rewrites

| File | Test id(s) | Change |
|---|---|---|
| `add-student-to-course-cycle.use-case.test.ts` | S-07 (l.109), S-06 (l.122), "validates cc before student" (l.135) | `.rejects.toBeInstanceOf(NotFoundError)` → `const r = await uc.execute(...); expect(r.isErr()).toBe(true); expect(r.unwrapErr()).toBeInstanceOf(NotFoundError)`. The order test's `.catch(e=>e)` → read `r.unwrapErr()`, assert `.message` contains `'CourseCycle'`. S-01/S-02 happy: wrap in `r.unwrap()` / assert `r.isOk()`. |
| `toggle-printable.use-case.test.ts` | Scenario E IDOR (l.75), "row does not exist" (l.88) | `.rejects` → `isErr()` + `unwrapErr() instanceof NotFoundError`. Scenario D ×2 (l.50, l.63): `result.printable` → `result.unwrap().printable`. |
| `remove-student-from-course-cycle.use-case.test.ts` | "cc not found" (l.106), S-08 (l.120), S-08 IDOR (l.133), S-5-A (l.148) | `.rejects.toBeInstanceOf(NotFoundError/StudentHasPaseError)` → `isErr()` + `unwrapErr() instanceof ...`. S-05 (l.93) & S-5-B (l.163) happy: assert `r.isOk()` (return is `void`; no unwrap payload). |
| `registrar-pase.use-case.test.ts` | S-2-C (l.131), S-3-D IDOR (l.146), S-3-D missing (l.162), S-4-A (l.176) | `.rejects.toBeInstanceOf(NotFoundError)` → `isErr()` + `unwrapErr() instanceof NotFoundError`. **S-4-B (l.191) is the bridge rewrite**: `.rejects.toBeInstanceOf(PaseFechaInvalidaError)` → `isErr()` + `unwrapErr() instanceof PaseFechaInvalidaError` (proves the entity throw is caught, not escaped). S-2-A (l.104) & S-2-B (l.118): add `expect(r.isOk()).toBe(true); expect(r.unwrap()).toBeUndefined()` (CCAM-R2 register/revert ok(undefined) scenarios). |
| `cascade-student-materias-competencias.use-case.test.ts` | UC-01 (l.98), UC-02 (l.110) | `.rejects.toBeInstanceOf(NotFoundError)` → `isErr()` + `unwrapErr() instanceof NotFoundError`. Happy paths capturing `result`: UC-03 (l.129), UC-04 (l.155), UC-05 both (l.209, l.227), MGC-S17 (l.328) → `expect(result.unwrap()).toEqual({...})` (5 unwraps). Tests that only `await uc.execute()` without inspecting the return (UC-04 "resolves competencies" l.185, MGC-S15 ×2, MGC-S16, UC-06) need **no** change to the assertion body, but `execute` now returns a Result — they still pass as-is (no `.rejects`, no return read). |

Real happy-path `unwrap()` count in cascade: **5** (not ~8 — the other 3 awaited tests don't read the return). Documented so apply doesn't over-touch.

### 4.2 Controller spec — `alumnos-x-curso-x-ciclo.controller.spec.ts`

The controller now consumes a `Result`, so **every mock feeding an in-scope UC must return a Result** (`ok(...)`/`err(...)`), not a raw value / rejected promise.

| Test id | Current mock | New mock |
|---|---|---|
| C-01 happy add | `mockResolvedValue(row)` | `mockResolvedValue(ok(row))` |
| C-02, C-03 add errs | `mockRejectedValue(error)` | `mockResolvedValue(err(error))` |
| C-06 happy remove | `mockResolvedValue(undefined)` | `mockResolvedValue(ok(undefined))` |
| C-07 remove err | `mockRejectedValue(error)` | `mockResolvedValue(err(error))` |
| C-10 happy cascade | `mockResolvedValue(counts)` | `mockResolvedValue(ok(counts))` |
| C-11 cascade err | `mockRejectedValue(error)` | `mockResolvedValue(err(error))` |
| C-14, C-15 happy pase | `mockResolvedValue(undefined)` | `mockResolvedValue(ok(undefined))` |
| **C-16** pase future | `mockRejectedValue(error)` | `mockResolvedValue(err(error))` — **assertion line unchanged, stays green**: controller re-throws via `unwrapErr()`, so `.rejects.toBeInstanceOf(PaseFechaInvalidaError)` still holds. Mock migrated so it exercises the real Result path. |
| C-17 pase notfound | `mockRejectedValue(error)` | `mockResolvedValue(err(error))` |
| C-18 pase 409 | `mockRejectedValue(error)` | `mockResolvedValue(err(error))` |
| C-04, C-05 (list), C-08, C-09 (memberships), C-12 (bulk cascade), C-13 (route-order), D-01..D-08 (Zod) | — | **UNCHANGED** — non-in-scope UCs / pure schema tests. |

Import add to the spec: `import { ok, err } from '@educandow/domain';`.

### 4.3 NEW `togglePrintable` controller-spec tests (RED-first, CCAM-R7)

`togglePrintable` has **zero** controller-spec coverage today. Add a `describe('PATCH .../:id/printable')` block with 3 tests, written RED before the controller retrofit:

| New id | Scenario | Mock | Assert |
|---|---|---|---|
| C-19 | success 204 | `togglePrintableUC.execute → ok(row)` | `await ctrl.togglePrintable('cc-1','axcc-1',{value:true})` resolves `undefined`; UC called with `{courseCycleId,id,value}` |
| C-20 | 404 not found | `→ err(new NotFoundError('AlumnosXCursoXCiclo','axcc-999'))` | `.rejects.toBeInstanceOf(NotFoundError)` |
| C-21 | 404 IDOR | `→ err(new NotFoundError(...))` (row of another CC) | `.rejects.toBeInstanceOf(NotFoundError)` — same handling as C-20, no existence leak |

`makeController` already wires `togglePrintableUC` (l.32) — no factory change needed.

---

## 5. Work unit / commit plan (one PR, <400 lines, work-unit commits)

RED-first where new coverage appears (togglePrintable specs, bridge assertion). Conventional commits, NO AI attribution. Tests co-located with the behavior they verify.

| # | Commit | Contents |
|---|---|---|
| 1 | `refactor(course-cycle): AddStudent + Remove use-cases return Result` | 1.1 + 1.2 prod + their test rewrites |
| 2 | `refactor(course-cycle): TogglePrintable use-case returns Result` | 1.3 prod + toggle use-case test rewrite |
| 3 | `refactor(course-cycle): RegistrarPase returns Result, bridge PaseFechaInvalidaError` | 1.4 prod + registrar-pase test rewrites incl. S-4-B bridge + S-2-A/B ok(undefined) |
| 4 | `refactor(course-cycle): Cascade use-case returns Result` | 1.5 prod + cascade test rewrites (2 err + 5 unwrap) |
| 5 | `test(course-cycle): RED — togglePrintable controller-spec coverage (C-19..C-21)` | new failing specs BEFORE controller retrofit |
| 6 | `refactor(course-cycle): controller adopts isErr/unwrapErr on 5 endpoints` | §2 retrofit + controller-spec mock migration (C-01/02/03/06/07/10/11/14/15/16/17/18) → GREEN incl. C-19..C-21 |

Ordering note: commit 5 (RED togglePrintable) precedes commit 6 (retrofit that turns it GREEN), honoring strict-TDD. Commits 1-4 are status-preserving rewrites (already-GREEN assertions re-expressed); each keeps its slice compiling because the controller still compiles against `Result` only after commit 6 — so **commits 1-5 will not `pnpm build` in isolation** (the controller expects raw returns until commit 6). This is the type-coupling that forces a single PR; the commits are review units, not independently shippable. `sdd-tasks` should mark commit 6 as the compile-closing unit.

---

## 6. Review Workload Forecast

| Metric | Value |
|---|---|
| Estimated changed lines | ~225-265 (5 use-cases ~45-55 prod, controller ~25-30, 5 UC test files ~90-110, controller spec 12 mock migrations + 3 new ~65-70) |
| Chained PRs recommended | **No** — return-type change couples use-cases↔controller through the type system; a use-cases-only PR-1 would break controller compilation (endpoints would receive `Result` without the unwrap idiom). Splitting needs a throwaway adapter = cost without value. |
| 400-line budget risk | **Low** (~245 median, comfortably under 400) |
| Decision needed before apply | **No** — scope settled, zero new classes, zero status changes, bridge pattern fixed (D3/D4), DOMAIN_STATUS pre-verified (D6). |

## Risks / assumptions

1. **Commits 1-5 don't build in isolation** (type coupling) — expected; the PR builds green only at commit 6. Not a code risk, a review-granularity note.
2. **`e as PaseFechaInvalidaError` cast** (D3): mirrors the precedent. A safer `instanceof PaseFechaInvalidaError` narrow (re-throwing anything else) would be stricter, but the entity's only throw in that block is `PaseFechaInvalidaError` and the precedent uses the bare cast — kept for consistency. Flagged for the reviewer as an optional hardening.
3. **Cascade unwrap count is 5, not ~8** (proposal estimate was high) — corrected here so apply doesn't touch the 3 return-agnostic awaited tests.
</content>
</invoke>
