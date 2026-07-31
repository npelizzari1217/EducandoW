# Delta Spec — materia-grupo-ciclo-result-migration

## Purpose

This change is a **consumer** of the canonical capability `application-error-handling`
(`openspec/specs/application-error-handling/spec.md`) — it does not create a new capability.
It closes the `materia-grupo-ciclo` throw-based holdout under that capability's established
requirement "No throw in application/ — Result propagation only". Of the 17 throws inventoried,
16 are actionable in this change; the 17th (`update-grupo.use-case.ts:43`) is an infra guard that
is explicitly DEFERRED and remains a `throw` (see MGCM-R6).

**Honesty note.** Of the 16 actionable throws, **15 are mechanical** (`NotFoundError` → 404,
`ValidationError` → 400, `AlumnoAlreadyInGrupoError` → 409 — only the propagation mechanism
changes, not the observable HTTP contract) and **exactly 1 is a behavior correction**
(`add-student-to-grupo.use-case.ts:53`, a bare `Error` escaping as `500`, corrected to `422` via a
**new** `DomainError` subclass, `GrupoMateriaMismatchError`). Any requirement below that reads as
"status unchanged" is intentional, not a placeholder for a bug fix — only MGCM-R3 introduces an
observable behavior change.

## Requirements

### MGCM-R1: No throw remains in the 9 migrated use-cases and the `validateTeacherLevel` helper

`SetMateriaEsOptativaUseCase.execute`, `RemoveStudentFromMateriaUseCase.execute`,
`AddStudentToMateriaUseCase.execute`, `ListEnrollableStudentsForMateriaUseCase.execute`,
`UpdateGrupoUseCase.execute`, `CreateGrupoUseCase.execute`, `DeleteGrupoUseCase.execute`,
`RemoveStudentFromGrupoUseCase.execute`, `AddStudentToGrupoUseCase.execute`, and the
`validateTeacherLevel(...)` helper function MUST NOT `throw` for expected business-logic failures.
Each MUST return `Result<T, Error>`, propagating every such failure as `err(...)` of the matching
error type, per the canonical capability's "No throw in application/" requirement.

**EXCEPTION (explicit, not an oversight):** the infra guard at `update-grupo.use-case.ts:43`
(`throw new Error('No tenant client available')`) is OUT OF SCOPE for this requirement and MUST
remain a `throw` — see MGCM-R6.

#### Scenario: Each of the 9 use-cases returns err, not throw, on its NotFoundError guard(s)
- GIVEN an id (materia, grupo, course-cycle, or membership) that does not exist, for any of the 9 use-cases listed above that guard on existence
- WHEN the use case's `execute(...)` runs
- THEN it MUST NOT throw; it MUST return a `Result` with `isErr()` true and `unwrapErr()` an instance of the matching `NotFoundError`

#### Scenario: AddStudentToGrupo returns err, not throw, on AlumnoAlreadyInGrupoError
- GIVEN an `alumnosXMateriaXCursoXCicloId` already assigned to another grupo of the same materia
- WHEN `AddStudentToGrupoUseCase.execute(...)` runs
- THEN it MUST NOT throw; it MUST return a `Result` with `isErr()` true and `unwrapErr()` an instance of `AlumnoAlreadyInGrupoError`

#### Scenario: validateTeacherLevel returns err, not throw, on level mismatch
- GIVEN a `userId` whose composite levels do not include the target course-cycle's level (and the caller is neither ROOT nor ADMIN)
- WHEN `validateTeacherLevel(...)` runs
- THEN it MUST NOT throw; it MUST return a `Result` with `isErr()` true and `unwrapErr()` an instance of `ValidationError`

#### Scenario: update-grupo's infra guard is excluded from this requirement
- GIVEN the full diff of this change
- WHEN inspecting `update-grupo.use-case.ts:43`
- THEN that line MUST still be a `throw new Error(...)` — it MUST NOT be migrated to `Result` by this change

### MGCM-R2: Mechanical migrations preserve HTTP status — no incidental status change

The 14 `NotFoundError` sites (across all 9 use-cases in MGCM-R1) and the 1 `AlumnoAlreadyInGrupoError`
site (`add-student-to-grupo.use-case.ts:65`) MUST map to the exact same HTTP status they produced
before this change: `NotFoundError` → 404, `AlumnoAlreadyInGrupoError` → 409. This change MUST NOT
alter any pre-existing `DOMAIN_STATUS` entry for these error classes.

#### Scenario: NotFoundError status is unchanged
- GIVEN any of the 14 not-found conditions migrated under MGCM-R1
- WHEN the corresponding request is made after this change lands
- THEN the HTTP response status MUST be `404`, identical to the pre-migration `throw`-based path

#### Scenario: AlumnoAlreadyInGrupoError status is unchanged
- GIVEN the add-student-to-grupo "already assigned" condition
- WHEN the corresponding request is made after this change lands
- THEN the HTTP response status MUST be `409`, identical to the pre-migration `throw`-based path

### MGCM-R3: `GrupoMateriaMismatchError` corrects the MGC-R4 mismatch from 500 to 422

`AddStudentToGrupoUseCase.execute` MUST replace the bare `throw new Error(...)` at the grupo⊆materia
containment check (previously `add-student-to-grupo.use-case.ts:53`) with
`return err(new GrupoMateriaMismatchError(...))`. `GrupoMateriaMismatchError` MUST `extends DomainError`,
MUST fix `code = 'GRUPO_MATERIA_MISMATCH'`, and MUST be added to `DOMAIN_STATUS`
(`exception.filter.ts`) mapped to **422**. This is the ONE behavior correction in this change; every
other requirement in this spec preserves the pre-existing HTTP contract.

This requirement MUST be implemented RED-first: the pre-existing unit and controller tests for this
condition use a loose `.rejects.toThrow(/regex/)`-style assertion that would still pass against a
generic `Error`. Those tests MUST be tightened to assert
`unwrapErr()` `instanceof GrupoMateriaMismatchError` (unit) and HTTP `422` with
`error.code === 'GRUPO_MATERIA_MISMATCH'` (controller-spec) BEFORE the production code changes land,
so the tightened assertion fails against the old bare-`Error`/500 behavior and passes only after the fix.

#### Scenario: Grupo/materia mismatch returns err(GrupoMateriaMismatchError), not throw
- GIVEN an `alumnosXMateriaXCursoXCicloId` whose `materiaXCursoXCicloId` does not equal the target grupo's `materiaXCursoXCicloId`
- WHEN `AddStudentToGrupoUseCase.execute(...)` runs
- THEN it MUST NOT throw; it MUST return a `Result` with `isErr()` true and `unwrapErr()` an instance of `GrupoMateriaMismatchError`

#### Scenario: Mismatch maps to HTTP 422, not 500
- GIVEN the same mismatch condition reaches the API (use case → controller → `AppExceptionFilter`)
- WHEN the request completes
- THEN the HTTP response status MUST be `422` (NOT `500`) and `error.code` MUST be `GRUPO_MATERIA_MISMATCH`

#### Scenario: Regression — a test still asserting 500 for this condition is a failing regression
- GIVEN any test in the suite that asserts (or would pass under) a `500` response, or a bare-`Error`
  assertion loose enough to pass against a generic `Error`, for the grupo/materia mismatch condition
- WHEN this change lands
- THEN that test MUST be tightened to assert `422` / `instanceof GrupoMateriaMismatchError` — a test
  still passing for `500` or a generic `Error` on this condition afterward MUST be treated as a
  failing regression, not as an accepted delta

#### Scenario: GrupoMateriaMismatchError is not confused with the 409 bucket
- GIVEN the DOMAIN_STATUS 409 bucket, which is reserved for "already exists / already assigned / closed / overlap" semantics
- WHEN `GRUPO_MATERIA_MISMATCH` is added to `DOMAIN_STATUS`
- THEN it MUST be mapped to `422`, not `409` — the mismatch is an invalid relation between two entities, not a state conflict

### MGCM-R4: `validateTeacherLevel` helper migrates atomically with both its callers

`validateTeacherLevel(...)` MUST be migrated to return `Result<void, ValidationError>` in the same
slice (Slice B) as its two callers, `CreateGrupoUseCase.execute` and `UpdateGrupoUseCase.execute`.
Both callers MUST be updated to check the returned `Result` and propagate its `err(...)` unchanged
(same `ValidationError`, same 400) rather than calling the helper as a throwing function. This
helper MUST NOT land in a state where one caller has been migrated to consume it as a `Result` and
the other still expects it to throw.

#### Scenario: Helper failure propagates through CreateGrupoUseCase
- GIVEN a `userId` whose composite levels do not include the target course-cycle's level
- WHEN `CreateGrupoUseCase.execute(...)` calls `validateTeacherLevel(...)`
- THEN `CreateGrupoUseCase.execute` MUST NOT throw; it MUST return `err(ValidationError)`, unchanged from the pre-migration `throw`-based `ValidationError`/400 behavior

#### Scenario: Helper failure propagates through UpdateGrupoUseCase
- GIVEN the same level-mismatch condition
- WHEN `UpdateGrupoUseCase.execute(...)` calls `validateTeacherLevel(...)`
- THEN `UpdateGrupoUseCase.execute` MUST NOT throw; it MUST return `err(ValidationError)`, unchanged from the pre-migration `throw`-based `ValidationError`/400 behavior

#### Scenario: Helper and both callers land together
- GIVEN the full diff of Slice B
- WHEN inspecting `validate-teacher-level.ts`, `create-grupo.use-case.ts`, and `update-grupo.use-case.ts`
- THEN all three files MUST appear in the same slice — the helper's signature change MUST NOT be split from either caller

### MGCM-R5: Controller adopts the `if (isErr) throw unwrapErr()` idiom on the 9 in-scope endpoints

`MateriaGrupoCicloController`'s 9 endpoints that call a migrated use-case — `addStudentToMateria`,
`createGrupo`, `listAlumnosMateria` (only its `eligible=true` conditional branch, which delegates to
`ListEnrollableStudentsForMateriaUseCase`), `removeStudentFromMateria`, `setMateriaEsOptativa`,
`addStudentToGrupo`, `updateGrupo`, `deleteGrupo`, `removeStudentFromGrupo` — MUST adopt
`if (result.isErr()) throw result.unwrapErr();` (the idiom already established by
`course-cycle-result-migration` and `course-cycle-alumnos-result-migration`), unwrapping the ok
payload only after that check. The 4 endpoints that do not call a migrated use-case (`listMaterias`,
`listGrupos`, `listAlumnosGrupo`, `listGruposGlobal`) MUST remain unchanged. `createGrupo`'s
pre-existing raw-Prisma enrichment block (`TenantContext.getClient()` + `NotFoundException` from
Nest, lines 157-165) is a PRE-EXISTING anti-pattern and MUST NOT be touched by this change — it is
tracked as a separate follow-up.

#### Scenario: Each in-scope endpoint throws the unwrapped error
- GIVEN any of the 9 in-scope endpoints receives an `err(...)` result from its use case
- WHEN the controller method runs
- THEN it MUST call `throw result.unwrapErr()` and MUST NOT swallow, re-wrap, or transform the error

#### Scenario: Non-in-scope list endpoints are unaffected
- GIVEN the full diff of this change
- WHEN inspecting `listMaterias`, `listGrupos`, `listAlumnosGrupo`, and `listGruposGlobal`
- THEN their implementation MUST be unchanged

#### Scenario: createGrupo's raw-Prisma anti-pattern is untouched
- GIVEN the full diff of this change
- WHEN inspecting `createGrupo`'s enrichment block (`TenantContext.getClient()` + Prisma + `NotFoundException`)
- THEN that block MUST NOT be modified by this change

### MGCM-R6: Deferred infra guard, entity constructor guards, and out-of-scope files are untouched

Per the canonical capability's tracked follow-up ("2 mistyped infrastructure guards... need a
minimal `InfrastructureError`"), the infra guard at `update-grupo.use-case.ts:43`
(`throw new Error('No tenant client available')`) and `competency.use-cases.ts:258` MUST NOT be
modeled or modified by this change — 500 is the correct status for an unbound tenant context, and
`InfrastructureError` remains unmodeled. The entity constructor guards in
`materia-x-curso-x-ciclo.ts`, `grupo-x-curso-x-materia-x-ciclo.ts`,
`alumnos-x-materia-x-curso-x-ciclo.ts`, and `alumnos-x-grupo-x-curso-x-materia-x-ciclo.ts`
(programming invariants, unreachable via normal flow) MUST remain untouched throws. This change
MUST introduce exactly **one** new error class (`GrupoMateriaMismatchError`); no other new class MUST
appear in the diff. `competency.use-cases.ts` and the `auth` module MUST NOT appear in this change's
diff.

#### Scenario: update-grupo's infra guard is untouched
- GIVEN the full diff of this change
- WHEN inspecting `update-grupo.use-case.ts:43`
- THEN that throw MUST be unmodified and MUST still map to HTTP `500`

#### Scenario: competency.use-cases.ts is untouched
- GIVEN the full diff of this change
- WHEN inspecting `competency.use-cases.ts`
- THEN that file MUST NOT appear in the diff

#### Scenario: Entity constructor guards are untouched
- GIVEN the full diff of this change
- WHEN inspecting the constructor guards of `materia-x-curso-x-ciclo.ts`, `grupo-x-curso-x-materia-x-ciclo.ts`, `alumnos-x-materia-x-curso-x-ciclo.ts`, and `alumnos-x-grupo-x-curso-x-materia-x-ciclo.ts`
- THEN none of those guards MUST be modified or wrapped in `Result`

#### Scenario: Exactly one new error class
- GIVEN the full diff of this change
- WHEN inspecting `packages/domain/src/shared/errors/`
- THEN exactly one new file MUST be added (`grupo-materia-mismatch-error.ts`) — no other new error class MUST appear

#### Scenario: auth module is untouched
- GIVEN the full diff of this change
- WHEN inspecting files under the `auth` module
- THEN no file under that module MUST appear in the diff

### MGCM-R7: Delivery as 3 independently-green stacked slices

This change MUST land as 3 stacked slices — Slice A (materia use-cases), Slice B (grupo use-cases +
`validateTeacherLevel` helper, per MGCM-R4), Slice C (`add-student-to-grupo` + `GrupoMateriaMismatchError`,
per MGCM-R3) — each based on the previous. Each slice, taken independently at its own HEAD, MUST pass
`pnpm --filter api test` and `pnpm --filter api typecheck` before the next slice is authored. Coverage
MUST remain `>= 80%` at every slice boundary.

#### Scenario: Each slice is independently green
- GIVEN any of the 3 slices checked out at its own tip (with its base already merged/stacked)
- WHEN `pnpm --filter api test` and `pnpm --filter api typecheck` are run
- THEN both MUST succeed with no failing test and no type error, independent of whether later slices exist yet

#### Scenario: Slice B keeps the helper atomic with its callers (cross-reference to MGCM-R4)
- GIVEN Slice B's diff
- WHEN inspecting which files it contains
- THEN it MUST contain `validate-teacher-level.ts` together with both `create-grupo.use-case.ts` and `update-grupo.use-case.ts` in the same slice, per MGCM-R4

#### Scenario: 3 new controller-specs land RED-first
- GIVEN the 3 endpoints with no pre-existing controller-spec coverage (`createGrupo`, `addStudentToMateria`, `addStudentToGrupo`)
- WHEN their respective slice is authored under strict-TDD mode
- THEN the new spec file for each MUST be written before the corresponding production retrofit and MUST fail (RED) against the pre-migration throw-based code before passing (GREEN) after the migration
