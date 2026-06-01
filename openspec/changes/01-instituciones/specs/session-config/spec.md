# Delta for session-config

## Context

Change `01-instituciones` expands the session config spec to: (1) include the full 25-field response from `GET /v1/institutions/me`, (2) add dynamic CSS theming from branding colors, and (3) expose the 25-field create/edit form in the frontend. The existing spec already covers `InstitutionContext`, `/me` endpoint, and sidebar level filtering.

---

## ADDED Requirements

### Requirement: Dynamic CSS Theme from Branding Colors

The frontend MUST apply institution branding colors as CSS custom properties on the document root. When `InstitutionContext` loads, it MUST set `--header-color`, `--header-text-color`, and `--body-text-color` from the institution's branding fields. When a field is `null`, the corresponding CSS variable MUST be set to its design-system default. (Ref: R12)

#### Scenario: CSS variables applied on context load

- GIVEN an institution with `header_color: "#1a56db"`, `header_text_color: "#ffffff"`, `body_text_color: "#333333"`
- WHEN `InstitutionContext` loads and sets the theme
- THEN `document.documentElement` has CSS variables `--header-color: #1a56db`, `--header-text-color: #ffffff`, `--body-text-color: #333333`

#### Scenario: Null branding uses design-system defaults

- GIVEN an institution with all branding fields `null`
- WHEN `InstitutionContext` applies the theme
- THEN CSS variables are set to the design-system defaults (not left unset)

#### Scenario: Theme updates on institution PATCH

- GIVEN a user updates `header_color` via `PATCH /v1/institutions/:id`
- WHEN the frontend re-fetches institution config
- THEN CSS variables are updated immediately without a full page reload

### Requirement: Full 25-Field Institution Form

The frontend institution create/edit form MUST expose all 25 mutable fields, grouped by section. The form MUST be gated by role: ROOT sees all fields including branding, SMTP, and `active`; ADMIN sees identity and contact fields only; ADMIN MUST NOT see `cue`, `active`, or SMTP fields.

#### Scenario: ROOT sees all form sections

- GIVEN a ROOT user opens the institution create/edit form
- WHEN the form renders
- THEN all sections are visible: Identity, Contact, Address, Branding, SMTP, Notifications

#### Scenario: ADMIN sees restricted form sections

- GIVEN an ADMIN user opens the institution edit form for their own institution
- WHEN the form renders
- THEN only Identity and Contact sections are visible
- AND Branding, SMTP, `cue`, and `active` fields are NOT rendered

#### Scenario: Form validation matches domain rules

- GIVEN an ADMIN submitting the form with `contact_email: "invalid"`
- WHEN the form is submitted
- THEN client-side validation rejects with "Invalid email format" before calling the API

---

## MODIFIED Requirements

### Requirement: GET /v1/institutions/me Endpoint

A new endpoint `GET /v1/institutions/me` MUST return the full configuration of the institution associated with the authenticated user's JWT. The response MUST include all 25 fields needed by the frontend: identification (all 10 fields), contact, address, branding, notification toggles, SMTP metadata (excluding `smtp_pass`), config, and levels. (Ref: R11)
(Previously: response was described with partial fields; `contact_email`, address fields, and all identity fields not enumerated)

#### Scenario: Returns full config for authenticated user

- GIVEN an authenticated user with `institutionId: "abc-123"` belonging to "Colegio San Martín"
- WHEN `GET /v1/institutions/me` is called
- THEN the response is HTTP 200 and includes:
  - Identity: `id`, `name`, `contact_email`, `phone`, `address`, `city`, `postal_code`, `country`, `website`, `ministry_reg`, `cue`
  - Branding: `logo_url`, `header_color`, `header_text_color`, `body_text_color`
  - Notifications: `send_email`, `send_messages`, `socket_host`, `socket_port`
  - Lifecycle: `active`, `db_name`
  - Config: `levels[]`
- AND `smtp_pass` is NOT included in the response

#### Scenario: User without institution receives 404

- GIVEN an authenticated user with `institutionId: null`
- WHEN `GET /v1/institutions/me` is called
- THEN the response is HTTP 404 with an error indicating no institution is associated

### Requirement: InstitutionContext in React

The frontend MUST provide an `InstitutionContext` React context that:

1. Calls `GET /v1/institutions/me` once after successful login
2. Exposes all 25 institution fields including `logo_url`, `header_color`, `header_text_color`, `body_text_color`, `send_email`, `send_messages`, `socket_host`, `socket_port`, `active`, `levels[]`, and all identity/address fields
3. Applies CSS variables to the document root on load (see Dynamic CSS Theme requirement)
4. Persists for the duration of the session (until logout or token expiration)
(Previously: context exposed a subset of fields — now exposes all 25)

#### Scenario: Context loads on login

- GIVEN a user successfully authenticates
- WHEN the app mounts the `InstitutionContext` provider
- THEN it calls `GET /v1/institutions/me`
- AND all children can read `header_color`, `logo_url`, `levels[]`, `send_email`, etc. from the context

#### Scenario: Context gracefully handles fetch failure

- GIVEN a user authenticates but `GET /v1/institutions/me` fails (network error, 500)
- WHEN the `InstitutionContext` provider receives the error
- THEN it MUST fall back to default values (empty `levels[]`, default colors, `send_email: false`, `send_messages: false`, `active: true`)
- AND the application MUST NOT crash — it renders with sensible defaults

### Requirement: Active Levels Filter Navigation

The `levels[]` array from `InstitutionContext` MUST be used to filter the sidebar navigation. Only menu items corresponding to the institution's active levels are displayed. (Ref: R14)
(Previously: unchanged — keeping for completeness)

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
