# User Module Access Specification

## Purpose

Direct module-to-user assignment via `user_modules`, complementing the role-based `role_modules` system. Enables fine-grained permission control beyond what roles provide, with a public module catalog and UI grid for selecting module×action pairs.

## Requirements

### Requirement: Module Assignment Rules

Direct module assignment via `moduleAccess` MUST follow these rules. ROOT MAY assign any module. Non-ROOT users SHALL only assign modules they themselves possess. `user_modules` entries override `role_modules` for the same module (merge in repository layer). `moduleAccess: []` SHALL remove all `user_modules` for that user. Absent `moduleAccess` in request body SHALL NOT modify existing `user_modules`. Roles MUST be retained for hierarchy (`canManageUser`) and as base permissions.

#### Scenario: ROOT assigns any module

- GIVEN a ROOT user creating/editing a user
- WHEN `moduleAccess` includes any module code
- THEN all specified modules are persisted regardless of the creator's modules

#### Scenario: Non-ROOT assigns only owned modules

- GIVEN a DIRECTOR with modules [USERS, STUDENTS]
- WHEN creating a user with `moduleAccess: [{ moduleCode: "USERS", actions: ["READ"] }, { moduleCode: "GRADES", actions: ["READ"] }]`
- THEN only USERS:READ is persisted; GRADES is silently filtered

#### Scenario: Empty moduleAccess clears all user_modules

- GIVEN a user with existing `user_modules` entries
- WHEN `moduleAccess: []` is sent
- THEN all `user_modules` for that user are deleted

#### Scenario: Absent moduleAccess preserves existing

- GIVEN a user with existing `user_modules`
- WHEN a request does NOT include `moduleAccess`
- THEN existing `user_modules` remain unchanged

### Requirement: Module Access UI Grid

The create/edit user form MUST display a checkbox grid below the role selection. Rows = available modules; columns = actions (READ, CREATE, UPDATE, DELETE, PRINT). Non-ROOT users SHALL only see modules they possess. The grid MUST serialize to `moduleAccess: [{ moduleCode, actions }]` on submit.

#### Scenario: ROOT sees all modules in grid

- GIVEN a ROOT user on the create/edit form
- THEN the grid shows all 10 modules with 5 action columns

#### Scenario: Non-ROOT sees only owned modules

- GIVEN a SECRETARIO with modules [USERS, STUDENTS, ENROLLMENTS]
- THEN the grid shows only rows for those 3 modules

#### Scenario: Grid serializes to moduleAccess

- GIVEN a user checks READ and UPDATE for STUDENTS
- WHEN the form is submitted
- THEN `moduleAccess: [{ moduleCode: "STUDENTS", actions: ["READ", "UPDATE"] }]` is sent
