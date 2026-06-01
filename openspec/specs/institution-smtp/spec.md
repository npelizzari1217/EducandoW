# Institution SMTP Specification

## Purpose

Define how SMTP configuration is stored, encrypted, and managed per institution so each one can send emails through its own mail server. (Implements: global design notes (3)(4)(5), R13)

## Requirements

### Requirement: SmtpConfig Value Object

The SMTP configuration fields MUST be grouped as a `SmtpConfig` immutable Value Object at the domain layer. The VO MUST enforce: `smtp_encryption` is one of `"TLS"`, `"SSL"`, `"NONE"`; `smtp_port` is an integer in 1–65535; `smtp_host` and `smtp_user` are non-empty strings when provided; `smtp_pass` is stored as AES-256-GCM ciphertext. A `SmtpConfig` with all fields `null` represents "not configured" and MUST be valid.

#### Scenario: SmtpConfig VO rejects invalid encryption value

- GIVEN `smtp_encryption: "STARTTLS"` passed to `SmtpConfig`
- WHEN the Value Object is constructed
- THEN a domain `ValidationError` is thrown with valid values listed: TLS, SSL, NONE
- AND the Institution entity is never persisted

#### Scenario: SmtpConfig VO rejects out-of-range port

- GIVEN `smtp_port: 0` passed to `SmtpConfig`
- WHEN the Value Object is constructed
- THEN a domain `ValidationError` is thrown indicating port must be 1–65535

#### Scenario: SmtpConfig with all null fields is valid

- GIVEN an institution creation request with no SMTP fields provided
- WHEN `SmtpConfig` is constructed with all `null` values
- THEN it succeeds and represents "not configured"

### Requirement: SMTP Field Storage

The system MUST store `smtp_host`, `smtp_user`, `smtp_pass`, `smtp_encryption`, and `smtp_port` on the `Institution` entity via the `SmtpConfig` Value Object. All SMTP fields are optional at creation time. The domain entity MUST NOT accept raw strings for SMTP fields — it MUST receive a `SmtpConfig` VO.

| Field | Type | Constraint |
|-------|------|-----------|
| `smtp_host` | `string?` | Max 255 chars, non-empty if provided |
| `smtp_user` | `string?` | Max 255 chars, non-empty if provided |
| `smtp_pass` | `string?` | Encrypted at rest with AES-256-GCM; stored as ciphertext, never plaintext |
| `smtp_encryption` | `string?` | MUST be `"TLS"`, `"SSL"`, or `"NONE"` if provided — enforced by `SmtpConfig` VO |
| `smtp_port` | `number?` | Integer 1–65535 if provided — enforced by `SmtpConfig` VO |

When `smtp_pass` is persisted, it MUST be encrypted using AES-256-GCM with a key from the `ENCRYPTION_KEY` environment variable. It MUST be decrypted only when the SMTP connection is established, never stored in session data or API responses.

#### Scenario: SMTP fields stored with encrypted password

- GIVEN a ROOT user creating an institution with `smtp_host: "smtp.example.com"`, `smtp_pass: "secret123"`, `smtp_encryption: "TLS"`, `smtp_port: 587`
- WHEN the institution is persisted
- THEN `smtp_pass` is stored as AES-256-GCM ciphertext in the database
- AND the plaintext password is never written to logs or returned in API responses

#### Scenario: Invalid smtp_encryption rejected at domain

- GIVEN a request with `smtp_encryption: "STARTTLS"`
- WHEN the `SmtpConfig` Value Object is constructed
- THEN the system MUST reject it with a `ValidationError` indicating valid values are TLS, SSL, or NONE

### Requirement: SMTP Password Encryption Lifecycle

The system MUST encrypt `smtp_pass` before writing to the database and decrypt it only at the point of establishing an SMTP connection. The `ENCRYPTION_KEY` environment variable MUST be 32 bytes. If it is missing or invalid, the application MUST fail to start with an explicit bootstrap error — this check MUST run as an NestJS module initialization guard, not deferred to first SMTP use.

#### Scenario: Missing ENCRYPTION_KEY prevents startup

- GIVEN the `ENCRYPTION_KEY` environment variable is not set
- WHEN the NestJS application starts
- THEN the application MUST fail to start with an error indicating `ENCRYPTION_KEY` is required
- AND the error MUST appear before the HTTP server binds to any port

#### Scenario: ENCRYPTION_KEY with wrong length prevents startup

- GIVEN `ENCRYPTION_KEY` is set but its decoded byte length is not 32
- WHEN the NestJS application starts
- THEN the application MUST fail to start with an error indicating `ENCRYPTION_KEY` must be 32 bytes

#### Scenario: SMTP password not leaked in API responses

- GIVEN an institution with SMTP configuration saved
- WHEN `GET /v1/institutions/:id` or `GET /v1/institutions/me` is called
- THEN the response MUST NOT include `smtp_pass` (neither plaintext nor encrypted)
- AND `smtp_host`, `smtp_user`, `smtp_encryption`, `smtp_port` are included normally

### Requirement: SMTP Conditional Feature Toggle

The `send_email` boolean field controls whether email functionality is active for the institution. Ownership of the `send_email` flag is in `institution-notifications`; the SMTP spec governs its effect on SMTP behavior only. This implements R13.

| Field | Type | Default | Constraint |
|-------|------|---------|-----------|
| `send_email` | `boolean` | `false` | Owned by institution-notifications; referenced here for SMTP behavior |

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
