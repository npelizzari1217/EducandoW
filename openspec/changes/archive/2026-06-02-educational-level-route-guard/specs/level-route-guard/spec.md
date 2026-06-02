# Level Route Guard Specification

## Purpose

Route-level authorization enforcing educational-level assignment. Ensures users can only access nivel-specific endpoints matching their assigned levels. Mirrors the existing RolesGuard pattern.

## Requirements

### Requirement: Level Guard Enforcement

Level-scoped endpoints MUST be protected by `LevelsGuard`. The guard MUST compare the user's `levels` array against the required levels declared via `@Levels()`. ROOT users MUST bypass the check unconditionally. When no `@Levels()` metadata is present, the guard MUST default to `true` (pass through).

| Code | Level       |
|------|-------------|
| 1    | INICIAL     |
| 2    | PRIMARIO    |
| 3    | SECUNDARIO  |
| 4    | TERCIARIO   |

Level membership is derived by `Math.floor(compositeCode / 10)`.

#### Scenario: Matching level grants access

- GIVEN a user with `levels: [10]` (INICIAL)
- WHEN the user calls `GET /v1/inicial/salas`
- THEN the guard passes and the response is HTTP 200 OK

#### Scenario: Non-matching level is rejected

- GIVEN a user with `levels: [20]` (PRIMARIO only)
- WHEN the user calls `GET /v1/inicial/salas` (requires INICIAL)
- THEN the guard returns HTTP 403 Forbidden

#### Scenario: User with multiple levels rejected when none match

- GIVEN a user with `levels: [10, 20]` (INICIAL + PRIMARIO)
- WHEN the user calls `GET /v1/secundario/cursos` (requires SECUNDARIO)
- THEN the guard returns HTTP 403 Forbidden

#### Scenario: ROOT bypasses level check

- GIVEN a ROOT user
- WHEN the user calls any nivel-specific endpoint
- THEN the guard passes regardless of the user's `levels` array

#### Scenario: No decorator passes through

- GIVEN a controller method with no `@Levels()` annotation
- WHEN any authenticated user calls that endpoint
- THEN the guard returns `true` and the request proceeds normally

#### Scenario: User with no levels is rejected

- GIVEN a user with `levels: []`
- WHEN the user calls any `@Levels()`-decorated endpoint
- THEN the guard returns HTTP 403 Forbidden

### Requirement: Level Decorator Annotation

Controllers MUST use the `@Levels()` decorator to declare required educational levels. `@Levels()` SHALL be applied at the class level on each nivel-specific controller with the corresponding level code.

| Module           | Decorator         |
|------------------|-------------------|
| nivel-inicial    | `@Levels(1)`      |
| nivel-primario   | `@Levels(2)`      |
| nivel-secundario | `@Levels(3)`      |
| nivel-terciario  | `@Levels(4)`      |

### Requirement: Guard Integration

`LevelsGuard` MUST be registered as a provider in the auth module and applied via `@UseGuards(LevelsGuard)` to all nivel-specific controllers across the four nivel modules.
