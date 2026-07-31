# Design — materia-grupo-ciclo-result-migration

> Concrete implementation design (the HOW at architectural level). Verified by reading every
> in-scope file. Consumes the canonical capability `application-error-handling`; introduces exactly
> **one** new `DomainError` subclass. Delivery: 3 stacked slices (A → B → C), each independently green.

## 0. Architectural approach (settled)

- **Pattern:** application-layer failures propagate as `Result<T, E>` (return, not throw); the single
  `throw` boundary is the controller (`if (result.isErr()) throw result.unwrapErr()`), consumed by
  `AppExceptionFilter`. This is the established idiom (precedent: `course-cycle-*-result-migration`,
  `alumnos-x-curso-x-ciclo.controller.ts`, `users.use-cases.ts` pilot).
- **Layering (Clean Arch):** `domain/` owns error classes (`DomainError` subclasses) + `Result`;
  `application/` returns `Result`; `presentation/` unwraps to the HTTP boundary. No upward imports.
- **`Result` / `ok` / `err` import:** from `@educandow/domain` (re-exported at
  `packages/domain/src/index.ts:2-3`). Use `import { ..., ok, err, Result } from '@educandow/domain'`
  exactly as the migrated `course-cycle` use-cases do.
- **Typing:** explicit `Promise<Result<T, E>>` with a precise error **union** per use-case (no `any`,
  no bare `Error`). Spec MGCM-R1 permits `Result<T, Error>`; we tighten to unions to preserve type
  info for reviewers and match `course-cycle` precedent.
- **YAGNI:** one new class; inline `unwrapErr()` idiom (NO shared `unwrapOrThrow` helper);
  `InfrastructureError` NOT modeled (deferred).

---

## 1. New `GrupoMateriaMismatchError` (Slice C)

### 1a. New file — `packages/domain/src/shared/errors/grupo-materia-mismatch-error.ts`

Mirrors `AlumnoAlreadyInGrupoError` exactly (zero-arg constructor, ratified in proposal §4). The bare
`Error`'s current diagnostic string (internal `materiaId` values) is internal debug data, not a
client-facing message — it is dropped from the client message (loggable server-side if ever needed).
`DomainError` signature confirmed: `constructor(message: string, code: string)`.

```ts
import { DomainError } from './domain-error';

/**
 * Thrown when a student's materia membership does not belong to the target grupo's materia
 * (grupo ⊆ materia containment, MGC-R4 / MGC-S10 / MGC-S11).
 * HTTP mapping: 422 Unprocessable Entity (see exception.filter.ts DOMAIN_STATUS).
 * Semantics: a syntactically valid but semantically unprocessable relation between two entities
 * — NOT a state conflict (409), NOT infrastructure (500).
 */
export class GrupoMateriaMismatchError extends DomainError {
  constructor() {
    super(
      'El alumno no pertenece al universo de la materia de este grupo',
      'GRUPO_MATERIA_MISMATCH',
    );
  }
}
```

### 1b. Export line — `packages/domain/src/index.ts`

Add immediately after the confirmed sibling line (`index.ts:8`):

```ts
export { AlumnoAlreadyInGrupoError } from './shared/errors/alumno-already-in-grupo-error';
export { GrupoMateriaMismatchError } from './shared/errors/grupo-materia-mismatch-error'; // NEW
```

### 1c. `DOMAIN_STATUS` insertion — `api/src/presentation/shared/filters/exception.filter.ts`

Add one entry in the existing `Materia-grupo-ciclo` block (next to `ALUMNO_ALREADY_IN_GRUPO: 409` at
line 46). No existing entry is modified (MGCM-R2, MGCM-R6):

```ts
  // Materia-grupo-ciclo — Fase 3 (exclusión estricta: un alumno = un grupo por materia)
  ALUMNO_ALREADY_IN_GRUPO: 409,
  GRUPO_MATERIA_MISMATCH: 422, // NEW — grupo ⊆ materia containment (MGC-R4), 422 not 409
```

The filter already routes any `DomainError` through `DOMAIN_STATUS[code]` (line 96), so no filter
logic changes — only the table gains one row.

---

## 2. Per-use-case migration, by slice

Common transform: `import { NotFoundError } from '@educandow/domain'` →
`import { NotFoundError, ok, err, Result } from '@educandow/domain'`; each `throw new X(...)` →
`return err(new X(...))`; each success `return VALUE` → `return ok(VALUE)`; return type wrapped in
`Promise<Result<T, E>>`.

### Slice A — "materia" use-cases (only `NotFoundError`)

| File | New return type | Changed lines |
|---|---|---|
| `set-materia-es-optativa.use-case.ts` | `Promise<Result<MateriaXCursoXCiclo, NotFoundError>>` | `:19` `throw new NotFoundError(...)` → `return err(new NotFoundError('MateriaXCursoXCiclo', input.id))`; `:21` → `return ok(await this.materiaRepo.setEsOptativa(input.id, input.esOptativa))` |
| `remove-student-from-materia.use-case.ts` | `Promise<Result<void, NotFoundError>>` | `:25` → `return err(new NotFoundError('MateriaXCursoXCiclo', input.materiaXCursoXCicloId))`; `:27` after `await this.alumnosRepo.removeStudent(...)` add `return ok(undefined)` |
| `add-student-to-materia.use-case.ts` | `Promise<Result<MateriasXAlumnoXCursoXCiclo, NotFoundError>>` | `:33` → `return err(new NotFoundError('MateriaXCursoXCiclo', ...))`; `:39` → `return err(new NotFoundError('Student', input.studentId))`; `:43` → `return ok(await this.alumnosRepo.addStudent(...))` |
| `list-enrollable-students-for-materia.use-case.ts` | `Promise<Result<AlumnoMateriaEnriched[], NotFoundError>>` | `:34` → `return err(new NotFoundError('MateriaXCursoXCiclo', ...))`; final `:41-43` mapped array → `return ok(ccStudents.filter(...).map(...))` |

`AlumnoMateriaEnriched`, `MateriasXAlumnoXCursoXCiclo`, `MateriaXCursoXCiclo` remain type-only imports;
`ok`/`err`/`Result` are value+type imports.

### Slice B — "grupo" use-cases + helper (atomic, MGCM-R4)

**`validate-teacher-level.ts`** → `Promise<Result<void, ValidationError>>`. Import
`{ ValidationError, ok, err, Result }`. All FOUR early no-op `return;` paths become
`return ok(undefined)`:

| Line | Current | New |
|---|---|---|
| `:24` | `if (!user) return;` | `if (!user) return ok(undefined);` |
| `:27` | `... return;` (ROOT/ADMIN) | `return ok(undefined);` |
| `:30` | `if (!client) return;` | `if (!client) return ok(undefined);` |
| `:36` | `if (!cc) return;` | `if (!cc) return ok(undefined);` |
| `:42` | `throw new ValidationError(...)` | `return err(new ValidationError('La materia no pertenece al nivel del docente'))` |
| end | (implicit) | `return ok(undefined)` |

Confirmed: **yes** — every early no-op `return` becomes `return ok(undefined)`; the terminal happy
path also returns `ok(undefined)`.

**Both callers propagate the helper `Result` (both call sites shown):**

`create-grupo.use-case.ts` → `Promise<Result<GrupoXCursoXMateriaXCiclo, NotFoundError | ValidationError>>`:
```ts
// :46-49
const materia = await this.materiaRepo.findById(input.materiaXCursoXCicloId);
if (!materia) return err(new NotFoundError('MateriaXCursoXCiclo', input.materiaXCursoXCicloId));

// :52 — propagate helper result (call site 1)
const levelCheck = await validateTeacherLevel(this.prisma, input.userId, materia.courseCycleId);
if (levelCheck.isErr()) return err(levelCheck.unwrapErr());

const docenteXCiclo = await this.docenteService.getOrCreateForCycle(input.userId, input.cycleId);
return ok(await this.grupoRepo.create({ ... })); // :58
```

`update-grupo.use-case.ts` → `Promise<Result<GrupoXCursoXMateriaXCiclo, NotFoundError | ValidationError>>`:
```ts
// :32
const grupo = await this.grupoRepo.findById(input.id);
if (!grupo) return err(new NotFoundError('GrupoXCursoXMateriaXCiclo', input.id));

if (input.userId !== undefined) {
  const materia = await this.materiaRepo.findById(grupo.materiaXCursoXCicloId);
  if (!materia) return err(new NotFoundError('MateriaXCursoXCiclo', grupo.materiaXCursoXCicloId)); // :38

  // :40 — propagate helper result (call site 2)
  const levelCheck = await validateTeacherLevel(this.prisma, input.userId, materia.courseCycleId);
  if (levelCheck.isErr()) return err(levelCheck.unwrapErr());

  const client = TenantContext.getClient();
  if (!client) throw new Error('No tenant client available'); // :43 — STAYS A THROW (see below)

  const cc = await client.courseCycle.findUnique({ ... });
  if (!cc) return err(new NotFoundError('CourseCycle', materia.courseCycleId)); // :49

  const newDocente = await this.docenteService.getOrCreateForCycle(input.userId, cc.cycleId);
  docenteXCicloId = newDocente.id;
}

return ok(await this.grupoRepo.update(input.id, { name: input.name, docenteXCicloId })); // :55
```

**Why `update-grupo:43` stays a `throw` while the method still returns `Result`:** the method's
declared type is `Promise<Result<...>>`; every EXPECTED business failure (the 2 `NotFoundError`s and
the propagated `ValidationError`) returns `err(...)`. The infra guard is an UNEXPECTED server
misconfiguration (tenant context unbound) — semantically a 500, not a 4xx. A function typed
`Promise<Result<T,E>>` can still `throw` for truly exceptional infra faults; that throw escapes to
`AppExceptionFilter`'s untyped `instanceof Error` fallback → 500 (correct). This is the ONE documented
exception (MGCM-R6, spec scenario "update-grupo's infra guard is excluded"). It is NOT modeled as
`InfrastructureError` (deferred follow-up). The method's `Result` contract governs expected outcomes;
the throw is an out-of-band escape hatch, exactly like `PaseFechaInvalidaError`'s justified throw-path
precedent.

**Other mechanical Slice-B use-cases:**

| File | New return type | Changed lines |
|---|---|---|
| `delete-grupo.use-case.ts` | `Promise<Result<void, NotFoundError>>` | `:15` → `return err(new NotFoundError('GrupoXCursoXMateriaXCiclo', id))`; after `:16` `await this.grupoRepo.delete(id)` add `return ok(undefined)` |
| `remove-student-from-grupo.use-case.ts` | `Promise<Result<void, NotFoundError>>` | `:21` → `return err(new NotFoundError('GrupoXCursoXMateriaXCiclo', input.grupoId))`; after `:24` add `return ok(undefined)` |

### Slice C — `add-student-to-grupo.use-case.ts` (2 `NotFoundError` + `AlumnoAlreadyInGrupoError` + MGC-R4 fix)

New return type:
`Promise<Result<AlumnosXGrupoXCursoXMateriaXCiclo, NotFoundError | GrupoMateriaMismatchError | AlumnoAlreadyInGrupoError>>`.
Import: `{ NotFoundError, AlumnoAlreadyInGrupoError, GrupoMateriaMismatchError, ok, err, Result }`.

| Line | Current | New |
|---|---|---|
| `:42` | `throw new NotFoundError('GrupoXCursoXMateriaXCiclo', input.grupoId)` | `return err(new NotFoundError('GrupoXCursoXMateriaXCiclo', input.grupoId))` |
| `:48` | `throw new NotFoundError('MateriasXAlumnoXCursoXCiclo', ...)` | `return err(new NotFoundError('MateriasXAlumnoXCursoXCiclo', input.alumnosXMateriaXCursoXCicloId))` |
| `:53-56` | `throw new Error('Student is not in the universe... MGC-R4...')` (bare, **500 BUG**) | `return err(new GrupoMateriaMismatchError())` — **the ONE behavior fix, 500 → 422** |
| `:65` | `throw new AlumnoAlreadyInGrupoError()` | `return err(new AlumnoAlreadyInGrupoError())` |
| `:69` | `return this.alumnosGrupoRepo.addStudent(...)` | `return ok(await this.alumnosGrupoRepo.addStudent(input.grupoId, input.alumnosXMateriaXCursoXCicloId))` |

---

## 3. Controller retrofit — 9 endpoints (`materia-grupo-ciclo.controller.ts`)

Idiom: check `isErr()` first, `throw unwrapErr()`, then `unwrap()` the ok payload. Where the current
code already binds a var named `result`/`grupo`/`materia`, we rename the `Result` var to avoid a
shadow clash. The 4 list endpoints (`listMaterias`, `listGrupos`, `listAlumnosGrupo`,
`listGruposGlobal`) and `createGrupo`'s raw-Prisma enrichment block (`:157-165`) are UNTOUCHED
(MGCM-R5, MGCM-R6).

### Slice A endpoints

**`addStudentToMateria` (`:130-141`):**
```ts
const result = await this.addStudentToMateriaUC.execute({ materiaXCursoXCicloId: materiaId, studentId: body.studentId });
if (result.isErr()) throw result.unwrapErr();
const created = result.unwrap();
return { data: { id: created.id, materiaXCursoXCicloId: created.materiaXCursoXCicloId, studentId: created.studentId } };
```

**`listAlumnosMateria` — ONLY the `eligible === 'true'` branch (`:266-271`):** the `?unassigned`/full
branch (`:272-276`, delegates to `ListAlumnosMateriaUseCase`, NOT migrated) stays as-is.
```ts
if (eligible === 'true') {
  const result = await this.listEnrollableStudentsForMateriaUC.execute({ materiaXCursoXCicloId: materiaId });
  if (result.isErr()) throw result.unwrapErr();
  return { data: result.unwrap() };
}
```

**`removeStudentFromMateria` (`:293-296`, void):**
```ts
const result = await this.removeStudentFromMateriaUC.execute({ materiaXCursoXCicloId: materiaId, alumnoXMateriaId: id });
if (result.isErr()) throw result.unwrapErr();
```

**`setMateriaEsOptativa` (`:313-316`):**
```ts
const result = await this.setMateriaEsOptativaUC.execute({ id: materiaId, esOptativa: body.esOptativa });
if (result.isErr()) throw result.unwrapErr();
const materia = result.unwrap();
// ...existing response mapping unchanged, now reads `materia` from unwrap()
```

### Slice B endpoints

**`createGrupo` (`:168-173`)** — enrichment block `:157-165` UNTOUCHED:
```ts
const grupoResult = await this.createGrupoUC.execute({ materiaXCursoXCicloId: materiaId, userId: body.userId, cycleId, name: body.name });
if (grupoResult.isErr()) throw grupoResult.unwrapErr();
const grupo = grupoResult.unwrap();
// ...existing response mapping unchanged
```

**`updateGrupo` (`:432`):**
```ts
const grupoResult = await this.updateGrupoUC.execute({ id, name: body.name, userId: body.userId });
if (grupoResult.isErr()) throw grupoResult.unwrapErr();
const grupo = grupoResult.unwrap();
// ...existing userId-resolution + response mapping unchanged
```

**`deleteGrupo` (`:468`, void):**
```ts
const result = await this.deleteGrupoUC.execute(id);
if (result.isErr()) throw result.unwrapErr();
```

**`removeStudentFromGrupo` (`:482`, void):**
```ts
const result = await this.removeStudentFromGrupoUC.execute({ grupoId, alumnoXGrupoId });
if (result.isErr()) throw result.unwrapErr();
```

### Slice C endpoint

**`addStudentToGrupo` (`:342-353`):**
```ts
const result = await this.addStudentToGrupoUC.execute({ grupoId, alumnosXMateriaXCursoXCicloId: body.alumnosXMateriaXCursoXCicloId });
if (result.isErr()) throw result.unwrapErr();
const created = result.unwrap();
return { data: { id: created.id, grupoId: created.grupoId, alumnosXMateriaXCursoXCicloId: created.alumnosXMateriaXCursoXCicloId } };
```
The unwrapped `GrupoMateriaMismatchError` flows through `AppExceptionFilter` → `DOMAIN_STATUS` → 422.

---

## 4. Clean Architecture / classification (ADR)

- **Decision:** the mismatch (grupo ⊄ materia) is a `DomainError` (invariant intrinsic to the data:
  membership belongs to a materia that ≠ grupo's materia), NOT an `ApplicationError` (which models
  caller-context/authorization failures per the canonical spec's classification note). Rationale: the
  failure is independent of WHO asks — it depends only on the two entities' `materiaXCursoXCicloId`.
- **Layer placement:** new class in `packages/domain/src/shared/errors/` (domain owns it); all 9
  use-cases return `Result` (application signals via data); controller performs the single `throw`
  (presentation → filter boundary). No layer violation, no upward import introduced.
- **Rejected alternative — 409:** the `DOMAIN_STATUS` 409 bucket is reserved for "already
  exists/assigned/closed/overlap" state conflicts. A mismatch is a syntactically-valid-but-
  unprocessable relation → 422 (bucket precedent: `INVALID_LLAMADO_RANGE`, `CONDICION_INVALIDA`,
  `PREREQUISITE_SLOT_MISSING`). Ratified in proposal §4.
- **Rejected alternative — model `InfrastructureError` now** (to type `update-grupo:43`): scope creep;
  the epic tracks it as a separate follow-up. The infra throw stays a bare `throw` → filter fallback →
  500 (correct). This is the single documented exception to "no throw in application/".
- **YAGNI held:** exactly one new class; no shared unwrap helper; `Result` unions typed explicitly.

---

## 5. Test plan by slice (TDD strict — `pnpm --filter api test`, coverage ≥ 80%)

### Slice A

Unit rewrites (`api/src/application/materia-grupo-ciclo/__tests__/`): `set-materia-es-optativa`,
`remove-student-from-materia`, `add-student-to-materia`, `list-enrollable-students-for-materia`
`.use-case.test.ts`. Transform `.rejects.toBeInstanceOf(NotFoundError)` →
`const r = await uc.execute(...); expect(r.isErr()).toBe(true); expect(r.unwrapErr()).toBeInstanceOf(NotFoundError)`;
happy path `expect(...).resolves` → `expect(r.isOk()).toBe(true); expect(r.unwrap())...`.

Controller specs (`api/src/presentation/materia-grupo-ciclo/__tests__/`): rewrite existing
`set-materia-es-optativa.controller.spec.ts`, `remove-student-from-materia.controller.spec.ts`,
`list-enrollable-students.controller.spec.ts` — `mockResolvedValue(obj)` → `mockResolvedValue(ok(obj))`,
add an `err(new NotFoundError(...))` case asserting the controller re-throws. **NEW RED-first**:
`add-student-to-materia.controller.spec.ts` (no coverage today) — model on
`update-grupo.controller.spec.ts` (`Object.create(prototype)` + injected mock UCs): happy (mock
`ok(created)`, assert `data`) + error (mock `err(new NotFoundError(...))`, assert `.rejects`), written
BEFORE the retrofit, RED against the pre-migration throw-returning UC.

### Slice B

Unit rewrites: `update-grupo`, `create-grupo`, `delete-grupo`, `remove-student-from-grupo`
`.use-case.test.ts`. `update-grupo` KEEPS a `.rejects.toThrow('No tenant client available')` case for
the infra guard (asserts it STILL throws — MGCM-R6). Add a `validateTeacherLevel` `ValidationError`
propagation case for both `create-grupo` and `update-grupo` asserting `unwrapErr()` instanceof
`ValidationError`. (No dedicated `validate-teacher-level` unit test file exists; it is covered
transitively through both callers, which is the atomicity guarantee.)

Controller specs: rewrite existing `delete-grupo.controller.spec.ts`, `update-grupo.controller.spec.ts`
to `ok()`/`err()`. **NEW RED-first**: `create-grupo.controller.spec.ts` (no coverage today) — model on
`update-grupo.controller.spec.ts`, mock the `cycleId`-resolution `TenantContext` path (see existing
`mockGetClient` pattern) + `createGrupoUC` returning `ok(grupo)` / `err(new NotFoundError(...))`.

### Slice C

Unit tighten (RED-first) — `add-student-to-grupo.use-case.test.ts`:
- The MGC-R4 cases at `:117-130` (`rejects.toThrow(/universe.*materia|MGC-R4/i)`) and `:134-148`
  (`rejects.toThrow()`) → tightened to
  `expect(r.unwrapErr()).toBeInstanceOf(GrupoMateriaMismatchError)`. These are RED against the current
  bare-`Error` (which is NOT a `GrupoMateriaMismatchError`) and GREEN only after the fix.
- The `AlumnoAlreadyInGrupoError` cases (`:170-175`, `:187-192`) → `unwrapErr()` instanceof
  `AlumnoAlreadyInGrupoError`.
- The two `NotFoundError` cases (`:201-204`, `:213-216`) → `unwrapErr()` instanceof `NotFoundError`.
- Happy path (`:103-114`) → `expect(r.isOk()).toBe(true)`.

New domain unit test: `packages/domain/src/shared/errors/` (or the domain test dir mirroring
`AlumnoAlreadyInGrupoError`'s test if present) — assert `new GrupoMateriaMismatchError()` has
`.code === 'GRUPO_MATERIA_MISMATCH'` and `instanceof DomainError`.

**NEW RED-first** `add-student-to-grupo.controller.spec.ts` (no coverage today): happy (mock
`ok(created)`) + `NotFoundError` re-throw + `AlumnoAlreadyInGrupoError` re-throw + **the 422 case**:
mock `addStudentToGrupoUC.execute` → `err(new GrupoMateriaMismatchError())`, assert controller throws
it; a companion filter-level assertion (or `DOMAIN_STATUS` lookup) confirms code `GRUPO_MATERIA_MISMATCH`
maps to `422` (RED against the old 500 / bare `Error`, per MGCM-R3 regression scenario).

**Unaffected:** integration `.db.test.ts` (`mgc-s13.isolation`, `mgc-generate` /
`materialize-materias`) — repo-direct, no application throws. Also unaffected: `list-materias`,
`list-grupos*`, `list-alumnos-grupo` specs (their UCs are not migrated).

---

## 6. Stacked-PR mechanics & commit plan

| Slice | Branch | Base | Contents | Line est. |
|---|---|---|---|---|
| A | `refactor/mgc-result-a` | `main` (ad947ad) | 4 materia UCs + 4 unit rewrites + 3 controller specs (2 rewrite, 1 new) + 4 endpoint retrofits | ~300-350 |
| B | `refactor/mgc-result-b` | `refactor/mgc-result-a` | 4 grupo UCs + `validate-teacher-level.ts` (atomic w/ both callers) + unit rewrites + 3 controller specs (2 rewrite, 1 new) + 4 endpoint retrofits | ~350-400 |
| C | `refactor/mgc-result-c` | `refactor/mgc-result-b` | `add-student-to-grupo` UC + `GrupoMateriaMismatchError` (+ index export + `DOMAIN_STATUS`) + domain unit test + unit tighten + 1 new controller spec + 1 endpoint retrofit | ~270-320 |

Each slice MUST pass `pnpm --filter api test` + `pnpm --filter api typecheck` at its own tip before the
next is authored (MGCM-R7). Conventional commits, **NO AI attribution**, work-unit granularity:

- **Slice A:** `test(mgc): add-student-to-materia controller spec (RED)` → `refactor(mgc): migrate materia use-cases to Result` → `refactor(mgc): retrofit materia endpoints to unwrapErr idiom` → `test(mgc): migrate materia unit + controller specs to Result`.
- **Slice B:** `test(mgc): create-grupo controller spec (RED)` → `refactor(mgc): migrate validateTeacherLevel + grupo use-cases to Result` (helper + both callers in ONE commit — MGCM-R4 atomicity) → `refactor(mgc): retrofit grupo endpoints to unwrapErr idiom` → `test(mgc): migrate grupo unit + controller specs to Result`.
- **Slice C:** `feat(domain): add GrupoMateriaMismatchError (422)` (class + export + DOMAIN_STATUS + domain unit test) → `test(mgc): tighten add-student-to-grupo unit to 422/GrupoMateriaMismatchError (RED)` + `test(mgc): add-student-to-grupo controller spec incl. 422 (RED)` → `fix(mgc): map grupo⊆materia mismatch to 422 via Result` (the 500→422 production fix, turns RED green) → `refactor(mgc): retrofit add-student-to-grupo endpoint to unwrapErr idiom`.

Rollback: revert in reverse order C → B → A (purely additive; no schema/data migration).

---

## 7. Review Workload Forecast

| Slice | Est. changed lines | 400-line budget risk | Chained PRs | Decision before apply |
|---|---|---|---|---|
| A | ~300-350 | Medium | Yes (3 stacked) | Yes — decided: chained |
| B | ~350-400 | Medium (fallback: split B1 mechanical / B2 create+helper if > 400) | Yes | Yes — decided: chained |
| C | ~270-320 | Medium | Yes | Yes — decided: chained |
| **Aggregate** | **~800-1000** | **High** | **Yes (3 stacked)** | **Yes — decided: chained** |

`Decision needed before apply: YES · Chained PRs: YES · 400-line budget risk: HIGH (aggregate)`.
Delivery strategy already settled: 3 independently-green stacked PRs (A → B → C).

---

## 8. Persistence

- **openspec** (source of truth): this file —
  `openspec/changes/materia-grupo-ciclo-result-migration/design.md`.
- **engram**: **backfill pending** (`mem_save` not available to this sub-agent). Topic key:
  `sdd/materia-grupo-ciclo-result-migration/design` · `project: educandow` · `type: architecture` ·
  `scope: project` · `capture_prompt: false`.
