# Smart Course Creation Specification

## Purpose

Replaces the generic course section form with an intelligent form that auto-fills context the system already knows: academic cycle, educational level, institution, and generates the course name from grade + division.

## Requirements

### Requirement: Auto-fill Academic Cycle

The form SHALL auto-fill the academic cycle field by calling `GET /v1/academic-cycles?active=true&institutionId={id}&level={level}` on mount. The field SHALL be readonly.

#### Scenario: Active cycle auto-fills on form load

- GIVEN an active cycle exists for the user's institution and level
- WHEN the user opens the course creation form
- THEN the academic cycle field SHALL display the cycle name, readonly
- AND the cycle ID SHALL be included in the creation payload

#### Scenario: No active cycle shows current year fallback

- GIVEN no active cycle exists for the user's institution and level
- WHEN the user opens the course creation form
- THEN the academic year field SHALL display the current calendar year as fallback
- AND a warning message SHALL indicate no active cycle was found

### Requirement: Auto-fill Educational Level from User Context

The form SHALL derive the educational level from `user.level` in the JWT. If `user.level` maps to a specific level (1–4), the field SHALL be readonly with the level name displayed. If `user.level` is `9` (ADMINISTRACION) or absent, the field SHALL render as a dropdown with all levels.

#### Scenario: Specific level user sees readonly field

- GIVEN a user with `level=2` (PRIMARIO) in their JWT
- WHEN the user opens the course creation form
- THEN the level field SHALL display "PRIMARIO" as readonly

#### Scenario: ADMIN level user sees dropdown

- GIVEN a user with `level=9` (ADMINISTRACION) in their JWT
- WHEN the user opens the course creation form
- THEN the level field SHALL render a dropdown with all available levels

### Requirement: Grade and Division Replace Name Input

The form SHALL NOT display a `name` input field. Instead, it SHALL provide a `grade` field (required) and a `division` field (optional). The course name SHALL be auto-generated as `"{grade} {division}"`.

#### Scenario: Name auto-generated from grade and division

- GIVEN the user enters grade "5to" and division "A"
- WHEN the user submits the form
- THEN the payload SHALL contain `name: "5to A"`, `grade: "5to"`, `division: "A"`

#### Scenario: Name auto-generated from grade only

- GIVEN the user enters grade "3ro" and leaves division empty
- WHEN the user submits the form
- THEN the payload SHALL contain `name: "3ro"`, `grade: "3ro"`, `division` omitted

#### Scenario: Grade is required

- GIVEN the user leaves grade empty
- WHEN the user submits the form
- THEN the form SHALL NOT submit and SHALL display a validation error on the grade field

### Requirement: Auto-fill Institution from User Context

The form SHALL auto-fill the institution from `user.institutionId` in the JWT. The institution name (via `useInstitution().config.name`) SHALL be displayed. The institution ID SHALL be stored in the payload. The field SHALL be readonly.

#### Scenario: Institution auto-filled and readonly

- GIVEN a user with `institutionId` in their JWT
- WHEN the user opens the course creation form
- THEN the institution field SHALL display the institution name, readonly
- AND `institutionId` SHALL be included in the creation payload

#### Scenario: Missing institutionId prevents creation

- GIVEN a user without `institutionId` in their JWT
- WHEN the user opens the course creation form
- THEN the form SHALL display an error: "No institution assigned to your account"
- AND the submit button SHALL be disabled

### Requirement: Backend Name Auto-generation

When `name` is not provided in `CreateCourseSectionDTO`, the use case SHALL generate `name` from `grade` and `division`. The `name` field in the DTO SHALL become optional.

#### Scenario: Use case generates name from grade and division

- GIVEN a creation request with `grade="1ro"` and `division="B"` but no `name`
- WHEN the use case executes
- THEN the persisted entity SHALL have `name="1ro B"`

#### Scenario: Use case rejects missing grade without name

- GIVEN a creation request with no `name` and no `grade`
- WHEN the use case executes
- THEN the use case SHALL return an error indicating either `name` or `grade` is required
