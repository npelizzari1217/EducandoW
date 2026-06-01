# Institution Branding Specification

## Purpose

Define how institution branding data (logo, header colors, text colors) is stored, validated, and served to clients so each institution can customize its visual identity. (Implements R12)

## Requirements

### Requirement: HexColor Value Object Validation

The system MUST enforce hex color validation via a `HexColor` immutable Value Object. A `HexColor` MUST be rejected at the domain boundary — not only at the DTO layer — if the value does not match `^#[0-9a-fA-F]{6}$`. The domain entity MUST NOT accept a raw string for any color field.

#### Scenario: HexColor VO rejects non-hex at domain layer

- GIVEN a color string `"red"` (not a valid hex)
- WHEN the `HexColor` Value Object is constructed
- THEN a domain `ValidationError` is thrown with message indicating invalid hex format
- AND the Institution entity is never persisted

#### Scenario: HexColor VO accepts canonical hex

- GIVEN a color string `"#1a56db"`
- WHEN the `HexColor` Value Object is constructed
- THEN it succeeds and `.value` returns `"#1a56db"` unchanged

#### Scenario: HexColor VO is case-insensitive on input but stores as provided

- GIVEN a color string `"#1A56DB"`
- WHEN the `HexColor` Value Object is constructed
- THEN it succeeds — uppercase hex digits are valid per the regex

### Requirement: Branding Field Storage

The system MUST store `logo_url`, `header_color`, `header_text_color`, and `body_text_color` on the `Institution` entity. All four fields are optional at creation time. Color fields MUST be modelled as `HexColor` Value Objects in the domain layer; the repository maps them to plain strings for persistence.

| Field | Type | Constraint |
|-------|------|-----------|
| `logo_url` | `string?` | Valid URL if provided, max 500 chars |
| `header_color` | `HexColor?` | Hex regex `^#[0-9a-fA-F]{6}$` enforced by VO |
| `header_text_color` | `HexColor?` | Hex regex `^#[0-9a-fA-F]{6}$` enforced by VO |
| `body_text_color` | `HexColor?` | Hex regex `^#[0-9a-fA-F]{6}$` enforced by VO |

#### Scenario: Valid branding fields accepted

- GIVEN an institution with `header_color: "#1a56db"` and `header_text_color: "#ffffff"`
- WHEN `POST /v1/institutions` is called with these values
- THEN the institution is created with the colors stored exactly as provided

#### Scenario: Invalid hex color rejected at domain

- GIVEN an institution creation request with `header_color: "red"`
- WHEN the domain entity is constructed
- THEN the system MUST reject it with a `ValidationError` indicating invalid hex color format
- AND the rejection MUST occur before any database write

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
