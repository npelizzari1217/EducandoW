# Institution Notifications Specification

## Purpose

Define the notification toggles and WebSocket configuration that control real-time messaging per institution. (Implements R13)

## Requirements

### Requirement: Notification Toggle Fields

The system MUST store `send_messages` (boolean, default `false`), `socket_host` (string?), and `socket_port` (number?) on the `Institution` entity. These fields are optional at creation time.

| Field | Type | Default | Constraint |
|-------|------|---------|-----------|
| `send_messages` | `boolean` | `false` | — |
| `socket_host` | `string?` | — | Valid hostname or IP, max 255 chars |
| `socket_port` | `number?` | — | Integer 1–65535 if provided |

#### Scenario: Default notification values on creation

- GIVEN a ROOT user creating an institution without providing notification fields
- WHEN the institution is persisted
- THEN `send_messages` defaults to `false`, and `socket_host`/`socket_port` are `null`

#### Scenario: Custom socket configuration stored

- GIVEN a ROOT creating an institution with `send_messages: true`, `socket_host: "ws.example.com"`, `socket_port: 3001`
- WHEN the institution is created
- THEN all three fields are stored as provided

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

The `GET /v1/institutions/me` response MUST include `send_messages`, `socket_host`, and `socket_port`. (Ref: R11, R13)

#### Scenario: Notification fields present in /me response

- GIVEN an authenticated user belonging to an institution with `send_messages: true`
- WHEN `GET /v1/institutions/me` is called
- THEN the response includes `send_messages: true`, `socket_host`, and `socket_port`

#### Scenario: Null socket fields returned as null

- GIVEN an institution where `socket_host` and `socket_port` were never set
- WHEN `GET /v1/institutions/me` is called
- THEN `socket_host` and `socket_port` are `null`, and `send_messages` is `false`