# Session Config Specification

## Purpose

Define the endpoint and frontend context that loads institution configuration at login, making branding, features, and levels available throughout the session. (Implements R11)

## Requirements

### Requirement: GET /v1/institutions/me Endpoint

A new endpoint `GET /v1/institutions/me` MUST return the full configuration of the institution associated with the authenticated user's JWT. The response MUST include all fields needed by the frontend: identification, contact, branding, notification toggles, SMTP metadata (excluding `smtp_pass`), config, and levels. (Ref: R11)

#### Scenario: Returns full config for authenticated user

- GIVEN an authenticated user with `institutionId: "abc-123"` belonging to "Colegio San Martín"
- WHEN `GET /v1/institutions/me` is called
- THEN the response is HTTP 200 with:
  ```json
  {
    "id": "abc-123",
    "name": "Colegio San Martín",
    "logo_url": "...",
    "header_color": "#1a56db",
    "header_text_color": "#ffffff",
    "body_text_color": "#333333",
    "send_email": true,
    "send_messages": false,
    "socket_host": null,
    "socket_port": null,
    "active": true,
    "levels": ["INICIAL", "PRIMARIO"],
    "db_name": "educandow_abc-123",
    ...other fields
  }
  ```
- AND `smtp_pass` is NOT included in the response

#### Scenario: User without institution receives 404

- GIVEN an authenticated user with `institutionId: null`
- WHEN `GET /v1/institutions/me` is called
- THEN the response is HTTP 404 with an error indicating no institution is associated

### Requirement: InstitutionContext in React

The frontend MUST provide an `InstitutionContext` React context that:

1. Calls `GET /v1/institutions/me` once after successful login
2. Exposes `logo_url`, `header_color`, `header_text_color`, `body_text_color`, `send_email`, `send_messages`, `socket_host`, `socket_port`, `active`, and `levels[]` to all child components
3. Persists for the duration of the session (until logout or token expiration)

#### Scenario: Context loads on login

- GIVEN a user successfully authenticates
- WHEN the app mounts the `InstitutionContext` provider
- THEN it calls `GET /v1/institutions/me`
- AND all children can read `header_color`, `logo_url`, `levels[]`, etc. from the context

#### Scenario: Context gracefully handles fetch failure

- GIVEN a user authenticates but `GET /v1/institutions/me` fails (network error, 500)
- WHEN the `InstitutionContext` provider receives the error
- THEN it MUST fall back to default values (empty `levels[]`, default colors, `send_email: false`, `send_messages: false`, `active: true`)
- AND the application MUST NOT crash — it renders with sensible defaults

### Requirement: Active Levels Filter Navigation

The `levels[]` array from `InstitutionContext` MUST be used to filter the sidebar navigation. Only menu items corresponding to the institution's active levels are displayed. (Ref: R14)

#### Scenario: Sidebar shows only active levels

- GIVEN an institution with `levels: ["INICIAL", "SECUNDARIO"]`
- WHEN the sidebar component renders
- THEN only navigation items for "Inicial" and "Secundario" are visible
- AND items for "Primario" and "Terciario" are hidden

#### Scenario: Empty levels array shows no level navigation

- GIVEN an institution with `levels: []`
- WHEN the sidebar renders
- THEN no level-specific navigation items are displayed
- AND a placeholder or message indicates no levels are configured