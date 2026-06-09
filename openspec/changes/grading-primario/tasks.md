# Implementation Tasks — grading-primario (Fase 4, Etapa 1)

> Status: TASKS · Store: hybrid · Total: 69 tasks across 7 PRs
> Strict TDD: ACTIVE (RED→GREEN mandatory for every implementation task)
> Test runner: `pnpm test` per package — `packages/domain`, `api`, `web`
> Conventional commits: scope `grading` or `pedagogy`

## Corrections applied (supersede spec where they conflict)

1. **Entry screens show ALL competencies + imprimible toggle per row.** ES-R9 is wrong — it must NOT filter competencies by `imprimible=true` on the entry screen. Tasks PR4-T3/T5 and PR5-T5/T6 implement: fetch ALL competencies + expose `imprimible` boolean per row so the teacher can toggle it. The boletín (BP-R5, PR7) is the only place that filters `imprimible=true`.
2. **PA/PPI/PP = 3 booleans on `SubjectPeriodGrade` — no separate table, no separate PATCH endpoint.** PPF spec text that implies a separate flag table or a `PATCH /pedagogical-flags` endpoint is wrong. Per AD-3, flags live as `pa/ppi/pp Boolean @default(false)` on `SubjectPeriodGrade`. They are set via `UpsertSubjectPeriodGrades` — one write path for both grades and flags.
3. **Design wins** on all other spec/design conflicts.

---

## PR1 — Domain + schema: SubjectGradingPeriod (snapshot) + SubjectPeriodGrade (incl. pa/ppi/pp)

**Depends on:** none
**Estimate:** ~260 lines
**Packages:** `packages/domain`, `api`

| ID | Action | Files | Spec refs |
|---|---|---|---|
| PR1-T1 | [x] [RED] Write failing unit tests for `SubjectGradingPeriod` entity: `snapshotFromTemplateItem({sortOrder,name})` produces valid entity; `periodOrdinal < 1` → ValidationError; empty/whitespace `periodName` → ValidationError; entity is immutable after creation | `packages/domain/src/pedagogy/entities/subject-grading-period.spec.ts` | SPG-R2, AD-4 |
| PR1-T2 | [x] [GREEN] Implement `SubjectGradingPeriod` entity (`static snapshotFromTemplateItem`, `periodOrdinal ≥ 1` guard, trimmed non-empty `periodName`, immutable) | `packages/domain/src/pedagogy/entities/subject-grading-period.ts` | SPG-R2, AD-4 |
| PR1-T3 | [x] [RED] Write failing unit tests for `SubjectPeriodGrade` entity: `create()` yields ungraded row (grade fields null, flags all false); `assignGrade({gradeScaleValueId,gradeCode,internalStatus})` with empty `gradeCode` → err Result; `clearGrade()` nulls grade fields; `setFlags({pa,ppi,pp})` updates each flag independently | `packages/domain/src/pedagogy/entities/subject-period-grade.spec.ts` | SPG-R1, SPG-R3, SPG-R4, PPF-R1, PPF-R4, AD-3 |
| PR1-T4 | [x] [GREEN] Implement `SubjectPeriodGrade` entity (mirrors `CompetencyPeriodValuation` pattern; `assignGrade`, `clearGrade`, `setFlags` return `Result`; `pa/ppi/pp` default `false`) | `packages/domain/src/pedagogy/entities/subject-period-grade.ts` | SPG-R1, SPG-R3, SPG-R4, PPF-R1, AD-3 |
| PR1-T5 | [x] [RED] Write failing unit tests for `PedagogicalFlags` VO: `none()` → all false; `with({pa:true})` → pa true, ppi/pp false; each field toggleable independently | `packages/domain/src/pedagogy/value-objects/pedagogical-flags.spec.ts` | PPF-R1, PPF-R4, AD-3 |
| PR1-T6 | [x] [GREEN] Implement `PedagogicalFlags` VO (`none()`, `with({pa?,ppi?,pp?})`) | `packages/domain/src/pedagogy/value-objects/pedagogical-flags.ts` | PPF-R1, PPF-R4 |
| PR1-T7 | [x] Define `SubjectGradingPeriodRepository` interface (`findByCourseCycleAndSubject`, `ensureSnapshot`, `save` — all with `institutionId`) and `SubjectPeriodGradeRepository` interface (`findByCourseCycleAndSubject`, `findByStudentAndCourseCycle`, `saveMany` — all with `institutionId`) | `packages/domain/src/pedagogy/repositories/subject-grading-period-repository.ts`, `packages/domain/src/pedagogy/repositories/subject-period-grade-repository.ts` | SPG-R7, SPG-R8, PPF-R9, PPF-R10, AD-4, AD-5 |
| PR1-T8 | [x] Add `SubjectGradingPeriod` and `SubjectPeriodGrade` models to Prisma schema: `pa/ppi/pp Boolean @default(false)`, all `@@unique`/`@@index`, `courseCycleId → CourseCycle.uuid` FK, back-relations on `CourseCycle`, `Student`, `Subject`, `GradeScaleValue` | `api/prisma_tenant/schema.prisma` | SPG-R1, SPG-R2, AD-3, AD-4 |
| PR1-T9 | [x] Generate and apply Prisma migration `grading_primario_add_subject_grading_period_and_period_grade` | `api/prisma_tenant/migrations/20260609130000_grading_primario_add_subject_grading_period_and_period_grade/migration.sql` | SPG-R1, SPG-R2 |
| PR1-T10 | [x] [RED] Write failing Prisma repository tests for `SubjectGradingPeriodRepository`: `ensureSnapshot` copies template items on first call; second call is no-op; cross-institutionId rows not returned | `api/src/infrastructure/persistence/prisma/repositories/prisma-subject-grading-period.repository.spec.ts` | SPG-R7, AD-4, AD-5 |
| PR1-T11 | [x] [GREEN] Implement `PrismaSubjectGradingPeriodRepository` (`findByCourseCycleAndSubject`, `ensureSnapshot`, `save`) | `api/src/infrastructure/persistence/prisma/repositories/prisma-subject-grading-period.repository.ts` | SPG-R7, AD-4, AD-5 |
| PR1-T12 | [x] [RED] Write failing Prisma repository tests for `SubjectPeriodGradeRepository`: `saveMany` upserts without creating duplicate rows; `findByCourseCycleAndSubject` returns all periods × students; cross-institutionId returns 0 rows | `api/src/infrastructure/persistence/prisma/repositories/prisma-subject-period-grade.repository.spec.ts` | SPG-R4, SPG-R7, PPF-R9 |
| PR1-T13 | [x] [GREEN] Implement `PrismaSubjectPeriodGradeRepository` (`findByCourseCycleAndSubject`, `findByStudentAndCourseCycle`, `saveMany`) | `api/src/infrastructure/persistence/prisma/repositories/prisma-subject-period-grade.repository.ts` | SPG-R4, SPG-R7, PPF-R9 |
| PR1-T14 | [x] Re-export `SubjectGradingPeriod`, `SubjectPeriodGrade`, `PedagogicalFlags`, their Props/Input types, and both repo interfaces from pedagogy module barrel and root domain barrel | `packages/domain/src/pedagogy/index.ts`, `packages/domain/src/index.ts` | AD-1 (grounding facts) |

---

## PR2 — Domain + schema: SubjectFinalGrade + SubjectFinalGradeType enum

**Depends on:** PR1 (shared schema file)
**Estimate:** ~160 lines
**Packages:** `packages/domain`, `api`

| ID | Action | Files | Spec refs |
|---|---|---|---|
| PR2-T1 | [x] [RED] Write failing unit tests for `SubjectFinalGradeType` VO: `fromString('FINAL')` returns enum value; `fromString('INVALID')` returns `ValidationError`; all four values (`FINAL`, `DICIEMBRE`, `MARZO`, `DEFINITIVA`) round-trip correctly | `packages/domain/src/pedagogy/value-objects/subject-final-grade-type.spec.ts` | SFG-R1, SFG-R8, AD-2 |
| PR2-T2 | [x] [GREEN] Implement `SubjectFinalGradeType` VO (enum guard; `fromString` → `ValidationError` on unknown value) | `packages/domain/src/pedagogy/value-objects/subject-final-grade-type.ts` | SFG-R1, SFG-R8 |
| PR2-T3 | [x] [RED] Write failing unit tests for `SubjectFinalGrade` entity: `create()` yields ungraded row; `assignGrade(...)` validates grade fields; `setPassed(boolean)` sets `passed`; entity is bound to one `SubjectFinalGradeType` | `packages/domain/src/pedagogy/entities/subject-final-grade.spec.ts` | SFG-R1, SFG-R4, SFG-R5, AD-2 |
| PR2-T4 | [x] [GREEN] Implement `SubjectFinalGrade` entity (`assignGrade`, `setPassed`, both returning `Result`) | `packages/domain/src/pedagogy/entities/subject-final-grade.ts` | SFG-R1, SFG-R4, SFG-R5 |
| PR2-T5 | [x] Define `SubjectFinalGradeRepository` interface (`findByCourseCycleAndSubject`, `findByStudentAndCourseCycle`, `saveMany` — W2: institutionId removed, TenantContext scopes) | `packages/domain/src/pedagogy/repositories/subject-final-grade-repository.ts` | SFG-R7, SFG-R10, AD-2 |
| PR2-T6 | [x] Add `SubjectFinalGradeType` enum + `SubjectFinalGrade` model to Prisma schema (`@@unique([studentId,courseCycleId,subjectId,type])`, all indexes, `courseCycleId → CourseCycle.uuid`, back-relations on existing models) | `api/prisma_tenant/schema.prisma` | SFG-R1, AD-2 |
| PR2-T7 | [x] Generate and apply Prisma migration `grading_primario_add_subject_final_grade` (timestamp 20260609150000 — after teacher-identity 20260609140000) | `api/prisma_tenant/migrations/20260609150000_grading_primario_add_subject_final_grade/migration.sql` | SFG-R1 |
| PR2-T8 | [x] [RED] Write failing Prisma repository tests for `SubjectFinalGradeRepository`: upsert by type; `findByCourseCycleAndSubject` returns all type-keyed instances; cross-institutionId returns 0 rows; CRITICAL save() round-trip tests for all fields | `api/src/infrastructure/persistence/prisma/repositories/prisma-subject-final-grade.repository.spec.ts` | SFG-R5, SFG-R7, AD-2 |
| PR2-T9 | [x] [GREEN] Implement `PrismaSubjectFinalGradeRepository` | `api/src/infrastructure/persistence/prisma/repositories/prisma-subject-final-grade.repository.ts` | SFG-R5, SFG-R7 |
| PR2-T10 | [x] Re-export `SubjectFinalGrade`, `SubjectFinalGradeType`, `fromSubjectFinalGradeTypeString`, Props/Input types, and repo interface from pedagogy barrel and root domain barrel | `packages/domain/src/pedagogy/index.ts`, `packages/domain/src/index.ts` | AD-1 |

---

## PR3 — Domain + schema: Teacher.userId + CourseCycle.homeroomTeacherId

**Depends on:** none (independent foundation — can run in parallel with PR1/PR2)
**Estimate:** ~120 lines
**Packages:** `packages/domain`, `api`

| ID | Action | Files | Spec refs |
|---|---|---|---|
| PR3-T1 | [x] [RED] Write failing unit tests for modified `Teacher` entity: `userId` is nullable by default; `linkUser(userId)` sets it; getter returns current value | `packages/domain/src/personnel/entities/teacher.spec.ts` | TIA-R1, TIA-R2, AD-6 |
| PR3-T2 | [x] [GREEN] Add `userId?: string` prop, `linkUser(userId: string)` method, and getter to `Teacher` entity | `packages/domain/src/personnel/entities/teacher.ts` | TIA-R1, AD-6 |
| PR3-T3 | [x] Add `findByUserId(userId: string): Promise<Teacher | null>` to `TeacherRepository` interface (no institutionId — W2 convention, tenant via TenantContext) | `packages/domain/src/personnel/repositories/teacher-repository.ts` | TIA-R1, TIA-R2, AD-6 |
| PR3-T4 | [x] [RED] Write failing unit tests for modified `CourseCycle` entity: `homeroomTeacherId` is nullable; `assignHomeroomTeacher(teacherId)` sets it; getter returns value | `packages/domain/src/course-cycle/entities/course-cycle.spec.ts` | TIA-R5, AD-6 |
| PR3-T5 | [x] [GREEN] Add `homeroomTeacherId?: string` prop and `assignHomeroomTeacher(teacherId: string)` method to `CourseCycle` entity | `packages/domain/src/course-cycle/entities/course-cycle.ts` | TIA-R5, AD-6 |
| PR3-T6 | [x] Add `findByHomeroomTeacher(teacherId: string)` and `findByCourseSectionIds(ids: string[])` to `CourseCycleRepository` interface (no institutionId — W2 convention) | `packages/domain/src/course-cycle/repositories/course-cycle-repository.ts` | TIA-R3, TIA-R5, AD-6 |
| PR3-T7 | [x] Add `Teacher.userId String? + @@index([userId])` and `CourseCycle.homeroomTeacherId String? FK→Teacher.id onDelete:SetNull + @@index([homeroomTeacherId])` + `back-relation courseCyclesHomeroom CourseCycle[]` on Teacher to Prisma schema | `api/prisma_tenant/schema.prisma` | TIA-R1, TIA-R5, AD-6 |
| PR3-T8 | [x] Generate and apply Prisma migration `grading_primario_add_teacher_user_and_homeroom` (all nullable — no backfill required) | `api/prisma_tenant/migrations/20260609140000_grading_primario_add_teacher_user_and_homeroom/migration.sql` | TIA-R1, TIA-R5 |
| PR3-T9 | [x] [RED] Write failing Prisma repository tests: `findByUserId` returns Teacher or null; `findByHomeroomTeacher` returns CourseCycles for that teacherId; both respect institutionId scoping | `api/src/infrastructure/persistence/prisma/repositories/prisma-teacher.repository.spec.ts`, `prisma-course-cycle.repository.spec.ts` | TIA-R2, TIA-R5, TIA-R7, AD-6 |
| PR3-T10 | [x] [GREEN] Implement `PrismaTeacherRepository.findByUserId` + `PrismaCourseCycleRepository.findByHomeroomTeacher` + `findByCourseSectionIds` | `api/src/infrastructure/persistence/prisma/repositories/prisma-teacher.repository.ts`, `prisma-course-cycle.repository.ts` | TIA-R2, TIA-R5, TIA-R7 |

---

## PR4 — API: snapshot + subject-grade use cases + teacher-filtered endpoints

**Depends on:** PR1, PR2, PR3
**Estimate:** ~290 lines (pre-authorized split: PR4a reads / PR4b writes if TDD pushes past 300)
**Packages:** `api`

| ID | Action | Files | Spec refs |
|---|---|---|---|
| PR4-T1 | [x] [RED] Write failing use-case tests for `EnsureSubjectGradingSnapshot`: first call copies `GradingPeriodTemplate.items` → `SubjectGradingPeriod` rows; second call is no-op; wrong institutionId → 0 rows created | `api/src/application/grading/ensure-subject-grading-snapshot.use-case.spec.ts` | SPG-R2, AD-5 |
| PR4-T2 | [x] [GREEN] Implement `EnsureSubjectGradingSnapshot` use case (`@Injectable()`) | `api/src/application/grading/ensure-subject-grading-snapshot.use-case.ts` | SPG-R2, AD-5 |
| PR4-T3 | [x] [RED] Write failing use-case tests for `GetSubjectGradesBySubject`: calls `ensureSnapshot`; lazy-scaffolds `SubjectPeriodGrade` rows (all periods × all students, null grades, flags false); returns ALL competencies with `imprimible` boolean exposed per row (no pre-filter); returns empty array (HTTP 200, no error) for unlinked teacher; tenant scoping | `api/src/application/grading/get-subject-grades-by-subject.use-case.spec.ts` | SPG-R8, ES-R1 (CORRECTED), TIA-R2, AD-5, AD-7 |
| PR4-T4 | [x] [GREEN] Implement `GetSubjectGradesBySubject` use case (ensure snapshot → lazy scaffold → fetch all competencies with `imprimible` field → assemble students × periods response with `{ data }`) | `api/src/application/grading/get-subject-grades-by-subject.use-case.ts` | SPG-R8, ES-R1 (CORRECTED), AD-5, AD-7 |
| PR4-T5 | [x] [RED] Write failing use-case tests for `GetSubjectGradesByStudent`: returns subjects × {period grades + 4 final instances (absent = null not error) + ALL competencies with `imprimible` boolean + pa/ppi/pp flags per period}; tenant scoping | `api/src/application/grading/get-subject-grades-by-student.use-case.spec.ts` | SFG-R10, ES-R2 (CORRECTED), AD-7 |
| PR4-T6 | [x] [GREEN] Implement `GetSubjectGradesByStudent` use case | `api/src/application/grading/get-subject-grades-by-student.use-case.ts` | SFG-R10, ES-R2 (CORRECTED), AD-7 |
| PR4-T7 | [RED] Write failing use-case tests for `UpsertSubjectPeriodGrades`: valid batch upsert succeeds; invalid `gradeScaleValueId` for CC level/modality → 400; missing `studentId/courseCycleId/subjectId` → 404; `periodOrdinal` outside snapshotted range → 400; `pa/ppi/pp` flags update independently (omitted fields retain prior value); cross-tenant → 404 | `api/src/application/grading/upsert-subject-period-grades.use-case.spec.ts` | SPG-R3, SPG-R4, SPG-R5, SPG-R6, SPG-R7, SPG-R9, PPF-R2, PPF-R4, PPF-R7, PPF-R8, PPF-R9, PPF-R11, AD-3 |
| PR4-T8 | [GREEN] Implement `UpsertSubjectPeriodGrades` use case (one write path for both period grades AND pa/ppi/pp flags — no separate PATCH endpoint per AD-3; batch upsert via `saveMany`) | `api/src/application/grading/upsert-subject-period-grades.use-case.ts` | SPG-R3..R9, PPF-R4, AD-3 |
| PR4-T9 | [RED] Write failing use-case tests for `UpsertSubjectFinalGrades`: `DICIEMBRE` blocked when `FINAL.passed=true` → 400; `MARZO` blocked when `DICIEMBRE.passed=true` → 400; `DEFINITIVA` has no lifecycle block; `passed` field accepted on all types; invalid `gradeScaleValueId` → 400; missing refs → 404; upsert semantics | `api/src/application/grading/upsert-subject-final-grades.use-case.spec.ts` | SFG-R3, SFG-R4, SFG-R5, SFG-R6, SFG-R7, SFG-R8, SFG-R9, AD-2 |
| PR4-T10 | [GREEN] Implement `UpsertSubjectFinalGrades` use case (conditional lifecycle enforced HERE, not in entity; `FINAL` eager-scaffolded; `DICIEMBRE/MARZO/DEFINITIVA` on-demand) | `api/src/application/grading/upsert-subject-final-grades.use-case.ts` | SFG-R3..R9, AD-2 |
| PR4-T11 | [x] [RED] Write failing use-case tests for `ListTeacherCourseCycles`: `mode=subject` → CourseCycles via `SubjectAssignment` filtered to Primario (`Math.floor(level/10)===2`); `mode=homeroom` → CourseCycles via `homeroomTeacherId`; unlinked `userId` → empty array 200 (never error); tenant scoping | `api/src/application/grading/list-teacher-course-cycles.use-case.spec.ts` | TIA-R2, TIA-R3, TIA-R5, TIA-R6, TIA-R7, TIA-R9, ES-R4, ES-R5, ES-R6, AD-6 |
| PR4-T12 | [x] [GREEN] Implement `ListTeacherCourseCycles` use case | `api/src/application/grading/list-teacher-course-cycles.use-case.ts` | TIA-R2, TIA-R3, TIA-R5, TIA-R6, TIA-R9 |
| PR4-T13 | [x] [RED] Write failing use-case tests for `ListTeacherSubjectsInCourseCycle`: returns only the teacher's assigned subjects within the given CC; empty on no assignments; tenant scoping | `api/src/application/grading/list-teacher-subjects-in-course-cycle.use-case.spec.ts` | TIA-R4, TIA-R7, TIA-R8 |
| PR4-T14 | [x] [GREEN] Implement `ListTeacherSubjectsInCourseCycle` use case | `api/src/application/grading/list-teacher-subjects-in-course-cycle.use-case.ts` | TIA-R4, TIA-R7 |
| PR4-T15 | [x] (read-side) Define Zod query-param schemas: `SubjectGradesBySubjectQuerySchema`, `SubjectGradesByStudentQuerySchema`, `TeacherCCListQuerySchema`, `TeacherSubjectsQuerySchema` | `api/src/presentation/grading/dto/subject-grades.dto.ts` | SPG-R9, SFG-R8 — WRITE-SIDE DTOs deferred to PR4b |
| PR4-T16 | [x] (read-side) Write failing controller tests for `SubjectGradesController`: GET by-subject → 200 `{ data }`; GET by-student → 200 `{ data }`; validation pipe → 400; empty-result → 200 | `api/src/presentation/grading/subject-grades.controller.spec.ts` | SPG-R8, SFG-R10, TIA-R8 — WRITE-SIDE tests deferred to PR4b |
| PR4-T17 | [x] (read-side) Implement `SubjectGradesController` (`GET /grading/subject-grades`, `GET /grading/subject-grades/by-student`) | `api/src/presentation/grading/subject-grades.controller.ts` | SPG-R8, SFG-R10, TIA-R8, ES-R7 — PUT endpoints deferred to PR4b |
| PR4-T18 | [x] [RED] Write failing controller tests for course-cycles teacher-filter: `GET /course-cycles?teacherUserId=&role=subject\|homeroom` returns filtered list; `GET /course-cycles/:id/subjects?teacherUserId=` returns teacher's subjects; `{ data }` response shape; default behavior unchanged when params absent | `api/src/presentation/course-cycle/__tests__/course-cycle-teacher-filter.controller.spec.ts` | TIA-R3, TIA-R4, TIA-R5, TIA-R8 |
| PR4-T19 | [x] [GREEN] Extend `CourseCyclesController` with optional `teacherUserId` + `role` query params and `GET /course-cycles/:id/subjects?teacherUserId=` sub-endpoint (all new params optional; existing behavior unchanged) | `api/src/presentation/course-cycle/course-cycle.controller.ts` | TIA-R3, TIA-R4, TIA-R5 |

---

## PR5 — Web: "Alumnos por materia" (replaces /competency-grading)

**Depends on:** PR4
**Estimate:** ~300 lines (pre-authorized split: PR5a selector+hook / PR5b page if TDD pushes past 300)
**Packages:** `web`

| ID | Action | Files | Spec refs |
|---|---|---|---|
| PR5-T1 | [RED] Write failing component tests for `TeacherFilteredSelector`: calls `GET /course-cycles?teacherUserId=` and `…/subjects?teacherUserId=`; renders CC dropdown and subject dropdown; shows empty state when no CC returned | `web/src/pages/dashboard/components/TeacherFilteredSelector.spec.tsx` | TIA-R3, TIA-R4, ES-R4, ES-R6 |
| PR5-T2 | [GREEN] Implement `TeacherFilteredSelector` component (teacher-filtered 2-level selector: CC → subject; empty-state on empty response; reuses existing dropdown primitives) | `web/src/pages/dashboard/components/TeacherFilteredSelector.tsx` | TIA-R3, TIA-R4, ES-R4, ES-R6 |
| PR5-T3 | [RED] Write failing hook tests for extended `use-grading-grid`: adds subject-period-grade + final-grade + flags fetch/save channels alongside existing competency channel; dense Map includes period grades + finals + flags; bounded-parallel save unchanged; returns ALL competencies with `imprimible` field per row (no pre-filter) | `web/src/pages/dashboard/hooks/use-grading-grid.spec.ts` (or current path) | ES-R7, ES-R8, AD-3 (CORRECTION applied) |
| PR5-T4 | [GREEN] Extend `use-grading-grid` hook: add subject-grade fetch/save, finals fetch/save, flags fetch/save; expose `imprimible` boolean per competency row without any filter | `web/src/pages/dashboard/hooks/use-grading-grid.ts` (or current path) | ES-R7, ES-R8 |
| PR5-T5 | [RED] Write failing integration tests for `SubjectGradingBySubject` page: shows ALL competencies with "Imprimir" toggle per row (not pre-filtered); shows period-grade dropdowns per period tab; shows PA/PPI/PP toggle per student per period; inline save with no full-page reload; empty state when teacher has no assignments; Primario-only (non-Primario CC not shown) | `web/src/pages/dashboard/subject-grading-by-subject.spec.tsx` | ES-R1 (CORRECTED), ES-R4, ES-R6, ES-R7, ES-R8, ES-R10, ES-R11 |
| PR5-T6 | [GREEN] Implement `SubjectGradingBySubject` page: ALL competencies displayed + "Imprimir" toggle per row; period-grade dropdowns; 4 final-grade cells; PA/PPI/PP toggle per student×period; `TeacherFilteredSelector`; Primario-only | `web/src/pages/dashboard/subject-grading-by-subject.tsx` | ES-R1 (CORRECTED), ES-R4, ES-R7, ES-R8, ES-R10, ES-R11 |
| PR5-T7 | Update router: replace `/competency-grading` route with `SubjectGradingBySubject`; add redirect from old URL if needed | `web/src/router` (or equivalent path) | ES-R3 |

---

## PR6 — Web: "Alumnos por curso" (new route)

**Depends on:** PR4, PR5
**Estimate:** ~250 lines
**Packages:** `web`

| ID | Action | Files | Spec refs |
|---|---|---|---|
| PR6-T1 | [RED] Write failing integration tests for `SubjectGradingByCourse` page: student picker populated from homeroom CC students; subjects × {period grades + 4 finals + ALL competencies with "Imprimir" toggle + PA/PPI/PP per subject row}; empty state when teacher has no homeroom CC; Primario-only | `web/src/pages/dashboard/subject-grading-by-course.spec.tsx` | ES-R2 (CORRECTED: all competencies), ES-R5, ES-R6, ES-R10, TIA-R9 |
| PR6-T2 | [GREEN] Implement `SubjectGradingByCourse` page (student picker from homeroom CC; reuses `TeacherFilteredSelector`, extended hook, `CompetencyGradingGrid`; ALL competencies + "Imprimir" toggle; inline save) | `web/src/pages/dashboard/subject-grading-by-course.tsx` | ES-R2 (CORRECTED), ES-R5, ES-R7, ES-R8, ES-R10 |
| PR6-T3 | Update router: add `/grading/by-course` route pointing to `SubjectGradingByCourse` | `web/src/router` (or equivalent path) | ES-R3 |

---

## PR7 — API + template: boletín Primario branch

**Depends on:** PR1, PR2 (independent of PR4/PR5/PR6 web track — can land in parallel with PR4+)
**Estimate:** ~240 lines
**Packages:** `api`

| ID | Action | Files | Spec refs |
|---|---|---|---|
| PR7-T1 | [RED] Write failing regression test: for any CC where `Math.floor(level/10) !== 2`, `generateBoletin` reads the `NotaTrimestral` path and output is byte-for-byte equivalent to pre-change behavior | `api/src/application/reportes/generate-boletin.use-case.spec.ts` | BP-R2, AD-8 |
| PR7-T2 | [RED] Write failing tests for `buildMateriasPrimario`: reads `SubjectGradingPeriod` (dynamic period columns from snapshotted `periodName`); reads `SubjectPeriodGrade` (period grades + pa/ppi/pp); reads `SubjectFinalGrade` (4 instances; absent row → blank not error); reads `CompetencyPeriodValuation` filtered to `imprimible=true`; OR-aggregates pa/ppi/pp flags across reported periods per subject | `api/src/application/reportes/generate-boletin.use-case.spec.ts` | BP-R1, BP-R3, BP-R4, BP-R5, BP-R6, BP-R8, BP-R9, AD-8 |
| PR7-T3 | [GREEN] Extend `MateriaBoletin` type with optional fields `periodGrades?`, `finalGrades?`, `competencies?`, `flags?` — legacy path leaves them `undefined`, non-Primario templates must not crash | `api/src/application/reportes/templates/boletin.template.ts` | BP-R7, AD-8 |
| PR7-T4 | [GREEN] Implement `buildMateriasPrimario(courseCycleId, institutionId)` reading the four data sources + level dispatch (`Math.floor(level/10)===2` → Primario branch; else → existing `NotaTrimestral` code path untouched) in `generate-boletin.use-case.ts` | `api/src/application/reportes/generate-boletin.use-case.ts` | BP-R1, BP-R2, BP-R5, BP-R6, BP-R8, AD-8 |
| PR7-T5 | Rebuild `boletin-primario.hbs`: dynamic period columns from `periodGrades[].periodName`; finals section (4 instances, blank if absent); competency section renders competencies already filtered `imprimible=true` by use case; flags section per subject row (false flags hidden from output) | `api/src/infrastructure/reporting/html-templates/boletin-primario.hbs` | BP-R3, BP-R4, BP-R5, BP-R6, BP-R9, AD-8 |
| PR7-T6 | Mark `CalificacionPrimario` and `NotaTrimestral` as `@deprecated` via JSDoc (NOT deleted — Secundario/Terciario boletines still use them) | `packages/domain/src/primario/` (relevant entity/type files) | AD-8 |

---

## Review Workload Forecast

| PR | Est. lines | vs 300 target / 400 max | Risk | Pre-authorized split |
|---|---|---|---|---|
| PR1 | ~260 | Under target | Low | — |
| PR2 | ~160 | Well under | Low | — |
| PR3 | ~120 | Well under | Low | — |
| PR4 | ~290 | **At edge of 300** | Medium — strict TDD test files inflate line count | PR4a: reads (EnsureSnapshot + GetBySubject + GetByStudent use cases + GET endpoints) / PR4b: writes (Upsert use cases + PUT endpoints + teacher-filtered endpoints) |
| PR5 | ~300 | **At 300 limit** | Medium — component + hook + page + tests | PR5a: selector + hook extension / PR5b: SubjectGradingBySubject page |
| PR6 | ~250 | Under target | Low | — |
| PR7 | ~240 | Under target | Low | — |

**Total estimated:** ~1620 lines across 7 PRs
**Chained PRs recommended:** Yes (7-PR DAG; PR1 and PR3 independent; PR2 stacks on PR1; PR4 gates both web tracks; PR7 is an independent parallel path after PR1+PR2)
**400-line budget risk:** Low — no PR estimated above 300
**300-line target risk:** PR4 (~290) and PR5 (~300) sit at the boundary; TDD test files will push the real diff above 300. **Splits are pre-authorized by design** — the apply executor should split without asking if either PR exceeds 300.
**Decision needed before apply:** None. DAG is locked, corrections are applied, splits are pre-authorized. Apply can proceed.

---

## Cross-package notes

- **Domain barrel (`packages/domain/src/index.ts`)**: must re-export all new types after PR1 (PR1-T14) and PR2 (PR2-T10). Primario block at lines 74–79; pedagogy block at lines 52–65 per grounding facts.
- **Migrations path**: `api/prisma_tenant/migrations/` (NOT `api/prisma/migrations/`). One migration per schema-touching PR (PR1, PR2, PR3). Naming: `<timestamp>_grading_primario_<slug>`.
- **Multi-tenant scoping**: every new repository method and use case must receive `institutionId` from the existing `@CurrentTenant()` / tenant-context convention. Strict-TDD specs assert cross-tenant returns 404 or empty — never leaks rows.
- **`CourseCycle` FK uses `uuid` not `id`**: all new foreign keys referencing `CourseCycle` must point to `CourseCycle.uuid` (verified grounding fact).
- **No separate PATCH /pedagogical-flags endpoint**: flags travel with period grades via `UpsertSubjectPeriodGrades` per AD-3 correction. Any spec text implying a separate endpoint (PPF-R4, PPF-R5) is reconciled to this design.
- **Entry screens show ALL competencies**: `GetSubjectGradesBySubject` and `GetSubjectGradesByStudent` return every `CompetencyPeriodValuation` for the subject with `imprimible: boolean` exposed. The boletín (PR7) filters by it; the entry screens (PR4–PR6) do not.
- **`FINAL` eagerly scaffolded; `DICIEMBRE/MARZO/DEFINITIVA` on-demand**: the lifecycle is enforced in `UpsertSubjectFinalGrades` (use case), not in the entity.
- **Conventional commits**: `feat(grading): ...` / `feat(pedagogy): ...`; `test(grading): ...` for test-only commits; `chore(grading): ...` for barrel/migration-only.
