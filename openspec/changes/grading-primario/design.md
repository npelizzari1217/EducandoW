# Technical Design — grading-primario (Fase 4, Etapa 1)

> Status: DESIGNED · Store: hybrid (engram + openspec) · Scope: PRIMARIO vertical only
> Reads: proposal.md, engram `sdd/grading-primario/explore`. Supersedes the proposal where this document and the resolved constraints conflict (notably PA/PPI/PP granularity).

This is the architectural HOW. It settles every open question from the proposal, grounds the schema/domain/API/web shape in the real codebase, and refines the chained-PR DAG. No task breakdown, no code.

---

## 0. Grounding facts that drive the design

These were verified against the live source (not assumed):

- **`CourseCycle` is keyed by `uuid`** for relations. `CompetencyValuation.courseCycleId` → `CourseCycle.uuid` (`onDelete: Restrict`). Every new grade table MUST reference `courseCycleId → CourseCycle.uuid`, not the autoincrement `id`. (`api/prisma_tenant/schema.prisma:148-182, 316-338`)
- **`CompetencyPeriodValuation` is the canonical grade-row shape to mirror**: `gradeScaleValueId String?` + denormalized `gradeCode String?` + `internalStatus GradeInternalStatus?`, plus `modificable`/`imprimible`. Its entity lazy-creates ungraded child rows and keeps the lock invariant inside the entity (`assignGrade` returns `err(PeriodLockedError)`). We reuse this exact pattern. (`packages/domain/src/pedagogy/entities/competency-period-valuation.ts`)
- **`GradeInternalStatus` enum already exists** (`APROBADO|NO_APROBADO|EN_PROCESO|LIBRE`). New grade tables reuse it — no new status enum.
- **Period structure lives in `GradingPeriodTemplate(level,modality) → GradingPeriodTemplateItem(name, sortOrder)`**; `CompetencyPeriodValuation.periodItemId` is a **live FK** to it. We do NOT add a live FK on subject grades — we snapshot (see §3).
- **`Student.userId String?` already exists; `Teacher` has NO `userId`.** Cross-DB identity is modeled as a plain nullable string (no FK), exactly how `Student.userId` does it. We follow the same convention for `Teacher.userId`.
- **Boletín dispatch already computes `Math.floor(level/10)*10`** in `resolveLevelName` and `buildMaterias` currently reads `NotaTrimestral` unconditionally. The Primario branch slots in next to the existing level-name switch. (`api/src/application/reportes/generate-boletin.use-case.ts:157-260`)
- **`MateriaBoletin`** today is `{ nombre, docente, notas[], promedio, valoracion, aprobado }` — extended with OPTIONAL fields so the legacy path leaves them `undefined`. (`api/src/application/reportes/templates/boletin.template.ts:48-55`)
- **Web grid stack is reusable**: `CourseCycleSubjectSelector` (3-level dropdown, NO teacher filter), `CompetencyGradingGrid`, `use-grading-grid` hook (parallel fetch + dense Map + bounded-parallel save). The selector is what we replace; the grid/hook we extend.
- **Domain barrel `packages/domain/src/index.ts` MUST re-export every new type** — Primario block is at lines 74-79, pedagogy block at 52-65.

---

## 1. Architecture decisions (ADR-style)

### AD-1 — New grade entities are level-agnostic, in the `pedagogy` module

**Decision.** Add `SubjectPeriodGrade` and `SubjectFinalGrade` (English, level-agnostic) under `packages/domain/src/pedagogy/`, alongside `CompetencyValuation`. NOT in `packages/domain/src/primario/` and NOT Spanish-named.

**Rationale.** Secundario (Etapa 2) uses the identical model (period grades + Final/Diciembre/Marzo/Definitiva). Placing them in `pedagogy` lets Etapa 2 ship with zero new grade tables. `primario/` holds the legacy `Grado`/`CalificacionPrimario` we are explicitly leaving behind.

**Rejected.** `MateriaPrimarioNota` in `primario/` — would force Secundario to duplicate the table; entrenches the legacy package.

### AD-2 — The four finals are rows keyed by a Prisma enum, on one table

**Decision.** `SubjectFinalGrade`, one row per `(studentId, courseCycleId, subjectId, type)` where `type` is a Prisma enum `SubjectFinalGradeType { FINAL, DICIEMBRE, MARZO, DEFINITIVA }`. Same grade columns as `CompetencyPeriodValuation` plus `passed Boolean?`.

**Rationale.** Matches the conditional lifecycle (Diciembre/Marzo only materialize when the prior instance did not pass) without four nullable column-sets and without four tables. Flat schema, one repository, one DTO shape, trivially extensible if a fifth instance ever appears.

**Rejected.** Four columns on a single row (can't express per-instance status/lock cleanly, ugly nullability). Four tables (4× repos/use-cases for one concept).

### AD-3 — PA/PPI/PP = three booleans ON `SubjectPeriodGrade` (per student×subject×courseCycle×PERIOD)

**Decision (supersedes the proposal's student×courseCycle×subject).** Store `pa`, `ppi`, `pp` as three `Boolean @default(false)` columns directly on `SubjectPeriodGrade`. No separate flag table.

**Rationale.** The resolved constraint is **per-period** granularity (a flag can change per period and differ per subject). `SubjectPeriodGrade`'s composite key is *exactly* `(student, courseCycle, subject, periodOrdinal)` — the precise granularity required. A separate table would carry the identical composite key: pure duplication plus an extra join on every read. Because rows are lazy-scaffolded per period at screen load (AD-7), the flag row exists even before any grade is entered, satisfying the proposal's "a flag can exist before any grade is loaded" requirement. Flags are inherently a period concept, so they do NOT live on `SubjectFinalGrade`.

**Rejected.** Separate `EnrollmentPedagogicalFlag` / per-cycle booleans on `Enrollment` — loses per-period and per-subject specificity (the actual workflow). A parallel per-period flag table — same key as `SubjectPeriodGrade`, no benefit.

**Boletín aggregation note (CONFIRM).** Because flags are per period but the boletín renders them per subject row, the Primario boletín shows a flag as active using **logical OR across the reported periods** (active if set in any period within the boletín's period scope). Alternative: render per-period flag chips. Recommend OR-aggregation for the report card; flag for user confirmation.

### AD-4 — Period structure is snapshotted into a dedicated `SubjectGradingPeriod` table at Materia×Curso×Ciclo grain

**Decision.** Add `SubjectGradingPeriod`, one row per `(courseCycleId, subjectId, periodOrdinal)` carrying `periodName String`. It is an immutable **copy** taken from `GradingPeriodTemplate(level,modality).items` (`periodOrdinal = item.sortOrder`, `periodName = item.name`). `SubjectPeriodGrade` references the structure by `periodOrdinal` (matching key), **no live FK** to `GradingPeriodTemplateItem`.

**Rationale.** A dedicated snapshot parent freezes the period list **once per (courseCycle, subject)**, so two students scaffolded at different times cannot diverge if the template is edited mid-cycle — a real drift bug if the snapshot were distributed only across grade rows. It honors the resolved Materia×Curso×Ciclo anchor and keeps the door open for subjects with divergent period configs. Fase 3 `CompetencyPeriodValuation` stays on its live `periodItemId` FK **as accepted debt** — subject-grade correctness does not depend on it.

**Rejected.** Denormalizing `periodOrdinal+periodName` only onto each `SubjectPeriodGrade` row (no parent) — structure unknown until a grade exists, and risks mid-cycle drift between students. Normalized one-snapshot-per-`CourseCycle` (ignoring subject) — contradicts the resolved Materia×Curso×Ciclo decision; cheap to collapse later if uniformity is ever enforced.

**CONFIRM.** Anchor at `(courseCycle, subject)` (recommended, honors the resolved decision) vs normalized `(courseCycle)` only.

### AD-5 — Snapshot is materialized LAZILY on first grade-screen read (ensure-on-read)

**Decision.** The `GetSubjectGrades…` use cases call an idempotent `ensureSnapshot(courseCycleId, subjectId)`: if no `SubjectGradingPeriod` rows exist for the pair, copy them from `GradingPeriodTemplate(level, modality)` ordered by `sortOrder`; otherwise no-op. The snapshot moment is the **first time a teacher opens the grid** for that subject×course×cycle.

**Rationale.** Mirrors the existing lazy-scaffold pattern of `CompetencyPeriodValuation`. No dependency on creation-time ordering (CourseCycle creation does not know its subjects; study-plan subjects can change). Structure freezes at the first real grading interaction and is idempotent thereafter.

**Rejected.** Eager snapshot on `CourseCycle` creation (doesn't know subjects yet) or on study-plan-subject add (subjects mutate; would need re-sync logic). Lazy keeps it simple and correct.

### AD-6 — Teacher identity: `Teacher.userId` (no FK) + two query paths

**Decision.**
- Add `Teacher.userId String?` (nullable, plain string to master-DB `User.id`, same convention as `Student.userId`) + `@@index([userId])`. Repo `findByUserId(userId): Promise<Teacher | null>`.
- Add `CourseCycle.homeroomTeacherId String?` FK → `Teacher.id` (`onDelete: SetNull`) + `@@index`. This is the modern "por curso" link.

**Resolution flow.** JWT → `userId` (master) → controller `@CurrentUser()` → use case → `teacherRepo.findByUserId(userId)` → `teacher.id` (tenant). If `null` (teacher not linked / no record) → return **empty result, HTTP 200**, never an error; screens render an empty state.

**Teacher-filtered query paths.**
- **"Alumnos por materia"**: `SubjectAssignment` where `teacherId = teacher.id` → `courseSectionId` set → `CourseCycle` where `courseId IN (…)` AND `Math.floor(level/10)===2` (Primario). Subjects in a CC = that teacher's `SubjectAssignment.subjectId` within the CC's course section.
- **"Alumnos por curso"**: `CourseCycle` where `homeroomTeacherId = teacher.id` AND Primario. The teacher sees the whole course; subjects come from the CC's study plan.

**Rejected.** Deriving "por curso" via legacy `Grado.teacherId → courseSectionId → CourseCycle` — keeps a deprecated parallel model load-bearing. One nullable field on the modern entity is cleaner and cheap to flip. (Already resolved in constraints.)

### AD-7 — Lazy scaffold of grade rows, lock invariant in the entity

**Decision.** On grid read, the use case ensures one `SubjectPeriodGrade` per `(student × snapshotted period)` and (for finals) creates `FINAL` eagerly while `DICIEMBRE/MARZO/DEFINITIVA` are created **on demand** per the conditional lifecycle. The assign/clear grade behavior and any future lock check live in the entity (`assignGrade` returns a `Result`), mirroring `CompetencyPeriodValuation`.

**Rationale.** Consistent with the Fase 3 pattern the web grid already expects (dense Map of all cells, including ungraded). Conditional finals avoid scaffolding rows that may never be needed.

### AD-8 — Boletín level dispatch; legacy path untouched; legacy models deprecated not deleted

**Decision.** In `generate-boletin.use-case.ts`, split `buildMaterias` on `Math.floor(level/10)===2`:
- **Primario branch** → new `buildMateriasPrimario()` reading `SubjectGradingPeriod` + `SubjectPeriodGrade` + `SubjectFinalGrade` + `imprimible` `CompetencyPeriodValuation` + PA/PPI/PP.
- **All other levels** → existing `NotaTrimestral` code path, **byte-for-byte unchanged**.

`MateriaBoletin` gains OPTIONAL fields (`periodGrades?`, `finalGrades?`, `competencies?`, `flags?`) so the legacy path leaves them `undefined`. Rebuild `boletin-primario.hbs` with dynamic period columns + finals + competency section + flags; other templates untouched. A regression test asserts non-Primario still reads `NotaTrimestral`.

`CalificacionPrimario` / `NotaTrimestral` are marked `@deprecated`, NOT deleted — Secundario/Terciario boletines still read them. Retire only once every level migrates.

---

## 2. Prisma schema deltas (`api/prisma_tenant/schema.prisma`)

```prisma
enum SubjectFinalGradeType {
  FINAL
  DICIEMBRE
  MARZO
  DEFINITIVA
}

// Snapshot of the period structure for one Materia×Curso×Ciclo. Immutable copy.
model SubjectGradingPeriod {
  id            String  @id @default(uuid())
  courseCycleId String  @map("course_cycle_id")   // → CourseCycle.uuid
  subjectId     String  @map("subject_id")
  periodOrdinal Int     @map("period_ordinal")     // = GradingPeriodTemplateItem.sortOrder at snapshot time
  periodName    String  @map("period_name")        // = GradingPeriodTemplateItem.name at snapshot time

  courseCycle CourseCycle @relation(fields: [courseCycleId], references: [uuid], onDelete: Restrict)
  subject     Subject     @relation(fields: [subjectId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@unique([courseCycleId, subjectId, periodOrdinal])
  @@index([courseCycleId, subjectId])
  @@map("subject_grading_periods")
}

// Alphanumeric subject-level period grade + per-period pedagogical flags.
model SubjectPeriodGrade {
  id                String               @id @default(uuid())
  studentId         String               @map("student_id")
  courseCycleId     String               @map("course_cycle_id")   // → CourseCycle.uuid
  subjectId         String               @map("subject_id")
  periodOrdinal     Int                  @map("period_ordinal")     // matches SubjectGradingPeriod.periodOrdinal
  gradeScaleValueId String?              @map("grade_scale_value_id")
  gradeCode         String?              @map("grade_code")          // snapshot of the code
  internalStatus    GradeInternalStatus? @map("internal_status")
  // Per-period pedagogical flags (AD-3)
  pa                Boolean              @default(false)
  ppi               Boolean              @default(false)
  pp                Boolean              @default(false)

  student    Student          @relation(fields: [studentId], references: [id], onDelete: Cascade)
  courseCycle CourseCycle     @relation(fields: [courseCycleId], references: [uuid], onDelete: Restrict)
  subject    Subject          @relation(fields: [subjectId], references: [id], onDelete: Cascade)
  gradeValue GradeScaleValue? @relation(fields: [gradeScaleValueId], references: [id], onDelete: SetNull)

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@unique([studentId, courseCycleId, subjectId, periodOrdinal])
  @@index([courseCycleId, subjectId])
  @@index([studentId])
  @@map("subject_period_grades")
}

// The four final instances as type-enum rows. Conditional lifecycle (AD-2/AD-7).
model SubjectFinalGrade {
  id                String                @id @default(uuid())
  studentId         String                @map("student_id")
  courseCycleId     String                @map("course_cycle_id")   // → CourseCycle.uuid
  subjectId         String                @map("subject_id")
  type              SubjectFinalGradeType
  gradeScaleValueId String?               @map("grade_scale_value_id")
  gradeCode         String?               @map("grade_code")
  internalStatus    GradeInternalStatus?  @map("internal_status")
  passed            Boolean?

  student    Student          @relation(fields: [studentId], references: [id], onDelete: Cascade)
  courseCycle CourseCycle     @relation(fields: [courseCycleId], references: [uuid], onDelete: Restrict)
  subject    Subject          @relation(fields: [subjectId], references: [id], onDelete: Cascade)
  gradeValue GradeScaleValue? @relation(fields: [gradeScaleValueId], references: [id], onDelete: SetNull)

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@unique([studentId, courseCycleId, subjectId, type])
  @@index([courseCycleId, subjectId])
  @@index([studentId])
  @@map("subject_final_grades")
}
```

**Field deltas on existing models:**
- `Teacher`: add `userId String?` + `@@index([userId])` + back-relation `courseCyclesHomeroom CourseCycle[]`.
- `CourseCycle`: add `homeroomTeacherId String? @map("homeroom_teacher_id")`, relation `homeroomTeacher Teacher? @relation(fields: [homeroomTeacherId], references: [id], onDelete: SetNull)`, `@@index([homeroomTeacherId])`, plus back-relations `subjectPeriodGrades`, `subjectFinalGrades`, `subjectGradingPeriods`.
- `Student`, `Subject`, `GradeScaleValue`: add the back-relation arrays for the three new tables (Prisma requires both sides).

**Migration outline** (one migration per PR that touches schema, named `grading_primario_*`):
1. `add_subject_grading_period_and_period_grade` (PR1): create enum-free tables `subject_grading_periods`, `subject_period_grades` + indexes + back-relations.
2. `add_subject_final_grade` (PR2): create enum `SubjectFinalGradeType` + table `subject_final_grades`.
3. `add_teacher_user_and_homeroom` (PR3): `ALTER TABLE teachers ADD COLUMN user_id`, `ALTER TABLE course_cycles ADD COLUMN homeroom_teacher_id` + FKs/indexes. All nullable → no backfill required; existing rows valid.

---

## 3. Domain entities / VOs to add

All in `packages/domain/src/pedagogy/`, re-exported from the module barrel and the root `index.ts`.

| Artifact | File | Validation / behavior it enforces |
|---|---|---|
| `SubjectGradingPeriod` (entity) | `entities/subject-grading-period.ts` | `periodOrdinal ≥ 1`; `periodName` non-empty/trimmed. `static snapshotFromTemplateItem({sortOrder, name})`. Immutable after create. |
| `SubjectPeriodGrade` (entity) | `entities/subject-period-grade.ts` | Mirrors `CompetencyPeriodValuation`: `create()` lazy ungraded (all grade fields null, flags false). `assignGrade({gradeScaleValueId, gradeCode, internalStatus})` — `gradeCode` required non-empty when value set; `internalStatus` ∈ `GradeInternalStatus`. `clearGrade()`. `setFlags({pa, ppi, pp})`. Returns `Result` for guardable ops. |
| `SubjectFinalGrade` (entity) | `entities/subject-final-grade.ts` | Bound to a `SubjectFinalGradeType`. `assignGrade(...)` + `setPassed(boolean)`. Conditional-creation rule (Dic/Marzo only when prior not passed) is enforced in the **use case**, not the entity (cross-row policy). |
| `SubjectFinalGradeType` (VO) | `value-objects/subject-final-grade-type.ts` | Enum guard `{FINAL, DICIEMBRE, MARZO, DEFINITIVA}`; `fromString` → `ValidationError` on miss. |
| `PedagogicalFlags` (VO, optional) | `value-objects/pedagogical-flags.ts` | `{pa, ppi, pp}` value object with `none()`, `with(...)`. Keeps flag semantics in one place; entity holds it or three booleans — implementer's call, VO recommended. |
| Repo interfaces | `repositories/subject-period-grade-repository.ts`, `subject-final-grade-repository.ts`, `subject-grading-period-repository.ts` | `findByCourseCycleAndSubject`, `findByStudentAndCourseCycle`, `ensureSnapshot`, `saveMany` (batch upsert). |
| `Teacher` (modify) | `personnel/entities/teacher.ts` | Add `userId?: string` prop + getter + `linkUser(userId)`. |
| `TeacherRepository` (modify) | `personnel/repositories/teacher-repository.ts` | Add `findByUserId(userId): Promise<Teacher | null>`. |
| `CourseCycle` (modify) | `course-cycle/...` | Add `homeroomTeacherId?: string` + getter + `assignHomeroomTeacher(teacherId)`. |
| `CourseCycleRepository` (modify) | `course-cycle/repositories/...` | Add `findByHomeroomTeacher(teacherId)` and `findByCourseSectionIds(ids[])` (or reuse existing filters). |

Root barrel (`packages/domain/src/index.ts`) MUST re-export: `SubjectGradingPeriod`, `SubjectPeriodGrade`, `SubjectFinalGrade`, `SubjectFinalGradeType`, `PedagogicalFlags`, their `Props`/`Input` types, and the three repository interfaces.

---

## 4. API surface (NestJS — application + presentation)

### Use cases (`api/src/application/grading/` — `@Injectable()`, return `{ data }` shape via controllers)

| Use case | Responsibility |
|---|---|
| `EnsureSubjectGradingSnapshot` (internal, called by reads) | Idempotent: copy `GradingPeriodTemplate(level,modality).items` → `SubjectGradingPeriod` rows for `(courseCycle, subject)` if absent (AD-5). |
| `GetSubjectGradesBySubject` | Input `(courseCycleId, subjectId)`. Ensures snapshot, lazy-scaffolds `SubjectPeriodGrade` per `(student × period)`, returns students × {period grades, 4 finals, imprimible competencies, flags}. Feeds "por materia". |
| `GetSubjectGradesByStudent` | Input `(courseCycleId, studentId)`. Returns subjects × {period grades, 4 finals, competencies, flags} for one student. Feeds "por curso". |
| `UpsertSubjectPeriodGrades` | Batch assign/clear period grades **and** PA/PPI/PP flags. Validation → 400. |
| `UpsertSubjectFinalGrades` | Batch assign finals + `passed`; enforces conditional lifecycle (Dic/Marzo only when prior not passed; Definitiva = final verdict). |
| `ListTeacherCourseCycles` | Input `(teacherUserId, mode: 'subject'|'homeroom')`. Resolves Teacher via `findByUserId`; returns Primario CCs by assignment or by homeroom. Empty (200) if unlinked. |
| `ListTeacherSubjectsInCourseCycle` | Input `(teacherUserId, courseCycleId)`. The teacher's subjects in that CC. |

### Controller endpoints

Subject grades (new controller `api/src/presentation/grading/subject-grades.controller.ts`):
- `GET /grading/subject-grades?courseCycleId=&subjectId=` → por-materia grid payload
- `GET /grading/subject-grades/by-student?courseCycleId=&studentId=` → por-curso grid payload
- `PUT /grading/subject-grades` → batch upsert period grades + flags
- `PUT /grading/subject-final-grades` → batch upsert finals

Teacher-filtered (extend existing `course-cycles` controller):
- `GET /course-cycles?teacherUserId=&role=homeroom|subject` → filtered CC list (existing endpoint gains optional params; default behavior unchanged)
- `GET /course-cycles/:id/subjects?teacherUserId=` → teacher's subjects in the CC

All controllers: `@CurrentUser()` supplies `userId`; `validation → 400`, `not-found → 404`, responses `{ data }`, every tenant query carries the institution/tenant context per existing convention.

### DTOs (`api/src/presentation/grading/dto/`)
- `UpsertSubjectPeriodGradeDto` (`studentId, periodOrdinal, gradeScaleValueId?, gradeCode?, internalStatus?, pa?, ppi?, pp?`) + batch wrapper.
- `UpsertSubjectFinalGradeDto` (`studentId, type, gradeScaleValueId?, gradeCode?, internalStatus?, passed?`) + batch wrapper.
- `SubjectGradesResponseDto` (snapshot periods + grades + finals + competencies + flags).

---

## 5. Web component plan (`web/src/`)

**Reused as-is / extended:**
- `use-grading-grid.ts` → generalize into a shared grid hook (parallel fetch, dense `Map`, bounded-parallel save). Add subject-grade + finals + flags fetch/save channels. REUSE the dense-Map + bounded-save mechanics.
- `CompetencyGradingGrid.tsx` → reuse the cell/dropdown rendering; compose into the new grids rather than duplicate.
- `GradeScaleValue` dropdown population (existing `/grading/scales` consumer).

**Replaced:**
- `CourseCycleSubjectSelector.tsx` (no teacher filter) → new `TeacherFilteredSelector.tsx` calling `GET /course-cycles?teacherUserId=` and `…/subjects?teacherUserId=`. The old 3-level public selector stays for non-grading screens; the grading screens switch to the teacher-filtered one.

**Two screens:**
- **Alumnos por materia** — `web/src/pages/dashboard/subject-grading-by-subject.tsx`. **Replaces the `/competency-grading` route.** Grid: students × {period grades + 4 finals + imprimible competencies}, plus a PA/PPI/PP column (per-period, tabbed by period).
- **Alumnos por curso** — `web/src/pages/dashboard/subject-grading-by-course.tsx`. **New route.** Student picker (from teacher's homeroom CC) → subjects × {period grades + 4 finals + competencies}, PA/PPI/PP per subject row.

---

## 6. File manifest

**`packages/domain/src/`**
- create `pedagogy/entities/subject-grading-period.ts`, `subject-period-grade.ts`, `subject-final-grade.ts`
- create `pedagogy/value-objects/subject-final-grade-type.ts`, `pedagogical-flags.ts`
- create `pedagogy/repositories/subject-grading-period-repository.ts`, `subject-period-grade-repository.ts`, `subject-final-grade-repository.ts`
- modify `personnel/entities/teacher.ts`, `personnel/repositories/teacher-repository.ts`
- modify `course-cycle/` entity + repository
- modify `pedagogy/index.ts` (module barrel) and `index.ts` (root barrel)

**`api/`**
- modify `prisma_tenant/schema.prisma` (+3 tables, +1 enum, +Teacher.userId, +CourseCycle.homeroomTeacherId)
- create 3 migrations under `prisma_tenant/migrations/`
- create `src/infrastructure/persistence/prisma/repositories/prisma-subject-grading-period.repository.ts`, `prisma-subject-period-grade.repository.ts`, `prisma-subject-final-grade.repository.ts`
- modify `prisma-teacher.repository.ts` (`findByUserId`), `prisma-course-cycle.repository.ts` (homeroom + section filters)
- create `src/application/grading/ensure-subject-grading-snapshot.use-case.ts`, `get-subject-grades-by-subject.use-case.ts`, `get-subject-grades-by-student.use-case.ts`, `upsert-subject-period-grades.use-case.ts`, `upsert-subject-final-grades.use-case.ts`, `list-teacher-course-cycles.use-case.ts`, `list-teacher-subjects-in-course-cycle.use-case.ts`
- create `src/presentation/grading/subject-grades.controller.ts` + `dto/*`
- modify `src/presentation/course-cycle/*.controller.ts` (teacher params)
- modify `src/application/reportes/generate-boletin.use-case.ts` (`buildMateriasPrimario`)
- modify `src/application/reportes/templates/boletin.template.ts` (optional `MateriaBoletin` fields)
- modify `src/infrastructure/reporting/html-templates/boletin-primario.hbs`

**`web/src/`**
- create `pages/dashboard/subject-grading-by-subject.tsx`, `subject-grading-by-course.tsx`
- create `pages/dashboard/components/TeacherFilteredSelector.tsx`
- modify `use-grading-grid.ts`, `CompetencyGradingGrid.tsx` (extend/compose), router (replace `/competency-grading`, add por-curso route)

---

## 7. PR DAG (refined, chained, strict-TDD)

All strict TDD (RED→GREEN), conventional commits scope `grading`/`pedagogy`, stacked-to-main, each < 300 lines. Folded the proposal's separate PA/PPI/PP PR into PR1 (flags are now columns on `SubjectPeriodGrade`).

| PR | Title | Files (scope) | Est. | Depends |
|----|-------|---------------|------|---------|
| **PR1** | Domain+schema: `SubjectGradingPeriod` (snapshot) + `SubjectPeriodGrade` (incl. pa/ppi/pp) | 2 entities, 2 VOs, 2 repo ifaces, 2 prisma repos, migration #1, barrels, unit tests | ~260 | — |
| **PR2** | Domain+schema: `SubjectFinalGrade` + `SubjectFinalGradeType` enum | 1 entity, 1 VO, repo iface+impl, migration #2, barrels, tests | ~160 | PR1 (shared schema file) |
| **PR3** | Domain+schema: `Teacher.userId` + `findByUserId` + `CourseCycle.homeroomTeacherId` | teacher+coursecycle entity/repo edits, migration #3, tests | ~120 | — |
| **PR4** | API: snapshot-ensure + subject-grade CRUD use cases + teacher-filtered endpoints | 7 use cases, controller+DTOs, course-cycles controller edits, tests | ~290 | PR1, PR2, PR3 |
| **PR5** | Web: "Alumnos por materia" (replaces `/competency-grading`) | `TeacherFilteredSelector`, extended grid/hook, by-subject page, tests | ~300 | PR4 |
| **PR6** | Web: "Alumnos por curso" (new route) | by-course page, student picker, reuses PR5 components, tests | ~250 | PR4, PR5 |
| **PR7** | API+template: boletín Primario branch | `buildMateriasPrimario`, `MateriaBoletin` optional fields, `boletin-primario.hbs`, non-Primario regression test | ~240 | PR1, PR2 |

**Dependency edges:**
```
PR1 ──┬─> PR2 ──┐
      │         ├─> PR4 ──> PR5 ──> PR6
PR3 ──┼─────────┘
      └─> PR7 <── PR2
PR1 ──────────> PR7
```
- `PR1, PR3` are independent foundation slices. `PR2` stacks on `PR1` (same schema file).
- `PR4` gates both web screens. `PR5` gates `PR6` (shared selector/grid components).
- `PR7` (boletín) needs only the data tables (`PR1`, `PR2`) — independent of the API/web track, can land in parallel with `PR4+`.

**Strict-TDD RED→GREEN notes per PR:**
- PR1/PR2/PR3: RED = entity invariants + repo contract specs (validation, lazy-create defaults, tenant scoping) before impl.
- PR4: RED = use-case specs (snapshot idempotency, lazy scaffold, conditional finals lifecycle, empty-state on unlinked teacher, tenant filtering) and controller 400/404 specs.
- PR5/PR6: RED = component/integration specs (teacher-filtered fetch, dense-cell save, per-period flag toggle).
- PR7: RED = `GenerateBoletin` Primario-path spec **plus** a regression spec asserting `Math.floor(level/10)!==2` still reads `NotaTrimestral`.

**Review-workload forecast:** ~1620 lines / 7 PRs, none > 300. PR4 (~290) and PR5 (~300) sit at the budget edge — flag for the apply phase; if strict-TDD inflates them past 300, split PR4 into reads+writes and PR5 into selector+grid.

---

## 8. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| **Boletín regression** to Secundario/Inicial/Terciario. | Level dispatch; only the Primario branch + `boletin-primario.hbs` change. Mandatory non-Primario regression test in PR7. |
| **Snapshot vs live-FK inconsistency** (subject grades snapshot; Fase 3 competencies live FK). | Accepted, documented debt. `SubjectGradingPeriod` freezes structure per (CC, subject); subject-grade correctness is independent of Fase 3's FK. |
| **Mid-cycle template edit drift** between students scaffolded at different times. | Dedicated `SubjectGradingPeriod` parent snapshots once (ensure-on-read no-ops after first); all students read the same frozen ordinals. |
| **`Teacher.userId` unpopulated** → empty screens. | Nullable field; use cases return empty 200, never error; screens render empty state. Backfill is a separate data task. |
| **Multi-tenant leakage** on new tables/queries. | Every repo method + use case carries tenant context per existing convention; strict-TDD specs assert tenant scoping. |
| **Conditional finals mis-modeled as eager rows.** | `FINAL` eager; `DICIEMBRE/MARZO/DEFINITIVA` on-demand keyed by type enum; lifecycle enforced in `UpsertSubjectFinalGrades` with tests. |
| **PR4/PR5 at the 300-line budget edge.** | Pre-authorized split: PR4 → reads/writes; PR5 → selector/grid. |
| **PA/PPI/PP per-period vs boletín per-subject rendering.** | OR-aggregation across periods for the report card (AD-3) — confirm with user. |

---

## 9. Decisions to confirm before tasks

1. **PA/PPI/PP placement** — three booleans on `SubjectPeriodGrade` (recommended, exact granularity) — and **boletín aggregation** = OR across periods (vs per-period chips).
2. **Snapshot anchor** — dedicated `SubjectGradingPeriod` at `(courseCycle, subject)` with lazy ensure-on-read (recommended) vs normalized one-per-`CourseCycle`.
3. (Resolved, restated for the record) `CourseCycle.homeroomTeacherId` for "por curso" and level-agnostic table names — both locked by the resolved constraints; no action unless the user reopens.
