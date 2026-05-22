# Institution SMTP Specification

## Purpose

Define how SMTP configuration is stored, encrypted, and managed per institution so each one can send emails through its own mail server. (Implements: global design notes (3)(4)(5), R13)

## Requirements

### Requirement: SMTP Field Storage

The system MUST store `smtp_host`, `smtp_user`, `smtp_pass`, `smtp_encryption`, and `smtp_port` on the `Institution` entity. All SMTP fields are optional at creation time.

| Field | Type | Constraint |
|-------|------|-----------|
| `smtp_host` | `string?` | Max 255 chars, non-empty if provided |
| `smtp_user` | `string?` | Max 255 chars, non-empty if provided |
| `smtp_pass` | `string?` | Encrypted at rest with AES-256-GCM. Stored as ciphertext, never plaintext |
| `smtp_encryption` | `string?` | MUST be `"TLS"`, `"SSL"`, or `"NONE"` if provided |
| `smtp_port` | `number?` | Integer 1–65535 if provided |

When `smtp_pass` is persisted, it MUST be encrypted using AES-256-GCM with a key from the `ENCRYPTION_KEY` environment variable. It MUST be decrypted only when the SMTP connection is established, never stored in session data or API responses.

#### Scenario: SMTP fields stored with encrypted password

- GIVEN a ROOT user creating an institution with `smtp_host: "smtp.example.com"`, `smtp_pass: "secret123"`, `smtp_encryption: "TLS"`, `smtp_port: 587`
- WHEN the institution is persisted
- THEN `smtp_pass` is stored as AES-256-GCM ciphertext in the database
- AND the plaintext password is never written to logs or returned in API responses

#### Scenario: Invalid smtp_encryption rejected

- GIVEN a request with `smtp_encryption: "STARTTLS"`
- WHEN validation runs
- THEN the system MUST reject it with a `ValidationError` indicating valid values are TLS, SSL, or NONE

### Requirement: SMTP Password Encryption Lifecycle

The system MUST encrypt `smtp_pass` before writing to the database and decrypt it only at the point of establishing an SMTP connection. The `ENCRYPTION_KEY` environment variable MUST be 32 bytes. If it is missing or invalid, the application MUST fail to start.

#### Scenario: Missing ENCRYPTION_KEY prevents startup

- GIVEN the `ENCRYPTION_KEY` environment variable is not set
- WHEN the NestJS application starts
- THEN the application MUST fail to start with an error indicating `ENCRYPTION_KEY` is required

#### Scenario: SMTP password not leaked in API responses

- GIVEN an institution with SMTP configuration saved
- WHEN `GET /v1/institutions/:id` or `GET /v1/institutions/me` is called
- THEN the response MUST NOT include `smtp_pass` (neither plaintext nor encrypted)
- AND `smtp_host`, `smtp_user`, `smtp_encryption`, `smtp_port` are included normally

### Requirement: SMTP Conditional Feature Toggle

The `send_email` boolean field controls whether email functionality is active for the institution. This implements R13.

| Field | Type | Default | Constraint |
|-------|------|---------|-----------|
| `send_email` | `boolean` | `false` | — |

- WHEN `send_email` is `false`, the system MUST NOT attempt any SMTP connection and MUST hide email UI sections (Ref: R13).
- WHEN `send_email` is `true` and SMTP fields are incomplete, the system SHOULD log a warning but MUST NOT crash.

#### Scenario: send_email false disables SMTP

- GIVEN an institution with `send_email: false` and valid SMTP configuration
- WHEN the application processes an email-triggering event
- THEN the system MUST skip the email send entirely — no SMTP connection is attempted

#### Scenario: send_email true with missing SMTP config

- GIVEN an institution with `send_email: true` and `smtp_host: null`
- WHEN the application attempts to send an email
- THEN the system SHOULD log a warning like "SMTP not configured for institution {id}"
- AND MUST NOT crash or throw an unhandled exception