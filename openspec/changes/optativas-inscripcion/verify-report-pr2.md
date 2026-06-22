# Verify Report — PR2 (optativas-inscripcion)

> Phase: sdd-verify · Scope: PR2 only (PR1 already merged, PR3 out of scope)
> Date: 2026-06-22
> Verdict: **PASS WITH WARNINGS**
> Findings: 0 CRITICAL · 2 WARNING · 1 SUGGESTION
> Safe to commit + PR: **YES**

---

## Test Run

```
pnpm --filter api test
Test Files: 160 passed (160)
Tests:      1517 passed (1517)
Duration:   36.08s
```

All green. +7 test files, +27 tests added by PR2.

```
pnpm --filter api typecheck
exit 0, 0 errors
```

---

## Task Completion

All T2.1–T2.16 marked [x] in tasks.md and confirmed by code inspection. PR2 is the only open slice.

---

## Authz (D8) — PASS

DELETE `/course-cycles/:ccId/materias/:materiaId/alumnos/:id`:
- `@Roles('ROOT', { module: 'COURSE_CYCLES', action: 'DELETE' })` — present and correct (D8)
- Mirrors `DELETE /grupos/:grupoId/alumnos/:alumnoXGrupoId` exactly

PATCH `/course-cycles/:ccId/materias/:materiaId`:
- `@Roles('ROOT', { module: 'COURSE_CYCLES', action: 'UPDATE' })` — present and correct (D8)
- Mirrors `PATCH /grupos/:id` exactly

Both endpoints carry `@UseGuards(AuthGuard, RolesGuard)` via the class-level decorator. 3-door model correctly applied. No missing or weaker guard on any mutating endpoint.

---

## Endpoint Contracts — PASS (with WARNING on PATCH response)

**DELETE (MGC-R9, MGC-S19, MGC-S20)**
- Bridge-row id in `:id` param ✓
- `@HttpCode(HttpStatus.NO_CONTENT)` → 204 ✓
- NotFoundError on missing materia → propagates as 404 ✓
- Delegates to `RemoveStudentFromMateriaUseCase` ✓

**PATCH (MGC-R10, MGC-S23, MGC-S24)**
- Zod body `{ esOptativa: z.boolean() }` ✓
- Returns `MateriaResponse` with updated `esOptativa` ✓
- NotFoundError on missing materia → 404 ✓
- See WARNING-2 below for response shape issue

**GET `?eligible=true` (D5)**
- `eligible === 'true'` wins over `unassigned` (mutual exclusion correct) ✓
- Delegates to `ListEnrollableStudentsForMateriaUseCase` ✓
- Eligible = CC students minus materia universe (set diff on `studentId`) ✓

**`esOptativa` in `MateriaResponse` (MGC-R12, MGC-S27)**
- `MateriaResponse` interface has `esOptativa: boolean` ✓
- `listMaterias` mapping includes `esOptativa: item.materia.esOptativa` ✓
- Controller test asserts `esOptativa: false` and `esOptativa: true` per entry ✓

---

## UC Behavior Assertions

**RemoveStudentFromMateriaUseCase** (T2.3–T2.4)
- Validates materia exists via `findById`; throws `NotFoundError` on miss ✓
- Delegates `alumnosRepo.removeStudent(alumnoXMateriaId)` ✓
- Does NOT call `removeStudent` when materia not found ✓

**SetMateriaEsOptativaUseCase** (T2.5–T2.6)
- Toggle to `true` and back to `false` both delegated and returned ✓
- Does NOT interact with `AlumnosXMateriaRepository` (D6 no-cleanup enforced) ✓
- `NotFoundError` on missing materia ✓

**ListEnrollableStudentsForMateriaUseCase** (T2.7–T2.8)
- Set diff: CC-enrolled minus materia universe, keyed on `studentId` ✓
- All enrolled → empty result ✓
- Empty optativa → all CC students ✓
- Routes `findByCourseCycleEnriched` via `materia.courseCycleId` ✓
- Projects `{ id, studentId, studentName }` correctly in implementation ✓

---

## WARNINGS

### WARNING-1 — MGC-S22 violated: DELETE is idempotent, spec requires 404 on missing bridge-row

**Spec (MGC-R9 / MGC-S22, RFC 2119 MUST):**
> "Removing a student when no enrollment record exists MUST return HTTP 404"

**Implementation:**
- `PrismaAlumnosXMateriaRepository.removeStudent` uses `deleteMany({ where: { id } })` — returns `void`, discards the `BatchPayload.count`
- `RemoveStudentFromMateriaUseCase` validates the materia exists but does NOT check whether the bridge-row exists
- DELETE endpoint returns 204 even when `alumnoXMateriaId` refers to a non-existent row (as long as the materia itself exists)
- Controller test T3 explicitly validates idempotent double-call as success (embedding the violation in the test suite)

**How it got here:** The tasks deliberately designed idempotency at all layers (T2.1: "no throw (idempotent via deleteMany)", T2.3 test suite: no scenario for missing bridge-row → 404). Design D4 says "Idempotent: deleting a non-existent id is a no-op."

**Impact:** The UI always refetches after DELETE, so there's no practical regression. However, the RFC 2119 MUST contract is broken and cannot be relied on by any client that checks the status code to distinguish "never enrolled" from "just removed."

**Resolution options:**
A. Amend the spec: change MGC-S22 to allow 204 (idempotent delete). Update spec, tasks, and controller test.
B. Fix the implementation: change `removeStudent` return type to `{ count: number }`, check in the UC, throw `NotFoundError` when `count === 0`, add controller test for 404.

Option A is lower risk and aligns with how similar REST APIs handle DELETE-by-id idempotency. Option B strictly complies with the spec.

---

### WARNING-2 — PATCH response: `subjectName` equals `subjectId` UUID, counts always 0

**Controller handler (line 322):**
```ts
subjectName: materia.subjectId,  // NOTE: returns the UUID, not the resolved name
alumnosCount: 0,
gruposCount: 0,
```

**MGC-S23:** "the response includes the updated materia with esOptativa = true AND all other fields of M are unchanged"

**Analysis:** "all other fields unchanged" refers to DB state, which IS correct (only `esOptativa` is updated). However, the PATCH response shape is misleading:
- `subjectName` will display the raw UUID (e.g., `sub-abc123`) in any client that renders it from the PATCH response
- `alumnosCount`/`gruposCount` = 0 even if the materia has enrolled students and grupos

Design section 6.2 explicitly noted this trade-off: "counts unchanged by a toggle so returning the entity fields is enough." But the comment does not address the `subjectName` issue, which is silent in the design.

**Impact:** Client MUST NOT use the PATCH response to update local materia state (counts, name). It must refetch `GET .../materias` after a toggle. The PR3 web implementation needs to be aware of this.

**Resolution:** Either resolve `subjectName` in the PATCH handler (one extra `client.subject.findUnique`) or document the response contract explicitly: "PATCH response contains `subjectName = subjectId` and zeroed counts; consumer must refetch." No code change strictly required if PR3 is designed to refetch.

---

## SUGGESTION

### SUGGESTION-1 — Controller tests do not assert authz decorator metadata

Tasks T2.11 and T2.12 both listed "Authz: COURSE_CYCLES × DELETE/UPDATE (D8)" as a scenario to test. Neither test file uses `Reflect.getMetadata` to assert the `@Roles` decorator is present on the handler. The decorators ARE correct (verified by source), but nothing prevents a future refactor from silently dropping them.

The controller tests bypass all guards (they call the method directly), which is the existing project pattern. Still, adding two metadata assertions would lock in the authz contract:
```ts
import 'reflect-metadata';
// inside the test:
const metadata = Reflect.getMetadata('roles', MateriasGruposController.prototype, 'removeStudentFromMateria');
expect(metadata).toContainEqual({ module: 'COURSE_CYCLES', action: 'DELETE' });
```

---

## Requirement Coverage (PR2 scope only)

| Requirement | Status | Evidence |
|-------------|--------|----------|
| MGC-R9 remove student | PARTIAL | UC + endpoint correct; MGC-S22 (missing bridge-row → 404) violated (WARNING-1) |
| MGC-R9 add idempotent | PASS | Existing behavior, not regressed |
| MGC-R10 toggle PATCH | PASS | SetMateriaEsOptativaUseCase + endpoint |
| MGC-R11 no auto-cleanup | PASS | UC only injects MateriaRepo; test asserts no AlumnosRepo interaction |
| MGC-R12 esOptativa in GET | PASS | DTO + mapping + controller test (MGC-S27) |
| D3 setEsOptativa method | PASS | Dedicated port method, Prisma impl, UC |
| D4 remove by bridge-row id | PASS | id param, deleteMany |
| D5 eligible = CC minus universe | PASS | UC set diff, controller eligible branch |
| D8 3-door authz (DELETE + PATCH) | PASS | Decorators present and correct |

---

## Safe to PR?

**YES.** No CRITICAL findings. The two WARNINGs are known trade-offs documented in the design, not security or data-integrity issues. The idempotency decision (WARNING-1) requires either a spec amendment or a small implementation fix before PR merge — recommend deciding which before opening the PR to avoid post-review churn. WARNING-2 (PATCH response shape) needs to be communicated to PR3 (web layer) so it doesn't read `subjectName` or counts from the PATCH response.

---

## Next Recommended

- Resolve WARNING-1 (spec amendment or implementation fix) before PR merge
- Communicate WARNING-2 to PR3 implementer: PATCH response must not be used to update local materia name/counts
- Then: `sdd-archive` (if WARNINGs are accepted/resolved) or `sdd-apply` PR3
