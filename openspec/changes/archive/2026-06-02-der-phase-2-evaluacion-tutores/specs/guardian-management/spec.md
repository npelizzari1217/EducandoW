# Guardian Management Specification

## Purpose

UI + endpoint for student–guardian assignments with boolean flags.

## Requirements

### Requirement: Guardian List UI

MUST show guardians via `GET /v1/students/:id/guardians` with `userId`, `relationship`, `isFinancialResponsible`, `isAuthorizedToPickUp`.

#### Scenario: List and empty state
- GIVEN student with guardians → both shown with flags
- GIVEN student with none → empty state shown

### Requirement: Assign Guardian

MUST call `POST /v1/students/:id/guardians` with `userId` + `relationship`. ADMIN/ROOT only.

#### Scenario: Assign and duplicate
- GIVEN ADMIN and valid `userId` → guardian added to list (HTTP 201)
- GIVEN same `userId` already assigned → HTTP 409; UI shows conflict

### Requirement: Remove Guardian

MUST call `DELETE /v1/students/:id/guardians/:guardianId` with confirmation. ADMIN/ROOT only.

#### Scenario: Remove
- GIVEN assignment exists and user confirms
- THEN record deleted; entry removed from UI

### Requirement: GET /students/:id/guardians Endpoint

MUST return `{ id, userId, relationship, isFinancialResponsible, isAuthorizedToPickUp }[]`. JWT required; ADMIN, ROOT, TUTOR (own students).

#### Scenario: Returns list / not found
- GIVEN student with records + ADMIN token → HTTP 200 with all objects
- GIVEN unknown student id → HTTP 404
