# Delta for Notas (Subject Grades) — GET Read Scope

> Capabilities: subject-period-grades, subject-final-grades (READ path only)
> Change: notas-get-authz-grupo · 2026-06-16
> Satisfies: `docente-ciclo-grupos/specs/notas/delta.md` → "Requirement: Grade Scope Narrowed to Group"
> Base specs: openspec/specs/subject-period-grades/spec.md,
>             openspec/specs/subject-final-grades/spec.md

## Context

The prior change `docente-ciclo-grupos` stated that grade reads SHALL be scoped to a
`GrupoXCursoXMateriaXCiclo` for teachers (see "Requirement: Grade Scope Narrowed to Group"
and its scenario "Teacher sees only grades for their assigned group"). The write path
(`upsert-subject-period-grades`, `upsert-subject-final-grades`) already enforces that
requirement. The GET path (`get-subject-grades-by-subject`) has the authorization GATE
in place but returns all course-cycle students unfiltered after passing it.

This delta specifies WHAT the GET path MUST do to satisfy that open requirement on the
read side. It does NOT redefine the requirement — it closes the implementation gap.

---

## SATISFIES Requirements

### Requirement: Grade Scope Narrowed to Group (READ path implementation)

Reference: `docente-ciclo-grupos/specs/notas/delta.md` — "Requirement: Grade Scope Narrowed to Group"

The GET use-case `get-subject-grades-by-subject` MUST enforce group-scoped student
filtering AFTER authorization. The returned `students[]` MUST contain only students that
the authenticated user is permitted to see, as determined by the scope-resolution rules
below. The shape of `SubjectGradesBySubjectResult.students[]` MUST NOT change — only the
set of rows differs by role.

---

## ADDED Requirements

### Requirement: Scope Resolution Returns an Access Scope Value

The domain port `AssignmentAuthorizerPort` MUST expose a method
`getAllowedStudentIds(userId, userRoles, courseCycleId, subjectId)` that returns one of:

- `'all'` — the caller has administrative scope and MUST receive every student in the
  course-cycle without group filtering.
- `string[]` — an array of allowed student IDs (MAY be empty); the GET use-case MUST
  filter `students` to only those whose `studentId` is in this set.
- `null` — the caller has no valid assignment for the given (courseCycle, subject) and
  MUST be denied access.

Administrative roles (SECRETARIO, DIRECTOR, ADMIN, ROOT) SHALL resolve to `'all'`.
TEACHER SHALL resolve to `string[]` derived from their assigned grupos (or `null` if
no assignment exists).

### Requirement: GET Use-Case Replaces Boolean Gate with Scope Filter

The GET use-case MUST replace the prior boolean `canWriteGrades` gate with a call to
`getAllowedStudentIds`. The use-case MUST apply the result as follows:

- `null` → return a forbidden Result; the controller MUST respond with HTTP 403.
- `'all'` → return all enrolled students for the course-cycle, unfiltered.
- `string[]` → filter the enrolled student list to only those whose `studentId` appears
  in the scope array; an empty array is valid and results in an empty student list.

### Requirement: Student ID Deduplication for Multi-Grupo Teachers

When a TEACHER is assigned to more than one `GrupoXCursoXMateriaXCiclo` for the same
(courseCycle, subject), the scope resolver MUST return the deduplicated union of student
IDs across all assigned grupos. A student appearing in more than one grupo MUST appear
exactly once in the result.

### Requirement: Co-Docencia Does Not Duplicate Grade Records

When two or more teachers share a grupo (co-docencia), the grade record identified by
`@@unique([studentId, courseCycleId, subjectId])` is shared. Each teacher MUST be able
to read that shared record. The record MUST appear exactly once in each teacher's result.
This requirement carries forward from `docente-ciclo-grupos` and applies identically to
the read path.

---

## Scenarios

### Scenario: TEACHER scoped to one grupo sees only that grupo's students

- GIVEN a course-cycle CC1 with subject M split into G1 (teacher D1, students S1–S15)
  and G2 (teacher D2, students S16–S30)
- WHEN D1 calls GET grades for subject M in CC1
- THEN `students[]` contains only S1–S15
- AND S16–S30 are not present in the response

### Scenario: Administrative user sees all students

- GIVEN a course-cycle CC1 with subject M split into G1 and G2
- AND user U has role SECRETARIO with GRADES:READ module access
- WHEN U calls GET grades for subject M in CC1
- THEN `students[]` contains all students across G1 and G2
- AND the response shape of `SubjectGradesBySubjectResult.students[]` is identical to
  the shape a teacher would receive — only the row count differs

### Scenario: TEACHER with no grupo assignment for (courseCycle, subject) is forbidden

- GIVEN teacher D3 has no `DocenteXCiclo` row (or no `GrupoXCursoXMateriaXCiclo`
  assignment) for subject M in course-cycle CC1
- WHEN D3 calls GET grades for subject M in CC1
- THEN the use-case returns a forbidden Result
- AND the controller responds with HTTP 403 Forbidden
- AND no student data is returned

### Scenario: TEACHER assigned to multiple grupos receives deduplicated union

- GIVEN course-cycle CC1 with subject M having G1 (students S1–S10) and G2 (students
  S8–S15), where S8, S9, S10 appear in both grupos
- AND teacher D1 is assigned to both G1 and G2
- WHEN D1 calls GET grades for subject M in CC1
- THEN `students[]` contains S1–S15 with no duplicates (S8, S9, S10 appear exactly once)

### Scenario: Co-docencia — each teacher sees the shared student; one grade record exists

- GIVEN a `GrupoXCursoXMateriaXCiclo` G with teachers D1 and D2 (co-docencia)
  and student S assigned to G
- AND the grade record `(S.id, CC1.id, M.id)` exists (shared, per `@@unique` constraint)
- WHEN D1 calls GET grades for subject M in CC1
- THEN `students[]` includes student S with the shared grade record
- WHEN D2 calls GET grades for subject M in CC1
- THEN `students[]` also includes student S with the same shared grade record
- AND exactly one grade record exists for the `(S, CC1, M)` tuple (no duplication)

### Scenario: TEACHER assigned to an empty grupo receives an empty student list (not forbidden)

- GIVEN teacher D1 is assigned to `GrupoXCursoXMateriaXCiclo` G1 for subject M in CC1
- AND G1 has zero enrolled students
- WHEN D1 calls GET grades for subject M in CC1
- THEN the use-case returns a success Result with `students[]` equal to `[]`
- AND the controller responds with HTTP 200
- AND the response MUST NOT be HTTP 403 (an assigned teacher with an empty grupo is
  not forbidden — the assignment exists; the grupo is simply empty)

---

## Invariants

- The response type `SubjectGradesBySubjectResult` and the shape of each element in
  `students[]` MUST NOT change. This delta affects only which rows appear in the array.
- The scope resolver MUST operate entirely within the domain/application boundary.
  No HTTP-layer logic MAY duplicate or shadow this filtering.
- Integration tests against a real database for the above scenarios are DEFERRED (unit
  tests with mocks satisfy the spec gate for this change). This is consistent with the
  project's current test strategy and is recorded explicitly to prevent scope creep.
