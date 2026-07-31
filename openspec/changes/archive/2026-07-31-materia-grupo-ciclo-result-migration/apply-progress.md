# Apply Progress — materia-grupo-ciclo-result-migration

> **ALL 3 SLICES DONE.** Slice A merged to `main` (branch `refactor/mgc-result-a`, base `main` @
> `ad947ad`, merged via PR #115). Slice B done on `refactor/mgc-result-b`, based on
> `refactor/mgc-result-a` (i.e. `main` @ `d51f87a`, which already includes Slice A). Slice C
> (`add-student-to-grupo` + `GrupoMateriaMismatchError`, this section) is **DONE** on
> `refactor/mgc-result-c`, based on `refactor/mgc-result-b`. This is the change's final slice.

## Status

Slice A: **17/17 tasks complete** (A0–A17). Independently green at its own tip. **Merged to main.**
Slice B: **21/21 tasks complete** (B0–B20). Independently green at its own tip.
Slice C: **23/23 tasks complete** (C0–C22). Independently green at its own tip (this branch). **Final slice — change complete pending archive.**

## TDD Cycle Evidence (Strict TDD)

| Work-unit | RED | GREEN | REFACTOR | Notes |
|---|---|---|---|---|
| WU1 — `add-student-to-materia.controller.spec.ts` (new) | ✅ confirmed failing (2/2 tests) against pre-migration throw-based UC + direct-object controller | ✅ (passes after WU2+WU3 land) | n/a | RED run captured below |
| WU2 — migrate 4 materia use-cases to `Result` | n/a (mechanical prod change, tests updated in WU4) | ✅ | n/a | transiently breaks WU4's pre-migration unit tests until WU4 lands (expected, same commit-granularity as `tasks.md`/`design.md` §6) |
| WU3 — controller retrofit (4 endpoints) | n/a | ✅ | n/a | matches `design.md` §3 code blocks verbatim |
| WU4 — mechanical test rewrites (4 unit + 3 controller specs) | n/a (status-preserving) | ✅ | n/a | `.rejects.toBeInstanceOf` → `isErr()/unwrapErr()`; happy path → `isOk()/unwrap()` |

### RED confirmation (WU1, captured before any production change)

```
FAIL  add-student-to-materia.controller.spec.ts > T1: happy path
  AssertionError: expected { id: undefined, ... } to deeply equal { id: 'axm-1', ... }
FAIL  add-student-to-materia.controller.spec.ts > T2: materia not found → NotFoundError re-thrown
  AssertionError: promise resolved "{ data: {...} }" instead of rejecting
Test Files  1 failed (1)
     Tests  2 failed (2)
```

## Commits (Slice A, chronological)

| Hash | Message |
|---|---|
| `f7ca36c` | `test(mgc): add-student-to-materia controller spec (RED)` |
| `ba4ecce` | `refactor(mgc): migrate materia use-cases to Result` |
| `c1b2a73` | `refactor(mgc): retrofit materia endpoints to unwrapErr idiom` |
| `1377e41` | `test(mgc): migrate materia unit + controller specs to Result` |

Branch tip: `1377e41` on `refactor/mgc-result-a` (base `main` @ `ad947ad`).

## Files Changed

| File | Action | What Was Done |
|---|---|---|
| `api/src/application/materia-grupo-ciclo/set-materia-es-optativa.use-case.ts` | Modified | `Promise<MateriaXCursoXCiclo>` → `Promise<Result<MateriaXCursoXCiclo, NotFoundError>>`; `throw` → `err(...)`; success → `ok(...)` |
| `api/src/application/materia-grupo-ciclo/remove-student-from-materia.use-case.ts` | Modified | `Promise<void>` → `Promise<Result<void, NotFoundError>>`; `throw` → `err(...)`; added `ok(undefined)` |
| `api/src/application/materia-grupo-ciclo/add-student-to-materia.use-case.ts` | Modified | `Promise<MateriasXAlumnoXCursoXCiclo>` → `Promise<Result<MateriasXAlumnoXCursoXCiclo, NotFoundError>>`; both `throw`s → `err(...)`; success → `ok(...)` |
| `api/src/application/materia-grupo-ciclo/list-enrollable-students-for-materia.use-case.ts` | Modified | `Promise<AlumnoMateriaEnriched[]>` → `Promise<Result<AlumnoMateriaEnriched[], NotFoundError>>`; `throw` → `err(...)`; success → `ok(...)` |
| `api/src/presentation/materia-grupo-ciclo/materia-grupo-ciclo.controller.ts` | Modified | 4 endpoints (`addStudentToMateria`, `listAlumnosMateria`'s `eligible=true` branch, `removeStudentFromMateria`, `setMateriaEsOptativa`) adopt `if (result.isErr()) throw result.unwrapErr();`. `listMaterias`, `listGrupos`, `listAlumnosGrupo`, `listGruposGlobal`, `createGrupo`'s raw-Prisma block untouched. |
| `api/src/application/materia-grupo-ciclo/__tests__/set-materia-es-optativa.use-case.test.ts` | Modified | `.rejects.toBeInstanceOf` → `isErr()/unwrapErr()`; happy path → `isOk()/unwrap()` |
| `api/src/application/materia-grupo-ciclo/__tests__/remove-student-from-materia.use-case.test.ts` | Modified | same pattern |
| `api/src/application/materia-grupo-ciclo/__tests__/add-student-to-materia.use-case.test.ts` | Modified | same pattern |
| `api/src/application/materia-grupo-ciclo/__tests__/list-enrollable-students-for-materia.use-case.test.ts` | Modified | same pattern |
| `api/src/presentation/materia-grupo-ciclo/__tests__/set-materia-es-optativa.controller.spec.ts` | Modified | `mockResolvedValue(obj)` → `mockResolvedValue(ok(obj))`; `mockRejectedValue(error)` → `mockResolvedValue(err(error))` |
| `api/src/presentation/materia-grupo-ciclo/__tests__/remove-student-from-materia.controller.spec.ts` | Modified | same pattern |
| `api/src/presentation/materia-grupo-ciclo/__tests__/list-enrollable-students.controller.spec.ts` | Modified | same pattern + added a NotFoundError re-throw case (T1b) not previously covered |
| `api/src/presentation/materia-grupo-ciclo/__tests__/add-student-to-materia.controller.spec.ts` | **Created** | New RED-first controller spec (no prior coverage); happy path + `NotFoundError` re-throw |

## Verification (real results)

### `materia-grupo-ciclo`-scoped test run
```
pnpm --filter api test -- materia-grupo-ciclo
Test Files  25 passed (25)
     Tests  110 passed (110)
```

### Full suite
```
pnpm --filter api test
Test Files  1 failed | 211 passed (212)
     Tests  1 failed | 2153 passed (2154)
```
The 1 failure is **pre-existing and unrelated**: `scripts/__tests__/archive-legacy-grading-data.spec.ts`
("escribe los 5 archivos con paths {tenant-slug}/{tabla}.json") — a Windows path-separator
assertion bug (expects `/tmp/...`, receives `\tmp\...`). Confirmed pre-existing: `git diff` against
that file across this branch's full commit range is **empty** (file untouched by Slice A).

### Typecheck
```
pnpm --filter api typecheck
tsc --noEmit   → clean, no errors
```

### Coverage
Ran `pnpm --filter api exec vitest run --coverage --coverage.reportOnFailure` (the `reportOnFailure`
flag was needed because vitest's default skips the coverage summary when any test fails, and the
suite has the 1 pre-existing unrelated failure noted above). Real numbers from that run:

| Scope | Stmts | Branch | Funcs | Lines |
|---|---|---|---|---|
| **Whole project** (`api/`, all 7431 stmts) | 67.67% | — | — | — |
| `application/materia-grupo-ciclo/` (dir, incl. not-yet-migrated grupo UCs) | 95.6% | 92.5% | 96.66% | 98.73% |
| `presentation/materia-grupo-ciclo/` (whole controller file, all 9 endpoints across 3 planned slices) | 85.84% | 72.22% | 84% | 86.31% |

**Honest read:** the whole-project 67.67% figure is a **pre-existing baseline**, not a Slice A
regression — it reflects the entire legacy monorepo (e.g. `nivel-inicial`, `institution`, `modules`
controllers sit at 20-45%), most of which this change never touches. The directories this slice
actually modified are both well above 80% on stmts/funcs/lines. The one sub-80% figure — the
controller file's 72.22% branch coverage — is driven by **out-of-scope Slice B/C endpoints**
(`addStudentToGrupo` lines 348-352, `createGrupo`'s untouched raw-Prisma enrichment block) that this
slice correctly did not touch; the 4 Slice A endpoints' new `isErr()` branches are each covered both
ways (happy path + `NotFoundError` case) by the rewritten/added specs. Re-verify this figure once
Slices B and C land and their own RED-first specs cover those remaining branches.

### Slice diff line count
```
git diff --stat main...refactor/mgc-result-a -- api/src/application/materia-grupo-ciclo api/src/presentation/materia-grupo-ciclo
13 files changed, 198 insertions(+), 72 deletions(-)   → 270 changed lines
```
Well under the ~300-350 estimate and the 400-line hard cap.

## Divergences / Honesty Notes

1. **Whole-project coverage (67.67%) is below the nominal 80% gate, but this is a pre-existing
   condition of the monorepo baseline, not a Slice A regression** — see the Coverage section above
   for the directory-level breakdown showing Slice A's own directories at 85.84-95.6%. `vitest`'s
   default `coverage.reportOnFailure: false` also meant the plain `test:coverage` script silently
   skipped the report entirely (due to the 1 pre-existing failing test below); `--coverage.reportOnFailure`
   was required to force it. Flagging this honestly rather than asserting an unverified pass.
2. **Windows path separator issue** (`api/scripts/__tests__/archive-legacy-grading-data.spec.ts`) is
   confirmed pre-existing via empty `git diff` for that file — not introduced by this change.
3. No other deviations from `design.md`/`tasks.md` — controller retrofit code matches design.md §3
   code blocks verbatim (variable names, idiom, untouched blocks).

## Persistence

- **openspec** (source of truth): this file — `openspec/changes/materia-grupo-ciclo-result-migration/apply-progress.md`. `tasks.md` A0–A17 marked `[x]`.
- **engram**: **backfill pending** — `mem_save` was not available/attempted successfully in this
  sub-agent session for this artifact class; if the tool is available in a follow-up session, save
  with `topic_key: sdd/materia-grupo-ciclo-result-migration/apply-progress`, `project: educandow`,
  `type: architecture`, `scope: project`, `capture_prompt: false`, content = this file's body.

## Next Steps (as of Slice A)

- ~~Slice B: `refactor/mgc-result-b` from `refactor/mgc-result-a` (grupo use-cases + `validateTeacherLevel`, per `tasks.md` Slice B).~~ **DONE — see Slice B section below.**
- Slice C: `refactor/mgc-result-c` from `refactor/mgc-result-b` (`add-student-to-grupo` + `GrupoMateriaMismatchError`, per `tasks.md` Slice C).
- Re-confirm project-wide coverage ≥ 80% via `pnpm --filter api test:coverage --coverage.reportOnFailure` (or after the pre-existing Windows-path test is fixed separately) before final archive.

---

# SLICE B — grupo use-cases + `validateTeacherLevel` helper

> Branch `refactor/mgc-result-b`, base `refactor/mgc-result-a` (i.e. `main` @ `d51f87a`, Slice A
> already merged in). Slice A is DONE/merged (see above). Slice C is PENDING.

## Status

**21/21 tasks complete** (B0–B20). Independently green at its own tip.

## TDD Cycle Evidence (Strict TDD)

| Work-unit | RED | GREEN | REFACTOR | Notes |
|---|---|---|---|---|
| WU1 — `create-grupo.controller.spec.ts` (new) | ✅ confirmed failing (2/3 tests: T1 happy-path shape, T3 error-propagation) against pre-migration throw-based `CreateGrupoUseCase` | ✅ (passes after WU2+WU4 land) | n/a | RED run captured below |
| WU2 — ATOMIC: `validateTeacherLevel` helper + both callers (`create-grupo`, `update-grupo`) in ONE commit | n/a (mechanical prod change, tests updated in WU5) | ✅ | n/a | helper + both callers land together per MGCM-R4; `update-grupo:43` infra guard (`throw new Error('No tenant client available')`) deliberately left untouched as a `throw` |
| WU3 — remaining mechanical UCs (`delete-grupo`, `remove-student-from-grupo`) | n/a | ✅ | n/a | split into its own commit to keep WU2's atomic commit focused and both diffs small |
| WU4 — controller retrofit (4 endpoints: `createGrupo`, `updateGrupo`, `deleteGrupo`, `removeStudentFromGrupo`) | n/a | ✅ | n/a | matches `design.md` §3 code blocks verbatim; var-shadow avoided via `grupoResult`/`grupo` rename in `createGrupo`/`updateGrupo` |
| WU5 — mechanical test rewrites (4 unit + 2 controller specs) | n/a (status-preserving) | ✅ | n/a | `.rejects.toBeInstanceOf`/`.rejects.toThrow` → `isErr()/unwrapErr()`; happy path → `isOk()/unwrap()`; `update-grupo`'s infra-guard case ADDED (none existed pre-migration) asserting it STILL throws |

### RED confirmation (WU1, captured before any production change)

```
FAIL  create-grupo.controller.spec.ts > T1: happy path (cycleId in body) — ok(grupo) → response.data matches GrupoResponse shape
  AssertionError: expected { id: undefined, ... } to match object { id: 'g-1', ... }
FAIL  create-grupo.controller.spec.ts > T3: materia not found → err(NotFoundError) re-thrown, not swallowed
  AssertionError: promise resolved "{ data: {...} }" instead of rejecting
Test Files  1 failed (1)
     Tests  2 failed | 1 passed (3)
```
(T2 — the `cycleId`-resolution-via-`TenantContext` case — passed even pre-migration since it only
asserts the UC call args, not the `Result`-shaped response; expected and consistent with the T1/T3
RED signal being the meaningful one.)

## Commits (Slice B, chronological)

| Hash | Message |
|---|---|
| `5733f5d` | `test(mgc): create-grupo controller spec (RED)` |
| `edd2b4a` | `refactor(mgc): migrate validateTeacherLevel + grupo use-cases to Result` (helper + both callers, ONE atomic commit) |
| `f2cd136` | `refactor(mgc): migrate delete-grupo and remove-student-from-grupo to Result` |
| `ca67751` | `refactor(mgc): retrofit grupo endpoints to unwrapErr idiom` |
| `b6e9f81` | `test(mgc): migrate grupo unit + controller specs to Result` |

Branch tip: `b6e9f81` on `refactor/mgc-result-b` (base `refactor/mgc-result-a`, i.e. `main` @ `d51f87a`).

## Files Changed

| File | Action | What Was Done |
|---|---|---|
| `api/src/application/materia-grupo-ciclo/validate-teacher-level.ts` | Modified | `Promise<void>` → `Promise<Result<void, ValidationError>>`; all 4 early no-op `return;` → `return ok(undefined)`; `throw new ValidationError(...)` → `return err(new ValidationError(...))`; terminal happy path → `return ok(undefined)` |
| `api/src/application/materia-grupo-ciclo/create-grupo.use-case.ts` | Modified | `Promise<GrupoXCursoXMateriaXCiclo>` → `Promise<Result<GrupoXCursoXMateriaXCiclo, NotFoundError \| ValidationError>>`; `NotFoundError` guard → `err(...)`; propagates `validateTeacherLevel`'s `Result` via `if (levelCheck.isErr()) return err(levelCheck.unwrapErr());`; success → `ok(...)` |
| `api/src/application/materia-grupo-ciclo/update-grupo.use-case.ts` | Modified | Same pattern; 2 `NotFoundError` guards → `err(...)`; propagates helper `Result`; success → `ok(...)`. **The infra guard at `:43` (`throw new Error('No tenant client available')`) is UNCHANGED — still a `throw`, per MGCM-R6.** |
| `api/src/application/materia-grupo-ciclo/delete-grupo.use-case.ts` | Modified | `Promise<void>` → `Promise<Result<void, NotFoundError>>`; guard → `err(...)`; added `ok(undefined)` |
| `api/src/application/materia-grupo-ciclo/remove-student-from-grupo.use-case.ts` | Modified | Same pattern |
| `api/src/presentation/materia-grupo-ciclo/materia-grupo-ciclo.controller.ts` | Modified | 4 endpoints (`createGrupo`, `updateGrupo`, `deleteGrupo`, `removeStudentFromGrupo`) adopt `if (result.isErr()) throw result.unwrapErr();`. `createGrupo`/`updateGrupo` rename the `Result` var to `grupoResult` to avoid shadowing the unwrapped `grupo`. `listGrupos`, `listAlumnosGrupo`, `listGruposGlobal`, and `createGrupo`'s raw-Prisma enrichment block (`:157-165`) untouched. |
| `api/src/application/materia-grupo-ciclo/__tests__/update-grupo.use-case.test.ts` | Modified | `validate-teacher-level` module mock updated to resolve a `Result`-shaped stub (via `vi.hoisted` to avoid the TDZ hoisting pitfall of referencing `ok(...)` inside a `vi.mock` factory); rewrote NotFoundError/ValidationError assertions to `isErr()/unwrapErr()`; happy paths → `isOk()`; **added** a new infra-guard test asserting `TenantContext.getClient() === null` still causes `.rejects.toThrow('No tenant client available')` (no such test existed pre-migration) |
| `api/src/application/materia-grupo-ciclo/__tests__/create-grupo.use-case.test.ts` | Modified | Same `isErr()/unwrapErr()` / `isOk()/unwrap()` pattern across all NIVEL + not-found + happy-path cases (this file does NOT mock `validate-teacher-level`, it exercises the real function via mocked `TenantContext`/`prisma`) |
| `api/src/application/materia-grupo-ciclo/__tests__/delete-grupo.use-case.test.ts` | Modified | Same pattern |
| `api/src/application/materia-grupo-ciclo/__tests__/remove-student-from-grupo.use-case.test.ts` | Modified | Same pattern |
| `api/src/presentation/materia-grupo-ciclo/__tests__/delete-grupo.controller.spec.ts` | Modified | `mockResolvedValue(undefined)` → `mockResolvedValue(ok(undefined))`; `mockRejectedValue(error)` → `mockResolvedValue(err(error))` |
| `api/src/presentation/materia-grupo-ciclo/__tests__/update-grupo.controller.spec.ts` | Modified | `mockResolvedValue(grupo)` → `mockResolvedValue(ok(grupo))` across T1-T3; **added** T4 (`NotFoundError` re-throw case, not previously covered) |
| `api/src/presentation/materia-grupo-ciclo/__tests__/create-grupo.controller.spec.ts` | **Created** | New RED-first controller spec (no prior coverage); T1 happy path (cycleId in body), T2 happy path (cycleId resolved via `TenantContext`), T3 `NotFoundError` re-throw |

## Verification (real results)

### `materia-grupo-ciclo`-scoped test run
```
corepack pnpm exec vitest run src/application/materia-grupo-ciclo src/presentation/materia-grupo-ciclo
Test Files  26 passed (26)
     Tests  115 passed (115)
```

### Full suite
```
corepack pnpm test   (== pnpm --filter api test)
Test Files  1 failed | 213 passed (214)
     Tests  1 failed | 2174 passed (2175)
```
The 1 failure is the same **pre-existing and unrelated** issue already documented for Slice A:
`scripts/__tests__/archive-legacy-grading-data.spec.ts` ("escribe los 5 archivos con paths
{tenant-slug}/{tabla}.json") — a Windows path-separator assertion bug. Re-confirmed pre-existing:
`git diff` against that file across Slice B's full commit range is **empty**.

### Typecheck
```
corepack pnpm run typecheck   (== pnpm --filter api typecheck)
tsc --noEmit   → clean, no errors
```

### Coverage
Ran `corepack pnpm exec vitest run --coverage --coverage.reportOnFailure` (full suite) and scoped to
the two Slice B directories. Real numbers:

| Scope | Stmts | Branch | Funcs | Lines |
|---|---|---|---|---|
| **Whole project** (`api/`, full suite) | 68.02% | 59.34% | 68.97% | 71.19% |
| `application/materia-grupo-ciclo/` (dir, incl. Slice C's not-yet-migrated `add-student-to-grupo`) | 95.76% | 94.04% | 95% | 98.15% |
| `presentation/materia-grupo-ciclo/` (whole controller file, all 9 endpoints across all 3 slices) | 80.17% | 79.03% | 84% | 80.19% |

**Honest read:** whole-project 68.02% is the same pre-existing monorepo baseline noted in Slice A
(unrelated legacy controllers at 20-45%), not a Slice B regression. The directories Slice B actually
modified are both at or above 80% on every metric. The `application/materia-grupo-ciclo/` 0%-stmt
outlier line noted in the raw report (`...o.use-case.ts` 16-19, 0%) is `list-grupos.use-case.ts` —
untouched by any slice (not part of A, B, or C's scope) and was already uncovered before this change.
`presentation/materia-grupo-ciclo/` sits at 80.17%/79.03% — the remaining gap is Slice C's
not-yet-migrated `addStudentToGrupo` endpoint (lines ~350-354, 493-494), correctly out of Slice B's
scope.

### Slice diff line count
```
git diff --stat d51f87a HEAD -- api/
13 files changed, 277 insertions(+), 92 deletions(-)   → 369 changed lines
```
Under the ~350-400 estimate and the 400-line hard cap.

## Divergences / Honesty Notes

1. **`update-grupo.use-case.test.ts` needed a `vi.hoisted()` fix not anticipated in `design.md`**:
   naively writing `vi.mock('../validate-teacher-level', () => ({ validateTeacherLevel: vi.fn()
   .mockResolvedValue(ok(undefined)) }))` fails at runtime with `ReferenceError: Cannot access
   '__vi_import_1__' before initialization`, because `vi.mock` factories are hoisted above all
   imports (including the `ok` import from `@educandow/domain`) by Vitest's compiler. Fixed by
   `vi.hoisted(() => ({ okUndefined: { isOk: () => true, isErr: () => false, unwrap: () => undefined
   } }))` — a plain object shaped like the `Result` the real function returns, hoisted alongside the
   mock factory. This is a **mechanical test-infra fix**, not a behavior or scope change.
2. **`update-grupo.use-case.test.ts` gained a NEW infra-guard test** (`.rejects.toThrow('No tenant
   client available')` when `TenantContext.getClient()` returns `null`) that did not exist
   pre-migration — `design.md`/`tasks.md` describe this as the test being "kept," but no such test
   was present in the file before Slice B. Added it to close the gap and give MGCM-R6's "infra guard
   stays a throw" requirement explicit regression coverage, per the spec's own scenario ("update-grupo's
   infra guard is excluded from this requirement").
3. **B10's commit was kept separate from B7's** (as the design's own fallback allows: "may be folded
   into B7 if diff stays small; keep separate if it helps stay under budget") to keep the atomic
   helper+callers commit focused and auditable on its own.
4. Windows path separator issue (`api/scripts/__tests__/archive-legacy-grading-data.spec.ts`)
   reconfirmed pre-existing via empty `git diff` for that file across Slice B's commits too.
5. No other deviations from `design.md`/`tasks.md` — controller retrofit code matches design.md §3
   code blocks verbatim (variable names, idiom, untouched blocks); the infra guard at
   `update-grupo.use-case.ts:43` was left as a bare `throw`, exactly as required.

## Persistence

- **openspec** (source of truth): this file — `openspec/changes/materia-grupo-ciclo-result-migration/apply-progress.md`. `tasks.md` B0–B20 marked `[x]`.
- **engram**: **backfill pending** — `mem_save` was not available/attempted successfully in this
  sub-agent session for this artifact class; if the tool is available in a follow-up session, save
  with `topic_key: sdd/materia-grupo-ciclo-result-migration/apply-progress`, `project: educandow`,
  `type: architecture`, `scope: project`, `capture_prompt: false`, content = this file's body (both
  Slice A and Slice B sections).

## Next Steps (as of Slice B)

- ~~Slice C: `refactor/mgc-result-c` from `refactor/mgc-result-b` (`add-student-to-grupo` +
  `GrupoMateriaMismatchError`, per `tasks.md` Slice C).~~ **DONE — see Slice C section below.**
- Re-confirm project-wide coverage ≥ 80% via `pnpm --filter api test:coverage
  --coverage.reportOnFailure` (or after the pre-existing Windows-path test is fixed separately)
  before final archive.

---

# SLICE C — `add-student-to-grupo` + `GrupoMateriaMismatchError`

> Branch `refactor/mgc-result-c`, base `refactor/mgc-result-b`. Slices A and B are DONE (A merged to
> `main`, B done). This is the change's **final slice** — all 3 slices are now complete, pending
> `sdd-archive`.

## Status

**23/23 tasks complete** (C0–C22). Independently green at its own tip.

## TDD Cycle Evidence (Strict TDD)

| Work-unit | RED | GREEN | REFACTOR | Notes |
|---|---|---|---|---|
| WU1 — `GrupoMateriaMismatchError` domain class + export + `DOMAIN_STATUS` entry + domain unit test | ✅ confirmed failing (`Cannot find module '../../errors/grupo-materia-mismatch-error'`) before the class existed | ✅ (2/2 domain tests pass after class created) | n/a | RED run captured below |
| WU2 — tighten `add-student-to-grupo.use-case.test.ts` (MGC-R4 → `GrupoMateriaMismatchError`, plus mechanical `AlumnoAlreadyInGrupoError`/`NotFoundError`/happy-path tightening) + new `add-student-to-grupo.controller.spec.ts` (incl. 422 case) + companion `exception.filter.spec.ts` FILTER-8 case | ✅ confirmed failing: unit 7/7 failed (all assertions unreachable — pre-migration UC still throws); controller spec 4/4 failed (`AssertionError: promise resolved ... instead of rejecting`) | ✅ (both pass after WU3+WU4 land) | n/a | RED runs captured below |
| WU3 — production fix: migrate `add-student-to-grupo.use-case.ts` to `Result`, MGC-R4 bare `Error` → `err(new GrupoMateriaMismatchError())` | n/a (mechanical + the one behavior correction) | ✅ unit 7/7 GREEN immediately after this commit | n/a | the ONE 500→422 behavior correction in the whole 3-slice change |
| WU4 — controller retrofit (`addStudentToGrupo`, 1 endpoint) | n/a | ✅ controller spec 4/4 GREEN; `exception.filter.spec.ts` FILTER-8 GREEN (was already green from WU1, since `DOMAIN_STATUS` entry landed then — confirms end-to-end 422 wiring) | n/a | var renamed to `created` (no shadow existed to begin with — the original var was already `result`) |

### RED confirmation (WU1 — domain class, captured before the class existed)

```
FAIL  src/shared/__tests__/errors/grupo-materia-mismatch-error.test.ts
Error: Cannot find module '../../errors/grupo-materia-mismatch-error' imported from
  .../grupo-materia-mismatch-error.test.ts
Test Files  1 failed (1)
     Tests  no tests
```

### RED confirmation (WU2a — tightened unit assertions, captured before the production fix)

```
pnpm --filter api exec vitest run src/application/materia-grupo-ciclo/__tests__/add-student-to-grupo.use-case.test.ts
FAIL > rejects student whose AlumnosXMateria belongs to a different materia (MGC-S11)
  Error: Student is not in the universe of this grupo's materia (MGC-R4)...
FAIL > rejects student from a different CC via containment check (MGC-S10)
  Error: Student is not in the universe of this grupo's materia (MGC-R4)...
FAIL > rejects student already in another group of same materia — co-docencia removed (MGC-S12)
  TypeError: rG1.isOk is not a function
FAIL > returns err(AlumnoAlreadyInGrupoError) when student already in another grupo of same materia (MGC-S13)
  AlumnoAlreadyInGrupoError: El alumno ya está asignado a un grupo de esta materia
FAIL > returns err(NotFoundError) when grupo not found
  NotFoundError: GrupoXCursoXMateriaXCiclo with id non-existent not found
FAIL > returns err(NotFoundError) when AlumnosXMateria not found
  NotFoundError: MateriasXAlumnoXCursoXCiclo with id non-existent not found
Test Files  1 failed (1)
     Tests  7 failed (7)
```
All 7 fail — expected, since the pre-migration use-case still throws instead of returning a `Result`
(mechanical cases were tightened together with the MGC-R4 cases, per the design's own note that this
is RED-first for the whole file, not just the two MGC-R4 cases).

### RED confirmation (WU2b — new `add-student-to-grupo.controller.spec.ts`, captured before the controller retrofit)

```
pnpm --filter api exec vitest run src/presentation/materia-grupo-ciclo/__tests__/add-student-to-grupo.controller.spec.ts
FAIL > T2: grupo not found → err(NotFoundError) re-thrown, not swallowed
  AssertionError: promise resolved "{ data: {...} }" instead of rejecting
FAIL > T3: student already in another grupo ... → err(AlumnoAlreadyInGrupoError) re-thrown
  AssertionError: promise resolved "{ data: {...} }" instead of rejecting
FAIL > T4: grupo⊆materia mismatch → err(GrupoMateriaMismatchError) re-thrown (422, not 500)
  AssertionError: promise resolved "{ data: {...} }" instead of rejecting
Test Files  1 failed (1)
     Tests  4 failed (4)
```
(T1 — happy path — passed even pre-migration since the direct-object controller happened to read
`.id`/`.grupoId`/`.alumnosXMateriaXCursoXCicloId` off the raw entity; the 3 error-propagation cases
are the meaningful RED signal, consistent with the pattern already seen in Slice A/B's WU1 RED runs.)

## Commits (Slice C, chronological)

| Hash | Message |
|---|---|
| `55c87ef` | `feat(domain): add GrupoMateriaMismatchError (422)` |
| `e0a917d` | `test(mgc): tighten add-student-to-grupo unit to 422/GrupoMateriaMismatchError (RED)` |
| `1194c30` | `test(mgc): add-student-to-grupo controller spec incl. 422 case (RED)` |
| `77cb6c3` | `fix(mgc): map grupo-materia mismatch to 422 via Result` |
| `366dccc` | `refactor(mgc): retrofit add-student-to-grupo endpoint to unwrapErr idiom` |

Branch tip: `366dccc` on `refactor/mgc-result-c` (base `refactor/mgc-result-b`).

**Divergence note (commit message encoding):** `design.md`/`tasks.md` specify the production-fix
commit message as `fix(mgc): map grupo⊆materia mismatch to 422 via Result` (using the `⊆` containment
symbol). A first commit attempt via a quoted `-m` argument mangled the UTF-8 byte sequence into
literal escaped text (`grupo\xE2\x8a\x86materia`) instead of rendering the character — a shell/tool
quoting issue, not a content decision. Amended immediately (before any further commits) to the ASCII
`fix(mgc): map grupo-materia mismatch to 422 via Result`, preserving the exact same semantic meaning.
No functional or scope impact; flagging for honesty since it's a literal deviation from the
plan's exact string.

## Files Changed

| File | Action | What Was Done |
|---|---|---|
| `packages/domain/src/shared/errors/grupo-materia-mismatch-error.ts` | **Created** | New `DomainError` subclass, zero-arg constructor, `code = 'GRUPO_MATERIA_MISMATCH'`, client message `'El alumno no pertenece al universo de la materia de este grupo'` — mirrors `AlumnoAlreadyInGrupoError` exactly |
| `packages/domain/src/shared/__tests__/errors/grupo-materia-mismatch-error.test.ts` | **Created** | New domain unit test asserting `code === 'GRUPO_MATERIA_MISMATCH'` and `instanceof DomainError`/`Error` (mirrors `attendance-type/__tests__/errors/presente-type-not-found-error.test.ts` pattern; no prior test dir existed under `shared/errors/`, so `shared/__tests__/errors/` was created to match the existing `shared/__tests__/` convention) |
| `packages/domain/src/index.ts` | Modified | Added `export { GrupoMateriaMismatchError } from './shared/errors/grupo-materia-mismatch-error';` immediately after `AlumnoAlreadyInGrupoError`'s export line |
| `api/src/presentation/shared/filters/exception.filter.ts` | Modified | Added `GRUPO_MATERIA_MISMATCH: 422,` to `DOMAIN_STATUS`, next to `ALUMNO_ALREADY_IN_GRUPO: 409` in the Materia-grupo-ciclo block. No existing entry modified |
| `api/src/presentation/shared/filters/__tests__/exception.filter.spec.ts` | Modified | Added `FILTER-8: GrupoMateriaMismatchError → HTTP 422, not 500 (MGCM-R3)` — companion assertion confirming the `DOMAIN_STATUS` mapping end-to-end via `filter.catch(...)` (real `DOMAIN_STATUS` object is private/unexported, so the established pattern of exercising it through `AppExceptionFilter.catch` — same as `FILTER-1`..`FILTER-7` — was used instead of a direct import) |
| `api/src/application/materia-grupo-ciclo/add-student-to-grupo.use-case.ts` | Modified | `Promise<AlumnosXGrupoXCursoXMateriaXCiclo>` → `Promise<Result<AlumnosXGrupoXCursoXMateriaXCiclo, NotFoundError \| GrupoMateriaMismatchError \| AlumnoAlreadyInGrupoError>>`; 2 `NotFoundError` throws → `err(...)`; the bare `Error` MGC-R4 throw → `err(new GrupoMateriaMismatchError())` (**the ONE behavior correction, 500→422**); `AlumnoAlreadyInGrupoError` throw → `err(...)`; success → `ok(await this.alumnosGrupoRepo.addStudent(...))`. Docstring updated (`Throws AlumnoAlreadyInGrupoError` → `Returns err(AlumnoAlreadyInGrupoError)`, same for the containment check) |
| `api/src/application/materia-grupo-ciclo/__tests__/add-student-to-grupo.use-case.test.ts` | Modified | All 7 test cases tightened to the `isErr()`/`unwrapErr()`/`isOk()` pattern; the two containment-mismatch cases (MGC-S11, MGC-S10) now assert `unwrapErr() instanceof GrupoMateriaMismatchError` instead of a loose `.rejects.toThrow(regex)`/`.rejects.toThrow()` |
| `api/src/presentation/materia-grupo-ciclo/__tests__/add-student-to-grupo.controller.spec.ts` | **Created** | New RED-first controller spec (no prior coverage); T1 happy path, T2 `NotFoundError` re-throw, T3 `AlumnoAlreadyInGrupoError` re-throw, T4 `GrupoMateriaMismatchError` re-throw (the 422 case) |
| `api/src/presentation/materia-grupo-ciclo/materia-grupo-ciclo.controller.ts` | Modified | `addStudentToGrupo` endpoint adopts `if (result.isErr()) throw result.unwrapErr();`; unwrapped value renamed to `created` (no actual var-shadow existed here since the pre-migration var was already named `result`, distinct from the entity fields it read — renamed anyway per design for consistency with the other 8 retrofitted endpoints) |

## Verification (real results)

### `materia-grupo-ciclo`-scoped test run
```
pnpm --filter api exec vitest run src/application/materia-grupo-ciclo src/presentation/materia-grupo-ciclo
Test Files  27 passed (27)
     Tests  119 passed (119)
```

### Full suite
```
pnpm --filter api test
Test Files  1 failed | 214 passed (215)
     Tests  1 failed | 2179 passed (2180)
```
The 1 failure is the same **pre-existing and unrelated** issue documented for Slices A and B:
`scripts/__tests__/archive-legacy-grading-data.spec.ts` ("escribe los 5 archivos con paths
{tenant-slug}/{tabla}.json") — a Windows path-separator assertion bug. Re-confirmed pre-existing:
`git diff --stat refactor/mgc-result-b HEAD -- api/scripts/__tests__/archive-legacy-grading-data.spec.ts`
is **empty**.

### Typecheck
```
pnpm --filter api typecheck
tsc --noEmit   → clean, no errors
```
**Note:** `pnpm --filter @educandow/domain build` had to be run once before the first typecheck pass,
because `api`'s `tsc --noEmit` resolves `@educandow/domain` against the package's built `dist/`
output, not its TS source — the new `GrupoMateriaMismatchError` export wasn't visible to `api`'s
typecheck until the domain package was rebuilt. This is a pre-existing monorepo build-order property,
not a Slice C-specific issue; `dist/` is gitignored, so nothing extra was staged/committed.

### Domain package test run (new class)
```
pnpm --filter @educandow/domain test -- grupo-materia-mismatch-error
Test Files  1 passed (1)
     Tests  2 passed (2)

pnpm --filter @educandow/domain test   (full domain suite)
Test Files  112 passed (112)
     Tests  1287 passed (1287)
```

### Coverage
Ran `pnpm --filter api exec vitest run --coverage --coverage.reportOnFailure` (full suite; vitest's
v8 text reporter only lists files below 100% coverage, so directory aggregates below include files
not individually printed). Real numbers:

| Scope | Stmts | Branch | Funcs | Lines |
|---|---|---|---|---|
| **Whole project** (`api/`, full suite) | 68.06% | 59.36% | 69.02% | 71.23% |
| `application/materia-grupo-ciclo/` (dir, all 9 use-cases now migrated across A+B+C) | 96.29% | 94.04% | 96.66% | 98.77% |
| `presentation/materia-grupo-ciclo/` (controller file, all 9 endpoints across all 3 slices) | 95.52% | 79.68% | 95.12% | 97.45% |
| `presentation/shared/filters/` (`exception.filter.ts`) | 87.87% | 65.38% | 100% | 87.87% |

**Honest read:** whole-project 68.06% is the same pre-existing monorepo baseline noted in Slices A
and B (unrelated legacy controllers at 20-45%), not a Slice C regression. Both directories Slice C
actually modified are now at or above 95% on stmts/funcs/lines, and the controller's remaining
uncovered lines (`102, 495-496`) are out-of-scope code untouched by this slice. The
`presentation/materia-grupo-ciclo/` branch figure (79.68%) is unchanged from Slice B's own figure —
this slice's new `isErr()` branch on `addStudentToGrupo` is covered both ways (happy path + all 3
error cases) by the new controller spec; the remaining branch gap is pre-existing, out-of-scope code
in the same controller file (untouched `createGrupo` raw-Prisma block and non-in-scope list
endpoints).

### Slice diff line count
```
git diff --stat refactor/mgc-result-b HEAD -- api/ packages/domain
9 files changed, 221 insertions(+), 41 deletions(-)   → 262 changed lines
```
Under the ~270-320 estimate and well under the 400-line hard cap.

### Scope-discipline confirmations (C20/C21)
```
git diff --name-only refactor/mgc-result-b HEAD | grep -iE "competency|auth/|materia-x-curso-x-ciclo\.ts|grupo-x-curso-x-materia-x-ciclo\.ts|alumnos-x-materia-x-curso-x-ciclo\.ts|alumnos-x-grupo-x-curso-x-materia-x-ciclo\.ts"
→ no matches (confirmed untouched)

git diff --name-status main HEAD -- packages/domain/src/shared/errors/
→ A  grupo-materia-mismatch-error.ts   (exactly one new error class across the whole 3-slice change)
```

## Divergences / Honesty Notes

1. **Commit message encoding**: the `⊆` symbol in the planned `fix(mgc): map grupo⊆materia mismatch
   to 422 via Result` message was mangled by shell quoting on first attempt; amended to the ASCII
   `fix(mgc): map grupo-materia mismatch to 422 via Result` before any further commits landed. Same
   semantic meaning, no scope/content impact.
2. **New test directory created**: `packages/domain/src/shared/__tests__/errors/` did not exist
   before this slice (no domain test previously covered `shared/errors/*`); created it to house the
   new `GrupoMateriaMismatchError` test, following the existing `shared/__tests__/` and
   `attendance-type/__tests__/errors/` conventions rather than inventing a new layout.
3. **`DOMAIN_STATUS` is not exported** from `exception.filter.ts` (private `const`), so the design's
   "companion assertion confirms `DOMAIN_STATUS['GRUPO_MATERIA_MISMATCH'] === 422`" was implemented
   as a `filter.catch(...)`-based test (`FILTER-8` in `exception.filter.spec.ts`), matching the
   established pattern already used for `FILTER-1` through `FILTER-7` rather than a direct object
   import (which the module doesn't expose).
4. **No actual var-shadow existed at `addStudentToGrupo`**: unlike `createGrupo`/`updateGrupo` in
   Slice B (which bound `grupo` twice), the original `addStudentToGrupo` code already used a
   non-colliding var name (`result`). Renamed the unwrapped value to `created` anyway, per design's
   explicit instruction and for consistency with the other 8 retrofitted endpoints — not a required
   shadow-avoidance fix in this specific case, just a style-consistency choice.
5. Windows path separator issue (`api/scripts/__tests__/archive-legacy-grading-data.spec.ts`)
   reconfirmed pre-existing via empty `git diff` for that file across Slice C's commits too.
6. No other deviations from `design.md`/`tasks.md` — the `update-grupo.use-case.ts:43` infra guard,
   `competency.use-cases.ts`, the `auth` module, and all 4 entity constructor guards remain untouched
   (confirmed via `git diff` above); exactly one new `DomainError` subclass across the whole 3-slice
   change.

## Persistence

- **openspec** (source of truth): this file — `openspec/changes/materia-grupo-ciclo-result-migration/apply-progress.md`. `tasks.md` C0–C22 marked `[x]` (all 3 slices, A0–C22, now complete).
- **engram**: **backfill needed** — report to orchestrator/session: save this file's full content
  (all 3 slice sections) with `topic_key: sdd/materia-grupo-ciclo-result-migration/apply-progress`,
  `project: educandow`, `type: architecture`, `scope: project`, `capture_prompt: false`.

## Next Steps

- All 3 slices (A, B, C) are implementation-complete. Slice A is merged to `main`; Slices B and C
  live on their respective stacked branches (`refactor/mgc-result-b`, `refactor/mgc-result-c`),
  neither pushed nor PR'd per this session's instructions.
- Recommended next SDD phase: `sdd-verify` against the full spec (`MGCM-R1`..`MGCM-R7`), followed by
  `sdd-archive` once verification passes.
- Re-confirm project-wide coverage ≥ 80% via `pnpm --filter api test:coverage
  --coverage.reportOnFailure` (or after the pre-existing Windows-path test is fixed separately)
  before final archive — this has been a consistent pre-existing gap (not a regression) across all
  3 slices.
