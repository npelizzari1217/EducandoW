# Role Hierarchy Specification

## Purpose

Defines the role hierarchy as a domain concept independent of educational level. Higher rank grants management authority over lower-ranked roles. ROOT bypasses all restrictions.

## Requirements

### Requirement: Role Hierarchy Definition

The system SHALL define `ROLE_HIERARCHY` mapping each role to a numeric rank: ROOT=99, ADMIN=60, DIRECTOR=50, SECRETARIO=40, PRECEPTOR=30, TEACHER=20, TUTOR=10, STUDENT=0. These values MUST be treated as constants — not configurable at runtime.

#### Scenario: All hierarchy values are distinct

- GIVEN the ROLE_HIERARCHY constant
- WHEN comparing any two distinct role ranks
- THEN no two different roles SHALL share the same rank value

### Requirement: Role Labels

The system SHALL provide `ROLE_LABELS` mapping each role key to a human-readable Spanish label: ROOT→"Root", ADMIN→"Administrador", DIRECTOR→"Directivo", SECRETARIO→"Secretario", PRECEPTOR→"Preceptor", TEACHER→"Docente", TUTOR→"Tutor", STUDENT→"Alumno".

#### Scenario: Every role has a label

- GIVEN ROLE_HIERARCHY keys
- WHEN checking ROLE_LABELS
- THEN every key in ROLE_HIERARCHY MUST have a corresponding entry in ROLE_LABELS

### Requirement: Highest Role Rank

`getHighestRoleRank(roles)` MUST return the highest numeric rank from an array of role strings. If the array is empty or no role is recognized, it SHALL return -1.

#### Scenario: Multiple roles returns highest

- GIVEN roles `["TEACHER", "DIRECTOR"]`
- WHEN `getHighestRoleRank` is called
- THEN it returns 50 (DIRECTOR's rank)

#### Scenario: Empty array returns -1

- GIVEN an empty roles array
- WHEN `getHighestRoleRank` is called
- THEN it returns -1

#### Scenario: Unrecognized roles are ignored

- GIVEN roles `["UNKNOWN"]`
- WHEN `getHighestRoleRank` is called
- THEN it returns -1

### Requirement: Manage Authorization

`canManageUser(creatorRoles, targetRoles)` MUST determine whether a creator can manage a target user. It SHALL return `true` if creator has ROOT role, or if `getHighestRoleRank(creatorRoles) > getHighestRoleRank(targetRoles)`. It SHALL return `false` if creator has no recognized role (rank -1). Equal ranks MUST NOT grant management rights — the creator's highest rank MUST be strictly greater.

#### Scenario: ROOT manages anyone

- GIVEN creator roles `["ROOT"]` and target roles `["ADMIN"]`
- WHEN `canManageUser` is called
- THEN it returns `true`

#### Scenario: ADMIN manages DIRECTOR

- GIVEN creator roles `["ADMIN"]` and target roles `["DIRECTOR"]`
- WHEN `canManageUser` is called
- THEN it returns `true`

#### Scenario: ADMIN cannot manage another ADMIN

- GIVEN creator roles `["ADMIN"]` and target roles `["ADMIN"]`
- WHEN `canManageUser` is called
- THEN it returns `false`

#### Scenario: TEACHER cannot manage SECRETARIO

- GIVEN creator roles `["TEACHER"]` and target roles `["SECRETARIO"]`
- WHEN `canManageUser` is called
- THEN it returns `false`

#### Scenario: Cross-level management allowed

- GIVEN creator at Nivel Primario with role ADMIN and target at Nivel Secundario with role TEACHER
- WHEN `canManageUser(["ADMIN"], ["TEACHER"])` is called
- THEN it returns `true` — hierarchy is independent of educational level