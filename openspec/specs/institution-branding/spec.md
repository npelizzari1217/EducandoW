# Institution Branding Specification

## Purpose

Define how institution branding data (logo, header colors, text colors) is stored, validated, and served to clients so each institution can customize its visual identity. (Implements R12)

## Requirements

### Requirement: Branding Field Storage

The system MUST store `logo_url`, `header_color`, `header_text_color`, and `body_text_color` on the `Institution` entity. All four fields are optional at creation time.

| Field | Type | Constraint |
|-------|------|-----------|
| `logo_url` | `string?` | Valid URL if provided, max 500 chars |
| `header_color` | `string?` | Hex color regex `^#[0-9a-fA-F]{6}$` |
| `header_text_color` | `string?` | Hex color regex `^#[0-9a-fA-F]{6}$` |
| `body_text_color` | `string?` | Hex color regex `^#[0-9a-fA-F]{6}$` |

#### Scenario: Valid branding fields accepted

- GIVEN an institution with `header_color: "#1a56db"` and `header_text_color: "#ffffff"`
- WHEN `POST /v1/institutions` is called with these values
- THEN the institution is created with the colors stored exactly as provided

#### Scenario: Invalid hex color rejected

- GIVEN an institution creation request with `header_color: "red"`
- WHEN the request is validated
- THEN the system MUST reject it with a `ValidationError` indicating invalid hex color format

### Requirement: Branding Update

The system MUST allow partial updates to branding fields via `PATCH /v1/institutions/:id` without requiring all four fields. Only ROOT role MAY update branding fields.

#### Scenario: Partial branding update

- GIVEN an existing institution with `header_color: "#1a56db"`
- WHEN `PATCH /v1/institutions/:id` sends `{ "logo_url": "https://cdn.example.com/logo.png" }`
- THEN `logo_url` is updated and all other branding fields remain unchanged

#### Scenario: Non-ROOT user cannot update branding

- GIVEN a user with role ADMIN
- WHEN they attempt to `PATCH /v1/institutions/:id` with branding fields
- THEN the system MUST reject the request with 403 Forbidden

### Requirement: Branding in Session Config

The `GET /v1/institutions/me` response MUST include all four branding fields. (Ref: R11, R12)

#### Scenario: Branding included in /me response

- GIVEN an authenticated user belonging to an institution with `header_color: "#1a56db"`
- WHEN `GET /v1/institutions/me` is called
- THEN the response includes `header_color`, `header_text_color`, `body_text_color`, and `logo_url`

#### Scenario: Null branding fields returned as null

- GIVEN an institution where `logo_url` and `header_color` were never set
- WHEN `GET /v1/institutions/me` is called
- THEN those fields are returned as `null` (not omitted)