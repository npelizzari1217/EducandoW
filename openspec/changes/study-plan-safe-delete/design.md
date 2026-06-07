# Design: Study Plan Safe Delete

Status: design (SDD)
Change: `study-plan-safe-delete`
Depends on: `proposal`, `explore`
Stack: NestJS + Prisma (api) · @educandow/domain (Clean Arch) · React (web) · Vitest (strict TDD)

## 1. Architecture approach

Application-layer dependency guard (Option A from exploration). The deletion rule is a
PEDAGOGICAL INVARIANT, so it lives where invariants belong: a typed domain error +
an application use case that decides, never a DB constraint and never a throw.

Layering and the flow of a delete request:

```
web/study-plans.tsx  handleDeletePlan
        │  DELETE /study-plans/:id  (apiClient, direct call — bypasses useApiDelete)
        ▼
presentation  PedagogyController.deletePlan   ── maps Result → HTTP (204 | 409)
        ▼
application   DeleteStudyPlanUC.execute  ── Result<void, DomainError>
        │            ├─ findById        (existence / idempotency)
        │            └─ getDependencies (the new guard query)
        ▼
domain        StudyPlanRepository (port)  +  StudyPlanHasDependenciesError
        ▼
infrastructure PrismaStudyPlanRepository.getDependencies  ── two counts
```

Direction of dependencies stays inward (presentation → application → domain ← infrastructure).
The new error and the new port method are pure domain additions; Prisma implements the port.

## 2. Component design and ADR-style decisions

### 2.1 Domain error — `StudyPlanHasDependenciesError`

File: `packages/domain/src/pedagogy/errors/study-plan.errors.ts` (NEW file, sibling of
`academic-cycle.errors.ts`).

Shape MUST match the verified `CycleCodeAlreadyExistsError` pattern
(`extends DomainError`, `super(message, 'CODE')`; `DomainError` is
`abstract (message, code)` and sets `name = constructor.name`):

```ts
import { DomainError } from '../../shared/errors/domain-error';

export class StudyPlanHasDependenciesError extends DomainError {
  constructor(
    public readonly courseCount: number,
    public readonly courseCycleCount: number,
  ) {
    super(
      StudyPlanHasDependenciesError.buildMessage(courseCount, courseCycleCount),
      'STUDY_PLAN_HAS_DEPENDENCIES',
    );
  }

  private static buildMessage(courses: number, cycles: number): string {
    const parts: string[] = [];
    if (courses > 0) parts.push(`${courses} curso${courses === 1 ? '' : 's'} asignado${courses === 1 ? '' : 's'}`);
    if (cycles > 0)  parts.push(`${cycles} ciclo${cycles === 1 ? '' : 's'} lectivo${cycles === 1 ? '' : 's'}`);
    const detalle = parts.join(' y ');
    return `No se puede eliminar el plan porque tiene ${detalle}. ` +
           `Eliminá los ciclos lectivos y desvinculá los cursos antes de eliminar el plan.`;
  }
}
```

Decisions:
- Fields `courseCount` / `courseCycleCount` are public readonly so the controller reads them
  for the `details` payload without re-querying.
- Message builder handles singular/plural per field and omits the field whose count is 0
  (so the message never says "0 cursos"). The UC only constructs the error when at least one
  count > 0, so `parts` is never empty.
- Spanish, Rioplatense voseo ("Eliminá", "desvinculá") to match existing UX copy.
- Rejected: making it `extends ValidationError` — semantics are a 409 conflict on existing
  state, not input validation. Base `DomainError` is correct.

Export chain (mirror lines 32 / 58 verified in the two index files):
- `packages/domain/src/pedagogy/index.ts`: add
  `export { StudyPlanHasDependenciesError } from './errors/study-plan.errors';`
- `packages/domain/src/index.ts`: add
  `export { StudyPlanHasDependenciesError } from './pedagogy';`

### 2.2 Repository port + Prisma implementation

Port — `packages/domain/src/pedagogy/repositories/study-plan-repository.ts`, add to the
`StudyPlanRepository` interface:

```ts
getDependencies(planId: string): Promise<{ courseCount: number; courseCycleCount: number }>;
```

Impl — `api/src/infrastructure/persistence/prisma/repositories/prisma-study-plan.repository.ts`:

```ts
async getDependencies(planId: string): Promise<{ courseCount: number; courseCycleCount: number }> {
  const [courseCount, courseCycleCount] = await Promise.all([
    this.client.studyPlanCourse.count({ where: { studyPlanId: planId } }),
    this.client.courseCycle.count({ where: { studyPlanId: planId, deletedAt: null } }),
  ]);
  return { courseCount, courseCycleCount };
}
```

Decisions (verified against `schema.prisma`):
- `StudyPlanCourse` is a junction with NO `deletedAt` column → count ALL rows for the plan.
  Field name confirmed: `studyPlanId` (model `StudyPlanCourse`, lines 557-570).
- `CourseCycle` HAS `deletedAt DateTime?` and `studyPlanId String` (lines 146-175) → filter
  `deletedAt: null` so already soft-deleted cycles do NOT produce false positives.
- `Promise.all` of two `count` queries, NOT `$transaction`. Counts are independent reads with
  no consistency requirement between them and both hit the `@@index([studyPlanId])` (verified
  on both models) → cheap, no N+1. `$transaction` would add isolation we do not need.
- Prisma model accessors verified in existing code: `this.client.studyPlanCourse.*` and
  `this.client.courseCycle.*` are already used in this repo (lines 55, 63, 144).

### 2.3 `DeleteStudyPlanUC`

File: `api/src/application/pedagogy/use-cases/pedagogy.use-cases.ts` (line 387, currently a
one-liner returning `void`).

New signature and control flow:

```ts
@Injectable()
export class DeleteStudyPlanUC {
  constructor(private r: StudyPlanRepository) {}
  async execute(id: string): Promise<Result<void, DomainError>> {
    const existing = await this.r.findById(id);
    if (!existing) return ok(undefined);                 // idempotent: missing → success
    const { courseCount, courseCycleCount } = await this.r.getDependencies(id);
    if (courseCount > 0 || courseCycleCount > 0) {
      return err(new StudyPlanHasDependenciesError(courseCount, courseCycleCount));
    }
    await this.r.softDelete(id);
    return ok(undefined);
  }
}
```

Decisions:
- Return type changes `void → Promise<Result<void, DomainError>>`. `ok`, `err` are already
  imported and used in this file (lines 393-397); add `Result` and `DomainError` /
  `StudyPlanHasDependenciesError` to the `@educandow/domain` import.
- Not-found returns `ok(undefined)` to preserve current idempotent behavior (controller still
  answers 204). Soft-delete only runs when zero dependents.
- CALLER AUDIT (verified): the only caller of `DeleteStudyPlanUC.execute` is the controller
  `deletePlan` (line 284). No other call sites — grep for `deletePlanUC` / `DeleteStudyPlanUC`
  in `api/src` returns only the controller wiring. The return-type change is contained.

### 2.4 Controller mapping

File: `api/src/presentation/pedagogy/pedagogy.controller.ts` (line 283-284). Keep
`@HttpCode(HttpStatus.NO_CONTENT)` for the success path:

```ts
@Delete('study-plans/:id') @Roles('ROOT', { module: 'STUDY_PLANS', action: 'DELETE' }) @HttpCode(HttpStatus.NO_CONTENT)
async deletePlan(@Param('id') id: string) {
  const r = await this.deletePlanUC.execute(id);
  if (r.isErr()) {
    const e = r.unwrapErr();
    if (e instanceof StudyPlanHasDependenciesError) {
      throw new HttpException(
        { error: { message: e.message, code: e.code, details: { courseCount: e.courseCount, courseCycleCount: e.courseCycleCount } } },
        HttpStatus.CONFLICT,
      );
    }
    throw new HttpException({ error: { message: e.message, code: e.code } }, HttpStatus.BAD_REQUEST);
  }
  // success → @HttpCode(204), no body
}
```

Decisions:
- Success path returns nothing → NestJS emits 204 (unchanged contract).
- `StudyPlanHasDependenciesError → 409` with the full envelope
  `{ error: { message, code, details: { courseCount, courseCycleCount } } }`. Matches the
  existing `{ error: { message } }` envelope used by `postSection` (verified in explore) and
  the `extractErrorMessage` frontend contract (reads `data.error.message`).
- Fallback `else` → 400 with `{ error: { message, code } }` for any future `DomainError`,
  so an unmapped error never becomes an opaque 500.
- `StudyPlanHasDependenciesError` must be imported into the controller from `@educandow/domain`.

### 2.5 Frontend — reusable `AlertModal` + `handleDeletePlan`

New component: `web/src/components/ui/alert-modal.tsx`.

API:
```ts
interface AlertModalProps {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
}
```

Markup / "super premium" look (follows the verified fixed-overlay + `Card` pattern from
`students.tsx` line 525, but elevated):
- Fixed overlay: `position: fixed; inset: 0; background: rgba(0,0,0,0.45)`, flex-centered,
  `zIndex: 1000`. Render nothing when `!open`.
- Inner `Card` (`maxWidth: 420, width: 90%`) with elevation tokens (verified to exist in the
  codebase): `boxShadow: var(--shadow-xl)`, `borderRadius: var(--radius-lg)`.
- Warning accent: a top accent bar / icon circle using `var(--color-warning)` /
  `var(--color-warning-light)` and a warning glyph (triangle "!" — inline SVG or emoji-free
  unicode) to read as "blocked", not "error/destructive".
- Title (`var(--space-md)` spacing), message paragraph, then a SINGLE primary `Button`
  "Aceptar" right-aligned that calls `onClose`. No Cancel — this is an informational alert.

`handleDeletePlan` (study-plans.tsx line 204) — DO NOT modify the shared `useApiDelete` hook
(it intentionally swallows errors; changing it is out of scope). Instead this handler calls
`apiClient.delete` DIRECTLY (apiClient is already imported and used at line 212):

```ts
const [alert, setAlert] = useState<{ open: boolean; message: string }>({ open: false, message: '' });

const handleDeletePlan = async (id: string) => {
  try {
    await apiClient.delete(`/study-plans/${id}`, { params: tenantQueryParams });
    reload();
  } catch (e: unknown) {
    setAlert({ open: true, message: extractErrorMessage(e) }); // do NOT reload on block
  }
};
```

Decisions:
- `extractErrorMessage` (verified, use-api.ts line 31) already reads
  `error.response.data.error.message` → the 409 message renders directly, no composition
  needed. `details` is available on the raw error if richer copy is ever wanted, but the
  backend message is already complete.
- Bypassing `useApiDelete` for THIS handler keeps the hook untouched and other pages unaffected
  (Out of Scope honored). The page already imports `apiClient`; add `extractErrorMessage` and
  `AlertModal` imports.
- Render `<AlertModal open={alert.open} title="No se puede eliminar el plan" message={alert.message} onClose={() => setAlert({ open: false, message: '' })} />` near the page root.
- On block, do NOT `reload()` (the list is unchanged); only reload on success.

## 3. Test strategy (Vitest, strict TDD — write tests first)

Red → green per unit. Domain/UC/repo tests fail first against the unimplemented code.

| Layer | File | Cases |
|------|------|------|
| Domain error | `packages/domain/test/pedagogy/study-plan.errors.spec.ts` (NEW) | code === `STUDY_PLAN_HAS_DEPENDENCIES`; fields stored; message singular (1 curso / 1 ciclo); message plural (N cursos / M ciclos); message with only courses (no "ciclo" text); only cycles (no "curso" text); both counts present |
| Use case | `api/test/application/pedagogy/delete-study-plan.uc.spec.ts` (NEW, fake repo) | block by courses only (courseCount>0) → err; block by cycles only → err; block by both → err with both counts; ok no deps → calls `softDelete`, returns `ok`; not-found → `ok`, NEVER calls `getDependencies`/`softDelete` |
| Repository | `api/test/infrastructure/.../prisma-study-plan.repository.spec.ts` (extend/NEW) | counts `studyPlanCourse` rows by `studyPlanId`; counts `courseCycle` with `deletedAt: null` only (a soft-deleted cycle is excluded); returns zeros when no deps — using mocked Prisma client asserting the exact `where` filters |
| Controller | optional thin test | err → `HttpException` 409 with `details`; ok → no throw (204). Lower priority; UC + e2e cover the logic |
| AlertModal | `web` component test only if web test infra exists | renders message when `open`; hidden when `!open`; "Aceptar" fires `onClose`. If no web test runner is configured, cover by manual QA — do NOT add a web test toolchain in this change |

The UC test is the highest-value unit and is mandatory. The repo test must assert the
`deletedAt: null` filter explicitly (the false-positive risk called out in the proposal).

## 4. Build order & sequencing constraints (for tasks phase)

1. Domain FIRST: add error class + export chain + port method. The api resolves
   `@educandow/domain` via compiled `dist/` — REBUILD the domain package (`dist/`) before any
   api typecheck/test run, otherwise the new export/port is invisible to the api. This is a
   hard ordering edge: domain source change → rebuild → then api.
2. Infrastructure: implement `getDependencies` in the Prisma repo (needs the port to exist).
3. Application: update `DeleteStudyPlanUC` (needs error + port; needs domain dist rebuilt).
4. Presentation: controller mapping (needs UC new signature + error import).
5. Frontend: `AlertModal` then `handleDeletePlan` (independent of backend build; can proceed in
   parallel, but the contract — message/code/details — must match section 2.4).
6. Tests precede each implementation step (strict TDD). The repo and UC tests import from
   `@educandow/domain` → the rebuild in step 1 gates them too.

## 5. Risks / open items

- Domain `dist/` rebuild is the top operational risk — if skipped, api typecheck fails with
  "no exported member". Make it an explicit task step, not an assumption.
- `Promise.all` two-count read is non-transactional; a concurrent insert between count and
  softDelete could theoretically slip a dependent in. Acceptable for this admin-only,
  low-concurrency flow; a stricter version would wrap guard+softDelete in `$transaction`
  (deferred, out of scope).
- AlertModal web testing depends on whether `web` has a Vitest/RTL setup; if absent, do not
  introduce one here — cover via manual QA and keep the component trivial.
- `details` in the 409 body is currently unused by the frontend (message is enough). Kept in
  the contract for forward compatibility / richer UX later.
