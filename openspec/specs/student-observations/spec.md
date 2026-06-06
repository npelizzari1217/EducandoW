# Student Observations Specification

## Purpose

Defines requirements for recording and retrieving pedagogical and psychopedagogical free-text observations per student. Access is gated by role rank: creation and listing are restricted to TEACHER+ (rank ≥ 20), while PSYCHOPEDAGOGICAL observations are restricted to DIRECTOR+ (rank ≥ 50). Deletion is restricted to the observation author or ADMIN+.

## Requirements

### Requirement: Create Observation

The system MUST allow authenticated users with rank ≥ 20 (TEACHER+) to create PEDAGOGICAL observations. Creating a PSYCHOPEDAGOGICAL observation MUST require rank ≥ 50 (DIRECTOR+). Each observation MUST record `studentId`, `type`, `content`, `authorId`, and `createdAt`. `content` MUST NOT be empty.

#### Scenario: TEACHER creates PEDAGOGICAL observation

- GIVEN a TEACHER user (rank 20) authenticated via JWT
- WHEN `POST /v1/student-observations` is called with `{ studentId: "<id>", type: "PEDAGOGICAL", content: "Alumno muestra avances en lectura" }`
- THEN the observation is persisted and HTTP 201 is returned with the created observation

#### Scenario: TEACHER rejected creating PSYCHOPEDAGOGICAL observation

- GIVEN a TEACHER user (rank 20)
- WHEN `POST /v1/student-observations` is called with `{ studentId: "<id>", type: "PSYCHOPEDAGOGICAL", content: "..." }`
- THEN the system returns HTTP 403 Forbidden

#### Scenario: DIRECTOR creates PSYCHOPEDAGOGICAL observation

- GIVEN a DIRECTOR user (rank 50)
- WHEN `POST /v1/student-observations` is called with `{ studentId: "<id>", type: "PSYCHOPEDAGOGICAL", content: "Seguimiento EOE" }`
- THEN the observation is persisted and HTTP 201 is returned

#### Scenario: Empty content is rejected

- GIVEN any authorized user
- WHEN `POST /v1/student-observations` is called with `{ studentId: "<id>", type: "PEDAGOGICAL", content: "" }`
- THEN the system returns HTTP 400 Bad Request

#### Scenario: STUDENT role rejected from creating

- GIVEN a STUDENT user (rank 0)
- WHEN `POST /v1/students/:studentId/observations` is called
- THEN the system returns HTTP 403 Forbidden

### Requirement: List Observations by Student

The system MUST allow users with rank ≥ 20 to retrieve observations for a given student. PSYCHOPEDAGOGICAL observations MUST be excluded from responses for callers with rank < 50. The response MUST include `id`, `type`, `content`, `authorId`, `createdAt`.

#### Scenario: TEACHER lists observations — PSYCHOPEDAGOGICAL hidden

- GIVEN a student with one PEDAGOGICAL and one PSYCHOPEDAGOGICAL observation
- WHEN a TEACHER (rank 20) calls `GET /v1/students/:studentId/observations`
- THEN only the PEDAGOGICAL observation is returned

#### Scenario: DIRECTOR lists observations — all visible

- GIVEN a student with one PEDAGOGICAL and one PSYCHOPEDAGOGICAL observation
- WHEN a DIRECTOR (rank 50) calls `GET /v1/students/:studentId/observations`
- THEN both observations are returned

#### Scenario: Unauthorized role receives 403

- GIVEN a TUTOR user (rank 10)
- WHEN `GET /v1/students/:studentId/observations` is called
- THEN the system returns HTTP 403 Forbidden

### Requirement: List Observations by Course

The system MUST allow users with rank ≥ 20 to list all observations for students in a given course. The same role-based PSYCHOPEDAGOGICAL filtering (rank < 50) MUST apply. The response MUST group or identify observations by student.

#### Scenario: TEACHER lists course observations — filtered

- GIVEN a course with two students, each having PEDAGOGICAL and PSYCHOPEDAGOGICAL observations
- WHEN a TEACHER (rank 20) calls `GET /v1/courses/:cycleId/observations`
- THEN only PEDAGOGICAL observations are returned for all students

#### Scenario: DIRECTOR lists course observations — unfiltered

- GIVEN the same course and observations
- WHEN a DIRECTOR (rank 50) calls `GET /v1/courses/:cycleId/observations`
- THEN all observations (PEDAGOGICAL and PSYCHOPEDAGOGICAL) are returned

### Requirement: Delete Observation

The system MUST allow deletion of an observation by its author (any rank) or by a user with rank ≥ 60 (ADMIN+). Any other caller MUST receive HTTP 403.

#### Scenario: Author deletes own observation

- GIVEN a TEACHER who created observation #42
- WHEN `DELETE /v1/observations/42` is called by that same TEACHER
- THEN the observation is deleted and HTTP 204 is returned

#### Scenario: ADMIN deletes any observation

- GIVEN an observation created by a TEACHER
- WHEN an ADMIN (rank 60) calls `DELETE /v1/observations/:id`
- THEN the observation is deleted and HTTP 204 is returned

#### Scenario: Non-author TEACHER cannot delete another's observation

- GIVEN observation #42 authored by TEACHER-A
- WHEN TEACHER-B (different user, rank 20) calls `DELETE /v1/observations/42`
- THEN the system returns HTTP 403 Forbidden

#### Scenario: Deleting non-existent observation returns 404

- GIVEN no observation exists with the requested id
- WHEN `DELETE /v1/observations/:id` is called by any authorized user
- THEN the system returns HTTP 404 Not Found
