# Spec: institution-settings (delta)

## ADDED Requirements

### Requirement: Body background color for prints
The Institution entity SHALL store an optional `bodyColor` field of type HexColor representing the background color of the document body in institutional prints.

#### Scenario: Create institution with body color
- **Given** a valid hex color string `#f0f4f8`
- **When** an institution is created with `body_color: "#f0f4f8"`
- **Then** the institution stores `bodyColor` as a HexColor value object with value `#f0f4f8`

#### Scenario: Update institution body color
- **Given** an existing institution without `bodyColor`
- **When** the institution is updated with `body_color: "#e2e8f0"`
- **Then** the institution stores `bodyColor` with value `#e2e8f0`

#### Scenario: Null body color by default
- **Given** a new institution created without `body_color`
- **Then** `bodyColor` SHALL be undefined (null in response)

### Requirement: Footer background color for prints
The Institution entity SHALL store an optional `footerColor` field of type HexColor representing the background color of the document footer in institutional prints.

#### Scenario: Create institution with footer color
- **Given** a valid hex color string `#1e293b`
- **When** an institution is created with `footer_color: "#1e293b"`
- **Then** the institution stores `footerColor` as a HexColor value object with value `#1e293b`

#### Scenario: Null footer color by default
- **Given** a new institution created without `footer_color`
- **Then** `footerColor` SHALL be undefined

### Requirement: Footer text color for prints
The Institution entity SHALL store an optional `footerTextColor` field of type HexColor representing the text color of the document footer in institutional prints.

#### Scenario: Create institution with footer text color
- **Given** a valid hex color string `#ffffff`
- **When** an institution is created with `footer_text_color: "#ffffff"`
- **Then** the institution stores `footerTextColor` as a HexColor value object with value `#ffffff`

#### Scenario: Invalid hex color rejected
- **Given** an invalid color string `rgb(255,0,0)`
- **When** an institution is created or updated with `body_color: "rgb(255,0,0)"`
- **Then** the operation SHALL return a validation error

## Validation Rules
- All 3 fields MUST match regex `/^#[0-9a-fA-F]{6}$/` when provided
- All 3 fields are OPTIONAL — undefined/null is valid
- The fields follow the same pattern as existing `headerColor`, `headerTextColor`, `bodyTextColor`
