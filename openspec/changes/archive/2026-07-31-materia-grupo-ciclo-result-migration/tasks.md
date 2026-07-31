# Tasks — materia-grupo-ciclo-result-migration

> Ordered checklist. Delivery: 3 stacked slices (A → B → C), each independently green
> (`pnpm --filter api test` + `pnpm --filter api typecheck`, coverage ≥ 80%). TDD strict.
> Conventional commits, **NO AI attribution**. Backbone: `design.md` §2, §3, §5, §6.
> Requirement tags: **MGCM-R1..R7** (see `specs/spec.md`).

---

## Slice A — materia use-cases (branch `refactor/mgc-result-a`, base `main`)

- [x] **A0. Branch setup** — create `refactor/mgc-result-a` from `main` (tip `ad947ad`).
  _(MGCM-R7)_

### Work-unit 1 — RED: new controller spec for `addStudentToMateria`

- [x] A1. Write `api/src/presentation/materia-grupo-ciclo/__tests__/add-student-to-materia.controller.spec.ts` — model on `update-grupo.controller.spec.ts` (`Object.create(prototype)` + injected mock UC). Cases: happy (`ok(created)` → asserts `data`), `NotFoundError` re-throw (`err(new NotFoundError(...))` → asserts `.rejects`). **Confirm FAILS first** (RED) against the current throw-based `AddStudentToMateriaUseCase` before any production change lands.
  _(MGCM-R5, MGCM-R7 — "3 new controller-specs land RED-first")_
- [x] A2. Commit: `test(mgc): add-student-to-materia controller spec (RED)`

### Work-unit 2 — migrate the 4 materia use-cases to `Result`

- [x] A3. `set-materia-es-optativa.use-case.ts` → `Promise<Result<MateriaXCursoXCiclo, NotFoundError>>`; `throw new NotFoundError(...)` → `return err(new NotFoundError('MateriaXCursoXCiclo', input.id))`; success path → `return ok(...)`.
  _(MGCM-R1, MGCM-R2)_
- [x] A4. `remove-student-from-materia.use-case.ts` → `Promise<Result<void, NotFoundError>>`; guard → `return err(new NotFoundError(...))`; add `return ok(undefined)` after `removeStudent(...)`.
  _(MGCM-R1, MGCM-R2)_
- [x] A5. `add-student-to-materia.use-case.ts` → `Promise<Result<MateriasXAlumnoXCursoXCiclo, NotFoundError>>`; both guards → `return err(new NotFoundError(...))`; success → `return ok(await this.alumnosRepo.addStudent(...))`.
  _(MGCM-R1, MGCM-R2)_
- [x] A6. `list-enrollable-students-for-materia.use-case.ts` → `Promise<Result<AlumnoMateriaEnriched[], NotFoundError>>`; guard → `return err(new NotFoundError(...))`; final mapped array → `return ok(...)`.
  _(MGCM-R1, MGCM-R2)_
- [x] A7. Commit: `refactor(mgc): migrate materia use-cases to Result`

### Work-unit 3 — controller retrofit (4 endpoints)

- [x] A8. `addStudentToMateria` — adopt `if (result.isErr()) throw result.unwrapErr();` idiom; `created = result.unwrap()`.
  _(MGCM-R5)_
- [x] A9. `listAlumnosMateria` — retrofit ONLY the `eligible === 'true'` branch (delegates to `ListEnrollableStudentsForMateriaUseCase`); the `?unassigned`/full branch stays untouched.
  _(MGCM-R5)_
- [x] A10. `removeStudentFromMateria` — retrofit (void endpoint).
  _(MGCM-R5)_
- [x] A11. `setMateriaEsOptativa` — retrofit; rename unwrapped value to `materia`, existing response mapping now reads from it.
  _(MGCM-R5)_
- [x] A12. Confirm `listMaterias` (and any other non-in-scope list endpoint touched by Slice A's file) remains byte-for-byte unchanged.
  _(MGCM-R5 — "non-in-scope list endpoints are unaffected")_
- [x] A13. Commit: `refactor(mgc): retrofit materia endpoints to unwrapErr idiom`

### Work-unit 4 — mechanical test rewrites (status-preserving)

- [x] A14. Rewrite unit tests in `api/src/application/materia-grupo-ciclo/__tests__/`: `set-materia-es-optativa`, `remove-student-from-materia`, `add-student-to-materia`, `list-enrollable-students-for-materia` `.use-case.test.ts` — `.rejects.toBeInstanceOf(NotFoundError)` → `isErr()`/`unwrapErr()` pattern; happy path → `isOk()`/`unwrap()`.
  _(MGCM-R1, MGCM-R2 — status-preserving, mechanical)_
- [x] A15. Rewrite existing controller specs `set-materia-es-optativa.controller.spec.ts`, `remove-student-from-materia.controller.spec.ts`, `list-enrollable-students.controller.spec.ts` — `mockResolvedValue(obj)` → `mockResolvedValue(ok(obj))`; add `err(new NotFoundError(...))` case asserting re-throw.
  _(MGCM-R2, MGCM-R5)_
- [x] A16. Commit: `test(mgc): migrate materia unit + controller specs to Result`

### Slice A verification

- [x] A17. **Slice verification** — run `pnpm --filter api test` (scoped to `materia-grupo-ciclo` if supported, else full suite) and `pnpm --filter api typecheck`; both green. Confirm coverage ≥ 80%. Check slice diff line count against ~300-350 line budget (≤ 400 hard cap).
  _(MGCM-R7 — "each slice independently green")_ **DONE** — full suite: 2153/2154 pass (1 pre-existing Windows-path failure, empty diff, unrelated to this change); `materia-grupo-ciclo`-scoped: 110/110 pass; typecheck clean; slice diff ≈270 changed lines (well under 400 cap). Coverage: whole-project 67.67% (pre-existing baseline, not a Slice A regression); `application/materia-grupo-ciclo/` 95.6% stmts/92.5% branch; `presentation/materia-grupo-ciclo/` controller 85.84% stmts/72.22% branch (branch gap driven by out-of-scope Slice B/C endpoints, not Slice A's 4). See `apply-progress.md` for full breakdown.

---

## Slice B — grupo use-cases + `validateTeacherLevel` helper (branch `refactor/mgc-result-b`, base `refactor/mgc-result-a`)

- [x] **B0. Branch setup** — create `refactor/mgc-result-b` from `refactor/mgc-result-a` (NOT from `main`).
  _(MGCM-R7)_

### Work-unit 1 — RED: new controller spec for `createGrupo`

- [x] B1. Write `api/src/presentation/materia-grupo-ciclo/__tests__/create-grupo.controller.spec.ts` — model on `update-grupo.controller.spec.ts`; mock the `cycleId`-resolution `TenantContext` path (existing `mockGetClient` pattern) + `createGrupoUC` returning `ok(grupo)` / `err(new NotFoundError(...))`. **Confirm FAILS first** (RED) against the current throw-based `CreateGrupoUseCase`.
  _(MGCM-R5, MGCM-R7 — "3 new controller-specs land RED-first")_
- [x] B2. Commit: `test(mgc): create-grupo controller spec (RED)`

### Work-unit 2 — ATOMIC: helper + both callers in ONE commit

- [x] B3. `validate-teacher-level.ts` → `Promise<Result<void, ValidationError>>`. All 4 early no-op `return;` → `return ok(undefined)`; `throw new ValidationError(...)` → `return err(new ValidationError('La materia no pertenece al nivel del docente'))`; terminal happy path → `return ok(undefined)`.
  _(MGCM-R4 — helper migration)_
- [x] B4. `create-grupo.use-case.ts` → `Promise<Result<GrupoXCursoXMateriaXCiclo, NotFoundError | ValidationError>>`; `NotFoundError` guard → `return err(...)`; call site propagates helper `Result` (`if (levelCheck.isErr()) return err(levelCheck.unwrapErr());`); success → `return ok(...)`.
  _(MGCM-R1, MGCM-R2, MGCM-R4)_
- [x] B5. `update-grupo.use-case.ts` → `Promise<Result<GrupoXCursoXMateriaXCiclo, NotFoundError | ValidationError>>`; 2 `NotFoundError` guards → `return err(...)`; call site propagates helper `Result`; success → `return ok(...)`. **The infra guard at `:43` (`throw new Error('No tenant client available')`) MUST stay a `throw` — do not touch it.**
  _(MGCM-R1, MGCM-R2, MGCM-R4, MGCM-R6 — infra guard exception)_
- [x] B6. Verify `validate-teacher-level.ts`, `create-grupo.use-case.ts`, and `update-grupo.use-case.ts` all land in this SAME commit — no split.
  _(MGCM-R4 — atomicity, "helper and both callers land together")_
- [x] B7. Commit: `refactor(mgc): migrate validateTeacherLevel + grupo use-cases to Result` (helper + both callers, ONE atomic commit)

### Work-unit 3 — remaining mechanical Slice-B use-cases

- [x] B8. `delete-grupo.use-case.ts` → `Promise<Result<void, NotFoundError>>`; guard → `return err(...)`; add `return ok(undefined)` after `delete(id)`.
  _(MGCM-R1, MGCM-R2)_
- [x] B9. `remove-student-from-grupo.use-case.ts` → `Promise<Result<void, NotFoundError>>`; guard → `return err(...)`; add `return ok(undefined)`.
  _(MGCM-R1, MGCM-R2)_
- [x] B10. Commit: `refactor(mgc): migrate delete-grupo and remove-student-from-grupo to Result` (may be folded into B7 if diff stays small; keep separate if it helps stay under budget)

### Work-unit 4 — controller retrofit (4 endpoints)

- [x] B11. `createGrupo` — retrofit; rename `Result` var to `grupoResult` (avoid shadow with unwrapped `grupo`); enrichment block (`:157-165`, raw-Prisma + `NotFoundException`) stays UNTOUCHED.
  _(MGCM-R5 — var-shadow rename, "createGrupo's raw-Prisma anti-pattern is untouched")_
- [x] B12. `updateGrupo` — retrofit; rename `Result` var to `grupoResult`.
  _(MGCM-R5 — var-shadow rename)_
- [x] B13. `deleteGrupo` — retrofit (void endpoint).
  _(MGCM-R5)_
- [x] B14. `removeStudentFromGrupo` — retrofit (void endpoint).
  _(MGCM-R5)_
- [x] B15. Confirm `listGrupos`, `listAlumnosGrupo`, `listGruposGlobal` remain unchanged.
  _(MGCM-R5 — non-in-scope list endpoints unaffected)_
- [x] B16. Commit: `refactor(mgc): retrofit grupo endpoints to unwrapErr idiom`

### Work-unit 5 — mechanical test rewrites (status-preserving)

- [x] B17. Rewrite unit tests: `update-grupo`, `create-grupo`, `delete-grupo`, `remove-student-from-grupo` `.use-case.test.ts`. `update-grupo` KEEPS a `.rejects.toThrow('No tenant client available')` case for the infra guard (still throws — MGCM-R6). Add a `validateTeacherLevel` `ValidationError` propagation case to BOTH `create-grupo` and `update-grupo` tests asserting `unwrapErr()` `instanceof ValidationError`.
  _(MGCM-R2, MGCM-R4, MGCM-R6 — infra guard test unchanged)_
- [x] B18. Rewrite existing controller specs `delete-grupo.controller.spec.ts`, `update-grupo.controller.spec.ts` to `ok()`/`err()` pattern.
  _(MGCM-R2, MGCM-R5)_
- [x] B19. Commit: `test(mgc): migrate grupo unit + controller specs to Result`

### Slice B verification

- [x] B20. **Slice verification** — `pnpm --filter api test` + `pnpm --filter api typecheck` green at Slice B's own tip (Slice A already stacked underneath); coverage ≥ 80%. Check slice diff line count against ~350-400 budget; if > 400, split into B1 (mechanical) / B2 (create+helper) per design fallback.
  _(MGCM-R7)_ **DONE** — `materia-grupo-ciclo`-scoped: 115/115 pass; full suite: 2174/2175 pass (1 pre-existing Windows-path failure, empty diff, unrelated); typecheck clean; slice diff = 369 changed lines (under the 400 cap). Coverage: `application/materia-grupo-ciclo/` 95.76% stmts/94.04% branch; `presentation/materia-grupo-ciclo/` controller 80.17% stmts/79.03% branch. Whole-project 68.02% stmts is the pre-existing monorepo baseline (not a Slice B regression). See `apply-progress.md` Slice B section for full breakdown.

---

## Slice C — `add-student-to-grupo` + `GrupoMateriaMismatchError` (branch `refactor/mgc-result-c`, base `refactor/mgc-result-b`)

- [x] **C0. Branch setup** — create `refactor/mgc-result-c` from `refactor/mgc-result-b`.
  _(MGCM-R7)_

### Work-unit 1 — new `GrupoMateriaMismatchError` domain class

- [x] C1. New file `packages/domain/src/shared/errors/grupo-materia-mismatch-error.ts` — `extends DomainError`, zero-arg constructor, `code = 'GRUPO_MATERIA_MISMATCH'`, client message `'El alumno no pertenece al universo de la materia de este grupo'` (mirrors `AlumnoAlreadyInGrupoError`).
  _(MGCM-R3, MGCM-R6 — exactly one new error class)_
- [x] C2. Export line in `packages/domain/src/index.ts` immediately after `AlumnoAlreadyInGrupoError`'s export line: `export { GrupoMateriaMismatchError } from './shared/errors/grupo-materia-mismatch-error';`.
  _(MGCM-R3)_
- [x] C3. `DOMAIN_STATUS` entry in `api/src/presentation/shared/filters/exception.filter.ts` — add `GRUPO_MATERIA_MISMATCH: 422,` next to `ALUMNO_ALREADY_IN_GRUPO: 409` in the Materia-grupo-ciclo block. No existing entry modified.
  _(MGCM-R2, MGCM-R3 — 422 not 409)_
- [x] C4. New domain unit test (mirroring `AlumnoAlreadyInGrupoError`'s test if present) asserting `new GrupoMateriaMismatchError().code === 'GRUPO_MATERIA_MISMATCH'` and `instanceof DomainError`.
  _(MGCM-R3)_
- [x] C5. Commit: `feat(domain): add GrupoMateriaMismatchError (422)` (class + export + DOMAIN_STATUS + domain unit test)

### Work-unit 2 — RED: tighten MGC-R4 unit assertions + new controller spec (BOTH before the production fix)

- [x] C6. Tighten `add-student-to-grupo.use-case.test.ts` MGC-R4 cases (currently `.rejects.toThrow(/universe.*materia|MGC-R4/i)` and a loose `.rejects.toThrow()`) to `expect(r.unwrapErr()).toBeInstanceOf(GrupoMateriaMismatchError)`. **Confirm FAILS first** (RED) — the current bare `Error` is NOT an instance of `GrupoMateriaMismatchError`.
  _(MGCM-R3 — RED-first, "regression — a test still asserting 500... MUST be treated as a failing regression")_
- [x] C7. Also tighten in the same file: `AlumnoAlreadyInGrupoError` cases → `unwrapErr()` instanceof `AlumnoAlreadyInGrupoError`; the 2 `NotFoundError` cases → `unwrapErr()` instanceof `NotFoundError`; happy path → `isOk()`. (Mechanical, status-preserving — no RED requirement for these three.)
  _(MGCM-R1, MGCM-R2)_
- [x] C8. Write `api/src/presentation/materia-grupo-ciclo/__tests__/add-student-to-grupo.controller.spec.ts` (no coverage today) — cases: happy (`ok(created)`), `NotFoundError` re-throw, `AlumnoAlreadyInGrupoError` re-throw, **and the 422 case**: mock `addStudentToGrupoUC.execute` → `err(new GrupoMateriaMismatchError())`, assert controller throws it; companion assertion confirms `DOMAIN_STATUS['GRUPO_MATERIA_MISMATCH'] === 422`. **Confirm FAILS first** (RED) against the pre-migration throw-based/500 behavior.
  _(MGCM-R3, MGCM-R5, MGCM-R7 — RED-first, "3 new controller-specs land RED-first")_
- [x] C9. Commit: `test(mgc): tighten add-student-to-grupo unit to 422/GrupoMateriaMismatchError (RED)`
- [x] C10. Commit: `test(mgc): add-student-to-grupo controller spec incl. 422 case (RED)`

### Work-unit 3 — production fix: migrate `add-student-to-grupo.use-case.ts` (turns C6/C8 GREEN)

- [x] C11. `add-student-to-grupo.use-case.ts` → `Promise<Result<AlumnosXGrupoXCursoXMateriaXCiclo, NotFoundError | GrupoMateriaMismatchError | AlumnoAlreadyInGrupoError>>`. Import `{ NotFoundError, AlumnoAlreadyInGrupoError, GrupoMateriaMismatchError, ok, err, Result }`.
- [x] C12. Two `NotFoundError` guards (`GrupoXCursoXMateriaXCiclo`, `MateriasXAlumnoXCursoXCiclo`) → `return err(new NotFoundError(...))`.
  _(MGCM-R1, MGCM-R2)_
- [x] C13. **The MGC-R4 fix**: replace the bare `throw new Error('Student is not in the universe... MGC-R4...')` with `return err(new GrupoMateriaMismatchError())` — the ONE behavior correction in this change (500 → 422).
  _(MGCM-R3 — production fix, must land AFTER C6/C8 are confirmed RED)_
- [x] C14. `AlumnoAlreadyInGrupoError` guard → `return err(new AlumnoAlreadyInGrupoError())`.
  _(MGCM-R1, MGCM-R2)_
- [x] C15. Success path → `return ok(await this.alumnosGrupoRepo.addStudent(...))`.
- [x] C16. Confirm C6, C7, C8 now pass GREEN against this production change.
- [x] C17. Commit: `fix(mgc): map grupo⊆materia mismatch to 422 via Result` (the 500→422 production fix, turns RED green)

### Work-unit 4 — controller retrofit (1 endpoint)

- [x] C18. `addStudentToGrupo` — adopt `if (result.isErr()) throw result.unwrapErr();` idiom; rename unwrapped value to `created` (var-shadow avoidance per design). Confirm the unwrapped `GrupoMateriaMismatchError` flows through `AppExceptionFilter` → `DOMAIN_STATUS` → 422 end-to-end.
  _(MGCM-R3, MGCM-R5 — var-shadow rename)_
- [x] C19. Commit: `refactor(mgc): retrofit add-student-to-grupo endpoint to unwrapErr idiom`

### Slice C verification

- [x] C20. Confirm `competency.use-cases.ts`, the `auth` module, and the 4 entity constructor guards (`materia-x-curso-x-ciclo.ts`, `grupo-x-curso-x-materia-x-ciclo.ts`, `alumnos-x-materia-x-curso-x-ciclo.ts`, `alumnos-x-grupo-x-curso-x-materia-x-ciclo.ts`) do NOT appear in the diff.
  _(MGCM-R6)_ **DONE** — confirmed via `git diff --name-only refactor/mgc-result-b HEAD | grep -iE "competency|auth/|materia-x-curso-x-ciclo\.ts|grupo-x-curso-x-materia-x-ciclo\.ts|alumnos-x-materia-x-curso-x-ciclo\.ts|alumnos-x-grupo-x-curso-x-materia-x-ciclo\.ts"` → no matches.
- [x] C21. Confirm exactly one new error class in `packages/domain/src/shared/errors/` across the WHOLE 3-slice change (`grupo-materia-mismatch-error.ts`).
  _(MGCM-R6)_ **DONE** — `git diff --name-status main HEAD -- packages/domain/src/shared/errors/` shows only `A grupo-materia-mismatch-error.ts`.
- [x] C22. **Slice verification** — `pnpm --filter api test` + `pnpm --filter api typecheck` green at Slice C's own tip; coverage ≥ 80%. Check slice diff line count against ~270-320 budget (≤ 400 hard cap). Confirm integration `.db.test.ts` files (`mgc-s13.isolation`, `mgc-generate`/`materialize-materias`) and unmigrated list specs (`list-materias`, `list-grupos*`, `list-alumnos-grupo`) are unaffected.
  _(MGCM-R7)_ **DONE** — `materia-grupo-ciclo`-scoped: 119/119 pass; full suite: 2179/2180 pass (1 pre-existing Windows-path failure, empty diff, unrelated); typecheck clean; slice diff = 9 files, 221 insertions(+)/41 deletions(-) = 262 changed lines (well under the 400 cap). See `apply-progress.md` Slice C section for coverage breakdown.

---

## Review Workload Forecast

| Slice | Est. changed lines | 400-line budget risk | Chained PRs | Decision before apply |
|---|---|---|---|---|
| A | ~300-350 | Medium | Yes (3 stacked) | Yes — **decided: chained** |
| B | ~350-400 | Medium (fallback: split B1 mechanical / B2 create+helper if > 400) | Yes | Yes — **decided: chained** |
| C | ~270-320 | Medium | Yes | Yes — **decided: chained** |
| **Aggregate** | **~800-1000** | **High** | **Yes (3 stacked)** | **Yes — decided: chained** |

`Decision needed before apply: YES · Chained PRs: YES · 400-line budget risk: HIGH (aggregate)`.
Delivery strategy already settled at design time: 3 independently-green stacked PRs (A → B → C).
`sdd-apply` MUST implement one slice at a time, verifying each before authoring the next.

Rollback order if needed: revert C → B → A (purely additive; no schema/data migration).

---

## Persistence

- **openspec** (source of truth): this file — `openspec/changes/materia-grupo-ciclo-result-migration/tasks.md`.
- **engram**: **backfill pending** (`mem_save` not available to this sub-agent). Topic key:
  `sdd/materia-grupo-ciclo-result-migration/tasks` · `project: educandow` · `type: architecture` ·
  `scope: project` · `capture_prompt: false`.
