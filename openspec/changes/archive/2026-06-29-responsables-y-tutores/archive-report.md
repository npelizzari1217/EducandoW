# Archive Report — responsables-y-tutores

**Date**: 2026-06-29
**Branch**: feat/student-emails
**Verdict at archive**: PASS WITH WARNINGS (0 CRITICAL, 2 WARNING, 2 SUGGESTION)
**Artifact store**: hybrid (engram + openspec)

---

## Archive location

`openspec/changes/archive/2026-06-29-responsables-y-tutores/`
(Naming convention: `YYYY-MM-DD-{change-name}`)

---

## Engram observation IDs (for traceability)

| Artifact | Engram topic key | Obs ID |
|---|---|---|
| Proposal | `sdd/responsables-y-tutores/proposal` | #1576 |
| Spec (student-guardian delta) | `sdd/responsables-y-tutores/spec` | (see engram) |
| Spec (student-emails delta) | `sdd/responsables-y-tutores/spec` | (see engram) |
| Design | `sdd/responsables-y-tutores/design` | (see engram) |
| Tasks | `sdd/responsables-y-tutores/tasks` | (see engram) |
| Verify report | `sdd/responsables-y-tutores/verify-report` | (see engram) |
| Archive report | `sdd/responsables-y-tutores/archive-report` | (this file) |

---

## Spec merges performed

### 1. `openspec/specs/student-guardian/spec.md` (updated)

Delta from `specs/student-guardian/spec.md` fully merged. The main spec now includes:

- **Entity** section updated: `userId` optional, `relationship` free text ≤15 chars (enum removed), new fields (`fullName`, `mobile`, `email`, `active`, `updatedAt`), `create()` returns `Result`.
- **REQ-RYT-02**: Extended fields with scenarios RYT-02-A/B
- **REQ-RYT-03**: userId optional / portal inference with scenarios RYT-03-A/B
- **REQ-RYT-04**: relationship free text with scenarios RYT-04-A/B/C
- **REQ-RYT-05**: `CreateStudyTutorUseCase` with scenarios RYT-05-A/B/C/D/E/F/G (including RELATIONSHIP_REQUIRED — user decision 2026-06-29)
- **REQ-RYT-06**: `UpdateStudyTutorUseCase` with scenarios RYT-06-A/B/C/D
- **REQ-RYT-07**: `AssignGuardianUseCase` (portal links only) with scenarios RYT-07-A/B + original assign scenarios
- **REQ-RYT-08**: Uniqueness (DB + app layer) with scenarios RYT-08-A/B/C/D
- **REQ-RYT-09**: N tutors per student with scenario RYT-09-A
- **REQ-RYT-10**: Portal my-children exclusion with scenarios RYT-10-A/B
- **REQ-RYT-11**: Mobile VO with scenarios RYT-11-A/B/C
- **REQ-RYT-12**: List includes all record types with scenarios RYT-12-A/B + original list scenarios
- **REQ-RYT-13**: UI admin panel with scenarios RYT-13-A/B/C/D
- **REQ-RYT-14**: Email pre-fill from legajo (only when email field empty) with scenarios RYT-14-A/B/C/D
- Preserved unchanged: Remove Guardian, Legacy Guardian Data Migration

### 2. `openspec/specs/student-profile/spec.md` (updated)

Delta from `specs/student-emails/spec.md` (REQ-RYT-01) merged as a new Requirement section. The main spec now includes:

- **REQ-RYT-01**: `fatherEmail` / `motherEmail` on Student with scenarios RYT-01-A/B/C/D/E/F
  - `Email` VO reused (no new VO)
  - Fields NOT in `ALLOWED_TUTOR_FIELDS` (admin-only)
  - Legajo identity fields — independent from `StudentGuardian.email`

No new main spec file was created for `student-emails` — the delta was merged directly into `student-profile/spec.md` (its declared delta-against target).

---

## Carry-over technical debt

### WARNING-1: Throws in application layer — PatchStudentUseCase

**Topic key**: `tech-debt/throw-in-application-layer`

`PatchStudentUseCase.applyChanges()` returns `Student`, not `Result`. The fatherEmail/motherEmail email validation (added by this change) throws `result.unwrapErr()` in lines 202–204 and 211–213 of `student.use-cases.ts`. This extended a pre-existing violation of the "never throw in domain/application" standard. The correct fix is to make `execute()` return `Promise<Result<Student, DomainError>>`.

**Status**: Non-blocking. Functionally correct (controller catches, returns 400). Architecturally non-compliant. Tracked as tech debt.

### WARNING-2: Pre-existing throws in guardian use cases

**Topic key**: `tech-debt/throw-in-application-layer`

`RemoveGuardianUseCase.execute()` (line 473) and `ListGuardiansUseCase.execute()` (line 503) throw `NotFoundError` instead of returning `Result`. These pre-existed this change but are now part of the extended guardian management surface.

**Status**: Non-blocking. Pre-existing. Tracked as tech debt.

### Pre-existing unrelated failing test

`api/test/integration/asistencia/subject-group-filter.db.test.ts` — 2 tests fail independently of this change. Confirmed pre-existing (not a regression from this change).

---

## SUGGESTION carry-over (non-blocking, optional cleanup)

- **SUGGESTION-1**: Dead code `?? 'tutor'` fallback in controller guardian POST dispatch (line 134 of `student.controller.ts`). `relationship` is always required by schema, so the fallback is unreachable. Can be cleaned up in a follow-up PR.
- **SUGGESTION-2**: Email pre-fill in edit mode. The implementation pre-fills only when the email field is empty, which is the correct conservative behavior per the verified wording of REQ-RYT-14. The original spec scenarios cover creation mode only.

---

## Test suite at archive

- domain: 104 files / 1181 tests — PASS
- api: 173 files / 1735 tests — PASS
- web: 45 files / 516 tests — PASS
- Total: 3432 tests passing

---

## Change summary

34 tasks across 4 PR slices (PR1 → PR2a → PR2b → PR3), all marked [x].

| Slice | Scope |
|---|---|
| PR1 | Student fatherEmail/motherEmail + Mobile VO |
| PR2a | StudentGuardian schema + entity (Result) + repo port/impl |
| PR2b | CreateStudyTutor/UpdateStudyTutor use cases + controller dispatch + DTOs |
| PR3 | Web guardian panel — list, create, edit, email pre-fill |

One user decision captured during apply (2026-06-29): `relationship` REQUIRED on CreateStudyTutorUseCase — default `'tutor'` removed, new error code `RELATIONSHIP_REQUIRED` added. Spec (REQ-RYT-05) updated accordingly (Scenario RYT-05-G).
