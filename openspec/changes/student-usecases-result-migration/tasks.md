# Tasks: student-usecases-result-migration

Behavior-preserving refactor — four student use-cases migrate from `throw`-based domain error signaling
to `Promise<Result<T, DomainError>>` returns. Observable HTTP contract is byte-identical after the change.

**Total tasks: 15 | Sequential phases: 4 | Parallel opportunities: within Phase 4 RED steps**

---

## Dependency Graph

```
TASK-01 → TASK-02 → TASK-03 → TASK-04 → TASK-05
                                           ↓
                                         TASK-06 → TASK-07 → TASK-08
                                                               ↓
                              ┌──────────────────────┐
                              │ TASK-09 ┐             │
                              │ TASK-10 ├─ parallel   │ → TASK-12 → TASK-13 → TASK-15
                              │ TASK-11 ┘             │         → TASK-14 ┘
                              └──────────────────────┘
```

Phases 1 → 2 → 3 → 4 are strictly sequential.
Within Phase 4: TASK-09, TASK-10, TASK-11 (all RED) may be written in parallel (different files).
TASK-12 and TASK-14 touch the same file — keep sequential.
TASK-15 requires both TASK-13 and TASK-14 to be GREEN.

---

## Files Affected

| File | Role |
|---|---|
| `api/src/application/student/use-cases/student.use-cases.ts` | 4 use-cases migrated to Result |
| `api/src/presentation/student/student.controller.ts` | unwrap Results in 4 handlers; 403 branch added |
| `api/src/application/student/use-cases/__tests__/patch-student-email-guard.test.ts` | 5 stale assertions updated |
| `api/src/presentation/student/__tests__/throw-guardian-error.spec.ts` | NEW — 403 branch test |
| `api/src/application/student/use-cases/__tests__/list-guardians.use-case.spec.ts` | NEW — ListGuardians error-path tests |
| `api/src/application/student/use-cases/__tests__/remove-guardian.use-case.spec.ts` | NEW — RemoveGuardian error-path + success tests |
| `api/src/application/student/use-cases/__tests__/patch-student.use-case.spec.ts` | NEW — PatchStudent error-path tests (5 scenarios) |
| `api/src/application/student/use-cases/__tests__/get-my-student-data.use-case.spec.ts` | NEW — GetMyStudentData error-path test |

---

## Phase 1 — Harden error mapper: throwGuardianError() + 403 branch

**Satisfies**: REQ-02
**Must complete before any use-case migration.** Additive change; no existing caller emits ForbiddenError yet.

### TASK-01 [x] Write test: ForbiddenError → ForbiddenException via throwGuardianError()

- **File (new)**: `api/src/presentation/student/__tests__/throw-guardian-error.spec.ts`
- Instantiate a minimal `StudentController` (mock all use-case deps).
- Call `(controller as any).throwGuardianError(new ForbiddenError('test'))`.
- Assert: throws `ForbiddenException` (HTTP 403).
- Assert (negative): does NOT throw `BadRequestException`.
- Run `pnpm test` — confirm test fails (current code falls through to `BadRequestException`).
- **Satisfies**: REQ-02

### TASK-02 [x] Add ForbiddenError/403 branch to throwGuardianError(); add imports

- **File**: `api/src/presentation/student/student.controller.ts`
- Add imports: `ForbiddenException` from `@nestjs/common`, `ForbiddenError` from domain.
- Insert branch **before** the `DomainError` catch-all:
  ```
  if (err instanceof ForbiddenError) throw new ForbiddenException(err.message);
  ```
- Resulting branch order: Conflict → NotFound → **ForbiddenError → ForbiddenException** → ValidationError/DomainError → rethrow.
- Run `pnpm test` — TASK-01 GREEN, full suite green (no regressions; no caller emits ForbiddenError yet).
- **Satisfies**: REQ-02

---

## Phase 2 — ListGuardiansUseCase migration

**Satisfies**: REQ-01, REQ-05, REQ-09-B
**Sequential**: after Phase 1.

### TASK-03 [x] Write test: ListGuardians student not found → err(NotFoundError)

- **File (new)**: `api/src/application/student/use-cases/__tests__/list-guardians.use-case.spec.ts`
- Mock student repo: returns `null` for any studentId.
- Mock guardian repo: never called.
- Assert: `result.isErr() === true`.
- Assert: `result.unwrapErr() instanceof NotFoundError`.
- Run `pnpm test` — confirm test fails (current impl throws instead of returning err).
- **Satisfies**: REQ-09-B (ListGuardians error scenario)

### TASK-04 [x] Migrate ListGuardiansUseCase.execute() → Promise<Result<GuardianOutput[], NotFoundError>>

- **File**: `api/src/application/student/use-cases/student.use-cases.ts`
- Change return type annotation: `Promise<Result<GuardianOutput[], NotFoundError>>`.
- `if (!student) throw new NotFoundError(...)` → `if (!student) return err(new NotFoundError(...))`.
- `return guardians.map(toGuardianOutput)` → `return ok(guardians.map(toGuardianOutput))`.
- Ensure `ok`/`err` are imported (mirror existing in-file pattern).
- Run `pnpm test` — TASK-03 GREEN; full suite green.
- **Satisfies**: REQ-01

### TASK-05 [x] Unwrap Result in listGuardians controller handler

- **File**: `api/src/presentation/student/student.controller.ts`
- Change handler body:
  ```
  const result = await this.listGuardiansUseCase.execute(studentId);
  if (result.isErr()) throw result.unwrapErr();
  return { data: result.unwrap() };
  ```
- HTTP parity: NotFoundError propagates to AppExceptionFilter → 404. Success → 200 `{ data: GuardianOutput[] }`.
- Run `pnpm test` — suite green.
- **Satisfies**: REQ-05

---

## Phase 3 — RemoveGuardianUseCase migration

**Satisfies**: REQ-01, REQ-04, REQ-09-B
**Sequential**: after Phase 2.

### TASK-06 [x] Write tests: RemoveGuardian error paths + success

- **File (new)**: `api/src/application/student/use-cases/__tests__/remove-guardian.use-case.spec.ts`
- **Test A** (guardian not found): guardian repo returns `null` → `result.isErr() && result.unwrapErr() instanceof NotFoundError`.
- **Test B** (studentId mismatch): guardian repo returns record with `studentId !== input.studentId` → `result.isErr() && result.unwrapErr() instanceof NotFoundError`.
- **Test C** (happy path): guardian repo returns matching record; delete called → `result.isOk() && result.unwrap() === undefined`.
- Run `pnpm test` — confirm all 3 fail (current impl throws on A/B; returns void bare on C, no wrapper).
- **Satisfies**: REQ-09-B (RemoveGuardian ×2 error scenarios), REQ-04

### TASK-07 [x] Migrate RemoveGuardianUseCase.execute() → Promise<Result<void, NotFoundError>>

- **File**: `api/src/application/student/use-cases/student.use-cases.ts`
- Change return type: `Promise<Result<void, NotFoundError>>`.
- Site 1 (guardian missing): `throw new NotFoundError(...)` → `return err(new NotFoundError(...))`.
- Site 2 (studentId mismatch): `throw new NotFoundError(...)` → `return err(new NotFoundError(...))`.
- Final: after delete operation → `return ok(undefined)`.
- Run `pnpm test` — TASK-06 A/B/C GREEN; full suite green.
- **Satisfies**: REQ-01

### TASK-08 [x] Update removeGuardian handler: drop try/catch, route err to throwGuardianError()

- **File**: `api/src/presentation/student/student.controller.ts`
- Remove: `try { ... result = await this.removeGuardianUseCase.execute(...) } catch (e) { this.throwGuardianError(e) }`.
- Replace with:
  ```
  const result = await this.removeGuardianUseCase.execute(guardianId, studentId);
  if (result.isErr()) this.throwGuardianError(result.unwrapErr());
  ```
- HTTP parity: NotFoundError → throwGuardianError's NotFound branch → 404. Infrastructure errors now propagate directly (no catch) → AppExceptionFilter → 500. This is correct per REQ-08.
- Run `pnpm test` — suite green.
- **Satisfies**: REQ-04

---

## Phase 4 — PatchStudentUseCase + GetMyStudentDataUseCase migration

**Satisfies**: REQ-01, REQ-03, REQ-06, REQ-07, REQ-08, REQ-09-A, REQ-09-B
**Sequential**: after Phase 3. TASK-09/10/11 may be written in parallel (different files, all RED).

### TASK-09 [x] Update 5 stale assertions in patch-student-email-guard.test.ts → Result-aware

- **File**: `api/src/application/student/use-cases/__tests__/patch-student-email-guard.test.ts`
- **2 `.resolves.toBeDefined()` assertions** → `.resolves.toSatisfy(r => r.isOk() === true)`.
- **3 raw property-access assertions** (e.g. `result.fatherEmail`) → unwrap first: `result.unwrap().fatherEmail`.
- Run `pnpm test` — confirm these 5 assertions now FAIL (execute() still returns raw Student or throws).
- **Satisfies**: REQ-09-A

### TASK-10 [x] Write new error-path tests for PatchStudentUseCase (5 scenarios)

- **File (new)**: `api/src/application/student/use-cases/__tests__/patch-student.use-case.spec.ts`
- **Test A** (student not found): student repo returns `null` → `result.isErr() && result.unwrapErr() instanceof NotFoundError`.
- **Test B** (STUDENT editing another student): caller role = STUDENT, `caller.userId !== student.userId` → `result.isErr() && result.unwrapErr() instanceof ForbiddenError`.
- **Test C** (TUTOR not linked): caller role = TUTOR, no StudentGuardian record linking them → `result.isErr() && result.unwrapErr() instanceof ForbiddenError`.
- **Test D** (restricted caller patches disallowed field): caller in restricted set, request body contains field outside allowed list → `result.isErr() && result.unwrapErr() instanceof ForbiddenError`.
- **Test E** (invalid email): valid student, ADMIN caller, body `fatherEmail: 'not-an-email'` → `result.isErr() && result.unwrapErr() instanceof ValidationError`.
- Run `pnpm test` — confirm all 5 FAIL.
- **Satisfies**: REQ-09-B (PatchStudent ×5 error scenarios), REQ-03

### TASK-11 [x] Write error-path test for GetMyStudentDataUseCase

- **File (new)**: `api/src/application/student/use-cases/__tests__/get-my-student-data.use-case.spec.ts`
- Mock: student repo returns `null` for given userId.
- Assert: `result.isErr() === true`.
- Assert: `result.unwrapErr() instanceof NotFoundError`.
- Run `pnpm test` — confirm FAILS.
- **Satisfies**: REQ-09-B (GetMyStudentData scenario), REQ-06

### TASK-12 [x] Refactor PatchStudent private methods to thread Result (no throw)

- **File**: `api/src/application/student/use-cases/student.use-cases.ts`
- **`checkOwnership()`** — change return type to `Promise<Result<void, ForbiddenError>>`; replace each `throw new ForbiddenError(...)` with `return err(new ForbiddenError(...))`.
- **`validateAllowedFields()`** — change return type to `Result<void, ForbiddenError>`; replace each `throw new ForbiddenError(...)` with `return err(new ForbiddenError(...))`.
- **Extract `resolveEmailField(bodyVal, presentFlag, stored): Result<Email|undefined, ValidationError>`**:
  - absent → `return ok(stored)` (pass-through, unchanged)
  - null / empty string → `return ok(undefined)` (clear)
  - value === stored.value → `return ok(stored)` (unchanged pass-through)
  - else → `return Email.create(raw)` (already returns `Result<Email, ValidationError>`)
- **Purify `applyChanges(student, body, emails: { email, fatherEmail, motherEmail })`**: receives 3 resolved Email VOs; maps remaining scalars + `Dni.reconstruct`; no throw, no email resolution logic inside.
- Run `pnpm test` — existing tests that don't touch execute() stay green; no new RED yet (execute() still calls old paths).
- **Satisfies**: REQ-01 (internal threading), REQ-08

### TASK-13 [x] Migrate PatchStudentUseCase.execute() → Promise<Result<Student, DomainError>>

- **File**: `api/src/application/student/use-cases/student.use-cases.ts`
- Change return type annotation: `Promise<Result<Student, DomainError>>`.
- **Site 1** (`!student`): `throw new NotFoundError(...)` → `return err(new NotFoundError(...))`.
- **Site 2** (`checkOwnership`): `await this.checkOwnership(...)` → `const own = await this.checkOwnership(...); if (own.isErr()) return err(own.unwrapErr())`.
- **Site 3** (`validateAllowedFields`): `this.validateAllowedFields(...)` → `const v = this.validateAllowedFields(...); if (v.isErr()) return err(v.unwrapErr())`.
- **Site 4** (3× `resolveEmailField`): collect results; `if (emailR.isErr()) return err(emailR.unwrapErr())`.
- **Site 5**: `return ok(updatedStudent)`.
- Run `pnpm test` — TASK-09 (all 5 stale assertions) + TASK-10 (all 5 error scenarios) go GREEN.
- **Satisfies**: REQ-01, REQ-03

### TASK-14 [x] Migrate GetMyStudentDataUseCase.execute() → Promise<Result<Student, NotFoundError>>

- **File**: `api/src/application/student/use-cases/student.use-cases.ts`
- Change return type: `Promise<Result<Student, NotFoundError>>`.
- `if (!student) throw new NotFoundError(...)` → `return err(new NotFoundError(...))`.
- `return student` → `return ok(student)`.
- Run `pnpm test` — TASK-11 GREEN; full suite green.
- **Satisfies**: REQ-01, REQ-06

### TASK-15 [x] Unwrap Results in patch + me controller handlers

- **File**: `api/src/presentation/student/student.controller.ts`
- **`patch` handler**:
  ```
  const result = await this.patchStudentUseCase.execute(id, body, caller);
  if (result.isErr()) throw result.unwrapErr();
  return { data: result.unwrap() };
  ```
  HTTP parity: NotFoundError→404, ForbiddenError→403, ValidationError→400 all via AppExceptionFilter.
- **`me` handler**:
  ```
  const result = await this.getMyStudentDataUseCase.execute(userId);
  if (result.isErr()) throw result.unwrapErr();
  return { data: result.unwrap() };
  ```
  HTTP parity: NotFoundError→404 via AppExceptionFilter.
- Run `pnpm test` — full suite green.
- **Satisfies**: REQ-03, REQ-06, REQ-07

---

## Non-Goals (do not touch)

- `AssignGuardianUseCase`, `CreateStudyTutorUseCase`, `UpdateStudyTutorUseCase` — already migrated.
- Infra-rethrow `try { save } catch (e) { if (e instanceof ValidationError) return err(e); throw e; }` convention — intentional, preserved.
- Any non-student controller or use-case.
- HTTP response body shapes — must stay identical (REQ-07).

---

## Review Workload Forecast

### Estimated Changed Lines

| Area | Lines |
|---|---|
| `student.use-cases.ts` — GetMyStudentDataUseCase | ~8 |
| `student.use-cases.ts` — ListGuardiansUseCase | ~7 |
| `student.use-cases.ts` — RemoveGuardianUseCase | ~10 |
| `student.use-cases.ts` — PatchStudent private methods (checkOwnership, validateAllowedFields, resolveEmailField new, applyChanges purified) | ~75 |
| `student.use-cases.ts` — PatchStudentUseCase.execute() (5 sites + return type) | ~30 |
| **Source use-cases subtotal** | **~130** |
| `student.controller.ts` — throwGuardianError branch + imports | ~8 |
| `student.controller.ts` — me handler unwrap | ~5 |
| `student.controller.ts` — patch handler unwrap | ~5 |
| `student.controller.ts` — listGuardians handler unwrap | ~5 |
| `student.controller.ts` — removeGuardian drop try/catch + err route | ~8 |
| **Source controller subtotal** | **~31** |
| **Source total** | **~161** |
| `patch-student-email-guard.test.ts` — 5 assertion updates | ~15 |
| NEW `throw-guardian-error.spec.ts` (1 test + setup) | ~30 |
| NEW `list-guardians.use-case.spec.ts` (1 test + setup) | ~35 |
| NEW `remove-guardian.use-case.spec.ts` (3 tests + setup) | ~60 |
| NEW `patch-student.use-case.spec.ts` (5 tests + mocks) | ~100 |
| NEW `get-my-student-data.use-case.spec.ts` (1 test + setup) | ~30 |
| **Test total** | **~270** |
| **GRAND TOTAL** | **~431 lines** |

### Budget Assessment

| Metric | Value |
|---|---|
| Estimated changed/added lines | ~431 |
| Exceeds 400-line PR budget | **Yes** |
| Chained PRs recommended | **Yes** |
| Decision needed before apply | **Yes** |

### Suggested PR slices (if chaining approved)

| PR | Phases | Scope | Complexity |
|---|---|---|---|
| PR-1 | Phase 1 | throwGuardianError + 403 branch + test | Low — additive only |
| PR-2 | Phase 2 + 3 | ListGuardians + RemoveGuardian (use-cases + handlers + tests) | Medium — 2 simple use-cases |
| PR-3 | Phase 4 | PatchStudent + GetMyStudentData (private method refactor + execute + handlers + all tests) | High — highest complexity |

Each PR keeps the test suite green end-to-end and can be reviewed in isolation.
