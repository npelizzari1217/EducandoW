# Spec: asignacion-cascade-masiva

## Overview

Add a BULK "Asignar materias y competencias" operation at the CourseCycle level.
A single HTTP call SHALL materialize `MateriasXAlumnoXCursoXCiclo` and
`CompetenciaXMateriaXAlumnoXCursoXCiclo` rows for EVERY enrolled student of a
given CourseCycle, replacing the current per-student-only workflow.

## Pedagogical Level

Level-agnostic. Each CourseCycle already carries its level and study-plan
context. The bulk operation is scoped to one CC per call; no cross-level
processing occurs.

---

## 1. API — New Bulk Endpoint

### 1.1 Route

- The system SHALL expose `POST /course-cycles/:ccId/alumnos/cascade` as the
  bulk cascade endpoint.
- This route MUST be registered in the NestJS router **before**
  `POST /course-cycles/:ccId/alumnos/:id/cascade`; failure to do so causes
  NestJS to match the literal segment `"cascade"` as the dynamic `:id`
  parameter, silently routing to the wrong handler.

### 1.2 Authorization

- The bulk endpoint SHALL require the same role/permission guards as
  `POST /course-cycles/:ccId/alumnos/:id/cascade`.
- Unauthenticated or unauthorized requests SHALL receive HTTP 401/403 and SHALL
  NOT mutate any data.

### 1.3 Idempotency

- Both `MateriasXAlumnoXCursoXCiclo` and `CompetenciaXMateriaXAlumnoXCursoXCiclo`
  rows SHALL be created with `skipDuplicates: true`.
- Re-running the endpoint on a CourseCycle where all rows already exist SHALL
  return HTTP 200, set `materiasCreated = 0`, `competenciasCreated = 0`, and
  SHALL NOT corrupt or modify any pre-existing row.
- `CompetenciaPeriodo` (grade) rows SHALL NEVER be touched (ADR-7).

### 1.4 Partial Failure (Best-Effort)

- If one student's cascade throws an error, the operation SHALL continue
  processing the remaining students.
- The failed student SHALL be counted in `studentsFailed`; the operation SHALL
  NOT propagate a top-level exception.
- The overall HTTP response SHALL be 200 regardless of partial failures.

### 1.5 Response Shape

The response body SHALL conform to:

```typescript
{
  data: {
    studentsProcessed:   number; // students whose cascade succeeded
    studentsFailed:      number; // students whose cascade threw
    materiasCreated:     number; // total MateriasXAlumnoXCursoXCiclo rows inserted
    materiasSkipped:     number; // total skipped (already existed)
    competenciasCreated: number; // total CompetenciaXMateriaXAlumnoXCursoXCiclo rows inserted
    competenciasSkipped: number; // total skipped (already existed)
  }
}
```

### 1.6 Empty CourseCycle

- When a CourseCycle has zero enrolled students (or `ccId` resolves to no
  `AlumnosXCursoXCiclo` rows), the endpoint SHALL return HTTP 200 with all
  response fields equal to `0`. It SHALL NOT return an error status.

---

## 2. Application — Use Case

- The bulk use case SHALL reside in `api/src/application/course-cycle/` as
  `cascade-all-students-materias-competencias.use-case.ts`.
- The use case SHALL accept input `{ ccId: string }`.
- The use case SHALL call `alumnosCCRepo.findByCourseCycle(ccId)` exactly once
  to obtain all bridge rows.
- The use case SHALL call `materiaRepo.findByCourseCycleId(ccId)` exactly once
  and filter out `esOptativa = true` materias before any per-student iteration.
- The use case SHALL resolve active competencies per unique `studyPlanSubjectId`
  (calling `competencyRepo.findActiveByStudyPlanSubject` once per unique SPS ID,
  not once per student).
- The use case SHALL NOT delegate to the per-student use case
  (`cascade-student-materias-competencias.use-case.ts`); doing so would cause
  an N+1 `findById` for every student.
- Per-student errors SHALL be caught inside the iteration loop, logged, and
  accumulated as failures. They SHALL NOT bubble up and abort the batch.
- The use case SHALL return an aggregated `CascadeBulkResult` value object
  (no throw on partial failure).

---

## 3. Module

- `api/src/presentation/course-cycle-alumnos/alumnos-x-curso-x-ciclo.module.ts`
  SHALL register the new use case as a provider so the controller can inject it.

---

## 4. Frontend — Course Row Button

### 4.1 Placement

- A button labelled **"Asignar materias y competencias"** SHALL appear in the
  course-row action group of `web/src/pages/dashboard/course-cycles.tsx`,
  adjacent to the existing Materias / Alumnos / Editar / Eliminar actions.

### 4.2 Disabled State

- The button SHALL be disabled (not hidden) when the course has `0` enrolled
  students.

### 4.3 Confirmation

- Clicking the enabled button SHALL present a confirmation dialog before any
  HTTP request is issued.
- If the user dismisses or cancels the dialog, no request SHALL be made and the
  UI SHALL return to its idle state.

### 4.4 In-Flight State

- After the user confirms, the button SHALL enter a loading/disabled state for
  the duration of the request.
- No other course-row action SHALL be blocked by this operation.

### 4.5 Feedback Toasts

- On success: a toast SHALL display the aggregated counts from the response
  (`studentsProcessed`, `materiasCreated`, `competenciasCreated`, etc.).
- On failure (non-2xx or network error): an error toast SHALL be shown.

### 4.6 State Variable

- A single state variable (e.g., `cascadingBulkCcId: string | null`) SHALL
  track which, if any, CourseCycle is currently processing. Setting it `null`
  after completion returns the button to its idle/enabled state.

---

## 5. Acceptance Scenarios

### SC-01 — Happy path: N students, no prior data

```
Given a CourseCycle ccId with N enrolled students (N > 0)
  And none of the students have MateriasXAlumnoXCursoXCiclo rows
  And none of the students have CompetenciaXMateriaXAlumnoXCursoXCiclo rows
When POST /course-cycles/:ccId/alumnos/cascade is called with valid auth
Then HTTP 200 is returned
  And response.data.studentsProcessed == N
  And response.data.studentsFailed == 0
  And response.data.materiasCreated == N × (non-optativa materia count)
  And response.data.competenciasCreated == N × (total active competencies of non-optativa materias)
  And MateriasXAlumnoXCursoXCiclo rows exist for all students × all non-optativa materias
  And CompetenciaXMateriaXAlumnoXCursoXCiclo rows exist for all students × all active competencias
```

### SC-02 — Idempotency: re-run on fully populated course

```
Given a CourseCycle ccId where all students already have materias and competencias assigned
When POST /course-cycles/:ccId/alumnos/cascade is called again
Then HTTP 200 is returned
  And response.data.materiasCreated == 0
  And response.data.competenciasCreated == 0
  And response.data.materiasSkipped > 0
  And response.data.competenciasSkipped > 0
  And no pre-existing row is modified or deleted
```

### SC-03 — Grade preservation (ADR-7)

```
Given a student in ccId with existing CompetenciaPeriodo rows (grades)
When POST /course-cycles/:ccId/alumnos/cascade is called
Then all CompetenciaPeriodo rows are unchanged after the operation
  And no CompetenciaPeriodo rows are deleted or updated
```

### SC-04 — Partial failure: one student throws

```
Given a CourseCycle with 3 enrolled students
  And the cascade for student B is configured to throw an error
When POST /course-cycles/:ccId/alumnos/cascade is called
Then HTTP 200 is returned
  And response.data.studentsProcessed == 2
  And response.data.studentsFailed == 1
  And students A and C have their rows created correctly
  And student B's rows may or may not exist (failure mid-stream is acceptable)
```

### SC-05 — Empty course

```
Given a CourseCycle with 0 enrolled students
When POST /course-cycles/:ccId/alumnos/cascade is called
Then HTTP 200 is returned
  And response.data == { studentsProcessed: 0, studentsFailed: 0,
      materiasCreated: 0, materiasSkipped: 0,
      competenciasCreated: 0, competenciasSkipped: 0 }
```

### SC-06 — Route disambiguation: bulk route not shadowed

```
Given the NestJS router registers:
  - POST /course-cycles/:ccId/alumnos/cascade  → BulkCascadeHandler
  - POST /course-cycles/:ccId/alumnos/:id/cascade → PerStudentCascadeHandler
When a request arrives at POST /course-cycles/abc123/alumnos/cascade
Then it is dispatched to BulkCascadeHandler
  And PerStudentCascadeHandler is NOT invoked
  And the :id param is NOT set to "cascade"
```

> This scenario MUST have a dedicated controller unit test (or integration test)
> that confirms the routing decision is stable.

### SC-07 — Authorization: unauthenticated request rejected

```
Given no authentication token is present
When POST /course-cycles/:ccId/alumnos/cascade is called
Then HTTP 401 or 403 is returned
  And no MateriasXAlumnoXCursoXCiclo rows are created
  And no CompetenciaXMateriaXAlumnoXCursoXCiclo rows are created
```

### SC-08 — Authorization: authorized role mirrors per-student cascade

```
Given a user with the same role that can call POST /course-cycles/:ccId/alumnos/:id/cascade
When POST /course-cycles/:ccId/alumnos/cascade is called
Then the request is authorized (not rejected with 401/403)
```

### SC-09 — Optativas excluded

```
Given a CourseCycle with materias where some have esOptativa = true
When POST /course-cycles/:ccId/alumnos/cascade is called
Then only MateriasXAlumnoXCursoXCiclo rows for esOptativa = false materias are created
  And no MateriasXAlumnoXCursoXCiclo row is created for any optativa materia
```

### SC-10 — Active competencies only

```
Given a CourseCycle with materias whose study-plan subjects have both active
      and inactive competencias
When POST /course-cycles/:ccId/alumnos/cascade is called
Then only CompetenciaXMateriaXAlumnoXCursoXCiclo rows for active competencias are created
  And no row is created for inactive competencias
```

### SC-11 — Frontend: button disabled for empty course

```
Given a course row rendered in CursosXCiclo with alumnosCount == 0
Then the "Asignar materias y competencias" button is present in the DOM
  And the button has the disabled attribute
  And clicking it produces no confirmation dialog and no HTTP request
```

### SC-12 — Frontend: confirmation cancel aborts request

```
Given a course row with alumnosCount > 0
When the user clicks "Asignar materias y competencias"
  And the confirmation dialog appears
  And the user clicks Cancel / dismisses the dialog
Then no POST /course-cycles/:ccId/alumnos/cascade request is issued
  And the button returns to its idle enabled state
```

### SC-13 — Frontend: success toast shows counts

```
Given a course row with alumnosCount > 0
When the user confirms the bulk cascade
  And POST /course-cycles/:ccId/alumnos/cascade returns HTTP 200 with counts
Then a success toast is displayed showing the aggregated counts
  And the button returns to its idle enabled state
```

### SC-14 — Frontend: error toast on failure

```
Given a course row with alumnosCount > 0
When the user confirms the bulk cascade
  And POST /course-cycles/:ccId/alumnos/cascade returns a non-2xx response
    or a network error occurs
Then an error toast is displayed
  And the button returns to its idle enabled state (not permanently disabled)
```

### SC-15 — Frontend: loading state while in-flight

```
Given the user has confirmed the bulk cascade for course C
When the POST request is in-flight
Then the "Asignar materias y competencias" button for course C is in loading/disabled state
  And no other course-row action is affected by this state
```

---

## 6. Out of Scope

The following are explicitly excluded from this change:

- Modifying or replacing `cascade-student-materias-competencias.use-case.ts`
  (per-student cascade stays intact and untouched).
- Concurrent student processing (`Promise.all`) — the implementation SHALL be
  sequential.
- Creating, migrating, or deleting any database table or Prisma schema.
- New repository ports — the existing repo interfaces are sufficient.
- `CompetenciaPeriodo` (grades) in any capacity.
