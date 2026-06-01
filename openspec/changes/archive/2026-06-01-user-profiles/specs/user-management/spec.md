# User Management Specification — Delta

> **Delta for change**: user-profiles
> **Modified capabilities**: user-management (add `profileId` to Create/Update user DTOs)

## Modified Requirements

### Requirement: Create User

**Changes**: Added optional `profileId` field. When `profileId` is provided, the system MUST load the associated profile's `ProfileModulePermission` rows (boolean matrix), convert them to `String[] actions` (canRead→READ, canCreate→CREATE, canEdit→UPDATE, canDelete→DELETE, canPrint→PRINT), and create corresponding `UserModule` records. If `moduleAccess` is also provided, `moduleAccess` SHALL take precedence — per-module overrides from profile are replaced by manual `moduleAccess` entries for any conflicting module. The `profileId` value SHALL be persisted on the User record.

#### Scenario: Create user with profileId generates user_modules from profile

- GIVEN a profile "Docente" with permissions: STUDENTS(canRead=true), GRADES(canRead=true, canCreate=true)
- WHEN `POST /v1/users` with `{ email, password, name, roles: ["TEACHER"], profileId: "<profile-uuid>" }`
- THEN the user is created
- AND `user_modules` entries for STUDENTS:READ, GRADES:READ, GRADES:CREATE are persisted
- AND the user record has `profileId` set to the provided UUID
- AND `filterModuleAccess()` is applied (non-ROOT creators SHALL only pass modules they possess)

#### Scenario: Create user with profileId and manual moduleAccess — manual overrides

- GIVEN a profile "Docente" with permissions: STUDENTS(canRead=true), GRADES(canRead=true, canCreate=true)
- WHEN `POST /v1/users` with `{ email, password, name, roles: ["TEACHER"], profileId: "<profile-uuid>", moduleAccess: [{ moduleCode: "STUDENTS", actions: ["READ", "CREATE"] }] }`
- THEN STUDENTS entries from profile are replaced by manual `moduleAccess` (STUDENTS:READ + STUDENTS:CREATE)
- AND GRADES entries from profile remain (GRADES:READ, GRADES:CREATE)
- AND `profileId` is still persisted on the user record

#### Scenario: Create user without profileId works as before

- GIVEN a ROOT user
- WHEN `POST /v1/users` with `{ email, password, name, roles: ["TEACHER"] }` (no `profileId`)
- THEN the user is created with no `profileId` and no `user_modules` (unless `moduleAccess` is provided)
- AND behavior is identical to pre-profile implementation

### Requirement: Update User

**Changes**: Added optional `profileId` field. When `profileId` is provided on update, the system SHALL load the profile's permissions, convert booleans→actions, delete ALL existing `UserModule` records for the user, and create new ones from the profile. If `moduleAccess` is also provided, `moduleAccess` SHALL take precedence over profile values per-module. Setting `profileId` to `null` SHALL remove the profile association but SHALL NOT delete existing `user_modules` (unless `moduleAccess` is explicitly provided). Absent `profileId` SHALL NOT modify the existing `profileId` on the user record.

#### Scenario: Update user with new profileId replaces user_modules

- GIVEN a user with existing `user_modules` from profile "Docente" and `profileId` set
- WHEN `PATCH /v1/users/:id` with `{ profileId: "<new-profile-uuid>" }`
- THEN all existing `user_modules` are deleted
- AND new `user_modules` are created from the new profile's permissions
- AND the user's `profileId` is updated to the new UUID

#### Scenario: Update user with profileId null removes association

- GIVEN a user with `profileId` set
- WHEN `PATCH /v1/users/:id` with `{ profileId: null }`
- THEN the user's `profileId` is set to `null`
- AND existing `user_modules` remain unchanged (no deletion)
