# Institution Notifications Specification

## Purpose

Define the notification toggles and WebSocket configuration that control real-time messaging per institution. (Implements R13)

## Requirements

### Requirement: Notification Toggle Fields

The system MUST store `send_messages` (boolean, default `false`), `socket_host` (string?), and `socket_port` (number?) on the `Institution` entity. These fields are optional at creation time. The `send_email` field (boolean, default `false`) is co-located in the same model section and governed by this requirement alongside `send_messages`.

| Field | Type | Default | Constraint |
|-------|------|---------|-----------|
| `send_email` | `boolean` | `false` | — |
| `send_messages` | `boolean` | `false` | — |
| `socket_host` | `string?` | — | Valid hostname or IP, max 255 chars |
| `socket_port` | `number?` | — | Integer 1–65535 if provided |

#### Scenario: Default notification values on creation

- GIVEN a ROOT user creating an institution without providing notification fields
- WHEN the institution is persisted
- THEN `send_email` and `send_messages` both default to `false`
- AND `socket_host`/`socket_port` are `null`

#### Scenario: Custom socket configuration stored

- GIVEN a ROOT creating an institution with `send_messages: true`, `socket_host: "ws.example.com"`, `socket_port: 3001`
- WHEN the institution is created
- THEN all three fields are stored as provided

### Requirement: send_email as Notification Feature Flag

The `send_email` boolean field MUST be modelled as part of the notification configuration alongside `send_messages`. When `send_email` is `false`, the frontend MUST hide all email-related UI sections. This implements R13 for the email channel.

| Field | Type | Default | Constraint |
|-------|------|---------|-----------|
| `send_email` | `boolean` | `false` | — |

#### Scenario: send_email false hides email UI

- GIVEN an institution with `send_email: false`
- WHEN `InstitutionContext` loads the institution config
- THEN all email-related UI sections (compose, inbox, send buttons) MUST be hidden
- AND no SMTP connection is attempted

#### Scenario: send_email defaults to false on creation

- GIVEN a ROOT user creating an institution without providing `send_email`
- WHEN the institution is persisted
- THEN `send_email` defaults to `false`

#### Scenario: send_email true reveals email UI

- GIVEN an institution with `send_email: true`
- WHEN `InstitutionContext` loads
- THEN email UI sections are visible and enabled

### Requirement: send_messages Controls WebSocket Connection

When `send_messages` is `false`, the frontend MUST NOT initiate a WebSocket connection. When `send_messages` is `true`, the frontend SHOULD connect to `socket_host:socket_port` for real-time messaging. This implements R13.

#### Scenario: send_messages false prevents WebSocket

- GIVEN an institution with `send_messages: false`
- WHEN the frontend loads `InstitutionContext`
- THEN the WebSocket connection MUST NOT be initiated
- AND any real-time messaging UI components MUST be hidden or disabled

#### Scenario: send_messages true enables WebSocket

- GIVEN an institution with `send_messages: true`, `socket_host: "ws.school.edu"`, `socket_port: 3001`
- WHEN the frontend loads `InstitutionContext`
- THEN the WebSocket client SHOULD connect to `ws.school.edu:3001`

### Requirement: Notification Fields in Session Config

The `GET /v1/institutions/me` response MUST include `send_email`, `send_messages`, `socket_host`, and `socket_port`. (Ref: R11, R13)

#### Scenario: Notification fields present in /me response

- GIVEN an authenticated user belonging to an institution with `send_messages: true`
- WHEN `GET /v1/institutions/me` is called
- THEN the response includes `send_email`, `send_messages`, `socket_host`, and `socket_port`

#### Scenario: Null socket fields returned as null

- GIVEN an institution where `socket_host` and `socket_port` were never set
- WHEN `GET /v1/institutions/me` is called
- THEN `socket_host` and `socket_port` are `null`, `send_messages` is `false`, and `send_email` is `false`

### Requirement: Notification Fields Exposed via /me

The `GET /v1/institutions/me` response MUST include `send_email`, `send_messages`, `socket_host`, and `socket_port` together. Both flags and both socket fields MUST be present as a coherent group. (Ref: R11, R13)

#### Scenario: All notification fields in /me response

- GIVEN an institution with `send_email: true`, `send_messages: false`, `socket_host: null`, `socket_port: null`
- WHEN `GET /v1/institutions/me` is called
- THEN the response includes all four fields with their exact stored values
