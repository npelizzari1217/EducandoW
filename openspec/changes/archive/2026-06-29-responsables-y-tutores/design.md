# Design — responsables-y-tutores

**Phase**: design (HOW, architectural level) · **Architecture**: Clean Architecture (domain → application → infrastructure/presentation) · **Artifact store**: hybrid

Scope is CLOSED (see `sdd/responsables-y-tutores/scope`): single `StudentGuardian` entity (NO `type` discriminator — user rejected it), `userId` optional, `relationship` free-text ≤15ch, emails on `Student`, Mobile VO new, web UI INCLUDED (Part 3). This doc decides the HOW only; it reopens nothing.

---

## 1. Architecture approach

Additive cross-layer extension of the existing `Student` aggregate and `StudentGuardian` entity. No new aggregate, no discriminator. "Has portal account" is inferred from `userId != null`. The same entity and the same REST surface serve both flows; the distinction lives in the **application layer** (two use cases) and in the **controller dispatch**, not in the domain shape.

Layering honored strictly:
- `domain/` — entity invariants + `Mobile`/`Email` VOs + repo port. Imports nothing outside itself.
- `application/` — use cases enforce contextual rules (fullName/mobile required for study tutors), orchestrate ports, return `Result`.
- `infrastructure/` — Prisma repo maps records ↔ entities, no domain leakage.
- `presentation/` — controllers + Zod DTOs, dispatch by `userId` presence, map to/from app DTOs.

---

## 2. Data model / Prisma (tenant schema only)

`api/prisma_tenant/schema.prisma`. Master schema untouched.

### Student (add 2 fields, after `motherDni`)
```prisma
fatherEmail   String?
motherEmail   String?
```
Plain `String?` (legajo identity, independent from tutor contact email). Maps to `Email?` VO in domain.

### StudentGuardian (extend + relax)
```prisma
model StudentGuardian {
  id                     String   @id @default(uuid())
  studentId              String
  userId                 String?                       // was: String (required) → now OPTIONAL
  relationship           String   @db.VarChar(15)      // was: GuardianRelationship enum
  fullName               String?                       // NEW — required for study tutors (app-enforced)
  mobile                 String?                       // NEW — required for study tutors (app-enforced)
  email                  String?                       // NEW — optional (maps to Email? VO)
  isFinancialResponsible Boolean  @default(false) @map("is_financial_responsible")
  isAuthorizedToPickUp   Boolean  @default(false) @map("is_authorized_to_pick_up")
  active                 Boolean  @default(true)       // NEW — deactivatable tutor
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt            // NEW — fields are now mutable

  student Student @relation(fields: [studentId], references: [id], onDelete: Cascade)

  @@unique([studentId, userId])   // kept: Postgres treats NULLs as distinct → multiple account-less tutors OK
  @@index([studentId])
  @@index([userId])
  @@map("student_guardians")
}
```
Then **drop** `enum GuardianRelationship { ... }` from the schema.

### Migration shape
Tenant DBs are **regenerated** (no data-migration scripts maintained for tenant). `prisma:migrate:tenant` produces one migration that: adds the Student email columns; alters `student_guardians.userId` to nullable; adds `fullName`/`mobile`/`email`/`active`/`updatedAt`; converts `relationship` enum column → `VARCHAR(15)`; drops the `GuardianRelationship` enum type. Cascade order inside the migration matters: ALTER the `relationship` column to text BEFORE `DROP TYPE GuardianRelationship` (Postgres refuses to drop a type still referenced by a column). Prisma generates this ordering automatically when the enum is removed and the field retyped in the same `prisma migrate` run; verify the generated SQL has `ALTER COLUMN ... TYPE varchar` before `DROP TYPE`.

---

## 3. Domain layer

### 3.1 New VO — `Mobile` (`packages/domain/src/shared/value-objects/mobile.ts`)
Follows the `Email` VO pattern exactly: `private readonly value`, no setters, `static create(): Result<Mobile, ValidationError>`, `static reconstruct()`, `get()`, `equals()`.

**Validation rule (pragmatic, decided)**: normalize the input by stripping spaces, dashes, parentheses and dots; preserve a single optional leading `+`. After normalization the remaining characters must be **digits only**, count between **8 and 15** (E.164 upper bound). Empty/whitespace → `ValidationError('Mobile cannot be empty')`; otherwise `ValidationError('Invalid mobile format')`. Store the normalized string (leading `+` kept if present). Rationale: accepts real Argentine inputs (`11 1234 5678`, `+54 9 11 1234 5678`) without imposing strict country/E.164 parsing that would reject valid legacy formats. Export from `shared/value-objects/index.ts` and root `index.ts` next to `Email`.

### 3.2 `StudentGuardian` entity (`packages/domain/src/personnel/entities/student-guardian.ts`)
Props change:
- `userId: string` → `userId?: string`
- `relationship: GuardianRelationship` → `relationship: string`
- add `fullName?: string`, `mobile?: Mobile`, `email?: Email`, `active: boolean`, `updatedAt: Date`
- remove the `GuardianRelationship` type + `VALID_RELATIONSHIPS` array.

`create()` validations (entity-level invariants ONLY — context-free):
- `relationship` trimmed, length 1..15 → else `ValidationError`. No enum check.
- `fullName`/`mobile`/`email` accepted as already-built VOs/strings; **NOT required here** (see Decision below).
- defaults: `active ?? true`, `isFinancialResponsible ?? false`, `isAuthorizedToPickUp ?? false`, `id = Id.create()`, `createdAt = updatedAt = new Date()`.

**ADR — `create()` returns `Result<StudentGuardian, ValidationError>` instead of throwing.** Today it throws. Project standard "never throw in domain". Mobile/Email VOs already return `Result`. Migrating `create()` to `Result` makes the entity consistent and lets the use case compose VO results cleanly. Cost: update the single existing call site (`AssignGuardianUseCase`) to unwrap. Rejected alternative: keep throwing — cheaper but perpetuates the inconsistency the standards forbid.

New getters: `fullName?`, `mobile?: Mobile`, `email?: Email`, `active`, `updatedAt`; `userId` getter returns `string | undefined`. Add mutation methods for the mutable surface (e.g. `update({...})` that bumps `updatedAt`, and `deactivate()`/`activate()`), keeping behavior in the entity.

Stop exporting `GuardianRelationship` from `personnel/entities/index.ts`, `personnel/index.ts`, and root `index.ts`.

**ADR — fullName/mobile required is enforced in the APPLICATION layer, not the entity.** The one entity serves portal guardians (have `userId`; their name/phone live in master `User`) AND account-less study tutors (no `userId`; need `fullName`+`mobile`). The entity cannot know which flow it is in without a discriminator — and the discriminator was rejected. So required-ness is contextual → it belongs to `CreateStudyTutorUseCase`. The entity only guarantees format/length invariants. Rejected: enforce in entity — would force portal rows to carry redundant fullName/mobile or reintroduce a type flag.

### 3.3 `Student` entity (`packages/domain/src/personnel/entities/student.ts`)
Add `fatherEmail?: Email`, `motherEmail?: Email` to `StudentProps` + two getters. NOT added to `ALLOWED_TUTOR_FIELDS` (admin-only).

### 3.4 Repo port (`packages/domain/src/personnel/repositories/student-guardian-repository.ts`)
- Keep `findByComposite(studentId: string, userId: string)` — used ONLY for the portal-link duplicate check (userId always present there); signature stays `string`.
- **Add** `findStudyTutor(studentId: string, fullName: string): Promise<StudentGuardian | null>` — the uniqueness strategy for account-less tutors (`@@unique([studentId,userId])` is inert when `userId` is null). This is the new method the application layer uses for the `(studentId, fullName)` uniqueness check.

---

## 4. Application layer (`api/src/application/student/use-cases/student.use-cases.ts`)

### 4.1 `AssignGuardianUseCase` — stays intact for portal links
Unchanged contract: requires `userId`, duplicate-checks via `findByComposite(studentId, userId)`. Only adjust the `StudentGuardian.create(...)` call to unwrap the new `Result` and drop the `GuardianRelationship` cast. This remains the portal-link path.

### 4.2 `CreateStudyTutorUseCase` (NEW class, `execute()`)
Input: `{ fullName: string; mobile: string; relationship: string; email?: string; isFinancialResponsible?: boolean; isAuthorizedToPickUp?: boolean }` (no `userId`).
Flow, all `Result`-based, no throws:
1. Student exists → else `NotFoundError`.
2. `fullName` and `mobile` required → `ValidationError` if missing/blank (THIS is where required-ness lives).
3. Build `Mobile.create(mobile)`, `Email.create(email)` if provided → propagate VO errors.
4. Uniqueness: `findStudyTutor(studentId, fullName)` → if found, `ValidationError('A study tutor with that name already exists for this student')`.
5. `StudentGuardian.create({ studentId, relationship, fullName, mobile, email, isFinancialResponsible: false default, isAuthorizedToPickUp: false default })` (userId omitted) → save.

### 4.3 `UpdateStudyTutorUseCase` (NEW class, `execute()`)
Input: `guardianId` + partial `{ fullName?, mobile?, email?, relationship?, active?, isFinancialResponsible?, isAuthorizedToPickUp? }`.
Flow: load by id (`NotFoundError`), if `fullName` changes re-check `findStudyTutor` uniqueness, rebuild VOs for provided fields, apply via entity mutation (bumps `updatedAt`), save. Works for portal rows too (they can patch relationship/flags/active), but does not let a portal row drop its `userId`.

### 4.4 `GuardianOutput` (list DTO) — extend
`userId: string` → `userId?: string`; add `fullName?`, `mobile?`, `email?`, `active`. `ListGuardiansUseCase.execute()` maps the new getters (`g.mobile?.get()`, `g.email?.get()`).

### 4.5 Email pre-fill — UI layer, NOT app
**Decided**: the app accepts whatever `email` the request carries (or none). The legajo→tutor email default (`Student.fatherEmail`/`motherEmail` pre-filled when relationship is father/mother) is a **UI convenience** (Part 3), editable before submit. Keeps the application pure and avoids coupling study-tutor creation to legajo identity (the two emails may legitimately diverge). Rejected: app auto-derive — couples concerns and hides that the values can differ.

### 4.6 Read-path filters — NO change (verified against code)
- `GetMyChildrenUseCase` → `guardianRepo.findByGuardianUserId(userId)` → Prisma `where: { userId: guardianUserId }`. Null-userId tutor rows never match a concrete userId. SAFE.
- `ListStudentsUseCase` TUTOR branch → `studentRepo.findByGuardianUserId` → `where: { guardians: { some: { userId } } }`. Null rows excluded. SAFE.
- `PatchStudentUseCase.checkOwnership` (TUTOR) → same `findByGuardianUserId`. SAFE.
No filter changes needed; account-less tutors are invisible to portal queries by construction.

---

## 5. Presentation layer

### 5.1 DTOs (`api/src/presentation/student/dto/assign-guardian.dto.ts`)
`AssignGuardianSchema`:
- `userId`: `z.string().uuid().optional()`
- `relationship`: `z.enum([...])` → `z.string().min(1).max(15)`
- add `fullName: z.string().min(1).optional()`, `mobile: z.string().min(1).optional()`, `email: z.string().email().optional()`, `isFinancialResponsible`/`isAuthorizedToPickUp` optional default false.
New `UpdateGuardianSchema` (all optional, same field set + `active: z.boolean().optional()`).
Student email DTOs: add `fatherEmail`/`motherEmail` (`z.string().email().optional().or(z.literal(''))`) to `CreateStudentSchema` (register.request.ts) and `UpdateStudentSchema`.

### 5.2 Controller (`student.controller.ts`) — endpoint list (unified, minimal new surface)
| Method | Route | Use case |
|---|---|---|
| GET | `/students/:id/guardians` | `ListGuardiansUseCase` (extended output) |
| POST | `/students/:id/guardians` | **dispatch**: `body.userId` present → `AssignGuardianUseCase`; absent → `CreateStudyTutorUseCase` |
| PATCH | `/students/:id/guardians/:guardianId` | `UpdateStudyTutorUseCase` (NEW endpoint) |
| DELETE | `/students/:id/guardians/:guardianId` | `RemoveGuardianUseCase` (unchanged) |

The POST dispatch keeps REST surface small (no `/study-tutors` routes); the controller branches on `userId` presence. `mapStudent()` gains `fatherEmail`/`motherEmail`. Register both new use cases in `student.module.ts`.

---

## 6. Web layer — Part 3 (`web/src/pages/dashboard/students.tsx`)

Framework-consistent with existing React 19 + Vite + `apiClient` + `useApiList` code. No new libs.

- **Student form**: add `fatherEmail`/`motherEmail` inputs near father/mother DNI; thread through `form` state, `startEdit`, `resetForm`, and the create/patch body.
- **Guardian panel** (`guardianAssignForm`): change `userId` to optional; add `fullName`, `mobile`, `email`, `active` inputs and keep `relationship` — but `relationship` becomes a **free-text input** (`maxLength={15}`) instead of the fixed `<select>`. Two modes in one form: leaving `userId` empty creates a study tutor (POST without userId); filling it links a portal account (POST with userId).
- **Email pre-fill default**: when `relationship` is `father`/`madre`-ish (or via an explicit "padre"/"madre" choice), pre-fill `email` from the loaded student's `fatherEmail`/`motherEmail` as an editable default; user can override. Pure client behavior.
- **List/display**: `GuardianOutput.userId` optional → render "Con cuenta de portal" vs "Sin cuenta" badge from `userId` presence; show `fullName`/`mobile`/`email`/`active`. Relationship cell: keep the legacy label map (`mother→Madre`, …) as a fallback, else render the raw free-text string.
- States: keep existing empty/loading/error handling; add async button state for the new PATCH (edit tutor).

---

## 7. Migration & multitenancy
Tenant-only change; `api/prisma_master/schema.prisma` untouched. `pnpm --filter api prisma:generate` regenerates BOTH master and tenant clients — the master client is unaffected but is regenerated by the same command, so run it once after the schema edit. Cross-DB `userId` (references master `User.id` without FK) pattern continues and now tolerates NULL. Enum-drop cascade order: retype `relationship` to `varchar` first, then `DROP TYPE` (Section 2).

---

## 8. PR slicing hint (feeds tasks; change is large → chained PRs)
1. **PR1 — Student emails + Mobile VO foundation** (~250–350 LOC): Student schema emails; `Mobile` VO + unit tests; Student entity email getters; Student create/update DTOs, use-case `applyChanges`, repo map, controller `mapStudent`; web two email inputs. Self-contained, no StudentGuardian churn.
2. **PR2 — StudentGuardian backend extension** (~400–550 LOC, biggest): schema (userId nullable, new fields, enum→VarChar(15)+drop); entity refactor + `Result`; repo `save/toDomain/findStudyTutor`; `CreateStudyTutorUseCase`/`UpdateStudyTutorUseCase`; `AssignGuardianUseCase` tweak; DTOs; controller POST dispatch + PATCH; module wiring; all backend tests. **Likely breaches the 400-line budget — flag for tasks to consider sub-splitting** (PR2a domain entity+VO+port+repo; PR2b app+presentation+tests).
3. **PR3 — Web tutor panel** (~200–300 LOC): guardian form (free-text relationship, optional userId, fullName/mobile/email/active), email pre-fill wiring, null-userId + free-text display.

Rough total ~900–1200 LOC → chained/stacked PRs required (cannot be one ≤400 PR).

---

## 9. Test strategy (strict TDD — test first, `pnpm test`, coverage ≥80%)
**Unit (zero infrastructure, mocked ports):**
- `packages/domain/src/shared/__tests__/value-objects/mobile.test.ts` (NEW) — valid/invalid formats, normalization, 8–15 digit bounds, leading `+`, empty.
- `packages/domain/src/personnel/__tests__/student-guardian.test.ts` (UPDATE) — drop enum tests; add relationship ≤15ch, optional userId, new fields, `create()` returns `Result`, fullName/mobile optional at entity level, mutation/`updatedAt`.
- Student entity email getters (extend existing student entity test).
- `api/test/unit/assign-guardian.use-case.test.ts` (UPDATE) — unwrap `Result`, no enum cast; plus NEW `create-study-tutor.use-case.test.ts` / `update-study-tutor.use-case.test.ts` — required fullName/mobile, `(studentId,fullName)` uniqueness via mocked `findStudyTutor`, default-false flags, VO error propagation.

**Integration (NestJS `TestingModule` + test DB):**
- `api/test/integration/guardians.test.ts` (UPDATE) — add study-tutor create/list/update/delete; null userId; free-text relationship; uniqueness by (studentId, fullName); portal-link path still works via POST-with-userId dispatch.
- Student email persistence round-trip (extend student integration test).

---

## Open risks
- **Enum-drop SQL ordering**: if Prisma emits `DROP TYPE` before the column retype, the migration fails — verify generated SQL (Section 2).
- **PR2 size**: exceeds the 400-line budget; tasks phase must decide sub-split vs `size:exception`.
- **POST dispatch ambiguity**: a request that sends BOTH `userId` and `fullName` must have defined precedence — decided: `userId` present → portal path wins; document in DTO/controller.
- **Free-text relationship**: loses enum guarantees; mitigated by ≤15ch cap + UI label fallback. Acceptable per closed scope.
- **`AssignGuardianUseCase` Result migration**: touches the existing call site + its test; low risk but must land in the same PR as the entity change (PR2).
