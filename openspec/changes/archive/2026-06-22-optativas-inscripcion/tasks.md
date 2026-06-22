# Tasks: optativas-inscripcion

> Change: optativas-inscripcion
> Phase: tasks · Store: hybrid
> Spec: openspec/changes/optativas-inscripcion/specs/materia-grupo-ciclo/delta.md
> Design: openspec/changes/optativas-inscripcion/design.md
> TDD: strict — test FIRST, then impl. Test command: `pnpm test`. Coverage ≥ 80%.
> PR sequence: PR1 → PR2 → PR3 (each must merge before the next starts)

---

## PR1 — Schema · Domain · Cascade filter · Unit tests

**Scope:** Prisma schema migration + `MateriaXCursoXCiclo` entity + port extensions + cascade filter + Prisma repo flag plumbing + unit/repo tests.
**Estimated changed lines:** ~180–220.
**No behavioral endpoints.** PR2 depends on this merged.

### Dependency order within PR1

Steps 1→2 are sequential. Steps 3a/3b/3c can run in parallel once step 2 is done. Step 4 requires 3a+3b. Step 5 requires step 4.

---

#### Step 1 — Entity unit test (failing) [TEST]

**Task T1.1** [x]
- **File (new):** `packages/domain/src/materia-grupo-ciclo/entities/__tests__/materia-x-curso-x-ciclo.test.ts`
- **Spec:** MGC-R7, MGC-S14 · **Design:** D1
- **Write the failing test first.** Scenarios:
  - `create()` with no `esOptativa` defaults to `false`
  - `create({ esOptativa: true })` sets the flag
  - getter `esOptativa` returns the stored value
  - `reconstruct()` round-trips `esOptativa` through props
- Run `pnpm test` — must fail (entity has no `esOptativa` yet).

---

#### Step 2 — Entity implementation [IMPL]

**Task T1.2** [x]
- **File:** `packages/domain/src/materia-grupo-ciclo/entities/materia-x-curso-x-ciclo.ts`
- **Spec:** MGC-R7, MGC-S14 · **Design:** D1
- Depends on: T1.1 (test exists and fails)
- Changes:
  - `MateriaXCursoXCicloProps`: add `esOptativa: boolean`
  - `CreateMateriaXCursoXCicloInput`: add `esOptativa?: boolean`
  - `create()`: `esOptativa: input.esOptativa ?? false`
  - Add getter `get esOptativa(): boolean { return this.props.esOptativa; }`
  - `reconstruct()` spreads props — no change beyond the prop type
- Run `pnpm test` — T1.1 must now pass.

---

#### Step 3a — `MateriaXCursoXCicloRepository` port extension [IMPL] (parallel with 3b, 3c)

**Task T1.3** [x]
- **File:** `packages/domain/src/materia-grupo-ciclo/repositories/materia-x-curso-x-ciclo-repository.ts`
- **Spec:** MGC-R7 (upsertMany), MGC-R10 (setEsOptativa) · **Design:** D3
- Depends on: T1.2 (entity type must have `esOptativa`)
- Changes:
  - `upsertMany` element type: add `esOptativa?: boolean` (keeps existing callers source-compatible; omitted → false)
  - Add method: `setEsOptativa(id: string, esOptativa: boolean): Promise<MateriaXCursoXCiclo>;`
- Note: port-only (TypeScript interface) — behavioral tests live in the repo impl (T1.7/T1.8).

---

#### Step 3b — `AlumnosXMateriaRepository` port extension [IMPL] (parallel with 3a, 3c)

**Task T1.4** [x]
- **File:** `packages/domain/src/materia-grupo-ciclo/repositories/alumnos-x-materia-repository.ts`
- **Spec:** MGC-R9 · **Design:** D4
- Depends on: T1.2
- Changes:
  - Add method: `removeStudent(id: string): Promise<void>;`
  - JSDoc: "Remove a student from the subject universe by bridge-row id. Idempotent (deleteMany)."
- Note: port-only — implementation and tests are in PR2.

---

#### Step 3c — Prisma schema migration [IMPL] (parallel with 3a, 3b)

**Task T1.5** [x]
- **File:** `api/prisma_tenant/schema.prisma` — model `MateriaXCursoXCiclo` (line 173)
- **Spec:** MGC-R7 · **Design:** D1, D7
- Depends on: T1.2 (conceptually; can run in parallel)
- Changes:
  - Add field after `studyPlanSubjectId`: `esOptativa  Boolean @default(false) @map("es_optativa")`
- Commands:
  - `pnpm --filter api prisma:migrate:tenant` — generates migration (non-nullable with default, instant on existing data)
  - `pnpm --filter api prisma:generate` — regenerates tenant Prisma client so `esOptativa` is typed
- No backfill. Existing rows get `false` (correct semantics). No index (D7).

---

#### Step 4 — Cascade UC unit test (failing) [TEST]

**Task T1.6** [x]
- **File:** `api/src/application/course-cycle/__tests__/cascade-student-materias-competencias.use-case.test.ts` (EXTEND existing)
- **Spec:** MGC-R8, MGC-S15, MGC-S16, MGC-S17 · **Design:** D2
- Depends on: T1.2 (entity has `esOptativa`), T1.3 (port typed)
- Write failing tests BEFORE touching the use case. New test cases to add:
  - MGC-S15: given CC with 2 obligatoria + 2 optativa materias, `upsertMany` receives only the 2 obligatoria ids
  - MGC-S15 (competency side): `findActiveByStudyPlanSubject` is NOT called for the optativa `studyPlanSubjectId`s
  - MGC-S16: all-obligatoria CC → behavior unchanged (regression guard; upsertMany receives all)
  - MGC-S17: all-optativa CC → `upsertMany` called with empty array OR not called; cascade completes without error, returns zeros
- Run `pnpm test` — new tests must fail (UC not yet modified).

---

#### Step 4 — Cascade UC implementation [IMPL]

**Task T1.7** [x]
- **File:** `api/src/application/course-cycle/cascade-student-materias-competencias.use-case.ts`
- **Spec:** MGC-R8, MGC-S15, MGC-S16, MGC-S17 · **Design:** D2
- Depends on: T1.6 (test must fail first)
- **Single behavioral change of the whole feature.** After line 54 (`findByCourseCycleId`), apply:
  ```ts
  const materias = (await this.materiaRepo.findByCourseCycleId(ccId)).filter((m) => !m.esOptativa);
  ```
  The filtered `materias` variable is used for BOTH the alumno upsert (step 3) AND the competency resolution (step 4) — optativa competencies are also excluded.
- The existing `materias.length === 0` short-circuit and count math keep working unchanged.
- Run `pnpm test` — T1.6 tests must now pass.

---

#### Step 5 — Prisma repo tests (failing) [TEST]

**Task T1.8** [x]
- **File (new):** `api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-materia-x-curso-x-ciclo.repository.test.ts`
- **Spec:** MGC-R7, MGC-R10 · **Design:** D1, D3
- Depends on: T1.3 (`setEsOptativa` in port), T1.5 (schema generated)
- Write failing tests. Scenarios:
  - `upsertMany` without `esOptativa` field → row defaults to `false`; `toDomain` returns `esOptativa=false`
  - `upsertMany` with `esOptativa: true` → row has `true`; `toDomain` returns `esOptativa=true`
  - `setEsOptativa(id, true)` → updates row; returns domain entity with `esOptativa=true`
  - `setEsOptativa(id, false)` → flips back; returns entity with `esOptativa=false`
- Run `pnpm test` — must fail (repo impl not yet updated).

---

#### Step 5 — Prisma repo implementation [IMPL]

**Task T1.9** [x]
- **File:** `api/src/infrastructure/persistence/prisma/repositories/prisma-materia-x-curso-x-ciclo.repository.ts`
- **Spec:** MGC-R7, MGC-R10 · **Design:** D3
- Depends on: T1.8 (tests exist and fail), T1.5 (schema + client generated)
- Changes:
  - `MateriaXCursoXCicloRow` type: add `esOptativa: boolean`
  - `upsertMany`: in `createMany` data map, include `esOptativa: d.esOptativa ?? false`
  - New `setEsOptativa(id, esOptativa)`: `this.client.materiaXCursoXCiclo.update({ where: { id }, data: { esOptativa } })`, map result to domain via `toDomain`
  - `toDomain`: pass `esOptativa: row.esOptativa`
- Run `pnpm test` — T1.8 tests must now pass.

---

#### Step 6 — PR1 build + test verification [BUILD]

**Task T1.10** [x]
- Commands: `pnpm test` + `pnpm build`
- All PR1 tests green. No TypeScript errors. Coverage ≥ 80% for touched files.
- Merge PR1 before starting PR2.

---

## PR2 — Application + Infrastructure + Presentation (API only)

**Scope:** `removeStudent` impl, 3 new use cases, DELETE + PATCH endpoints, `?eligible=true` branch, DTO, module wiring, unit + controller tests.
**Estimated changed lines:** ~280–330.
**Depends on:** PR1 merged (entity has `esOptativa`, ports have `setEsOptativa` + `removeStudent`).

### Parallelism within PR2

Groups A, B, C, D can run in parallel. Group E requires A+B+C+D to be done.

```
┌─ Group A: removeStudent repo (T2.1 → T2.2)      ─┐
├─ Group B: RemoveStudentFromMateria UC (T2.3 → T2.4)─┤
├─ Group C: SetMateriaEsOptativa UC (T2.5 → T2.6)  ─┤  → Group E (presentation)
└─ Group D: ListEnrollableStudents UC (T2.7 → T2.8) ─┘
```

---

#### Group A — `removeStudent` Prisma implementation

**Task T2.1 [TEST]** [x]
- **File (extend or new):** `api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-alumnos-x-materia.repository.test.ts`
- **Spec:** MGC-R9, MGC-S19, MGC-S20, MGC-S22 · **Design:** D4
- Write failing tests:
  - `removeStudent(id)` → row deleted from `materiasXAlumnoXCursoXCiclo`
  - `removeStudent(id)` on non-existent id → no throw (idempotent via `deleteMany`)
- Run `pnpm test` — must fail.

**Task T2.2 [IMPL]** [x]
- **File:** `api/src/infrastructure/persistence/prisma/repositories/prisma-alumnos-x-materia.repository.ts`
- **Spec:** MGC-R9 · **Design:** D4
- Depends on: T2.1
- Add:
  ```ts
  async removeStudent(id: string): Promise<void> {
    await this.client.materiasXAlumnoXCursoXCiclo.deleteMany({ where: { id } });
  }
  ```
  `deleteMany` (not `delete`) — no throw on missing row (idempotent).
- Run `pnpm test` — T2.1 must pass.

---

#### Group B — `RemoveStudentFromMateriaUseCase`

**Task T2.3 [TEST]** [x]
- **File (new):** `api/src/application/materia-grupo-ciclo/__tests__/remove-student-from-materia.use-case.test.ts`
- **Spec:** MGC-R9, MGC-S19, MGC-S22 · **Design:** D4
- Write failing tests:
  - `execute({ materiaXCursoXCicloId, alumnoXMateriaId })` — happy path: delegates `alumnosRepo.removeStudent(alumnoXMateriaId)`
  - Materia not found → throws `NotFoundError`
  - Does NOT call `alumnosRepo.removeStudent` when materia not found
- Run `pnpm test` — must fail.

**Task T2.4 [IMPL]** [x]
- **File (new):** `api/src/application/materia-grupo-ciclo/remove-student-from-materia.use-case.ts`
- **Spec:** MGC-R9 · **Design:** D4
- Depends on: T2.3
- Mirror of `RemoveStudentFromGrupoUseCase`. Validate materia via `materiaRepo.findById`; throw `NotFoundError` if absent; delegate `alumnosRepo.removeStudent(alumnoXMateriaId)`.
- Injects: `MateriaXCursoXCicloRepository`, `AlumnosXMateriaRepository`.
- Run `pnpm test` — T2.3 must pass.

---

#### Group C — `SetMateriaEsOptativaUseCase`

**Task T2.5 [TEST]** [x]
- **File (new):** `api/src/application/materia-grupo-ciclo/__tests__/set-materia-es-optativa.use-case.test.ts`
- **Spec:** MGC-R10, MGC-R11, MGC-S23, MGC-S24, MGC-S25 · **Design:** D3, D6
- Write failing tests:
  - `execute({ id, esOptativa: true })` — delegates `materiaRepo.setEsOptativa(id, true)`, returns entity
  - `execute({ id, esOptativa: false })` — delegates `materiaRepo.setEsOptativa(id, false)`
  - Materia not found → throws `NotFoundError`
  - Does NOT interact with `AlumnosXMateriaRepository` — no cleanup (D6)
- Run `pnpm test` — must fail.

**Task T2.6 [IMPL]** [x]
- **File (new):** `api/src/application/materia-grupo-ciclo/set-materia-es-optativa.use-case.ts`
- **Spec:** MGC-R10, MGC-R11 · **Design:** D3, D6
- Depends on: T2.5
- Validate materia exists; call `materiaRepo.setEsOptativa(id, esOptativa)`; return updated entity. No alumno repo interaction (D6: no retroactive cleanup).
- Injects: `MateriaXCursoXCicloRepository`.
- Run `pnpm test` — T2.5 must pass.

---

#### Group D — `ListEnrollableStudentsForMateriaUseCase`

**Task T2.7 [TEST]** [x]
- **File (new):** `api/src/application/materia-grupo-ciclo/__tests__/list-enrollable-students-for-materia.use-case.test.ts`
- **Spec:** (implicit in MGC-R9/MGC-S18, enables the add flow for empty optativas) · **Design:** D5
- Write failing tests:
  - Materia not found → throws `NotFoundError`
  - Returns CC students minus already-enrolled (set diff on `studentId`)
  - All CC students already enrolled → returns empty array
  - Empty optativa (0 enrolled) → returns all CC students as candidates
- Run `pnpm test` — must fail.

**Task T2.8 [IMPL]** [x]
- **File (new):** `api/src/application/materia-grupo-ciclo/list-enrollable-students-for-materia.use-case.ts`
- **Spec:** (D5) · **Design:** D5
- Depends on: T2.7
- Resolve materia → get `courseCycleId` → `alumnosCCRepo.findByCourseCycleEnriched(ccId)` (already exists in port + impl) → build `enrolled = new Set(alumnosXMateriaRepo.findByMateria(materiaId).map(a => a.studentId))` → return CC students where `!enrolled.has(s.studentId)`. Return type `AlumnoMateriaEnriched[]` (project `id`, `studentId`, `studentName` from `AlumnoCursoCicloEnriched`; drop `printable`).
- Injects: `MateriaXCursoXCicloRepository`, `AlumnosXMateriaRepository`, `AlumnosXCursoXCicloRepository`.
- Note: `findByCourseCycleEnriched` already exists in both the port and Prisma impl — no new repo method needed (Risk R3 resolved).
- Run `pnpm test` — T2.7 must pass.

---

#### Group E — Presentation (sequential; requires A+B+C+D done)

**Task T2.9 [TEST]** [x] **— MateriaResponse + GET /materias esOptativa field (MGC-S27)**
- **File (new or extend):** `api/src/presentation/materia-grupo-ciclo/__tests__/list-materias.controller.spec.ts`
- **Spec:** MGC-R12, MGC-S27 · **Design:** section 6.1
- Write failing test: GET /course-cycles/:ccId/materias response includes `esOptativa` per entry; one entry `false`, one entry `true`.
- Run `pnpm test` — must fail (DTO not yet updated).

**Task T2.10 [IMPL]** [x] **— MateriaResponse DTO + listMaterias mapping**
- **File:** `api/src/presentation/materia-grupo-ciclo/dto/materia-grupo-ciclo.dto.ts`
- **File:** `api/src/presentation/materia-grupo-ciclo/materia-grupo-ciclo.controller.ts` (listMaterias mapping only)
- **Spec:** MGC-R12, MGC-S27 · **Design:** D1, section 6.1
- Depends on: T2.9
- DTO `MateriaResponse`: add `esOptativa: boolean`.
- `listMaterias` handler: add `esOptativa: item.materia.esOptativa` to the mapped response.
- Run `pnpm test` — T2.9 must pass.

**Task T2.11 [TEST]** [x] **— DELETE endpoint controller spec**
- **File (new):** `api/src/presentation/materia-grupo-ciclo/__tests__/remove-student-from-materia.controller.spec.ts`
- **Spec:** MGC-R9, MGC-S19, MGC-S20, MGC-S22 · **Design:** D4, D8, section 6.3
- Depends on: T2.10 (DTO stable before adding new endpoints)
- Write failing tests:
  - `DELETE /course-cycles/:ccId/materias/:materiaId/alumnos/:id` → HTTP 204 NO_CONTENT
  - Materia not found → HTTP 404
  - Authz: `COURSE_CYCLES` × `DELETE` (3-door model, D8)
- Run `pnpm test` — must fail.

**Task T2.12 [TEST]** [x] **— PATCH endpoint controller spec**
- **File (new):** `api/src/presentation/materia-grupo-ciclo/__tests__/set-materia-es-optativa.controller.spec.ts`
- **Spec:** MGC-R10, MGC-S23, MGC-S24 · **Design:** D3, D8, section 6.2
- Write failing tests:
  - `PATCH /course-cycles/:ccId/materias/:materiaId` `{ esOptativa: true }` → 200 with updated `MateriaResponse` carrying `esOptativa: true`
  - `PATCH` with `{ esOptativa: false }` → response carries `esOptativa: false`
  - Materia not found → 404
  - Authz: `COURSE_CYCLES` × `UPDATE` (D8)
- Run `pnpm test` — must fail.

**Task T2.13 [TEST]** [x] **— GET ?eligible=true controller spec**
- **File (new or extend):** `api/src/presentation/materia-grupo-ciclo/__tests__/list-enrollable-students.controller.spec.ts`
- **Spec:** MGC-S18 (enables the add candidate list for empty optativas) · **Design:** D5, section 6.4
- Write failing tests:
  - `GET /course-cycles/:ccId/materias/:materiaId/alumnos?eligible=true` → delegates to `ListEnrollableStudentsForMateriaUseCase`
  - Without `?eligible=true` → current behavior unchanged (regression guard)
  - `?eligible=true` and `?unassigned=true` together → `eligible` wins (or validate one-of)
- Run `pnpm test` — must fail.

**Task T2.14 [IMPL]** [x] **— Controller: DELETE + PATCH + eligible branch**
- **File:** `api/src/presentation/materia-grupo-ciclo/materia-grupo-ciclo.controller.ts`
- **Spec:** MGC-R9, MGC-R10, MGC-S19, MGC-S22, MGC-S23, MGC-S24; D5 eligible · **Design:** sections 6.2, 6.3, 6.4, D8
- Depends on: T2.11, T2.12, T2.13 (all tests must fail first)
- Add:
  1. `DELETE /course-cycles/:ccId/materias/:materiaId/alumnos/:id` — `@HttpCode(HttpStatus.NO_CONTENT)`, delegates to `RemoveStudentFromMateriaUseCase`. Authz `@Roles('ROOT', { module: 'COURSE_CYCLES', action: 'DELETE' })`.
  2. `PATCH /course-cycles/:ccId/materias/:materiaId` — Zod body `{ esOptativa: z.boolean() }`, delegates to `SetMateriaEsOptativaUseCase`, returns `MateriaResponse`. Authz `@Roles('ROOT', { module: 'COURSE_CYCLES', action: 'UPDATE' })`.
  3. `GET .../materias/:materiaId/alumnos`: add `eligible` branch — when `eligible === 'true'` delegate to `ListEnrollableStudentsForMateriaUseCase`; else keep existing behavior. Validate mutual exclusion with `unassigned`.
- Run `pnpm test` — T2.11, T2.12, T2.13 must pass.

**Task T2.15 [IMPL]** [x] **— Module wiring**
- **File:** `api/src/presentation/materia-grupo-ciclo/materia-grupo-ciclo.module.ts`
- **Design:** section 6, module wiring
- Depends on: T2.14
- Register `RemoveStudentFromMateriaUseCase`, `SetMateriaEsOptativaUseCase`, `ListEnrollableStudentsForMateriaUseCase` as providers.
- Ensure `AlumnosXCursoXCicloRepository` token is available in the module (needed by `ListEnrollableStudentsForMateriaUseCase`).

**Task T2.16 [BUILD]** [x] **— PR2 verification**
- Commands: `pnpm test` + `pnpm build`
- All PR2 tests green. TypeScript clean. Coverage ≥ 80% for touched files.
- Merge PR2 before starting PR3.

---

## PR3 — Web: optativa badge · materia-universe modal · toggle

**Scope:** `gestion-grupos.tsx` — type update, optativa badge, new materia-universe management modal (mirrors grupo alumnosModal), toggle control.
**Estimated changed lines:** ~230–280.
**Depends on:** PR2 merged (DELETE + PATCH + `?eligible=true` endpoints live).

### Dependency order within PR3

Steps are sequential within the same file. Badge and toggle are independent of each other but both depend on the type update. Modal depends on badge (shared view context).

---

**Task T3.1 [TEST] [x] — Web component test (optional but required for coverage gate)**
- **File (new if web test convention exists):** `web/src/pages/dashboard/__tests__/gestion-grupos-optativa.test.tsx`
- **Spec:** MGC-R7 (badge), MGC-R9 (modal add/remove), MGC-R10 (toggle) · **Design:** section 7
- Write failing tests (follow existing grupo alumnosModal test patterns):
  - Optativa badge renders when `materia.esOptativa === true`; no badge when `false`
  - Toggle PATCH is called with the current inverse value
  - Modal "eligible" list fetches `?eligible=true` endpoint
- Run `pnpm test` — must fail.

**Task T3.2 [IMPL] [x] — `esOptativa` type update**
- **File:** `web/src/pages/dashboard/gestion-grupos.tsx`
- **Spec:** MGC-R7, MGC-R12 · **Design:** section 7, item 1
- Depends on: T3.1
- Add `esOptativa: boolean` to the local `Materia` interface. The `GET .../materias` response now includes it (PR2 T2.10).
- No visual change. Run `pnpm build` — TypeScript must be clean.

**Task T3.3 [IMPL] [x] — Optativa badge**
- **File:** `web/src/pages/dashboard/gestion-grupos.tsx`
- **Spec:** MGC-R7, MGC-R12 · **Design:** section 7, item 2
- Depends on: T3.2
- Render a small badge/label next to the materia name in the materia management view when `materia.esOptativa === true`. Follow the visual convention already used for other status indicators on the page.
- Run `pnpm test` — T3.1 badge assertion must pass.

**Task T3.4 [IMPL] [x] — Materia-universe management modal**
- **File:** `web/src/pages/dashboard/gestion-grupos.tsx` (and/or a new small subcomponent if the modal logic is large enough to split)
- **Spec:** MGC-R9, MGC-S18, MGC-S19, MGC-S20, MGC-S21 · **Design:** section 7, item 3
- Depends on: T3.2
- Mirror the existing grupo `alumnosModal` shape (`handleModalAdd` / `handleModalRemove` / `refreshModalData`) for the materia-universe context:
  - Opens per-materia (new modal state: `materiaUniverseModal`)
  - Lists current universe: `GET /course-cycles/:ccId/materias/:materiaId/alumnos`
  - Lists enrollable candidates: `GET .../alumnos?eligible=true` (CC students not yet in universe)
  - Add: existing `POST .../materias/:materiaId/alumnos`
  - Remove: new `DELETE .../materias/:materiaId/alumnos/:id`
- For obligatoria materias the eligible list will typically be empty (cascade already enrolled everyone) — this is correct behavior, not an error.
- Run `pnpm test` — T3.1 modal assertions must pass.

**Task T3.5 [IMPL] [x] — Optativa toggle control**
- **File:** `web/src/pages/dashboard/gestion-grupos.tsx`
- **Spec:** MGC-R10, MGC-R11, MGC-S23, MGC-S24, MGC-S25 · **Design:** section 7, item 4; D6
- Depends on: T3.2
- Add a toggle/checkbox control in the materia management view (ROOT/admin only — guard by the authz context already available on the page):
  - Calls `PATCH /course-cycles/:ccId/materias/:materiaId` with `{ esOptativa: !current }` on change
  - Display a note: "Marcar como optativa NO elimina inscriptos existentes. Para removerlos usá el botón de quitar."
  - Matches D6 (no retroactive cleanup — the note covers the UX expectation)
- Run `pnpm test` — T3.1 toggle assertions must pass.

**Task T3.6 [BUILD] [x] — PR3 verification**
- Commands: `pnpm test` + `pnpm build`
- All PR3 tests green. TypeScript clean. Coverage ≥ 80% for touched files.
- Merge PR3. Feature complete.

---

## Requirement coverage matrix

| Task(s) | Spec requirement | Scenarios covered |
|---------|-----------------|-------------------|
| T1.1, T1.2 | MGC-R7 | MGC-S14 |
| T1.3 | MGC-R7, MGC-R10 | (port contract for D1, D3) |
| T1.4 | MGC-R9 | (port contract for D4) |
| T1.5 | MGC-R7 | (schema/migration) |
| T1.6, T1.7 | MGC-R8 | MGC-S15, MGC-S16, MGC-S17 |
| T1.8, T1.9 | MGC-R7, MGC-R10 | (flag persistence round-trip) |
| T2.1, T2.2 | MGC-R9 | MGC-S19, MGC-S20, MGC-S22 (infra) |
| T2.3, T2.4 | MGC-R9 | MGC-S19, MGC-S22 (UC) |
| T2.5, T2.6 | MGC-R10, MGC-R11 | MGC-S23, MGC-S24, MGC-S25 |
| T2.7, T2.8 | D5 (enables MGC-R9 for empty optativas) | — |
| T2.9, T2.10 | MGC-R12 | MGC-S27 |
| T2.11, T2.14 | MGC-R9 | MGC-S19, MGC-S20, MGC-S22 (endpoint) |
| T2.12, T2.14 | MGC-R10 | MGC-S23, MGC-S24 (endpoint) |
| T2.13, T2.14 | D5 | (eligible endpoint) |
| T2.15 | — | (module wiring) |
| T3.1–T3.5 | MGC-R7 (badge), MGC-R9, MGC-R10, MGC-R11 | MGC-S14, S18–S22, S23–S26 (web) |

---

## Review Workload Forecast

| PR | Scope summary | Estimated changed lines | 400-line risk |
|----|---------------|------------------------|---------------|
| PR1 | Schema + entity + ports + cascade filter + 2 repo impls + 2 test files | ~180–220 | Low |
| PR2 | 3 UCs + removeStudent impl + 3 new controller tests + 1 DTO update + controller endpoints + module | ~280–330 | Low |
| PR3 | gestion-grupos.tsx type + badge + modal + toggle + 1 test file | ~230–280 | Low |
| **Total** | | **~690–830** | **Chained PRs: Yes** |

**Chained PRs recommended: Yes.**
**Per-PR budget risk: Low** (each PR individually under 400 lines).
**Combined lines: ~690–830** — a single PR would breach the 400-line review budget.
**Delivery sequence:** PR1 → PR2 → PR3 (hard dependency order; not parallelizable across PRs).
**Decision needed before apply: Yes** — confirm chained delivery (3 sequential PRs).

---

## Notes

- **Risk R3 resolved:** `AlumnosXCursoXCicloRepository.findByCourseCycleEnriched` already exists in both the domain port (`packages/domain/src/course-cycle/repositories/alumnos-x-curso-x-ciclo-repository.ts:50`) and the Prisma impl (`api/src/infrastructure/persistence/prisma/repositories/prisma-alumnos-x-curso-x-ciclo.repository.ts:79`). No new repo method needed for T2.8.
- **Return type for `ListEnrollableStudentsForMateriaUseCase`:** reuse `AlumnoMateriaEnriched` (defined in `alumnos-x-materia-repository.ts`); project `{ id, studentId, studentName }` from `AlumnoCursoCicloEnriched`, dropping the `printable` field.
- **T3.1 is marked optional in the design but required for coverage gate.** If the web workspace has no test runner configured, mark T3.1 as `SKIP` and note the coverage gap.
- **`upsertMany` callers** (e.g., `MaterializeMateriasUseCase`, `GenerateCourseCyclesUseCase`) do NOT pass `esOptativa` and remain source-compatible (the new field is `optional` in the port).
