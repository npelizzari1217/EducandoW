# Delta for Auth Access

## ADDED Requirements

### Requirement: Observation Route Protection

Observation endpoints MUST be protected by role rank, not by module/action guard. `POST /v1/students/:studentId/observations` and `GET /v1/students/:studentId/observations` and `GET /v1/courses/:courseId/observations` SHALL require a minimum role rank of 20 (TEACHER+), enforced by a rank guard at the presentation layer. `DELETE /v1/observations/:id` SHALL require either authorship or minimum rank 60 (ADMIN+), enforced at the use case layer. Callers below the required rank MUST receive HTTP 403 Forbidden.

#### Scenario: TEACHER+ rank guard passes for observation creation

- GIVEN a TEACHER user (rank 20) sending `POST /v1/students/:studentId/observations`
- WHEN the rank guard evaluates the request
- THEN the guard passes and the request reaches the use case

#### Scenario: PRECEPTOR rank guard passes for observation listing

- GIVEN a PRECEPTOR user (rank 30) sending `GET /v1/students/:studentId/observations`
- WHEN the rank guard evaluates the request
- THEN the guard passes — rank 30 ≥ minimum 20

#### Scenario: Below-minimum rank receives 403 on observation routes

- GIVEN a TUTOR user (rank 10)
- WHEN calling any observation read or write endpoint
- THEN the system returns HTTP 403 Forbidden before reaching the use case

#### Scenario: PSYCHOPEDAGOGICAL type enforced inside use case, not guard

- GIVEN a TEACHER user (rank 20) who passes the rank guard
- WHEN the use case evaluates `type: PSYCHOPEDAGOGICAL` against caller rank < 50
- THEN the use case returns a domain authorization error mapped to HTTP 403
- AND the guard itself does NOT make type-level decisions
