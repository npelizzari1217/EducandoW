# Spec: Study Plan Safe Delete

## Intent

`DeleteStudyPlanUC` MUST verify that a study plan has no dependent records before performing a soft-delete. When dependents exist the operation MUST be rejected with a structured domain error that propagates to a HTTP 409 response and an `AlertModal` on the frontend. A plan with no dependents MUST be soft-deleted normally (HTTP 204). A non-existent plan MUST be treated as a no-op (idempotent).

---

## REQ-1: Deletion blocked when the plan has linked courses (StudyPlanCourse)

### Scenario 1.1 — Plan with 1 linked course

- GIVEN a study plan P that has 1 `StudyPlanCourse` record
- WHEN `DeleteStudyPlanUC.execute(P.id)` is called
- THEN the result is `err(StudyPlanHasDependenciesError)`
- AND `error.details` equals `{ courseCount: 1, courseCycleCount: 0 }`
- AND P's `deletedAt` remains `null`

### Scenario 1.2 — Plan with N linked courses (N > 1)

- GIVEN a study plan P that has 3 `StudyPlanCourse` records
- WHEN `DeleteStudyPlanUC.execute(P.id)` is called
- THEN the result is `err(StudyPlanHasDependenciesError)`
- AND `error.details` equals `{ courseCount: 3, courseCycleCount: 0 }`
- AND P's `deletedAt` remains `null`

---

## REQ-2: Deletion blocked when the plan has active course cycles (CourseCycle, deletedAt null)

### Scenario 2.1 — Plan with 1 active cycle

- GIVEN a study plan P that has 1 `CourseCycle` with `deletedAt = null`
- AND P has 0 `StudyPlanCourse` records
- WHEN `DeleteStudyPlanUC.execute(P.id)` is called
- THEN the result is `err(StudyPlanHasDependenciesError)`
- AND `error.details` equals `{ courseCount: 0, courseCycleCount: 1 }`
- AND P's `deletedAt` remains `null`

### Scenario 2.2 — Plan with M active cycles (M > 1)

- GIVEN a study plan P that has 2 `CourseCycle` records both with `deletedAt = null`
- AND P has 0 `StudyPlanCourse` records
- WHEN `DeleteStudyPlanUC.execute(P.id)` is called
- THEN the result is `err(StudyPlanHasDependenciesError)`
- AND `error.details` equals `{ courseCount: 0, courseCycleCount: 2 }`
- AND P's `deletedAt` remains `null`

### Scenario 2.3 — Already soft-deleted cycles do NOT block

- GIVEN a study plan P that has 1 `CourseCycle` with `deletedAt = <timestamp>` (already soft-deleted)
- AND P has 0 `StudyPlanCourse` records
- WHEN `DeleteStudyPlanUC.execute(P.id)` is called
- THEN the result is `ok(void)`
- AND P's `deletedAt` is set to a non-null timestamp

---

## REQ-3: Deletion blocked when BOTH courses and cycles exist

### Scenario 3.1 — Mixed dependents (plural courses, singular cycle)

- GIVEN a study plan P that has 2 `StudyPlanCourse` records and 1 `CourseCycle` with `deletedAt = null`
- WHEN `DeleteStudyPlanUC.execute(P.id)` is called
- THEN the result is `err(StudyPlanHasDependenciesError)`
- AND `error.details` equals `{ courseCount: 2, courseCycleCount: 1 }`
- AND P's `deletedAt` remains `null`

### Scenario 3.2 — Mixed dependents (singular course, plural cycles)

- GIVEN a study plan P that has 1 `StudyPlanCourse` record and 2 `CourseCycle` records with `deletedAt = null`
- WHEN `DeleteStudyPlanUC.execute(P.id)` is called
- THEN the result is `err(StudyPlanHasDependenciesError)`
- AND `error.details` equals `{ courseCount: 1, courseCycleCount: 2 }`
- AND P's `deletedAt` remains `null`

---

## REQ-4: Successful soft-delete when no dependents

### Scenario 4.1 — No courses, no active cycles

- GIVEN a study plan P with 0 `StudyPlanCourse` records and 0 `CourseCycle` records with `deletedAt = null`
- WHEN `DeleteStudyPlanUC.execute(P.id)` is called
- THEN the result is `ok(void)`
- AND P's `deletedAt` is set to the current UTC timestamp (ISO 8601, non-null)

---

## REQ-5: Non-existent plan is idempotent

### Scenario 5.1 — Plan ID does not exist in the database

- GIVEN a plan ID that has no corresponding `StudyPlan` row
- WHEN `DeleteStudyPlanUC.execute(nonExistentId)` is called
- THEN the result is `ok(void)`
- AND no error is thrown or returned

---

## REQ-6: HTTP response shape

### Scenario 6.1 — Controller maps error to HTTP 409

- GIVEN the UC returns `err(StudyPlanHasDependenciesError)` with `details = { courseCount: 1, courseCycleCount: 0 }`
- WHEN the controller processes `DELETE /v1/study-plans/:id`
- THEN the HTTP status is `409`
- AND the response body is exactly:
  ```json
  {
    "error": {
      "message": "<Spanish message per REQ-7>",
      "code": "STUDY_PLAN_HAS_DEPENDENCIES",
      "details": {
        "courseCount": 1,
        "courseCycleCount": 0
      }
    }
  }
  ```

### Scenario 6.2 — Successful delete returns HTTP 204

- GIVEN the UC returns `ok(void)`
- WHEN the controller processes `DELETE /v1/study-plans/:id`
- THEN the HTTP status is `204`
- AND the response body is empty

---

## REQ-7: Spanish message format — authoritative templates

The `message` field in the HTTP 409 body MUST be generated using the following templates verbatim. TDD assertions MUST compare against these exact strings.

**Implementation note (intentional design decision):** The message is built in the domain error constructor (`StudyPlanHasDependenciesError.buildMessage()`), following the existing pattern of `CycleCodeAlreadyExistsError`. This provides a self-contained, reusable error object that the controller passes directly to the HTTP response. While the spec initially proposed presentation-layer-only templating, this approach maintains consistency with the domain model and eliminates duplication.

### Helper definitions

```
pluralize_courses(n):
  n === 1  →  "1 curso vinculado"
  n  > 1   →  "{n} cursos vinculados"

pluralize_cycles(n):
  n === 1  →  "1 ciclo lectivo activo"
  n  > 1   →  "{n} ciclos lectivos activos"
```

### Template A — courses only (`courseCount > 0`, `courseCycleCount === 0`)

```
"No se puede eliminar el plan de estudio porque tiene {pluralize_courses(courseCount)}. Eliminá los cursos vinculados antes de continuar."
```

### Template B — cycles only (`courseCount === 0`, `courseCycleCount > 0`)

```
"No se puede eliminar el plan de estudio porque tiene {pluralize_cycles(courseCycleCount)}. Eliminá los ciclos lectivos antes de continuar."
```

### Template C — both (`courseCount > 0`, `courseCycleCount > 0`)

```
"No se puede eliminar el plan de estudio porque tiene {pluralize_courses(courseCount)} y {pluralize_cycles(courseCycleCount)}. Eliminá los ciclos lectivos primero y luego los cursos vinculados."
```

### Scenario 7.1 — 1 course, 0 cycles → Template A singular

```
format_message(1, 0)
→ "No se puede eliminar el plan de estudio porque tiene 1 curso vinculado. Eliminá los cursos vinculados antes de continuar."
```

### Scenario 7.2 — 3 courses, 0 cycles → Template A plural

```
format_message(3, 0)
→ "No se puede eliminar el plan de estudio porque tiene 3 cursos vinculados. Eliminá los cursos vinculados antes de continuar."
```

### Scenario 7.3 — 0 courses, 1 cycle → Template B singular

```
format_message(0, 1)
→ "No se puede eliminar el plan de estudio porque tiene 1 ciclo lectivo activo. Eliminá los ciclos lectivos antes de continuar."
```

### Scenario 7.4 — 0 courses, 2 cycles → Template B plural

```
format_message(0, 2)
→ "No se puede eliminar el plan de estudio porque tiene 2 ciclos lectivos activos. Eliminá los ciclos lectivos antes de continuar."
```

### Scenario 7.5 — 2 courses, 1 cycle → Template C (plural courses, singular cycle)

```
format_message(2, 1)
→ "No se puede eliminar el plan de estudio porque tiene 2 cursos vinculados y 1 ciclo lectivo activo. Eliminá los ciclos lectivos primero y luego los cursos vinculados."
```

### Scenario 7.6 — 1 course, 2 cycles → Template C (singular course, plural cycles)

```
format_message(1, 2)
→ "No se puede eliminar el plan de estudio porque tiene 1 curso vinculado y 2 ciclos lectivos activos. Eliminá los ciclos lectivos primero y luego los cursos vinculados."
```

---

## REQ-8: Repository contract — getDependencies

The `StudyPlanRepository` port MUST declare a `getDependencies(planId: string): Promise<{ courseCount: number; courseCycleCount: number }>` method.

### Scenario 8.1 — Only non-soft-deleted cycles are counted

- GIVEN a study plan P with 2 `CourseCycle` records: one with `deletedAt = null`, one with `deletedAt = <timestamp>`
- AND P has 0 `StudyPlanCourse` records
- WHEN `getDependencies(P.id)` is called
- THEN the result is `{ courseCount: 0, courseCycleCount: 1 }`

### Scenario 8.2 — All linked courses are counted regardless of any state

- GIVEN a study plan P with 3 `StudyPlanCourse` records
- AND P has 0 active `CourseCycle` records
- WHEN `getDependencies(P.id)` is called
- THEN the result is `{ courseCount: 3, courseCycleCount: 0 }`

---

## REQ-9: Frontend behavior — AlertModal

### Scenario 9.1 — AlertModal shown on 409

- GIVEN the user clicks "Eliminar" for a study plan
- WHEN the API responds with HTTP 409 and `{ error: { message: "<msg>", code: "STUDY_PLAN_HAS_DEPENDENCIES", ... } }`
- THEN an `AlertModal` is rendered with the text from `error.message`
- AND a single "Aceptar" button is visible
- AND the plan list is NOT reloaded (no new GET request to the study-plans endpoint)

### Scenario 9.2 — "Aceptar" closes the modal

- GIVEN the `AlertModal` is open with a dependency message
- WHEN the user clicks "Aceptar"
- THEN the modal closes (is unmounted or hidden)
- AND the plan list is NOT reloaded

### Scenario 9.3 — Successful delete reloads the list

- GIVEN the user clicks "Eliminar" for a study plan with no dependents
- WHEN the API responds with HTTP 204
- THEN the study plan list is reloaded (GET request to the study-plans endpoint is triggered)
- AND no modal is shown

---

## Domain Invariants

- `StudyPlanHasDependenciesError` MUST extend `DomainError`.
- `StudyPlanHasDependenciesError.code` MUST equal `'STUDY_PLAN_HAS_DEPENDENCIES'`.
- `StudyPlanHasDependenciesError.details` MUST carry `{ courseCount: number; courseCycleCount: number }` with both values ≥ 0.
- `StudyPlanHasDependenciesError.message` MUST be built via `buildMessage()` in the domain error constructor, applying Templates A/B/C based on courseCount and courseCycleCount.
- `DeleteStudyPlanUC.execute` return type MUST be `Promise<Result<void, DomainError>>`.
- Domain and application layers MUST NOT throw; they MUST return `Result`.
- `getDependencies` MUST be declared on the `StudyPlanRepository` port (interface), not only on the concrete Prisma implementation.
- The soft-delete sets `deletedAt` to the current UTC timestamp; it MUST NOT hard-delete the row.
