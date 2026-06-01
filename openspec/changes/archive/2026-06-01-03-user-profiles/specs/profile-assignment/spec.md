# Profile Assignment Specification

> **New capability**: profile-assignment
> **Change**: 03-user-profiles

## Purpose

Automatic generation of `UserModule` records from a profile template at user creation or update time. Converts the profile's boolean permission matrix into `String[] actions` and creates the corresponding `UserModule` rows, with full respect for the existing `filterModuleAccess()` scoping rules.

## Requirements

### Requirement: Boolean-to-Actions Conversion

The system MUST implement a deterministic conversion from `ProfileModulePermission` booleans to `String[] actions` using the following fixed mapping:

| Boolean column | Action string |
|----------------|---------------|
| `canRead`      | `READ`        |
| `canCreate`    | `CREATE`      |
| `canEdit`      | `UPDATE`      |
| `canDelete`    | `DELETE`      |
| `canPrint`     | `PRINT`       |

Only booleans set to `true` SHALL produce an action entry. `false` values MUST be omitted. This conversion MUST be applied on every profile-to-user assignment.

#### Scenario: All-true profile produces 5-action array

- GIVEN a `ProfileModulePermission` row with all 5 booleans `true`
- WHEN the conversion function runs for that module
- THEN the output is `["READ", "CREATE", "UPDATE", "DELETE", "PRINT"]`

#### Scenario: Partial booleans produce filtered array

- GIVEN a `ProfileModulePermission` row with canRead=true, canCreate=true, others false
- WHEN the conversion function runs
- THEN the output is `["READ", "CREATE"]`

#### Scenario: All-false row produces empty array

- GIVEN a `ProfileModulePermission` row with all booleans `false`
- WHEN the conversion function runs
- THEN the output is `[]` (no UserModule entry created for this module)

### Requirement: Profile Assignment on User Create

When `profileId` is provided in `POST /v1/users`, the system MUST load the profile's `ProfileModulePermission` rows, apply boolean→actions conversion, and create `UserModule` records for each module with at least one action. The resulting module list MUST then pass through `filterModuleAccess()` (non-ROOT creators may only assign modules they themselves possess). The `profileId` value MUST be persisted on the `User` record.

#### Scenario: profileId on create generates user_modules

- GIVEN profile "Docente Básico" with STUDENTS(canRead=true), GRADES(canRead=true, canCreate=true)
- WHEN `POST /v1/users` with `{ ..., profileId: "<uuid>" }` by ROOT
- THEN `user_modules` entries for STUDENTS:READ, GRADES:READ, GRADES:CREATE are persisted
- AND the user record has `profileId` set

#### Scenario: filterModuleAccess applied to profile-derived modules

- GIVEN a DIRECTOR with modules [STUDENTS] creating a user with profileId containing GRADES and STUDENTS
- WHEN `POST /v1/users` with `{ profileId: "<uuid>" }` is called
- THEN GRADES is silently filtered (DIRECTOR does not possess it)
- AND only STUDENTS:READ (or whatever DIRECTOR has) is persisted

#### Scenario: profileId and moduleAccess together — moduleAccess wins per-module

- GIVEN profile "Docente" with STUDENTS(canRead=true), GRADES(canRead=true, canCreate=true)
- WHEN `POST /v1/users` with `{ profileId, moduleAccess: [{ moduleCode: "STUDENTS", actions: ["READ", "CREATE"] }] }` by ROOT
- THEN STUDENTS uses manual actions (READ, CREATE) — profile value overridden
- AND GRADES uses profile values (READ, CREATE) — no manual entry provided
- AND `profileId` is persisted on the user record

### Requirement: Profile Assignment on User Update

When `profileId` is provided in `PATCH /v1/users/:id`, the system SHALL delete ALL existing `UserModule` records for the user, load the new profile's permissions, apply conversion, and recreate `UserModule` records. Setting `profileId` to `null` SHALL remove the profile association from the user record but SHALL NOT delete existing `UserModule` records. Absent `profileId` in the patch body SHALL NOT alter the user's current `profileId`.

#### Scenario: New profileId on update replaces all user_modules

- GIVEN a user with `profileId: "P1"` and existing `user_modules` from profile P1
- WHEN `PATCH /v1/users/:id` with `{ profileId: "P2" }`
- THEN all existing `user_modules` for this user are deleted
- AND new `user_modules` are created from profile P2's permissions
- AND the user's `profileId` is updated to "P2"

#### Scenario: profileId null removes association without touching user_modules

- GIVEN a user with `profileId` set and existing `user_modules`
- WHEN `PATCH /v1/users/:id` with `{ profileId: null }`
- THEN the user's `profileId` is set to `null`
- AND existing `user_modules` remain unchanged

#### Scenario: Absent profileId on update preserves existing association

- GIVEN a user with `profileId: "P1"` set
- WHEN `PATCH /v1/users/:id` with `{ name: "New Name" }` (no `profileId` field)
- THEN the user's `profileId` remains "P1" unchanged
