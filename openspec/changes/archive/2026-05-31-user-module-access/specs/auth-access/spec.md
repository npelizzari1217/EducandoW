# Delta for auth-access

## ADDED Requirements

### Requirement: Module-Level Assignment Authorization

When a non-ROOT user creates or updates another user with `moduleAccess`, the system MUST intersect the requested modules with the creator's own modules. Only modules present in the creator's JWT `modules` claim SHALL be assignable. Modules not present in the creator's scope MUST be silently filtered — no error SHALL be returned. ROOT users MAY assign any module without restriction.

#### Scenario: Non-ROOT assigns module they possess

- GIVEN a SECRETARIO with modules [USERS, STUDENTS, ENROLLMENTS] in JWT
- WHEN creating a user with `moduleAccess: [{ moduleCode: "USERS", actions: ["READ"] }]`
- THEN USERS:READ is persisted

#### Scenario: Non-ROOT assigns module they lack

- GIVEN a SECRETARIO with modules [USERS, STUDENTS, ENROLLMENTS] in JWT
- WHEN creating a user with `moduleAccess: [{ moduleCode: "GRADES", actions: ["READ"] }]`
- THEN GRADES is silently filtered; no error returned

#### Scenario: Non-ROOT assigns mixed — only owned modules persist

- GIVEN a DIRECTOR with modules [USERS, STUDENTS]
- WHEN creating a user with `moduleAccess: [{ moduleCode: "USERS", actions: ["READ"] }, { moduleCode: "GRADES", actions: ["READ"] }]`
- THEN only USERS:READ is persisted; GRADES is silently filtered

#### Scenario: ROOT assigns any module without filtering

- GIVEN a ROOT user
- WHEN creating a user with `moduleAccess` containing any module code
- THEN all specified modules are persisted without filtering
