# Technical Design: optativas-inscripcion

> Change: optativas-inscripcion — Deuda #3 de `docente-ciclo-grupos`
> Phase: design · Store: hybrid (engram `sdd/optativas-inscripcion/design`)
> Architecture: Clean/Hexagonal (per `openspec/config.yaml`). Multitenant: TENANT schema/client only.

## 1. Architectural Approach

No new pattern is introduced. We extend the existing vertical slice for `MateriaXCursoXCiclo`
across the established layers, respecting the dependency direction:

```
packages/domain (entities + ports, zero deps)
  → api/src/application (use cases)
    → api/src/infrastructure/persistence/prisma (repo implementations)
      → api/src/presentation (Nest controllers/DTOs)
        → web (React)
```

The behavioral core is a **one-line filter inside the cascade** (`!m.esOptativa`). Everything else is
plumbing the new `esOptativa` flag through the layers and adding the missing "remove student from
materia" mirror of the existing "add student" path. We REUSE the add path verbatim; we ADD the
delete/toggle/eligible paths following the exact templates already present for grupos
(`RemoveStudentFromGrupoUseCase`, `PATCH /grupos/:id`).

### Guiding principles (from proposal — locked)

- Flag lives ONLY on `MateriaXCursoXCiclo` (snapshot self-contained; zero cascade cost; rows already in memory).
- Cascade filters `!m.esOptativa` — optativas never auto-enroll.
- Retroactivity: NO auto-cleanup. Admin removes manually via the new DELETE.
- `StudyPlanSubject.esOptativa` and plan-level UI are explicit follow-up (out of scope).

## 2. Data Model Change

**File:** `api/prisma_tenant/schema.prisma`, model `MateriaXCursoXCiclo` (line 173).

Add one column after `studyPlanSubjectId`:

```prisma
  esOptativa  Boolean @default(false) @map("es_optativa")
```

**Migration:** `pnpm --filter api prisma:migrate:tenant` (dev). No backfill — existing rows default to
`false`, which is exactly the desired semantics (everything materialized so far is obligatoria). The
generated migration is a single non-nullable column with a default, so it is safe and instant on
existing data. Prod path: `prisma:migrate:deploy:tenant`.

`pnpm --filter api prisma:generate` regenerates the tenant client so `esOptativa` is typed.

**Decision — no DB index:** the flag is only ever read after `findByCourseCycleId` already loaded the
rows; it is filtered in memory. No query targets `WHERE esOptativa = ...`. Adding an index would be
dead weight.

## 3. Domain Layer (`packages/domain`)

### 3.1 Entity `MateriaXCursoXCiclo`
File: `packages/domain/src/materia-grupo-ciclo/entities/materia-x-curso-x-ciclo.ts`

- `MateriaXCursoXCicloProps`: add `esOptativa: boolean`.
- `CreateMateriaXCursoXCicloInput`: add `esOptativa?: boolean`.
- `create()`: default `esOptativa: input.esOptativa ?? false`.
- Add getter `get esOptativa(): boolean`.
- `reconstruct()` already spreads props — no change beyond the prop type.

Materialization (`MaterializeMateriasUseCase` / `GenerateCourseCyclesUseCase`) creates rows WITHOUT
passing `esOptativa` → they default `false`. No change needed there (confirms snapshot semantics:
plan edits never flip materialized rows). Designation is post-materialization, per-CC, via PATCH.

### 3.2 Port `MateriaXCursoXCicloRepository`
File: `packages/domain/src/materia-grupo-ciclo/repositories/materia-x-curso-x-ciclo-repository.ts`

- `upsertMany`: extend element type with `esOptativa?: boolean` (keeps `GenerateCourseCyclesUseCase`
  callers source-compatible; omitted → `false`).
- Replace/extend `updateDescription` to carry the flag. **Decision:** add a dedicated, intention-revealing
  method rather than overloading `updateDescription` (which is semantically about provenance):

  ```ts
  setEsOptativa(id: string, esOptativa: boolean): Promise<MateriaXCursoXCiclo>;
  ```

  Rationale: a toggle is a distinct domain operation; `updateDescription` stays focused. This keeps the
  PATCH use case trivial and the port honest.

### 3.3 Port `AlumnosXMateriaRepository`
File: `packages/domain/src/materia-grupo-ciclo/repositories/alumnos-x-materia-repository.ts`

Add the missing mirror of `addStudent`:

```ts
/** Remove a student from the subject universe by the bridge-row id. Idempotent. */
removeStudent(id: string): Promise<void>;
```

**Decision — remove by bridge-row `id`, not by `(materiaId, studentId)`.** Mirrors
`AlumnosXGrupoRepository.removeStudent(grupoId, alumnoXGrupoId)` and the DELETE endpoint shape
`.../alumnos/:id`. The `id` is what `findByMateriaEnriched` already returns to the UI, so the client
has it in hand. Idempotent: deleting a non-existent id is a no-op (Prisma `deleteMany`).

## 4. Application Layer (`api/src/application`)

### 4.1 `CascadeStudentMateriasCompetenciasUseCase` (MODIFY)
File: `api/src/application/course-cycle/cascade-student-materias-competencias.use-case.ts`

After line 54 (`findByCourseCycleId`), filter before the upsert:

```ts
const materias = (await this.materiaRepo.findByCourseCycleId(ccId)).filter((m) => !m.esOptativa);
```

`materias` is then used for BOTH the alumno upsert (step 3) and the competency resolution (step 4) —
so optativa competencies are also correctly excluded from auto-creation (a student not enrolled in the
optativa must not get its competency valuation rows). The `materias.length === 0` short-circuit and all
count math keep working unchanged. **This is the single behavioral change of the whole feature.**

### 4.2 `RemoveStudentFromMateriaUseCase` (NEW)
File: `api/src/application/materia-grupo-ciclo/remove-student-from-materia.use-case.ts`

Exact mirror of `RemoveStudentFromGrupoUseCase`. Validates the parent materia exists (NotFound on
absent), then delegates to `alumnosXMateriaRepo.removeStudent(id)`.

```ts
@Injectable()
export class RemoveStudentFromMateriaUseCase {
  constructor(
    private readonly materiaRepo: MateriaXCursoXCicloRepository,
    private readonly alumnosRepo: AlumnosXMateriaRepository,
  ) {}
  async execute(input: { materiaXCursoXCicloId: string; alumnoXMateriaId: string }): Promise<void> {
    const materia = await this.materiaRepo.findById(input.materiaXCursoXCicloId);
    if (!materia) throw new NotFoundError('MateriaXCursoXCiclo', input.materiaXCursoXCicloId);
    await this.alumnosRepo.removeStudent(input.alumnoXMateriaId);
  }
}
```

### 4.3 `SetMateriaEsOptativaUseCase` (NEW)
File: `api/src/application/materia-grupo-ciclo/set-materia-es-optativa.use-case.ts`

Validates materia exists, calls `materiaRepo.setEsOptativa(id, esOptativa)`, returns the updated entity.
Pure toggle — does NOT touch already-enrolled students (locked decision: no retroactive cleanup).

### 4.4 `ListEnrollableStudentsForMateriaUseCase` (NEW) — addresses Risk #4
File: `api/src/application/materia-grupo-ciclo/list-enrollable-students-for-materia.use-case.ts`

**Problem (explore Risk #4):** for an empty optativa, the existing
`GET .../materias/:materiaId/alumnos?unassigned=true` filters WITHIN the materia universe (students in
the materia but not in a grupo). An optativa universe starts empty → that query returns nothing, so the
admin has no source list of "who can be enrolled".

**Decision — add a dedicated use case + a third mode on the existing endpoint (`?eligible=true`).**
Eligible = students enrolled in the CourseCycle (`AlumnosXCursoXCiclo`) MINUS students already in the
materia universe (`MateriasXAlumnoXCursoXCiclo`).

```ts
async execute(input: { materiaXCursoXCicloId: string }): Promise<AlumnoMateriaItem[]> {
  const materia = await this.materiaRepo.findById(input.materiaXCursoXCicloId);
  if (!materia) throw new NotFoundError('MateriaXCursoXCiclo', input.materiaXCursoXCicloId);
  const ccStudents = await this.alumnosCCRepo.findByCourseCycleEnriched(materia.courseCycleId);
  const enrolled = new Set(
    (await this.alumnosXMateriaRepo.findByMateria(materia.id)).map((a) => a.studentId),
  );
  return ccStudents.filter((s) => !enrolled.has(s.studentId));
}
```

**Repo dependency:** needs CC-enrolled students enriched (id+studentId+studentName). Reuse
`AlumnosXCursoXCicloRepository`; if no enriched finder exists, add
`findByCourseCycleEnriched(ccId): Promise<AlumnoMateriaItem[]>` to that port + prisma impl. (Tasks
phase confirms whether the enriched finder already exists; if a plain `findByCourseCycleId` returns
rows with `studentId`, enrich with a `student.findMany` name lookup exactly like
`findByMateriaEnriched` does today.)

**Why a separate UC, not a branch inside `ListAlumnosMateriaUseCase`:** the eligible query reaches into
a DIFFERENT aggregate (`AlumnosXCursoXCiclo`) and needs a new repo dependency. Keeping
`ListAlumnosMateriaUseCase` focused on the materia universe respects SRP; the controller selects the UC
by query param.

## 5. Infrastructure Layer (Prisma — TENANT)

### 5.1 `PrismaMateriaXCursoXCicloRepository`
File: `api/src/infrastructure/persistence/prisma/repositories/prisma-materia-x-curso-x-ciclo.repository.ts`

- `MateriaXCursoXCicloRow` type: add `esOptativa: boolean`.
- `upsertMany`: include `esOptativa: d.esOptativa ?? false` in the `createMany` data map.
- New `setEsOptativa(id, esOptativa)`: `this.client.materiaXCursoXCiclo.update({ where: { id }, data: { esOptativa } })`, map to domain.
- `toDomain`: pass `esOptativa: row.esOptativa`.

### 5.2 `PrismaAlumnosXMateriaRepository`
File: `api/src/infrastructure/persistence/prisma/repositories/prisma-alumnos-x-materia.repository.ts`

New `removeStudent(id)`:

```ts
async removeStudent(id: string): Promise<void> {
  await this.client.materiasXAlumnoXCursoXCiclo.deleteMany({ where: { id } });
}
```

`deleteMany` (not `delete`) makes it idempotent — no throw on a missing row.

### 5.3 `PrismaAlumnosXCursoXCicloRepository` (only if enriched finder missing)
Add `findByCourseCycleEnriched(ccId)` following the `findByMateriaEnriched` pattern (rows → student name
map → sorted `AlumnoMateriaItem[]`).

## 6. Presentation Layer (NestJS)

File: `api/src/presentation/materia-grupo-ciclo/materia-grupo-ciclo.controller.ts`
DTO: `api/src/presentation/materia-grupo-ciclo/dto/materia-grupo-ciclo.dto.ts`
Module wiring: `materia-grupo-ciclo.module.ts` (register the 3 new use cases as providers).

### 6.1 `MateriaResponse` + `GET .../materias` (MODIFY)
- DTO `MateriaResponse`: add `esOptativa: boolean`.
- `listMaterias` mapping: add `esOptativa: item.materia.esOptativa`.

### 6.2 `PATCH /course-cycles/:ccId/materias/:materiaId` (NEW)
Body schema (Zod): `{ esOptativa: z.boolean() }`. Returns the updated `MateriaResponse` (recompute counts
or return the flag + ids; counts unchanged by a toggle so returning the entity fields is enough).
- Authz: `@Roles('ROOT', { module: 'COURSE_CYCLES', action: 'UPDATE' })` — mirrors `PATCH /grupos/:id`.

### 6.3 `DELETE /course-cycles/:ccId/materias/:materiaId/alumnos/:id` (NEW)
- `@HttpCode(HttpStatus.NO_CONTENT)`, delegates to `RemoveStudentFromMateriaUseCase`.
- Authz: `@Roles('ROOT', { module: 'COURSE_CYCLES', action: 'DELETE' })` — mirrors
  `DELETE /grupos/:grupoId/alumnos/:alumnoXGrupoId`.

### 6.4 `GET .../materias/:materiaId/alumnos?eligible=true` (EXTEND)
The existing handler already accepts `?unassigned`. Add an `eligible` branch: when `eligible === 'true'`,
delegate to `ListEnrollableStudentsForMateriaUseCase`; else keep current behavior. `unassigned` and
`eligible` are mutually exclusive (eligible wins if both set, or validate one-of in the schema).

### Authz alignment (3-door access model)
All endpoints in this controller use `@UseGuards(AuthGuard, RolesGuard)` + `@Roles('ROOT', { module, action })`.
The three doors: (1) `ROOT` role bypass, (2) module/action RBAC (`COURSE_CYCLES` × CRUD action), (3) tenant
scoping via `TenantContext`/`institutionId`. New endpoints reuse `COURSE_CYCLES` with `UPDATE` (toggle) and
`DELETE` (remove student), staying consistent with the existing materia/grupo endpoints. No new module or
permission is introduced.

## 7. Web Layer (`web/src/pages/dashboard/gestion-grupos.tsx`)

**Reality check:** `gestion-grupos.tsx` is currently GRUPO-centric. It lists/edits grupos and manages
GRUPO membership; the materia universe (`POST .../materias/:materiaId/alumnos`) is fetched only as a
candidate source for grupo assignment — there is NO existing UI to manage the materia universe directly.
Optativa enrollment IS materia-universe management, so PR3 must add a new surface for it.

**Design for PR3:**
1. `Materia` local interface: add `esOptativa: boolean` (the list endpoint now returns it; the filter
   `filterMaterias`/`formMaterias` lists already consume `GET .../materias`).
2. **Optativa badge:** render a small badge next to the materia name wherever materias are listed
   (filter dropdown labels can stay plain; the badge belongs to a materia-management view).
3. **New "Inscriptos" (materia universe) modal**, opened per-materia, that:
   - lists current universe via `GET .../materias/:materiaId/alumnos` (enriched),
   - lists enrollable candidates via `GET .../materias/:materiaId/alumnos?eligible=true`,
   - adds via existing `POST .../materias/:materiaId/alumnos`,
   - removes via the new `DELETE .../materias/:materiaId/alumnos/:id`.
   This mirrors the existing grupo `alumnosModal` (`handleModalAdd`/`handleModalRemove`/`refreshModalData`)
   almost verbatim — reuse its shape.
4. **Optativa toggle:** a control (only meaningful for ROOT/admin) calling the new
   `PATCH .../materias/:materiaId` with `{ esOptativa }`. Placed in the materia-management view, with a
   confirm note that marking optativa does NOT remove already-enrolled students (matches the no-cleanup
   decision — the admin uses the remove affordance for that).

**Decision:** for optativas, the add candidate source is `?eligible=true` (all CC students not yet in the
universe). For obligatorias the universe is already full via cascade, so the modal mainly shows current
members + remove; the eligible list will typically be empty, which is correct.

## 8. PR Decomposition & Review Workload

| PR | Scope | Files | Est. changed lines |
|----|-------|-------|--------------------|
| **PR1** | Schema + migration + domain entity/ports + Prisma flag plumbing + **cascade filter** + unit tests | schema.prisma, migration, entity, both ports (flag only), both prisma repos (flag/upsert), cascade UC, cascade + entity tests | ~180–220 |
| **PR2** | `removeStudent` port+impl, DELETE + PATCH endpoints, `RemoveStudentFromMateria` / `SetMateriaEsOptativa` / `ListEnrollableStudents` UCs, DTOs, module wiring, `?eligible` branch, unit + integration tests | repos, 3 UCs, controller, dto, module, tests | ~280–330 |
| **PR3** | Web: `esOptativa` in type, badge, materia-universe modal, toggle, eligible fetch | gestion-grupos.tsx (+ maybe a small subcomponent) | ~230–280 |

### Review Workload Forecast
- Each PR is individually UNDER the 400-line review budget (PR2 highest at ~330).
- Combined ~700–830 lines → a single PR WOULD breach the budget. **Chained PRs recommended: Yes.**
- 400-line budget risk per-PR: **Low**. Sequence is dependency-ordered (PR1 → PR2 → PR3); PR1 must merge
  (migration + domain) before PR2 endpoints compile, and PR3 needs PR2's endpoints.
- Decision needed before apply: confirm chained delivery (matches proposal Risk mitigation).

## 9. Testing Strategy (Strict TDD — test first, `pnpm test`, coverage ≥ 80%)

### Unit (Vitest)
1. **Cascade skips optativas** (`cascade-student-materias-competencias.use-case`): given a CC with mixed
   materias, `upsertMany` is called only with the non-optativa ids; competency resolution excludes
   optativa `studyPlanSubjectId`s. (Core behavior — write this FIRST.)
2. **Entity** (`materia-x-curso-x-ciclo.test.ts`): `create` defaults `esOptativa=false`; honors `true`;
   getter + reconstruct round-trip.
3. **`RemoveStudentFromMateriaUseCase`**: throws NotFound on missing materia; delegates
   `removeStudent(id)` on success.
4. **`SetMateriaEsOptativaUseCase`**: throws NotFound on missing materia; calls `setEsOptativa` with the
   boolean; does NOT touch alumno repos (no retroactive cleanup).
5. **`ListEnrollableStudentsForMateriaUseCase`**: returns CC students minus already-enrolled; empty when
   all enrolled; NotFound on missing materia.

### Integration (Prisma repo tests)
6. **Flag persistence** (`prisma-materia-x-curso-x-ciclo.repository.test.ts`): `upsertMany` with/without
   flag → defaults false; `setEsOptativa` flips and persists; round-trips through `findByCourseCycleId`.
7. **`removeStudent`** (`prisma-alumnos-x-materia.repository.test.ts`): removes the row by id; idempotent
   on a missing id (no throw).
8. **DELETE endpoint** (controller spec): NO_CONTENT, removes the universe row; NotFound on bad materia.
9. **PATCH endpoint** (controller spec): toggles `esOptativa`; response carries the new flag; authz.

### Web
10. Optional component test for the materia-universe modal add/remove + badge render (follow the existing
    `list-alumnos-materia.controller.spec` / web test conventions if present).

## 10. ADR-style Decisions

| # | Decision | Rationale | Rejected alternative |
|---|----------|-----------|----------------------|
| D1 | Flag only on `MateriaXCursoXCiclo` | Zero cascade cost (rows in memory), snapshot self-contained | Flag on `StudyPlanSubject` (N extra queries, plan edits leak into materias); both (2 migrations) |
| D2 | Cascade filters `!m.esOptativa` for BOTH alumnos and competencies | A non-enrolled student must not get optativa competency rows either | Filter only the alumno upsert (would orphan competency creation) |
| D3 | `setEsOptativa` as a dedicated port method | Intention-revealing; keeps `updateDescription` (provenance) focused | Overload `updateDescription` with a flag arg |
| D4 | `removeStudent(id)` by bridge-row id | Mirrors grupo remove + DELETE `.../alumnos/:id`; UI already holds the id | Remove by `(materiaId, studentId)` (extra lookup, diverges from grupo pattern) |
| D5 | New `ListEnrollableStudentsForMateriaUseCase` + `?eligible=true` | Empty-optativa case needs CC-level source; different aggregate → SRP | Branch inside `ListAlumnosMateriaUseCase` (mixes aggregates); reuse `?unassigned` (wrong semantics) |
| D6 | No retroactive cleanup on toggle | Avoids a destructive mass op; keeps change bounded (proposal-locked) | Auto-uncascade on marking optativa |
| D7 | No DB index on `esOptativa` | Only filtered in memory post-load; no WHERE targets it | Add index (dead weight) |
| D8 | Reuse `COURSE_CYCLES` module with UPDATE/DELETE actions | Consistent with existing materia/grupo endpoints (3-door model) | New permission module/action |

## 11. Risks & Assumptions

- **R1 (carried):** Per-CC designation is repetitive without plan-level flag — amortized by the
  `StudyPlanSubject.esOptativa` follow-up (out of scope).
- **R2 (resolved here):** Eligible-students query for empty optativas → solved by D5.
- **R3 (assumption to confirm in tasks):** an enriched CC-students finder may need adding to
  `AlumnosXCursoXCicloRepository`. If `findByCourseCycleId` returns `studentId`, enrich inline.
- **R4 (UI gap):** the materia universe currently has NO direct management surface in gestion-grupos;
  PR3 adds it (not just a tweak). Scoped and estimated above.
- **R5 (multi-layer scope):** mitigated by the chained PR1→PR2→PR3 sequence.
- **R6 (co-docencia discrepancy):** pre-existing spec/impl mismatch (MGC overlap) — explicitly out of scope.
