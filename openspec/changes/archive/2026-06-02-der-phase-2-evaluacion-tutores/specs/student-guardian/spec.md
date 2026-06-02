# Delta for Student Guardian

## MODIFIED Requirements

### Requirement: StudentGuardian Entity

SHALL define `StudentGuardian` with `studentId`, `userId`, `relationship`, `isFinancialResponsible` (Boolean, default `false`), `isAuthorizedToPickUp` (Boolean, default `false`). Composite `(studentId, userId)` unique. `userId` references master User without DB FK.
(Previously: no boolean flags)

#### Scenario: Defaults on create
- GIVEN `{ studentId: "s1", userId: "u1", relationship: "mother" }`
- THEN both booleans default to `false`; HTTP 201

#### Scenario: Explicit flags persisted
- GIVEN `{ ..., isFinancialResponsible: true, isAuthorizedToPickUp: false }`
- THEN those values stored exactly

#### Scenario: Duplicate rejected
- GIVEN pair `(s1, u1)` exists
- THEN HTTP 409

#### Scenario: Cross-DB — no FK enforcement
- GIVEN unknown `userId` → warning logged; operation proceeds

---

### Requirement: Assign Guardian to Student

`POST /v1/students/:id/guardians` body: `userId` (required), `relationship` (required), `isFinancialResponsible` (optional, default `false`), `isAuthorizedToPickUp` (optional, default `false`). ROOT/ADMIN only.
(Previously: body had only userId and relationship)

#### Scenario: ADMIN assigns
- GIVEN ADMIN and `{ userId, relationship: "father" }`
- THEN record created; booleans default `false`; HTTP 201

#### Scenario: TUTOR blocked → HTTP 403; missing `relationship` → HTTP 400

## ADDED Requirements

### Requirement: Retrieve Guardians for Student

`GET /v1/students/:id/guardians` MUST return `{ id, userId, relationship, isFinancialResponsible, isAuthorizedToPickUp }` per record. Auth required.

#### Scenario: Returns list
- GIVEN student with two records and valid token
- THEN HTTP 200 with both records

#### Scenario: Empty list → HTTP 200 `[]`
