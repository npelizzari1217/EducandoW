# Design — asignacion-cascade-masiva

> Architectural design (the HOW). Tasks (the WHAT-to-do steps) are produced in the next phase.
> Source of truth: proposal #1372, exploration #1371. This design mirrors the verified
> per-student slice exactly and adds ONE bulk path on top, with NO new repository ports.

## 1. Architecture approach

**Pattern:** dedicated bulk Application use case (proposal Option B), reusing the existing
repository ports already wired into `AlumnosXCursoXCicloModule`. No domain changes, no new
ports, no schema/migration. The bulk path is additive and lives entirely beside the
per-student path it parallels.

**Layering (Clean Architecture — enforced):**

```
presentation (controller, module wiring, response shape)
        │  imports application only
        ▼
application (new CascadeAllStudentsMateriasCompetenciasUseCase)
        │  imports domain only (ports + entities + errors)
        ▼
domain (AlumnosXCursoXCicloRepository, MateriaXCursoXCicloRepository,
        AlumnosXMateriaRepository, SubjectCompetencyRepository,
        CompetenciaXMateriaXAlumnoXCursoXCicloRepository,
        CompetenciaXMateriaXAlumnoXCursoXCiclo entity)
```

No layer is violated: the use case depends only on domain ports/entities; the controller
depends only on the use case; the module wires Prisma adapters via `useFactory` (the same
pattern already present for every other UC in this module).

**Why not loop the per-student UC (Option A):** the per-student UC opens with
`alumnosCCRepo.findById(id)` for an IDOR check. In bulk we already obtained every bridge row
from `findByCourseCycle(ccId)`, so re-resolving each one is a redundant N+1. The bulk UC also
fetches course materias ONCE and competencies ONCE per unique `studyPlanSubjectId`, instead of
re-fetching them for every student. This is the core reason for a dedicated UC.

## 2. Components & data flow

### 2.1 New use case — `cascade-all-students-materias-competencias.use-case.ts`

Location: `api/src/application/course-cycle/cascade-all-students-materias-competencias.use-case.ts`

**Constructor deps (5 existing ports — identical set to the per-student UC):**

| Param | Port | Method used |
|---|---|---|
| `alumnosCCRepo` | `AlumnosXCursoXCicloRepository` | `findByCourseCycle(ccId)` |
| `materiaRepo` | `MateriaXCursoXCicloRepository` | `findByCourseCycleId(ccId)` |
| `alumnosXMateriaRepo` | `AlumnosXMateriaRepository` | `upsertMany(...)` |
| `competencyRepo` | `SubjectCompetencyRepository` | `findActiveByStudyPlanSubject(spsId)` |
| `competenciaRepo` | `CompetenciaXMateriaXAlumnoXCursoXCicloRepository` | `bulkCreate(...)` |

**Signature & return type:**

```ts
export interface BulkCascadeResult {
  studentsProcessed: number;
  studentsFailed: number;
  materiasCreated: number;
  materiasSkipped: number;
  competenciasCreated: number;
  competenciasSkipped: number;
}

async execute(input: { ccId: string }): Promise<BulkCascadeResult>
```

`BulkCascadeResult` is declared in this UC file and re-exported through the controller import,
mirroring how `CascadeResult` is declared in the per-student UC file today.

**Execution sequence:**

1. `rows = await alumnosCCRepo.findByCourseCycle(ccId)`.
   If `rows.length === 0` → return all-zero `BulkCascadeResult` (no error). This is the empty-CC
   case that backs the "always-enabled button" frontend decision (§4).
2. `materias = (await materiaRepo.findByCourseCycleId(ccId)).filter(m => !m.esOptativa)` — fetched
   ONCE. If empty → return `{ studentsProcessed: rows.length, studentsFailed: 0, ...zeros }`
   (every student "processed" with nothing to create, exactly like per-student UC-03/MGC-S17).
3. Resolve competencies ONCE: build `uniqueSpsIds` from `materias`, call
   `findActiveByStudyPlanSubject` per unique id (`Promise.all`), flatten into `allCompetencies`.
   This map (spsId → competencies, or just the flat list) is computed a single time and reused
   for every student.
4. Iterate `rows`. For EACH student (`row.studentId`):
   - `upsertMany(materias.map(m => ({ materiaXCursoXCicloId: m.id, studentId })))` → add to
     `materiasCreated`; `materiasSkipped += materias.length - count`.
   - Build valuations via `CompetenciaXMateriaXAlumnoXCursoXCiclo.create({ competencyId, studentId, courseCycleId: ccId })`
     for `allCompetencies`; `bulkCreate(valuations)` → add to `competenciasCreated`;
     `competenciasSkipped += valuations.length - count`.
   - On success increment `studentsProcessed`.
5. Return the accumulated `BulkCascadeResult`.

Steps 1–3 reuse byte-for-byte the same filtering and competency-resolution logic the per-student
UC already proves correct (optativa filter, unique-SPS dedupe, `c.id.get()` valuation build).
The ONLY new logic is the outer loop + accumulation + best-effort wrapping.

### 2.2 Best-effort error capture (proposal decision #3)

Each student's work (step 4) is wrapped in `try/catch`. On a thrown error the loop does NOT
abort: increment `studentsFailed`, log the failure (Nest `Logger.warn` with `ccId` + `studentId`,
no PII beyond ids), and continue to the next student. Idempotency (`skipDuplicates` on both
`upsertMany` and `bulkCreate`) makes a later re-run safe even after a partial batch.

**Tension with the "Result<T,E>, no throw" standard — resolved deliberately:** the existing
slice does NOT use `Result<T,E>`; the per-student UC throws `NotFoundError` and returns a plain
`CascadeResult`, and the controller lets Nest's exception filter map it. To stay consistent
WITHIN this slice, the bulk UC also returns a plain object (no `Result` wrapper). The standard's
real intent — "one failure must not abort the batch; accumulate" — is honored exactly by the
per-student try/catch + `studentsFailed` counter. The bulk UC has NO top-level not-found guard
(there is no `:id` to resolve; an unknown `ccId` simply yields zero rows → all-zero result).

### 2.3 New endpoint — controller

File: `api/src/presentation/course-cycle-alumnos/alumnos-x-curso-x-ciclo.controller.ts`

```ts
@Post('course-cycles/:ccId/alumnos/cascade')
@HttpCode(HttpStatus.OK)
@Roles('ROOT', { module: 'COURSE_CYCLES', action: 'UPDATE' })
async cascadeAll(@Param('ccId') ccId: string): Promise<{ data: BulkCascadeResult }> {
  const data = await this.bulkCascadeUC.execute({ ccId });
  return { data };
}
```

- Guards/auth mirror the per-student endpoint exactly: class-level `@UseGuards(AuthGuard, RolesGuard)`
  + `@Roles('ROOT', { module: 'COURSE_CYCLES', action: 'UPDATE' })`.
- **ROUTE ORDER (CRITICAL):** this handler MUST be declared BEFORE
  `@Post('course-cycles/:ccId/alumnos/:id/cascade')`. NestJS matches declaratively; if `:id/cascade`
  comes first, the literal `cascade` segment is captured as `:id`. Same precedent as
  `PATCH .../alumnos/printable` declared before `.../alumnos/:id/printable` (controller lines 110–142).
  Place `cascadeAll` immediately before the existing `cascade` method (after `togglePrintable`).
- New constructor dependency `bulkCascadeUC: CascadeAllStudentsMateriasCompetenciasUseCase`,
  added alongside the existing `cascadeUC`.

### 2.4 Module wiring

File: `api/src/presentation/course-cycle-alumnos/alumnos-x-curso-x-ciclo.module.ts`

Add a `useFactory` provider for `CascadeAllStudentsMateriasCompetenciasUseCase` injecting the
SAME 5 Prisma repos already provided for the per-student cascade (they are all present in
`providers` already — no new repo provider needed):

```ts
{
  provide: CascadeAllStudentsMateriasCompetenciasUseCase,
  useFactory: (alumnosCCRepo, materiaRepo, alumnosXMateriaRepo, competencyRepo, competenciaRepo) =>
    new CascadeAllStudentsMateriasCompetenciasUseCase(
      alumnosCCRepo, materiaRepo, alumnosXMateriaRepo, competencyRepo, competenciaRepo,
    ),
  inject: [
    PrismaAlumnosXCursoXCicloRepository,
    PrismaMateriaXCursoXCicloRepository,
    PrismaAlumnosXMateriaRepository,
    PrismaSubjectCompetencyRepo,
    PrismaCompetenciaXMateriaXAlumnoXCursoXCicloRepo,
  ],
}
```

### 2.5 Frontend — bulk button in `course-cycles.tsx`

File: `web/src/pages/dashboard/course-cycles.tsx` (course-row actions, lines ~325–342).

- New `Button variant="action" size="sm"` "Asignar materias y competencias" in the actions cell,
  next to Materias / Alumnos / Editar / Eliminar.
- State: `const [cascadingBulkCcId, setCascadingBulkCcId] = useState<string | null>(null)`.
- State: `const [confirmCascadeCcId, setConfirmCascadeCcId] = useState<string | null>(null)` for
  the confirmation dialog (reuse existing `Modal`).
- Flow: click → open confirm `Modal` ("Esto asignará materias y competencias a TODOS los alumnos
  del curso. ¿Continuar?") → on confirm call `handleBulkCascade(ccId)`.
- `handleBulkCascade(ccId)`: `POST /course-cycles/${ccId}/alumnos/cascade`; set
  `cascadingBulkCcId = ccId` while in-flight (button `loading`/`disabled`); on success use the
  page-level `setToast` (existing `toast` state) with the aggregate, e.g.
  `"${studentsProcessed} alumno(s): ${materiasCreated} materia(s) y ${competenciasCreated} competencia(s) asignadas"`
  plus `" — ${studentsFailed} con error"` when `studentsFailed > 0`; on failure error toast.
  Mirrors the per-student `handleCascade` in `AlumnosCursoCicloPanel`.

## 3. Repository port confirmation (proposal/explore claim — VERIFIED)

| Port.method | Exists? | Evidence |
|---|---|---|
| `AlumnosXCursoXCicloRepository.findByCourseCycle` | YES | port line 43 |
| `MateriaXCursoXCicloRepository.findByCourseCycleId` | YES | per-student UC line 56 |
| `AlumnosXMateriaRepository.upsertMany` | YES | per-student UC line 64 |
| `SubjectCompetencyRepository.findActiveByStudyPlanSubject` | YES | per-student UC line 86 |
| `CompetenciaXMateriaXAlumnoXCursoXCicloRepository.bulkCreate` | YES | per-student UC line 104 |

**NO new repository methods are required.** All five Prisma adapters are already registered in
the module's `providers`.

## 4. Frontend "disabled-when-empty" decision (proposal #5 / explore Q5)

**Investigated:** `GET /course-cycles` returns the `CourseCycle` DTO
(`web/src/types/course-cycle.ts`) — it carries NO enrolled-student count and no count field of
any kind. Deriving "0 students" client-side would require either an extra per-row fetch or
coupling to the SEPARATE planned "active-students count column" feature.

**Decision: always-enabled button (disabled ONLY while its own request is in-flight).**

- Rationale: the backend already returns an all-zero `BulkCascadeResult` for an empty CC (§2.1
  step 1) — running on a 0-student course is a harmless no-op, not an error. The confirmation
  dialog already guards accidental clicks.
- This keeps the change DECOUPLED from the count-column feature. If/when that feature lands and
  the list response gains a student count, the button can opt into `disabled={count === 0}` as a
  trivial follow-up — no rework of this design.
- Rejected: lightweight per-row count fetch (adds N requests on page load for a cosmetic gate);
  blocking on the count-column feature (creates an artificial dependency the prompt explicitly
  forbids).

## 5. TDD impact — exact test files

Strict TDD is active (`test_command: pnpm test`, coverage ≥ 80%). Write tests RED first.

1. **`api/src/application/course-cycle/__tests__/cascade-all-students-materias-competencias.use-case.test.ts`** (new)
   Mirror the per-student UC cases adapted to multi-student + best-effort:
   - BULK-01: zero enrolled rows → all-zero result, no materia/competency fetch beyond rows.
   - BULK-02: zero materias (rows>0) → `studentsProcessed = rows.length`, all create/skip zero,
     `upsertMany`/`bulkCreate` never called.
   - BULK-03: happy path N students × M materias × K competencies → accumulated counts =
     per-student counts × N; materias + competencies resolved ONCE (assert
     `findByCourseCycleId` called once, `findActiveByStudyPlanSubject` called once per unique SPS,
     NOT once per student).
   - BULK-04: idempotent re-run → `studentsProcessed = N`, all `*Created = 0`, `*Skipped` = totals.
   - BULK-05: optativa filter (adapted MGC-S15) — optativa materias/SPS excluded across all students.
   - BULK-06: all-optativa CC (adapted MGC-S17) → zeros, no writes, no throw.
   - BULK-07 (NEW — best-effort partial failure): one student's `upsertMany`/`bulkCreate` throws →
     `studentsFailed = 1`, loop continues, remaining students still processed and counted.
   - BULK-08 (grade preservation, adapted UC-06): only `bulkCreate` touches the competency repo.
2. **`api/src/presentation/course-cycle-alumnos/__tests__/alumnos-x-curso-x-ciclo.controller.spec.ts`** (extend)
   - C-12: `cascadeAll('cc-1')` calls `bulkCascadeUC.execute({ ccId: 'cc-1' })`, returns `{ data: BulkCascadeResult }`.
   - C-13 (route order / shadowing assertion): assert via Nest route metadata
     (`Reflect.getMetadata('path', ...)` + method order) that `cascadeAll`'s path
     `course-cycles/:ccId/alumnos/cascade` is registered BEFORE
     `course-cycles/:ccId/alumnos/:id/cascade`, so `cascade` is not captured as `:id`.
3. **`web/src/pages/dashboard/course-cycles.test.tsx`** (new or extend, frontend button)
   - W-19: clicking the button opens the confirmation dialog (no request fired yet).
   - W-20: confirming fires `POST /course-cycles/:ccId/alumnos/cascade`.
   - W-21: button is `disabled`/`loading` while its request is in-flight (no double-submit).
   - W-22: success toast shows aggregate counts (and `studentsFailed` when > 0).
   - W-23: error toast on request failure.
   - W-24: button is ALWAYS enabled regardless of student count (documents §4 decision).

## 6. Clean Architecture compliance checklist

- domain: unchanged — imports nothing new. ✓
- application: new UC imports only domain ports + the `CompetenciaXMateriaXAlumnoXCursoXCiclo`
  entity + `Logger` (Nest infra logger is acceptable here exactly as Nest is already used via
  `@Injectable`; if stricter purity is desired, inject a logger port — flagged as optional). ✓
- presentation: controller imports the application UC only; module wires Prisma adapters. ✓
- repository-pattern: reuses existing ports speaking domain language; returns domain entities. ✓
- error-handling: best-effort accumulation via per-student try/catch + `studentsFailed`. ✓

## 7. ADR-style decisions

- **ADR-B1 — Dedicated bulk UC over per-student loop.** Chosen: dedicated UC fetching materias +
  competencies once and looping students. Rejected: looping per-student UC (N+1 `findById` +
  N× materia/competency refetch). Rationale: performance for 30+ student courses; rows already
  carry `studentId`, so the IDOR `findById` is redundant in bulk.
- **ADR-B2 — Best-effort partial failure, not atomic.** Chosen: continue on per-student error,
  count `studentsFailed`. Rejected: all-or-nothing transaction. Rationale: idempotency makes
  re-run safe; a single bad row should not block the rest of the class.
- **ADR-B3 — Plain return object, no `Result<T,E>` wrapper.** Chosen: return `BulkCascadeResult`
  to match the per-student slice. Rejected: introduce `Result<T,E>` only here. Rationale:
  intra-slice consistency; best-effort intent already satisfied at the loop level.
- **ADR-B4 — Always-enabled button, backend no-op on empty.** Chosen: no client-side count gate.
  Rejected: per-row count fetch / coupling to count-column feature. Rationale: decoupling +
  empty CC is a harmless zero-result no-op.
- **ADR-B5 — Route order: `/alumnos/cascade` before `/alumnos/:id/cascade`.** Forced by NestJS
  declarative matching; same precedent as `/printable`. Covered by controller test C-13.
