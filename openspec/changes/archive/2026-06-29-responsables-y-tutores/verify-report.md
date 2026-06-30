# Verify Report — responsables-y-tutores

**Date**: 2026-06-29
**Verdict**: PASS WITH WARNINGS
**Branch**: feat/student-emails
**Test run**: domain 104/104 files 1181/1181 tests PASS · api 173/173 files 1735/1735 tests PASS · web 45/45 files 516/516 tests PASS
**Known pre-existing failure (not a regression)**: `api/test/integration/asistencia/subject-group-filter.db.test.ts` — 2 tests fail independently of this change; confirmed pre-existing.

---

## Counts

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| WARNING | 2 |
| SUGGESTION | 2 |

---

## REQ Coverage

| REQ | Status | Evidence |
|---|---|---|
| REQ-RYT-01 | VERIFIED | `Student.fatherEmail`/`motherEmail` as `Email?`; NOT in `ALLOWED_TUTOR_FIELDS` (use-cases.ts:19); migration `20260629155127`; DTO validated; mapStudent includes both |
| REQ-RYT-02 | VERIFIED | `fullName String?`, `mobile String?`, `email String?`, `active Boolean @default(true)`, `updatedAt DateTime @updatedAt` in schema + entity getters |
| REQ-RYT-03 | VERIFIED | `userId String?` in schema; `userId?: string` in entity; portal inferred from `userId != null` |
| REQ-RYT-04 | VERIFIED | `relationship String @db.VarChar(15)`; enum dropped; entity validates 1..15 chars; DTO `z.string().min(1).max(15)`; all 3 barrel exports clean |
| REQ-RYT-05 | VERIFIED | `CreateStudyTutorUseCase`: fullName, mobile, relationship all required; Result return; RELATIONSHIP_REQUIRED code; email optional via Email VO |
| REQ-RYT-06 | VERIFIED | `UpdateStudyTutorUseCase`: updates 5 fields; no userId/studentId in input; Result return; GUARDIAN_NOT_FOUND; email null clears; entity.update() bumps updatedAt |
| REQ-RYT-07 | VERIFIED | `AssignGuardianUseCase`: userId guard at line 299; USER_ID_REQUIRED; Result<StudentGuardian, DomainError> return |
| REQ-RYT-08 | VERIFIED | DB `@@unique([studentId, userId])`; `findStudyTutor(studentId, fullName)`; TUTOR_DUPLICATE_NAME → 409; allowDuplicate override; Postgres NULL!=NULL pattern |
| REQ-RYT-09 | VERIFIED | No max enforced at domain/DB level |
| REQ-RYT-10 | VERIFIED | `findByGuardianUserId` uses `where: { userId: guardianUserId }` — null-userId rows excluded by exact match |
| REQ-RYT-11 | VERIFIED | `Mobile` VO: private readonly; normalize (strip spaces/dashes/parens/dots, preserve `+`); 8–15 digits; Result; equals(); exported from 2 barrels |
| REQ-RYT-12 | VERIFIED | `findByStudentId` no filter; `GuardianOutput` shape includes all 10 fields; `mapGuardian` in controller |
| REQ-RYT-13 | VERIFIED | Web panel: list with portal/sin-cuenta badge; free-text relationship; fullName/mobile/email/active columns; create (POST) / edit (PATCH) modes; client-side validation |
| REQ-RYT-14 | VERIFIED (with note) | `handleGuardianRelationshipChange` pre-fills from `detailStudent.fatherEmail/motherEmail`; matches father/madre variants; field editable; **only pre-fills when email is empty** (see SUGGESTION #2) |

---

## Findings

### WARNING-1 — Throws in application layer for fatherEmail/motherEmail validation

**File**: `api/src/application/student/use-cases/student.use-cases.ts`, lines 202–204 and 211–213
**Severity**: WARNING (pre-existing pattern extended by this change; non-blocking)

`PatchStudentUseCase.applyChanges()` is a private method that returns `Student` — not `Result`. When fatherEmail or motherEmail email validation fails, it throws `result.unwrapErr()`:

```typescript
const result = Email.create(raw);
if (result.isErr()) throw result.unwrapErr(); // line 203/212 — application layer throw
```

The `execute()` method itself also throws (pre-existing: NotFoundError at line 135, ForbiddenError at lines 163/180). This change extended the violation by adding two new throw sites for the new email fields.

Per project standard (`error-handling`): NEVER throw in domain/application — use `Result<T,E>`. The correct fix would be to make `execute()` return `Promise<Result<Student, DomainError>>` and propagate errors via `err()`.

**Impact**: callers (controller `patch` handler) catch exceptions; 400 is returned for invalid email. Functionally correct but architecturally non-compliant. No runtime breakage.

---

### WARNING-2 — Pre-existing throws in guardian use cases now in scope

**Files**:
- `api/src/application/student/use-cases/student.use-cases.ts` line 473 (`RemoveGuardianUseCase.execute`)
- `api/src/application/student/use-cases/student.use-cases.ts` line 503 (`ListGuardiansUseCase.execute`)
**Severity**: WARNING (pre-existing; now in scope of guardian management surface)

`RemoveGuardianUseCase` and `ListGuardiansUseCase` throw `NotFoundError` instead of returning `Result`. These existed before this change but are now part of the extended guardian management surface. They were NOT introduced by this change — flagged as architectural debt.

---

### SUGGESTION-1 — Dead code in controller guardian POST dispatch

**File**: `api/src/presentation/student/student.controller.ts`, line 134
**Severity**: SUGGESTION

```typescript
relationship: body.relationship ?? 'tutor',
```

`AssignGuardianSchema` requires `relationship` (`z.string().min(1)...` — no `.optional()`), so `body.relationship` is always a non-empty string by the time the controller runs. The `?? 'tutor'` fallback is dead code. Harmless but confusing — suggests the old default was not fully cleaned up.

---

### SUGGESTION-2 — Email pre-fill gated by "only when empty" (REQ-RYT-14 in edit mode)

**File**: `web/src/pages/dashboard/students.tsx`, lines 216–222
**Severity**: SUGGESTION

The implementation only pre-fills the email from `student.fatherEmail/motherEmail` when the email field is **currently empty**. The spec says "the UI MUST pre-fill" without this condition. In edit mode, if an existing guardian already has an email value and the admin changes relationship to 'father', no pre-fill occurs.

The spec scenarios (RYT-14-A/B/C/D) all describe creation mode, so no explicit test coverage for edit-mode pre-fill. The "only when empty" behavior is a reasonable conservative choice (avoids silently overwriting user edits) but diverges from the strict reading of "MUST pre-fill".

---

## Architecture / Clean Arch checks

| Check | Result |
|---|---|
| Domain imports nothing outside itself | PASS — `student-guardian.ts`, `mobile.ts`, `student.ts` import only from shared VO/errors |
| Application → domain only | PASS — `student.use-cases.ts` imports from `@educandow/domain` only |
| Infrastructure → domain + application | PASS — `prisma-student-guardian.repository.ts` imports from `@educandow/domain` and maps correctly |
| Presentation → application | PASS — controller imports from use-cases, not domain directly |
| Repo port in domain, impl in infrastructure | PASS — `student-guardian-repository.ts` in domain; `prisma-student-guardian.repository.ts` in infra |
| Entities have behavior (VOs immutable, Result-based) | PASS — Mobile, Email follow pattern; StudentGuardian.create() returns Result; entity.update() |
| Never throw in domain/application | FAIL (WARNING-1/2) — see above |
| Migration tenant-only | PASS — both migrations in `api/prisma_tenant`; master schema untouched |
| Enum removed from all 3 barrels | PASS — entities/index.ts, personnel/index.ts, root index.ts all clean |

---

## Task completion check

All 34 tasks marked [x] in `openspec/changes/responsables-y-tutores/tasks.md` (confirmed in apply-progress).
Code matches task descriptions. T2b.12 (RELATIONSHIP_REQUIRED, no 'tutor' default) correctly implemented and spec updated.

---

## Endpoint contract verification

| Method | Route | Status | Notes |
|---|---|---|---|
| POST | `/students/:id/guardians` | ✓ | 201; dispatches by `userId` presence |
| PATCH | `/students/:id/guardians/:guardianId` | ✓ | 200; UpdateStudyTutorUseCase |
| GET | `/students/:id/guardians` | ✓ | 200; full shape per REQ-RYT-12 |
| DELETE | `/students/:id/guardians/:guardianId` | ✓ | 204 |
| PATCH | `/students/:id` | ✓ | 200; fatherEmail/motherEmail threaded; 403 for TUTOR role |

---

## Overall Verdict

**PASS WITH WARNINGS** — 0 CRITICAL, 2 WARNING, 2 SUGGESTION.

All 14 requirements verified against code. Test suite fully GREEN (1735 api + 1181 domain + 516 web = 3432 tests passing). Pre-existing integration failure in subject-group-filter confirmed unrelated. Architecture clean except for the noted throw violations in PatchStudentUseCase (extended by fatherEmail addition) and pre-existing throws in Remove/List guardian use cases. No blocking issues.

**Recommended next step**: `sdd-archive`
