# Legajo View Specification

## Purpose

Aggregated student file view combining personal data, enrollment history, grades, and attendance from multiple backend endpoints into a single page. Accessible to ADMIN, MANAGER, and TEACHER roles across ALL pedagogical levels.

## Requirements

### Requirement: Student Search

The legajo page MUST provide a search input that queries `GET /students/search?q={term}` by name or DNI. Results SHALL be scoped to the authenticated user's institution. The search MUST debounce input (≥300ms) to avoid excessive API calls.

#### Scenario: Search by name returns matches

- GIVEN a user on the `/legajos` page with no student selected
- WHEN the user types "García" in the search field
- THEN the system queries `/students/search?q=García` and displays matching students from the same institution

#### Scenario: Search by DNI returns exact match

- GIVEN a user on the `/legajos` page
- WHEN the user types a complete DNI number (e.g., "30123456")
- THEN the system returns the student whose DNI matches exactly

#### Scenario: Empty search shows no results

- GIVEN a user on the `/legajos` page
- WHEN the search field is empty or below minimum length
- THEN no search request is sent and no results are shown

### Requirement: Aggregated Student File Display

Upon selecting a student from search results, the system MUST display four sections in parallel: Datos Personales, Matrículas, Calificaciones, and Asistencia. Each section SHALL load independently — a failure in one section MUST NOT block display of the others.

#### Scenario: All sections load successfully

- GIVEN a user selects a student from search results
- WHEN the system fetches data from all four endpoints
- THEN all sections render with their respective data: personal info, enrollments, grades, attendance

#### Scenario: Partial data renders with error indicator

- GIVEN a user selects a student
- WHEN the attendance endpoint fails but the other three succeed
- THEN Datos Personales, Matrículas, and Calificaciones display normally, and Asistencia shows an error indicator instead of silently failing

#### Scenario: Student with no enrollments shows empty state

- GIVEN a selected student has no enrollment records
- WHEN the Matrículas section renders
- THEN it MUST display an empty-state message (e.g., "Sin matrículas registradas")

#### Scenario: Student with no grades shows empty state

- GIVEN a selected student has no grade records
- WHEN the Calificaciones section renders
- THEN it MUST display an empty-state message

#### Scenario: Student with no attendance records shows empty state

- GIVEN a selected student has no attendance records
- WHEN the Asistencia section renders
- THEN it MUST display an empty-state message

### Requirement: Role-Based Access

The `/legajos` route MUST be accessible only to users with ADMIN, MANAGER, or TEACHER roles. Users with other roles (STUDENT, TUTOR, etc.) SHALL be denied access. The sidebar item for Legajos MUST only appear for institutions with configured pedagogical levels.

#### Scenario: ADMIN accesses legajo page

- GIVEN an ADMIN user authenticated with a valid JWT
- WHEN they navigate to `/legajos`
- THEN the page loads with full search and display capabilities

#### Scenario: STUDENT is denied access

- GIVEN a STUDENT role user
- WHEN they attempt to navigate to `/legajos`
- THEN the system MUST redirect them away or show an access-denied state

#### Scenario: Sidebar visibility requires configured levels

- GIVEN an institution with no configured pedagogical levels
- WHEN any user views the sidebar
- THEN the "Legajos" item MUST NOT appear
