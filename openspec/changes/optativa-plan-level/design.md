# Design: optativa-plan-level

> Change: optativa-plan-level — plan-level `esOptativa` that flows into materialization (approach B / C-minimal).
> Phase: design · Store: hybrid (engram `sdd/optativa-plan-level/design`)
> Reads: `sdd/optativa-plan-level/proposal` + `explore.md` (9-file chain, file:line refs).

## 1. Architecture Approach

**Pattern: pass-through extension across the existing Clean/Hexagonal layers.** No new entity, no new port method, no new endpoint, no new pattern. We thread one optional boolean (`esOptativa?: boolean`) down a chain that already exists end-to-end and whose terminal sink (`MateriaXCursoXCicloRepository.upsertMany`) already accepts the flag.

```
packages/domain (ports/DTOs, zero-deps)
  → api/src/application (use cases)
  → api/src/infrastructure/persistence/prisma (impls)
  → api/src/presentation (Nest controllers + Zod)
  → web
```

Tenant-scoped only — `StudyPlanSubject` and `MateriaXCursoXCiclo` live in `prisma_tenant`; no master-schema involvement.

**Layering discipline:** the flag is declared first in the domain DTO/port (the contract), then implemented inward (Prisma) and outward (application → presentation → web). The domain stays dependency-free; application depends on the port, never on Prisma; presentation depends on application use cases.

### Why approach B (C-minimal), not C-full

Locked in proposal §3. Re-generating a CourseCycle does NOT rewrite `esOptativa` on already-materialized `MateriaXCursoXCiclo` rows. Rationale: rewriting existing rows would silently clobber manual per-CC PATCH overrides shipped in `optativas-inscripcion`. The plan flag is the **default at first materialization**; the per-CC PATCH is the **post-gen override**. This preserves the additive semantics already in production.

## 2. Component Map & Data Flow

End-to-end chain for the flag (each hop 1–4 lines):

```
StudyPlanSubject.esOptativa            (1) schema — Prisma model field
  → StudyPlanCourseDto.subjects[].esOptativa   (2) domain DTO
  → StudyPlanRepository.addSubject(..., esOptativa?)  (2) domain port
  → PrismaStudyPlanRepository                  (3) infra
        .addSubject  → set on create AND in upsert update:{}
        .findPlanCourseById / .findPlanCoursesByPlan → map field OUT
  → AddSubjectToPlanCourseUC(..., esOptativa?)        (4) application
  → GenerateCourseCyclesUseCase                       (4) application
        maps esOptativa: s.esOptativa into planSubjects
  → MaterializeMateriasUseCase.PlanSubjectInput.esOptativa  (4) application
        passes esOptativa into upsertMany create path ONLY
  → MateriaXCursoXCicloRepository.upsertMany({ esOptativa })  ← ALREADY ACCEPTS
  → MateriaXCursoXCiclo.esOptativa            ← ALREADY EXISTS (shipped)
```

### 2.1 Read-path vs write-path

- **Write (designation):** `POST /study-plan-courses/:id/subjects` → `AddSubjectToPlanCourseUC` → `addSubject` upsert. The upsert is the single mutation point; extending its `update:{}` clause is what makes editing the flag on an existing plan subject work without a new endpoint (proposal §4).
- **Read (display):** `GET /study-plan-courses/:id/subjects` (`listPlanCourseSubjects`) and `GET .../plans/:id` (`getPlan` subjects map) both read through `findPlanCourse*` → must surface `esOptativa` so the web toggle/badge can render current state.
- **Materialization (consumption):** `GenerateCourseCyclesUseCase` reads `pc.subjects[].esOptativa` (populated by `findPlanCoursesByPlan`) and forwards it to `MaterializeMateriasUseCase`.

## 3. Detailed Design by Layer

### 3.1 Schema — `api/prisma_tenant/schema.prisma`

Add to `StudyPlanSubject` (lines 596–610), mirroring the shipped `MateriaXCursoXCiclo.esOptativa`:

```prisma
esOptativa Boolean @default(false) @map("es_optativa")
```

Migration: `pnpm --filter api prisma:migrate:tenant` (dev). **No backfill** — `@default(false)` makes every existing `StudyPlanSubject` obligatoria, which is correct (proposal §1). Dev note: dev `DATABASE_URL` now points at the `educandow_tenant_dev` sandbox, so the dev migration runs against the sandbox DB; prod uses `prisma:migrate:deploy:tenant`.

### 3.2 Domain — `packages/domain/src/pedagogy/repositories/study-plan-repository.ts`

DTO (line 10) and port method (line 20):

```ts
subjects?: { id: string; subjectId: string; subjectName?: string; hoursPerWeek?: number; esOptativa?: boolean }[];
// ...
addSubject(planCourseId: string, subjectId: string, hoursPerWeek?: number, esOptativa?: boolean): Promise<void>;
```

Optional + trailing param → backward compatible; existing callers compile unchanged.

`MateriaXCursoXCicloRepository.upsertMany` (materia-grupo-ciclo port line 15) already declares `esOptativa?: boolean` — **no change**.

### 3.3 Infrastructure — `prisma-study-plan.repository.ts`

`addSubject` (line 69) — set on BOTH create and update:

```ts
async addSubject(planCourseId, subjectId, hoursPerWeek?, esOptativa?) {
  await this.client.studyPlanSubject.upsert({
    where: { studyPlanCourseId_subjectId: { studyPlanCourseId: planCourseId, subjectId } },
    create: { studyPlanCourseId: planCourseId, subjectId, hoursPerWeek, esOptativa },
    update: { hoursPerWeek, esOptativa },
  });
}
```

The `update:` clause is what enables re-POST editing of the flag (proposal §4). `findPlanCourseById` (line 98) and `findPlanCoursesByPlan` (line 121) — add `esOptativa: s.esOptativa` to each subject map.

> Gotcha: only set `esOptativa` in `update:` when the caller actually intends to manage it. Because the param is optional, passing `undefined` to Prisma `update` is a no-op (field untouched) — this preserves the value on hoursPerWeek-only re-POSTs. Verify Prisma treats `undefined` as "skip" (it does); do NOT coerce to `false`, which would erase the flag.

### 3.4 Application

- `AddSubjectToPlanCourseUC` (`pedagogy.use-cases.ts` line 348): add `esOptativa?: boolean` to `execute(...)`, forward to `addSubject`.
- `MaterializeMateriasUseCase.PlanSubjectInput` (line 4): add `esOptativa?: boolean`. In `execute`, pass it into the `upsertMany` map (Step 1, the create path, line 34–39).
- `GenerateCourseCyclesUseCase` (line 404): map `esOptativa: s.esOptativa` into the `planSubjects` objects.

**LOCK — additive re-gen (proposal §3):** `MaterializeMateriasUseCase` Step 2 (the D1 re-sync, lines 41–63) re-syncs `studyPlanSubjectId` ONLY. It MUST NOT add `esOptativa` to the `updateDescription` re-sync. The flag flows only through `upsertMany` with `skipDuplicates`, which by definition does not touch existing rows. Make this explicit in the code comment so a future edit doesn't "helpfully" add it.

### 3.5 Presentation

- `AddSubjectToPlanCourseSchema` (`register.request.ts` line 133): add `esOptativa: z.boolean().optional()`.
- `addSubjectToPlanCourse` handler (controller line 259–262): pass `b.esOptativa` to `addSubjectUC.execute(...)`.
- `getPlan` subjects map (line 192–197): add `esOptativa: s.esOptativa`.
- `listPlanCourseSubjects` (line 250–255): add `esOptativa: s.esOptativa ?? false`.

### 3.6 Web — `web/src/pages/dashboard/study-plans.tsx`

- `PlanCourseSubject` interface (line 46): add `esOptativa?: boolean`.
- Subject row (lines 940–973): add a **standalone** optativa toggle/badge in the subject row — NOT inside the inline name-edit state (explore §open-decision 4). When on, show an "Optativa" badge; near the control show the hint **"aplica en la próxima generación de CC"** (proposal §scope, explore §risk: existing CCs are not retroactively changed).
- api-client method (the add/upsert call): include `esOptativa` in the POST body. The `hoursPerWeek: 4` hardcode at line ~393 stays; the toggle is additive alongside it.

## 4. ADR-style Decisions

| # | Decision | Rationale | Rejected alternative |
|---|----------|-----------|----------------------|
| D1 | Flag lives on `StudyPlanSubject`, modeled via `StudyPlanCourseDto` (no new domain entity) | No `StudyPlanSubject` entity exists today; the DTO is the established shape; minimal surface | Introduce a `StudyPlanSubject` entity — over-engineering for one boolean, breaks no current need |
| D2 | Re-gen is additive: `esOptativa` flows via `upsertMany` create path only, never the re-sync | Rewriting existing rows would clobber per-CC PATCH overrides (shipped) | C-full: propagate plan flag onto existing CCs on re-gen — silently undoes manual overrides |
| D3 | Edit the flag via upsert `update:{}`, no new endpoint | `POST .../subjects` is already on-conflict-update; reuse it | New `PATCH .../subjects/:id` endpoint — extra surface for a value the upsert already covers |
| D4 | `esOptativa?` optional + trailing everywhere | Backward compatible; existing callers/tests compile unchanged; `@default(false)` = no backfill | Required field / migration backfill — needless churn, breaks existing call sites |
| D5 | Prisma `update` receives `undefined` (skip) when caller omits the flag | hoursPerWeek-only re-POST must not erase the optativa flag | Coerce to `false` on omit — destructive, would silently clear designations |
| D6 | Web toggle is standalone in the subject row, not in name-edit state | Designation is independent of renaming; avoids coupling two UI states | Fold into inline name-edit — hides the control behind an unrelated mode |

## 5. PR Decomposition & Review Workload

| PR | Scope | Files | Est. lines |
|----|-------|-------|-----------|
| **PR1** — backend chain | schema + migration + domain + infra + application | `schema.prisma` (+1), study-plan-repository.ts (+2), prisma-study-plan.repository.ts (+4), pedagogy.use-cases.ts (+1), materialize-materias.use-case.ts (+2), course-cycle.use-cases.ts (+1) + migration SQL + unit/integration tests | ~40 (+ tests) |
| **PR2** — edge | presentation + web | register.request.ts (+1), pedagogy.controller.ts (+3), study-plans.tsx (+15–25), api-client (+~3) + controller spec | ~40 (+ tests) |

**Review Workload Forecast:** both PRs well under the 400-line budget. 400-line budget risk: **Low**. Chained PRs recommended: **No** (two independent slices; PR1 ships the backend default behavior, PR2 surfaces it in the UI — PR1 is safe to merge alone since the flag defaults to `false`). Decision needed before apply: **No**. PR1 → PR2 ordering is preferred (UI consumes the API), but not strictly blocking since both are additive.

## 6. Testing Strategy (Strict TDD — test first, `pnpm test`, coverage ≥ 80%)

### Unit (Vitest)
1. **`MaterializeMateriasUseCase`** — given `planSubjects` with `esOptativa: true`, asserts `upsertMany` is called with `esOptativa: true` for that subject (new materia inherits the plan flag).
2. **`MaterializeMateriasUseCase` re-gen LOCK** — on re-execution against existing rows, the Step-2 re-sync (`updateDescription`) is NOT called with `esOptativa`; existing rows keep their value. Guards D2.
3. **`GenerateCourseCyclesUseCase`** — maps `esOptativa` from `pc.subjects[]` into `planSubjects` passed to materialize.
4. **`AddSubjectToPlanCourseUC`** — forwards `esOptativa` to `planRepo.addSubject`.

### Integration — Prisma repo (`*.db.test.ts`)
5. **`PrismaStudyPlanRepository` round-trip** — `addSubject(..., esOptativa: true)` then `findPlanCourseById` / `findPlanCoursesByPlan` returns `esOptativa: true`. Re-POST with `hoursPerWeek` only does NOT clear the flag (D5).
6. **End-to-end materialization** — plan subject with `esOptativa: true` → generate CourseCycle → resulting `MateriaXCursoXCiclo` has `esOptativa: true`.

### Controller spec
7. **`addSubjectToPlanCourse`** — accepts `esOptativa` in body (Zod), passes to UC.
8. **`listPlanCourseSubjects` / `getPlan`** — responses include `esOptativa`.

## 7. Risks

1. **Thin chain across 5 layers / 9 files.** Each change 1–4 lines; the risk is an omitted hop (flag silently dropped mid-chain). Mitigation: integration test #6 exercises the full chain end-to-end.
2. **D5 — `undefined` vs `false` in Prisma `update`.** If a hoursPerWeek-only re-POST coerces `esOptativa` to `false`, it erases designations. Mitigation: test #5 second assertion; explicit comment.
3. **Admin mental model.** Admins may expect editing the plan to re-materialize existing CCs. It does not (D2). Mitigation: UI hint "aplica en la próxima generación de CC" + document per-CC PATCH as the remediation for existing CCs.
4. **`hoursPerWeek: 4` hardcode (web line ~393).** Pre-existing; toggle is additive, does not touch it.
