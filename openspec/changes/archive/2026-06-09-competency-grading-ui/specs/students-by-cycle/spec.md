# Spec — students-by-cycle

> **New capability spec**: endpoint that returns enrolled students for a CourseCycle,
> needed as the grid row source for the grading matrix.

---

## Scope

**In**: `GET /v1/course-cycles/:uuid/students` — list of students enrolled in the
given CourseCycle, derived from existing internal logic.  
**Out**: enrollment creation or modification; explicit Enrollment→CourseCycle FK (Fase 4);
pagination; detailed student profile fields beyond display name.

---

## Requirement: Enrolled Students for a CourseCycle

The system MUST expose:

```
GET /v1/course-cycles/:uuid/students
```

**Response shape** (HTTP 200) — wrapped in `{ data }` per project convention:

```json
{
  "data": [
    {
      "studentId": "<uuid or id>",
      "firstName": "<string>",
      "lastName": "<string>"
    }
  ]
}
```

The list is DERIVED from the existing internal `findEnrolledStudentIds` logic — there is
no explicit Enrollment→CourseCycle FK until Fase 4. This is intentional. Empty list is a
valid response (HTTP 200 `{ "data": [] }`).

CourseCycle not found → HTTP 404.

---

### Scenario SBC-1: Happy path — returns enrolled students

- GIVEN CourseCycle with uuid="cc-1" exists and has 3 enrolled students
- WHEN `GET /v1/course-cycles/cc-1/students`
- THEN HTTP 200 is returned with a list of 3 entries
- AND each entry contains `studentId`, `firstName`, `lastName`

### Scenario SBC-2: Course cycle not found → 404

- GIVEN no CourseCycle with uuid="cc-nonexistent"
- WHEN `GET /v1/course-cycles/cc-nonexistent/students`
- THEN HTTP 404 is returned

### Scenario SBC-3: Course cycle with no enrolled students → empty list, not 404

- GIVEN CourseCycle with uuid="cc-empty" exists but has no enrolled students
- WHEN `GET /v1/course-cycles/cc-empty/students`
- THEN HTTP 200 is returned with `[]`

---

## HTTP Mapping

| Situation                                | HTTP Status |
|------------------------------------------|-------------|
| Students returned (including empty list) | 200 OK      |
| CourseCycle uuid not found               | 404         |
