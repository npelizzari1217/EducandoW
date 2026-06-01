# Delta for user-management

> **Change**: 03-user-profiles
> **Modified capability**: user-management

## MODIFIED Requirements

### Requirement: Create User

`POST /v1/users` MUST create a new user. Required fields: `email` (valid email), `password` (min 6 chars), `name` (non-empty). Optional: `institutionId` (UUID), `levels` (array of `{ level: 1–9, modality: 0–9 }`), `roles` (array of role strings, min 1), `moduleAccess` (array of `{ moduleCode: string, actions: string[] }`), `profileId` (UUID string). The creator's highest role rank MUST be strictly greater than every assigned role's rank. ROOT bypasses this check. If `moduleAccess` is provided, the system MUST persist entries in `user_modules`. Non-ROOT creators SHALL only assign modules they possess; modules outside the creator's scope MUST be silently filtered. `moduleAccess: []` SHALL remove all `user_modules` for the user. The `levels` array, when provided, MUST be persisted as rows in `user_levels` (`userId`, `level`, `modality`). `levels: []` SHALL remove all `user_levels` for the user. Absent `levels` SHALL NOT modify existing `user_levels`. If `profileId` is provided, the system MUST load the profile's `ProfileModulePermission` rows (boolean matrix), convert booleans to `String[] actions` (canRead→READ, canCreate→CREATE, canEdit→UPDATE, canDelete→DELETE, canPrint→PRINT), and create corresponding `UserModule` records. If both `profileId` and `moduleAccess` are provided, `moduleAccess` SHALL take precedence per-module — entries in `moduleAccess` override the profile's permissions for matching modules, while non-overlapping modules retain profile values. The `profileId` value SHALL be persisted on the User record.

(Previously: no `profileId` field; no profile-based module generation.)

#### Scenario: ADMIN creates a TEACHER

- GIVEN an ADMIN user (rank 60)
- WHEN `POST /v1/users` with `{ email, password, name, roles: ["TEACHER"] }`
- THEN the system creates the user and returns HTTP 201 with the user data including roles

#### Scenario: ADMIN cannot assign ADMIN role

- GIVEN an ADMIN user (rank 60) attempting to create a user with role ADMIN (rank 60)
- WHEN `POST /v1/users` with `{ email, password, name, roles: ["ADMIN"] }`
- THEN the system MUST return an error — creator rank must be strictly higher

#### Scenario: Create with moduleAccess persists user_modules

- GIVEN a ROOT user
- WHEN `POST /v1/users` with `{ email, password, name, roles: ["TEACHER"], moduleAccess: [{ moduleCode: "STUDENTS", actions: ["READ", "CREATE"] }] }`
- THEN the user is created and `user_modules` entries for STUDENTS:READ and STUDENTS:CREATE are persisted

#### Scenario: Create with moduleAccess filters unauthorized modules

- GIVEN a DIRECTOR with modules [USERS, STUDENTS]
- WHEN creating a user with `moduleAccess: [{ moduleCode: "USERS", actions: ["READ"] }, { moduleCode: "GRADES", actions: ["READ"] }]`
- THEN only USERS:READ is persisted; GRADES is silently filtered

#### Scenario: Duplicate email rejected

- GIVEN a user with email `a@b.com` already exists
- WHEN `POST /v1/users` with the same email
- THEN the system MUST return a duplicate email error

#### Scenario: Invalid input returns validation error

- GIVEN a ROOT user
- WHEN `POST /v1/users` with `{ email: "invalid", password: "12" }`
- THEN the system MUST return HTTP 400 with validation errors

#### Scenario: Create with levels persists user_levels

- GIVEN a ROOT user
- WHEN `POST /v1/users` with `{ email, password, name, roles: ["TEACHER"], levels: [{ level: 2, modality: 0 }] }`
- THEN `user_levels` rows for (level=2, modality=0) are persisted

#### Scenario: Create with empty levels stores no user_levels

- GIVEN a ROOT user
- WHEN `POST /v1/users` with `{ email, password, name, roles: ["TEACHER"], levels: [] }`
- THEN the user is created with no `user_levels` rows

#### Scenario: Create without levels field leaves user_levels untouched

- GIVEN a ROOT user
- WHEN `POST /v1/users` without a `levels` field
- THEN no `user_levels` rows are created or deleted

#### Scenario: Create rejects levels not in institution_levels

- GIVEN a ROOT user creating a user in institution X with institution_levels [(level=1, modality=0)]
- WHEN `POST /v1/users` with `levels: [{ level: 3, modality: 1 }]` and `institutionId: X`
- THEN the system MUST reject with HTTP 400 and no user is created

#### Scenario: Create with valid subset succeeds

- GIVEN a ROOT user and institution X with institution_levels [(level=2, modality=0), (level=3, modality=1)]
- WHEN `POST /v1/users` with `levels: [{ level: 2, modality: 0 }]` and `institutionId: X`
- THEN the user is created with those user_levels

#### Scenario: Create user with profileId generates user_modules from profile

- GIVEN a profile "Docente" with STUDENTS(canRead=true), GRADES(canRead=true, canCreate=true)
- WHEN `POST /v1/users` with `{ email, password, name, roles: ["TEACHER"], profileId: "<uuid>" }` by ROOT
- THEN `user_modules` entries for STUDENTS:READ, GRADES:READ, GRADES:CREATE are persisted
- AND the user record has `profileId` set
- AND `filterModuleAccess()` is applied

#### Scenario: Create user with profileId and manual moduleAccess — manual overrides

- GIVEN profile "Docente" with STUDENTS(canRead=true), GRADES(canRead=true, canCreate=true)
- WHEN `POST /v1/users` with `{ profileId: "<uuid>", moduleAccess: [{ moduleCode: "STUDENTS", actions: ["READ", "CREATE"] }] }` by ROOT
- THEN STUDENTS uses manual actions (READ, CREATE); GRADES retains profile values (READ, CREATE)
- AND `profileId` is persisted on the user record

#### Scenario: Create user without profileId works as before

- GIVEN a ROOT user
- WHEN `POST /v1/users` with `{ email, password, name, roles: ["TEACHER"] }` (no `profileId`)
- THEN the user is created with no `profileId` and no `user_modules` (unless `moduleAccess` provided)

### Requirement: Update User

`PATCH /v1/users/:id` MUST allow partial updates. Creator's rank MUST be strictly higher than the target's current highest role rank. If `roles` is provided, creator's rank MUST also be strictly higher than every new role's rank. ROOT bypasses all checks. If `moduleAccess` is provided, the system MUST replace all `user_modules` for that user with the new set (after filtering unauthorized modules for non-ROOT). `moduleAccess: []` SHALL remove all `user_modules`. Absent `moduleAccess` SHALL NOT modify existing `user_modules`. If `levels` is provided, the system MUST replace all `user_levels` for that user with the new set. `levels: []` SHALL remove all `user_levels`. Absent `levels` SHALL NOT modify existing `user_levels`. If `profileId` is provided, the system SHALL load the profile's permissions, convert booleans→actions, delete ALL existing `UserModule` records for the user, and create new ones from the profile. If both `profileId` and `moduleAccess` are provided, `moduleAccess` SHALL take precedence per-module over profile values. Setting `profileId` to `null` SHALL remove the profile association but SHALL NOT delete existing `user_modules` (unless `moduleAccess` is explicitly provided). Absent `profileId` SHALL NOT modify the existing `profileId` on the user record. Non-existent user returns `{ data: null }`.

(Previously: no `profileId` field; no profile-based module replacement on update.)

#### Scenario: ADMIN updates a TEACHER's name

- GIVEN an ADMIN user and a target TEACHER user
- WHEN `PATCH /v1/users/:id` with `{ name: "New Name" }`
- THEN the system updates the name and returns HTTP 200 with updated user data

#### Scenario: ADMIN cannot update another ADMIN

- GIVEN an ADMIN user and a target ADMIN user (same rank)
- WHEN `PATCH /v1/users/:id` is attempted
- THEN the system MUST return an authorization error

#### Scenario: Update with moduleAccess replaces user_modules

- GIVEN a user with existing `user_modules` [USERS:READ, STUDENTS:CREATE]
- WHEN `PATCH /v1/users/:id` with `{ moduleAccess: [{ moduleCode: "GRADES", actions: ["READ"] }] }` by ROOT
- THEN the user's `user_modules` are replaced: USERS:READ and STUDENTS:CREATE removed, GRADES:READ added

#### Scenario: Update with empty moduleAccess clears user_modules

- GIVEN a user with existing `user_modules`
- WHEN `PATCH /v1/users/:id` with `{ moduleAccess: [] }`
- THEN all `user_modules` for that user are deleted

#### Scenario: Update without moduleAccess preserves existing

- GIVEN a user with existing `user_modules`
- WHEN `PATCH /v1/users/:id` with `{ name: "New" }` (no `moduleAccess`)
- THEN existing `user_modules` remain unchanged

#### Scenario: Update non-existent user

- GIVEN any authenticated user
- WHEN `PATCH /v1/users/nonexistent-id` with `{ name: "X" }`
- THEN the system returns HTTP 200 with `{ data: null }`

#### Scenario: Role reassignment respects hierarchy

- GIVEN an ADMIN user (rank 60) updating a TEACHER (rank 20)
- WHEN `PATCH /v1/users/:id` with `{ roles: ["DIRECTOR"] }` (rank 50)
- THEN the system accepts the update

#### Scenario: Update with levels replaces user_levels

- GIVEN a user with `user_levels` [(level=1, modality=0)]
- WHEN `PATCH /v1/users/:id` with `{ levels: [{ level: 2, modality: 0 }] }` by ROOT
- THEN existing user_levels are deleted and new row (level=2, modality=0) is inserted

#### Scenario: Update with empty levels clears user_levels

- GIVEN a user with existing `user_levels`
- WHEN `PATCH /v1/users/:id` with `{ levels: [] }`
- THEN all `user_levels` for that user are deleted

#### Scenario: Update without levels preserves user_levels

- GIVEN a user with existing `user_levels`
- WHEN `PATCH /v1/users/:id` with `{ name: "New" }` (no `levels` field)
- THEN existing `user_levels` remain unchanged

#### Scenario: Update rejects levels not in institution_levels

- GIVEN a user in institution X with institution_levels [(level=1, modality=0)]
- WHEN `PATCH /v1/users/:id` with `{ levels: [{ level: 2, modality: 0 }] }`
- THEN the system MUST reject with HTTP 400

#### Scenario: ROOT bypasses institution level subset validation

- GIVEN a ROOT user
- WHEN `PATCH /v1/users/:id` with any `levels` value
- THEN the update succeeds regardless of institution levels

#### Scenario: Update user with new profileId replaces user_modules

- GIVEN a user with `profileId: "P1"` and existing `user_modules` from profile P1
- WHEN `PATCH /v1/users/:id` with `{ profileId: "P2" }`
- THEN all existing `user_modules` are deleted and new ones created from profile P2
- AND the user's `profileId` is updated to "P2"

#### Scenario: Update user with profileId null removes association

- GIVEN a user with `profileId` set
- WHEN `PATCH /v1/users/:id` with `{ profileId: null }`
- THEN the user's `profileId` is set to `null`
- AND existing `user_modules` remain unchanged

## ADDED Requirements

### Requirement: Users UI Page — Profile Selector

The user create/edit form MUST include a `ProfileSelector` dropdown positioned between the role selection and the `ModuleAccessGrid`. When a profile is selected from the dropdown, the system MUST fetch `GET /v1/profiles/:id/permissions`, convert the boolean matrix to `ModuleAccessItem[]` (canRead→READ, etc.), and pre-fill the `ModuleAccessGrid` state. The user MAY override any pre-filled values before submitting. A clear/reset option MUST be available to remove the profile selection and reset the grid to empty. The `profileId` of the selected profile SHALL be included in the submit payload.

(Previously: no profile selector; modules were manually selected via grid only.)

#### Scenario: ProfileSelector pre-fills grid on selection

- GIVEN a user on the create/edit form
- WHEN they select "Docente Básico" from the ProfileSelector
- THEN `GET /v1/profiles/:id/permissions` is called
- AND the ModuleAccessGrid is populated with the profile's boolean matrix converted to checked cells

#### Scenario: Manual override after profile selection is retained

- GIVEN the user has selected a profile and the grid is pre-filled
- WHEN they manually uncheck GRADES:READ in the grid
- THEN the grid state reflects the manual change (profile pre-fill is not locked)

#### Scenario: Clear profile resets grid

- GIVEN a profile is selected and the grid is pre-filled
- WHEN the user clicks "Limpiar" (clear/reset)
- THEN the ProfileSelector shows no selection and the ModuleAccessGrid is cleared
- AND no `profileId` is included in the submit payload
