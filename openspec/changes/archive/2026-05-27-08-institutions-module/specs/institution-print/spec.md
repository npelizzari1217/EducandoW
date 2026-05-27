# Institution Print Specification

## Purpose

Print endpoint and UI controls for producing institution data output. Only ROOT users with INSTITUTIONS:PRINT permission MAY trigger institution printing.

## Requirements

### Requirement: Print Institution Endpoint

`GET /v1/institutions/:id/print` MUST return the institution's complete data formatted for print output. The endpoint MUST use `@Roles('ROOT', { module: 'INSTITUTIONS', action: 'PRINT' })`.

#### Scenario: ROOT prints an institution

- GIVEN a ROOT user with INSTITUTIONS:PRINT permission
- WHEN `GET /v1/institutions/:id/print` is called with a valid UUID
- THEN the system returns HTTP 200 with full institution data formatted for print

#### Scenario: Institution not found

- GIVEN a ROOT user
- WHEN `GET /v1/institutions/nonexistent-uuid/print`
- THEN the system MUST return HTTP 404 Not Found

#### Scenario: ADMIN cannot print

- GIVEN an ADMIN user (not ROOT)
- WHEN `GET /v1/institutions/:id/print`
- THEN the system MUST return HTTP 403 Forbidden

#### Scenario: Unauthenticated request rejected

- GIVEN a request without a valid JWT
- WHEN `GET /v1/institutions/:id/print`
- THEN the system MUST return HTTP 401 Unauthorized

### Requirement: Print Button in UI

The institutions list MUST display a "Print" action for each institution row visible to ROOT users with INSTITUTIONS:PRINT permission. ADMIN users MUST NOT see this action.

#### Scenario: ROOT sees print button

- GIVEN a ROOT user with INSTITUTIONS:PRINT permission viewing the institutions list
- WHEN an institution row is rendered
- THEN a "Print" action is visible on the row

#### Scenario: ADMIN does not see print button

- GIVEN an ADMIN user viewing the institutions list or their own institution
- THEN the "Print" action MUST NOT be visible anywhere

#### Scenario: Print button triggers print flow

- GIVEN a ROOT user who clicks "Print" on an institution
- WHEN the print endpoint responds successfully
- THEN the browser print dialog opens with the institution data rendered for paper output