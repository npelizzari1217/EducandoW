# Design — docente-grade-entry (Fase D, Terciario)

**Pedagogical level**: TERCIARIO · **Scope**: backend-only · **Architecture**: Clean Architecture (domain → application → infrastructure → presentation)
**Inputs**: proposal `openspec/changes/docente-grade-entry/proposal.md`; spec `.../specs/docente-grade-entry.md` (engram #1196); explore #1193; decisions #1194.

This change adds **Door 3 for Terciario** — the ownership gate that exists for Primario/Secundario via `AssignmentAuthorizer` but is absent for Terciario. It mirrors that service exactly, swapping the `DocenteXCiclo → Grupo` chain for a flat `DocenteXMateriaCarrera` lookup keyed on `(userId, materiaCarreraId, anioAcademico)`, because Terciario has no AcademicCycle/CourseCycle and is year-scoped by `anioAcademico` strings.

---

## 1. Architecture approach

Same layering and DI conventions already used by the grading bounded context:

- **domain** (`@educandow/domain`): entity `DocenteXMateriaCarrera`, repository port `DocenteXMateriaCarreraRepository`, the Door 3 port `TerciarioAuthorizerPort` (+ reused `StudentScope` tri-state), and two new `DomainError` subclasses.
- **application** (`api/src/application/grading/`): `TerciarioAuthorizerService` (mirrors `AssignmentAuthorizer`); admin use-cases (assign/list/unassign); and ownership wiring into the existing terciario cursada use-cases.
- **infrastructure** (`api/src/infrastructure/persistence/prisma/repositories/`): `PrismaDocenteXMateriaCarreraRepository` (tenant, via `TenantContext.getClient()`).
- **presentation** (`api/src/presentation/nivel-terciario/`): new `DocenteMateriaAdminController`; ownership injection into `NotaCursadaTerciarioController`; new scoped inscripciones read route.

Dependency rule respected: domain knows nothing of Prisma/Nest; the authorizer service depends only on the domain port + `TenantContext`; controllers depend on use-cases.

**Reused authz primitives (unchanged — SPEC-8.5):** `resolveAccessScope(...).isAdministrative` (rank ≥ SECRETARIO) is the single source of truth for Door 2. `AssignmentAuthorizer` and `access-scope.ts` are NOT touched.

### Naming reconciliation (ADR-1)
The locked spec (#1196 SPEC-3.1) defines the **public** Door 3 port as `canWriteGrades(userId, userRoles, inscripcionMateriaId)` and `getAllowedStudentIds(userId, userRoles, materiaCarreraId, anioAcademico)` — a 1:1 mirror of `AssignmentAuthorizerPort`. The proposal/decision notes used working names `canGradeMateria` / `getAllowedMateriaCarreraIds`. **The spec wins** (it is the contract `sdd-verify` checks). The proposal's `canGradeMateria(userId, materiaCarreraId, anioAcademico)` survives as the **private** Door 3 lookup helper that both public methods call — see §4.

---

## 2. Data layer — Prisma model + migration (tenant only, SPEC-8.1)

### 2.1 Schema (`api/prisma_tenant/schema.prisma`)
Mirrors `DocenteXCiclo` style (User.id soft ref AD-6, `active` soft-delete, `@@map` snake_case). No FK to master `User`; **does** FK to tenant `MateriaCarrera`.

```prisma
model DocenteXMateriaCarrera {
  id               String   @id @default(uuid())
  userId           String   @map("user_id")            // master User.id, no FK — cross-DB (AD-6)
  materiaCarreraId String   @map("materia_carrera_id")
  anioAcademico    String   @map("anio_academico")     // year string, NOT an AcademicCycle
  active           Boolean  @default(true)

  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt      @map("updated_at")

  materiaCarrera   MateriaCarrera @relation(fields: [materiaCarreraId], references: [id], onDelete: Cascade)

  @@unique([userId, materiaCarreraId, anioAcademico])   // SPEC-1.2
  @@index([materiaCarreraId, anioAcademico])            // Door 3 + list-by-materia
  @@index([userId])                                     // list-by-docente
  @@map("docentes_x_materia_carrera")
}
```
Add the back-relation `docentesAsignados DocenteXMateriaCarrera[]` to `model MateriaCarrera`.

> **ADR-2 — soft-delete via `active` only, no `deletedAt`.** `DocenteXCiclo` carries both `active` + `deletedAt`; the spec (SPEC-1.4) defines unassign purely as `active=false` and never hard-deletes. Adding `deletedAt` would be dead weight. The uniqueness invariant is `(userId, materiaCarreraId, anioAcademico)` — re-assigning after a soft-unassign **flips `active` back to true on the same row** (no duplicate insert), which the assign use-case must handle (see §6.1).

### 2.2 Migration
New folder `api/prisma_tenant/migrations/<ts>_docentes_x_materia_carrera/migration.sql` (template: `20260618100000_llamados_examen`):
```sql
CREATE TABLE "docentes_x_materia_carrera" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "materia_carrera_id" TEXT NOT NULL,
  "anio_academico" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "docentes_x_materia_carrera_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "dxmc_user_materia_anio_key"
  ON "docentes_x_materia_carrera"("user_id","materia_carrera_id","anio_academico");
CREATE INDEX "dxmc_materia_anio_idx"
  ON "docentes_x_materia_carrera"("materia_carrera_id","anio_academico");
CREATE INDEX "dxmc_user_idx" ON "docentes_x_materia_carrera"("user_id");
ALTER TABLE "docentes_x_materia_carrera"
  ADD CONSTRAINT "dxmc_materia_carrera_fkey"
  FOREIGN KEY ("materia_carrera_id") REFERENCES "materias_carrera"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
```
Apply with `pnpm --filter api prisma:migrate:tenant`; regenerate clients with `prisma:generate`. Confirm the `materias_carrera` table name against the generated schema before writing the FK.

---

## 3. Domain layer

### 3.1 Entity / VO (`packages/domain/src/nivel-terciario/`)
`DocenteXMateriaCarrera` aggregate with private ctor + `create()` / `reconstruct()` (mirror `DocenteXCiclo`). Fields: `id` (Id VO or string per existing terciario style), `userId`, `materiaCarreraId`, `anioAcademico`, `active`, `createdAt`, `updatedAt`. Behavior: `unassign()` sets `active=false` + bumps `updatedAt`; `reactivate()` sets `active=true` (used by assign-after-soft-unassign). No nota/grade logic lives here — this is purely an assignment record.

### 3.2 Repository port (`.../repositories/docente-x-materia-carrera-repository.ts`)
```ts
export const DOCENTE_X_MATERIA_CARRERA_REPOSITORY = 'DocenteXMateriaCarreraRepository' as const;

export interface DocenteXMateriaCarreraRepository {
  // Door 3 lookup — the hot path
  findActiveAssignment(userId: string, materiaCarreraId: string, anioAcademico: string):
    Promise<DocenteXMateriaCarrera | null>;
  // assign use-case (handles reactivate-on-existing — ADR-2)
  findAny(userId: string, materiaCarreraId: string, anioAcademico: string):
    Promise<DocenteXMateriaCarrera | null>;
  findById(id: string): Promise<DocenteXMateriaCarrera | null>;
  // admin lists (active only — SPEC-4.3/4.4/4.C)
  listByMateria(materiaCarreraId: string, anioAcademico?: string): Promise<DocenteXMateriaCarrera[]>;
  listByDocente(userId: string): Promise<DocenteXMateriaCarrera[]>;
  save(entity: DocenteXMateriaCarrera): Promise<void>;     // insert or update by id
}
```

### 3.3 Door 3 port (`packages/domain/src/grading/ports/terciario-authorizer.port.ts`)
Reuses `StudentScope = string[] | 'all' | null` from `assignment-authorizer.port.ts`.
```ts
export const TERCIARIO_AUTHORIZER = 'TerciarioAuthorizerPort' as const;

export interface TerciarioAuthorizerPort {
  // create/update slot + confirmar. Resolves materiaCarreraId+anioAcademico from the inscripcion.
  canWriteGrades(userId: string, userRoles: string[], inscripcionMateriaId: string): Promise<boolean>;
  // read-scoping for the inscripciones list (SPEC-7.4)
  getAllowedStudentIds(userId: string, userRoles: string[], materiaCarreraId: string, anioAcademico: string):
    Promise<StudentScope>;
}
```

### 3.4 New errors (`packages/domain/src/shared/errors/`)
| Class | code | HTTP (via filter) |
|---|---|---|
| `OwnershipDeniedError extends DomainError` | reuse existing `ForbiddenError` (`FORBIDDEN`) | 403 |
| `DocenteAlreadyAssignedError extends DomainError` | `DOCENTE_ALREADY_ASSIGNED` | 409 |
| `AssignmentAlreadyInactiveError extends DomainError` | `ASSIGNMENT_ALREADY_INACTIVE` | 409 |

`NotFoundError` (existing, `NOT_FOUND` → 404) covers the missing-assignment unassign case (SPEC-4.5). Both new codes MUST be added to `DOMAIN_STATUS` in `api/src/presentation/shared/filters/exception.filter.ts`. Ownership denial reuses `ForbiddenError` (already mapped to 403) — no new code needed.

---

## 4. `TerciarioAuthorizerService` (application/grading) — Door 3

Structural mirror of `AssignmentAuthorizer`: a private resolver shared by both public methods, Door 2 bypass first, fail-closed everywhere.

```ts
@Injectable()
export class TerciarioAuthorizerService implements TerciarioAuthorizerPort {
  constructor(private readonly repo: DocenteXMateriaCarreraRepository) {}

  // private helper == proposal's "canGradeMateria" (ADR-1)
  private async isAssigned(userId: string, materiaCarreraId: string, anioAcademico: string): Promise<boolean> {
    return (await this.repo.findActiveAssignment(userId, materiaCarreraId, anioAcademico)) !== null;
  }

  async canWriteGrades(userId, userRoles, inscripcionMateriaId): Promise<boolean> {
    if (resolveAccessScope({ roles: userRoles }).isAdministrative) return true;  // Door 2 (SPEC-3.2)
    const client = TenantContext.getClient();
    if (!client) return false;                                                   // fail-closed (SPEC-8.6)
    const insc = await client.inscripcionMateria.findUnique({
      where: { id: inscripcionMateriaId },
      select: { materiaCarreraId: true, anioAcademico: true },
    });
    if (!insc) return false;                                                     // null-data safety (SPEC-3.3)
    return this.isAssigned(userId, insc.materiaCarreraId, insc.anioAcademico);   // Door 3
  }

  async getAllowedStudentIds(userId, userRoles, materiaCarreraId, anioAcademico): Promise<StudentScope> {
    if (resolveAccessScope({ roles: userRoles }).isAdministrative) return 'all'; // Door 2 (SPEC-3.2)
    const client = TenantContext.getClient();
    if (!client) return null;                                                    // fail-closed
    if (!(await this.isAssigned(userId, materiaCarreraId, anioAcademico))) return null;  // not assigned → 403
    const rows = await client.inscripcionMateria.findMany({
      where: { materiaCarreraId, anioAcademico },
      select: { studentId: true },
    });
    return rows.map(r => r.studentId);
  }
}
```

**Door 3 lookup query** (repo impl): `findActiveAssignment` → `findUnique({ where: { userId_materiaCarreraId_anioAcademico: { ... }, } })` then assert `row.active === true` (or `findFirst({ where: { userId, materiaCarreraId, anioAcademico, active: true } })`). Inactive rows MUST NOT grant access (SPEC-3.D).

**anioAcademico derivation (SPEC-3.4, resolved risk #2):** never accepted from headers/query for write checks — always read from `InscripcionMateria.anioAcademico` of the target record. The raw-Prisma read of the inscripcion mirrors `AssignmentAuthorizer`'s raw `courseCycle.findUnique`. If the inscripcion is missing or the tenant client is null → fail-closed (`false`/`null` → 403).

> **ADR-3 — authorizer does its own raw-Prisma reads (no extra repo deps).** `AssignmentAuthorizer` reads `courseCycle`/`materiaXCursoXCiclo` directly via `TenantContext.getClient()` rather than injecting repos for them, reserving injected repos for the assignment lookup. We follow the same split: inject only `DocenteXMateriaCarreraRepository`; read `inscripcionMateria` raw. Keeps the service lean and the mirror faithful.

### DI wiring
`TerciarioAuthorizerService` is provided in `NivelTerciarioModule` (where the cursada controller/use-cases live), not `GradingModule` (which is CourseCycle-centric). Provide `PrismaDocenteXMateriaCarreraRepository` under token `DOCENTE_X_MATERIA_CARRERA_REPOSITORY` and a `useFactory` for the service, following the existing `useFactory(...repos)` pattern.

---

## 5. Cursada ownership integration (SPEC-5 / SPEC-6)

`NotaCursadaTerciarioController` keeps `@Levels(TERCIARIO)` + `@Roles(...)` at the door. Add `@CurrentUser() user` (provides `{ userId, roles }`) and pass `(user.userId, user.roles, inscripcionMateriaId)` into the use-cases. Door 1 actions stay exactly as today (create→CREATE, update→UPDATE, confirmar→UPDATE).

**Where the check lives:** inside the use-cases, not the controller — so it is unit-testable (SPEC-8.4) and the controller stays a thin adapter. The three write use-cases gain a `TerciarioAuthorizerPort` dependency and a new first parameter set:

- `CreateNotaCursadaSlotUC.execute(userId, userRoles, inscripcionMateriaId, input)`
- `UpdateNotaCursadaSlotUC.execute(userId, userRoles, inscripcionMateriaId, slot, input)`
- `ConfirmarNotaCursadaUC.execute(userId, userRoles, inscripcionMateriaId, input)`

Each begins:
```ts
if (!(await this.authz.canWriteGrades(userId, userRoles, inscripcionMateriaId)))
  return err(new ForbiddenError('No estás asignado a esta materia'));   // → 403 (SPEC 5.B/5.D/6.D)
```
Door 2 (secretaría) short-circuits to `true` inside the authorizer, so SPEC 5.E/6.E hold with no controller branching. `ListNotaCursadaSlotsUC` (GET slots, GRADES:READ) is **not** gated by ownership in this change (the spec route table only lists the inscripciones read as scoped; slot listing keeps current behavior). The `promocionar` endpoint is **out of scope** and is left untouched.

> **ADR-4 — ownership in the use-case, not a NestJS guard.** A guard cannot see `InscripcionMateria.anioAcademico` without a DB read and cannot return the Result-pattern error cleanly. Use-cases already own the Result flow (SPEC-8.2); adding the check there keeps one error path and direct unit-testability.

---

## 6. Admin assignment surface (SPEC-4)

### 6.1 Use-cases (`api/src/application/nivel-terciario/use-cases/docente-materia.use-cases.ts`)
All return `Result<T, DomainError>` (SPEC-8.2) and enforce **isAdministrative in the use-case** (resolved risk #3):
```ts
if (!resolveAccessScope({ roles: userRoles }).isAdministrative)
  return err(new ForbiddenError('Solo secretaría puede gestionar asignaciones'));  // SPEC-4.1 / 4.B
```

- **AssignDocenteMateriaUC**`(userRoles, {userId, materiaCarreraId, anioAcademico})`: admin-gate → `findAny(...)`. If an **active** row exists → `Err(DocenteAlreadyAssignedError)` (409, SPEC-1.B/4.2). If an **inactive** row exists → `reactivate()` + save (ADR-2). Else create. Returns the row (201).
- **ListAssignmentsUC**`(userRoles, {materiaCarreraId?, userId?, anioAcademico?})`: admin-gate → dispatch to `listByMateria` or `listByDocente` (active only, SPEC-4.3/4.4/4.C).
- **UnassignDocenteMateriaUC**`(userRoles, id)`: admin-gate → `findById`. Missing → `Err(NotFoundError)` (404, SPEC-4.5). Already inactive → `Err(AssignmentAlreadyInactiveError)` (409, SPEC-4.E). Else `unassign()` + save (200, SPEC-4.D).

> **ADR-5 — isAdministrative enforced in the use-case (not a dedicated guard).** The codebase has no `AdministrativeGuard`; admin-only intent today is expressed with `@Roles('ROOT', {module, action})`, which is rank-agnostic for non-ROOT. The spec (SPEC-4.1 Note) explicitly demands an *explicit business rule*, and `resolveAccessScope().isAdministrative` is the existing domain primitive the authorizers already use. Enforcing it in the use-case (a) makes it unit-testable per SPEC-8.4, (b) reuses one primitive across Door 2 and admin gating, and (c) avoids a new cross-cutting guard. Rejected: a `RankGuard` decorator — more infra, harder to unit-test, duplicates `resolveAccessScope`.

### 6.2 Controller (`api/src/presentation/nivel-terciario/docente-materia-admin.controller.ts`)
`@Controller('terciario/admin/docentes-materias')` + `@UseGuards(AuthGuard, RolesGuard, LevelsGuard)` + `@Levels(TERCIARIO)`. Zod schemas via `ZodValidationPipe` (SPEC-8.3). `@CurrentUser` passed into every UC for the admin gate.

| Method | Path | `@Roles` Door 1 | UC |
|---|---|---|---|
| POST | `/` | `GRADES:CREATE` | Assign (201 / 409) |
| GET | `/?materiaCarreraId=\|userId=[&anioAcademico=]` | `GRADES:READ` | List |
| PATCH | `/:id/unassign` | `GRADES:UPDATE` | Unassign (200 / 404 / 409) |

Register controller + providers in `NivelTerciarioModule`.

---

## 7. Inscripciones read for docentes (SPEC-7, resolved risk #1)

**Decision: NEW dedicated route, not augment the existing one.**
`GET /terciario/cursada/inscripciones?materiaCarreraId=M&anioAcademico=Y` on `NotaCursadaTerciarioController`, `@Roles('ROOT', {module:'GRADES', action:'READ'})`, `@CurrentUser`.

New `ListInscripcionesDocenteUC.execute(userId, userRoles, materiaCarreraId, anioAcademico)`:
```ts
const scope = await this.authz.getAllowedStudentIds(userId, userRoles, materiaCarreraId, anioAcademico);
if (scope === null) return err(new ForbiddenError('No estás asignado a esta materia'));  // SPEC-7.2
const all = await this.inscripcionRepo.listByMateria(materiaCarreraId, anioAcademico);
return ok(scope === 'all' ? all : all.filter(i => scope.includes(i.studentId)));         // SPEC-7.3/7.4
```

> **ADR-6 — new GRADES route instead of augmenting `GET /terciario/inscripciones`.** The existing endpoint requires `ENROLLMENTS:READ` (which TEACHER does NOT hold — SPEC-7.1) and returns the full unscoped list for secretaría enrollment management. Augmenting it would mean OR-ing two Door-1 actions and bolting ownership filtering onto a general-purpose list — muddying its contract and risking regression for secretaría. A separate `GRADES:READ` route on the cursada controller keeps Door-1 semantics clean (grading, not enrollment), co-locates with the other docente operations, and never weakens the existing endpoint. The spec route table explicitly sanctions this ("`/terciario/cursada/inscripciones` (or augmented existing)"). Requires a `listByMateria(materiaCarreraId, anioAcademico)` method on `InscripcionRepository` if absent — verify against `PrismaInscripcionMateriaRepository` during apply.

Secretaría keeps using the untouched `GET /terciario/inscripciones` (ENROLLMENTS:READ); the new route's Door 2 bypass (`'all'`) also gives them the full list there if they hit it.

---

## 8. RBAC grant — TEACHER gains `GRADES:UPDATE` (SPEC-2, resolved risk #4)

**Confirmed mechanism (verified against `roles.guard.ts`):** the guard checks `user.modules[].actions` carried in the JWT; those modules are resolved from **`role_modules`** (master DB) at login. So SPEC-2.1's `role_modules` target is correct, and the docente *profile* `canEdit=true` is irrelevant to the guard. Two coordinated edits, both idempotent:

1. **Seed (fresh installs)** — `api/prisma/seed-rbac.sql` line 79:
   `('rm-r-teach-m-grades', 'r-teach', 'm-grades', ARRAY['CREATE','READ'])` → `ARRAY['CREATE','READ','UPDATE']`.
2. **Existing DBs** — new **master** migration `api/prisma_master/migrations/<ts>_teacher_grades_update/migration.sql`, idempotent UPDATE keyed on the known seed id:
   ```sql
   UPDATE "role_modules"
   SET "actions" = ARRAY['CREATE','READ','UPDATE']
   WHERE "id" = 'rm-r-teach-m-grades'
     AND NOT ('UPDATE' = ANY("actions"));
   ```

> **ADR-7 — grant lives in master, not tenant.** `roles/modules/role_modules` are master-DB tables (`api/prisma_master/schema.prisma`); `seed-rbac.sql` is under `api/prisma`, not `prisma_tenant`. The grant is therefore a master migration. The `NOT ... ANY` guard makes re-runs safe. **Operational note (risk):** JWTs minted before this migration won't carry `GRADES:UPDATE` — docentes must re-login (or refresh token) to pass Door 1 on confirmar/update. Door 1 stays a coarse gate; Door 3 still enforces per-materia isolation (SPEC-2.2 / 2.B), so the grant does not widen access by itself.

---

## 9. Files touched

**Create**
- `packages/domain/src/nivel-terciario/docente-x-materia-carrera.entity.ts`
- `packages/domain/src/nivel-terciario/repositories/docente-x-materia-carrera-repository.ts`
- `packages/domain/src/grading/ports/terciario-authorizer.port.ts`
- `packages/domain/src/shared/errors/docente-already-assigned-error.ts`, `assignment-already-inactive-error.ts`
- `api/src/application/grading/terciario-authorizer.service.ts`
- `api/src/application/nivel-terciario/use-cases/docente-materia.use-cases.ts`
- `api/src/presentation/nivel-terciario/docente-materia-admin.controller.ts`
- `api/src/infrastructure/persistence/prisma/repositories/prisma-docente-x-materia-carrera.repository.ts`
- `api/prisma_tenant/migrations/<ts>_docentes_x_materia_carrera/migration.sql`
- `api/prisma_master/migrations/<ts>_teacher_grades_update/migration.sql`
- Test specs (see §10)

**Modify**
- `api/prisma_tenant/schema.prisma` (new model + MateriaCarrera back-relation)
- `api/prisma/seed-rbac.sql` (TEACHER grades actions)
- `packages/domain/src/index.ts` (barrel exports) + grading/nivel-terciario barrels
- `api/src/application/nivel-terciario/use-cases/nota-cursada-terciario.use-cases.ts` (authz dep + signatures) + new `ListInscripcionesDocenteUC`
- `api/src/presentation/nivel-terciario/nota-cursada-terciario.controller.ts` (@CurrentUser, new scoped GET)
- `api/src/presentation/nivel-terciario/nivel-terciario.module.ts` (providers + controller wiring)
- `api/src/presentation/shared/filters/exception.filter.ts` (2 new codes)
- `InscripcionRepository` port + `PrismaInscripcionMateriaRepository` (add `listByMateria` if absent)

**Delete**: none.

---

## 10. Test strategy (Strict TDD, ≥80% — SPEC-8.4)

- **`TerciarioAuthorizerService` unit (mock repo + stub `TenantContext.getClient`)** — the core matrix:
  - Door 2: SECRETARIO/DIRECTOR/ADMIN/ROOT → `canWriteGrades` true / `getAllowedStudentIds` `'all'` with NO repo call (SPEC-3.A).
  - Door 3 assigned (active row) → true / studentIds (SPEC-3.B, 7.A).
  - Not assigned → false / null → 403 (SPEC-3.C, 7.B).
  - Inactive row → false (SPEC-3.D).
  - Null tenant client → false / null fail-closed (SPEC-8.A).
  - Missing inscripcion → false (null-safety, SPEC-3.3/3.4).
- **Repository impl unit/integration** — `findActiveAssignment` ignores inactive; unique-violation surfaces; `listBy*` returns active only (SPEC-4.C).
- **Admin use-cases** — assign happy/duplicate-409/reactivate-inactive; unassign 200/404/409; list dispatch; non-admin → 403 (SPEC-4.A/B/D/E, 1.B/C/D).
- **Cursada use-cases** — assigned create/update/confirmar(REGULAR/LIBRE/PROMOCIONAL) pass; non-assigned → 403; secretaría bypass (SPEC-5, 6).
- **Inscripciones read UC** — assigned filtered, not-assigned 403, secretaría full (SPEC-7).
- **Regression guard (SPEC-8.5):** `AssignmentAuthorizer` (Primario/Secundario) tests run unchanged and green; Door 3 logic for those levels is not modified. `pnpm test` + `pnpm build`, coverage ≥ 80.

---

## 11. Risks / assumptions to validate during apply

1. **JWT staleness** (ADR-7): existing docente tokens lack `GRADES:UPDATE` until re-login. Operational, not code — flag in release notes.
2. **`materias_carrera` table name + `listByMateria` existence** must be confirmed against the generated tenant client / `PrismaInscripcionMateriaRepository` before writing the FK and the read UC (ADR-6).
3. **`reactivate-on-soft-unassign`** (ADR-2): assign-after-unassign flips `active` rather than inserting; if product later wants assignment history, this collapses it — acceptable for MVP, noted.
4. **PROMOCIONAL via confirmar stays docente-allowed** (proposal flag): spec SPEC-6.1 locks all three condicions as docente-allowed under ownership; honored. Revisit only if product reverts.
5. **`getAllowedStudentIds` returns all inscripciones of the materia/year** when assigned (co-teaching means a docente sees every student of the materia, not a personal subset) — matches spec intent (per-materia isolation, not per-student); confirm with product if finer scoping is ever required.
