# Design: student-usecases-result-migration

## Technical Approach

Convert the 4 throwing student use-cases to `Promise<Result<T, DomainError>>` using `ok()/err()`, mirroring the proven in-file pattern (AssignGuardian / CreateStudyTutor / UpdateStudyTutor). Each handler unwraps the `Result` and re-emits the SAME `DomainError`, so the existing error→status mapping is reused unchanged and HTTP codes stay byte-identical. No new mapping logic is introduced for the rethrow handlers; the only mapper edit is a defensive completion of `throwGuardianError()`.

## Key Parity Insight

The global `AppExceptionFilter` (`exception.filter.ts`) already maps `DomainError.code` → status: `NOT_FOUND→404`, `FORBIDDEN→403`, `VALIDATION_ERROR→400`. Today `me`/`patch`/`listGuardians` throw and land there. Post-migration they rethrow the identical `DomainError` → identical filter → identical status. This is the safest parity guarantee, so those handlers KEEP the filter path. Only `removeGuardian` keeps the `throwGuardianError()` path (the established guardian-route mapper).

## Target Signatures

```ts
// GetMyStudentDataUseCase
async execute(userId: string): Promise<Result<Student, NotFoundError>> {
  const s = await this.studentRepo.findByUserId(userId);
  if (!s) return err(new NotFoundError('Student', userId));
  return ok(s);
}

// ListGuardiansUseCase
async execute(studentId: string): Promise<Result<GuardianOutput[], NotFoundError>> {
  const s = await this.studentRepo.findById(studentId);
  if (!s) return err(new NotFoundError('Student', studentId));
  const g = await this.guardianRepo.findByStudentId(studentId);
  return ok(g.map(toGuardianOutput));
}

// RemoveGuardianUseCase
async execute(guardianId: string, studentId?: string): Promise<Result<void, NotFoundError>> {
  const g = await this.guardianRepo.findById(guardianId);
  if (!g) return err(new NotFoundError('StudentGuardian', guardianId));
  if (studentId && g.studentId !== studentId) return err(new NotFoundError('StudentGuardian', guardianId));
  await this.guardianRepo.delete(guardianId);
  return ok(undefined);
}

// PatchStudentUseCase
async execute(studentId, body, caller): Promise<Result<Student, DomainError>> {
  const student = await this.studentRepo.findById(studentId);
  if (!student) return err(new NotFoundError('Student', studentId));
  const isRestricted = caller.roles.some(r => RESTRICTED_ROLES.includes(r));
  const isFullAccess = caller.roles.some(r => FULL_ACCESS_ROLES.includes(r));
  if (isRestricted) {
    const own = await this.checkOwnership(student, caller);
    if (own.isErr()) return err(own.unwrapErr());
  }
  if (isRestricted && !isFullAccess) {
    const f = this.validateAllowedFields(body, caller.roles);
    if (f.isErr()) return err(f.unwrapErr());
  }
  const email  = this.resolveEmailField(body.email, body.email !== undefined, student.email);
  const father = this.resolveEmailField(body.fatherEmail, body.fatherEmail !== undefined, student.fatherEmail);
  const mother = this.resolveEmailField(body.motherEmail, body.motherEmail !== undefined, student.motherEmail);
  for (const r of [email, father, mother]) if (r.isErr()) return err(r.unwrapErr());
  const updated = this.applyChanges(student, body, {
    email: email.unwrap(), fatherEmail: father.unwrap(), motherEmail: mother.unwrap(),
  });
  await this.studentRepo.save(updated);
  return ok(updated);
}
```

### PatchStudent private methods (threading)

- `checkOwnership(...) : Promise<Result<void, ForbiddenError>>` — `return err(new ForbiddenError(...))` instead of throw.
- `validateAllowedFields(...) : Result<void, ForbiddenError>` — same.
- `resolveEmailField(bodyVal, present, stored) : Result<Email|undefined, ValidationError>` — lifts the unchanged→passthrough / clear / validate logic OUT of `applyChanges` into `execute`. Returns `ok(stored)` when absent, `ok(undefined)` on null/'', `ok(stored)` on unchanged pass-through, else `Email.create(raw)` (already a `Result`). This PRESERVES the ValidationError/400 path: an invalid changed email → `err(ValidationError)` → execute returns err → handler rethrow → filter → 400.
- `applyChanges(student, body, emails)` becomes PURE (no throw): receives the 3 resolved VOs, only maps remaining scalar fields + `Dni.reconstruct`.

## throwGuardianError() Change

Add the `ForbiddenError` branch BEFORE the `DomainError` branch (else `ForbiddenError`, which `extends DomainError`, falls through to `BadRequest` → wrong 400). Import `ForbiddenException` + `ForbiddenError`.

```ts
if (error instanceof NotFoundError || msg === 'GUARDIAN_NOT_FOUND') throw new NotFoundException(msg);
if (error instanceof ForbiddenError) throw new ForbiddenException(msg);          // ← NEW
if (error instanceof ValidationError || error instanceof DomainError) throw new BadRequestException(msg);
```

### Mapping table (after fix)

| Error | Branch | HTTP |
|-------|--------|------|
| `GUARDIAN_ALREADY_ASSIGNED` / `TUTOR_DUPLICATE_NAME` | ConflictException | 409 |
| `NotFoundError` / `GUARDIAN_NOT_FOUND` | NotFoundException | 404 |
| `ForbiddenError` | ForbiddenException | **403 (new)** |
| `ValidationError` / `DomainError` | BadRequestException | 400 |
| unknown / infra | rethrow → AppExceptionFilter | 500 |

## Per-Handler Unwrap (controller)

| Handler | Current path | Post-migration | Status parity |
|---------|--------------|----------------|---------------|
| `me` | AppExceptionFilter (plain throw) | `if (r.isErr()) throw r.unwrapErr()` | NotFound→404 via filter (same code) |
| `patch` | AppExceptionFilter | `if (r.isErr()) throw r.unwrapErr()` | NotFound→404, Forbidden→403, Validation→400 via filter (same codes) |
| `listGuardians` | AppExceptionFilter | `if (r.isErr()) throw r.unwrapErr()` | NotFound→404 via filter |
| `removeGuardian` | try/catch → throwGuardianError | drop try/catch; `if (r.isErr()) this.throwGuardianError(r.unwrapErr())` | NotFound→404 (mapper). Infra errors now propagate directly → still 500 |

Status stays identical because the error CODE is unchanged and both mappers key off that same code; we only change WHERE the error is produced (return vs throw), not its identity.

## Implementation Order (mandatory)

1. **`throwGuardianError()` + 403 branch** — safe additive; completes the guardian mapper so no later step can downgrade 403→400. No behavior change for existing callers (they never emit ForbiddenError yet).
2. **ListGuardiansUseCase** (1 site) + `listGuardians` handler — simplest single NotFound.
3. **RemoveGuardianUseCase** (2 sites) + `removeGuardian` handler — drop try/catch.
4. **PatchStudentUseCase (5 sites) + GetMyStudentDataUseCase** last — Patch is the highest-risk (email threading + 3 Forbidden), GetMyData rides along (trivial, same file).

Order = ascending complexity with the safety net first; each step keeps the suite green.

## Testing Strategy (strict TDD)

| Layer | What | Approach |
|-------|------|----------|
| Unit (changed) | `patch-student-email-guard.test.ts` — 5 stale assertions | `result.fatherEmail` → `result.unwrap().fatherEmail`; the 2 `.resolves.toBeDefined()` → assert `r.isOk() === true` then unwrap |
| Unit (new) | error paths per use-case | GetMyData: `err(NotFoundError)`. ListGuardians: `err(NotFoundError)`. RemoveGuardian: missing → `err`, studentId mismatch → `err`, success → `ok(undefined)`. PatchStudent: missing student → `err(NotFoundError)`; STUDENT editing other → `err(ForbiddenError)`; TUTOR not linked → `err(ForbiddenError)`; restricted role disallowed field → `err(ForbiddenError)`; changed invalid email → `err(ValidationError)` |
| Boundary | HTTP parity | If e2e/integration exists, assert patch → 403/400/404 unchanged; otherwise rely on filter-mapping unit (`exception.filter.spec.ts`) which already covers code→status |

## Infra-Rethrow Convention — KEPT

The `try { await save() } catch (e) { if (e instanceof ValidationError) return err(e); throw e; }` in Assign/Create/Update study-tutor is the established infra-rethrow convention and is NOT a violation — left untouched. PatchStudent's `studentRepo.save` stays a bare `await` (no unique-constraint race to wrap). The out-of-scope non-domain `throw e` rethrows are intentionally preserved.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `api/src/application/student/use-cases/student.use-cases.ts` | Modify | 4 use-cases → Result; PatchStudent private methods threaded |
| `api/src/presentation/student/student.controller.ts` | Modify | Unwrap Result in 4 handlers; add ForbiddenError/403 branch + imports |
| `.../__tests__/patch-student-email-guard.test.ts` | Modify | 5 assertions made Result-aware |
| `.../__tests__/*.test.ts` (new error-path specs) | Create | Per-use-case err-path coverage |

## Open Questions

None — pattern, threading, and parity are fully determined by the existing code.
