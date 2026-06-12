# Spec: Campos obligatorios — Nivel y Ciclo Lectivo

**RFC 2119 keywords apply throughout this document.**

## Overview

Both `level` and `cycleId` MUST be provided when creating an ingresante.
Their valid values are constrained by the requesting user's role, using the
same three-door access model (`resolveAccessScope`) already established in the codebase.

---

## 1. Nivel (level)

### Rules

1. `level` MUST be present and non-null on every create request. Requests without a level MUST be rejected with a validation error.
2. **ROOT and ADMIN users** (those for whom `allLevels = true` in `resolveAccessScope`) MAY choose any level available to them:
   - ROOT MUST have access to all levels in the system.
   - ADMIN MUST have access to levels belonging to their own institution only.
3. **All other authenticated users** (e.g., DIRECTOR, SECRETARIO) MUST receive `userLevels[0].level` as their level. This value MUST be set automatically by the system. The user MUST NOT be able to override it — any submitted level differing from `userLevels[0].level` MUST be ignored or rejected.
4. The system MUST NOT accept a level that does not exist in the set available to the requesting user.

### Acceptance Scenarios

#### SC-LVL-01 — ROOT creates with explicit level
**Given** a ROOT user  
**When** a create request is submitted with `level = SECUNDARIO`  
**Then** the ingresante is created with `level = SECUNDARIO`

#### SC-LVL-02 — ADMIN creates with level from their institution
**Given** an ADMIN user whose institution has levels [PRIMARIO, SECUNDARIO]  
**When** a create request is submitted with `level = PRIMARIO`  
**Then** the ingresante is created with `level = PRIMARIO`

#### SC-LVL-03 — ADMIN cannot use a level outside their institution
**Given** an ADMIN user whose institution has levels [PRIMARIO]  
**When** a create request is submitted with `level = SECUNDARIO`  
**Then** the API returns a validation error  
**And** no ingresante is created

#### SC-LVL-04 — DIRECTOR creates — level auto-assigned and locked
**Given** a DIRECTOR user with `userLevels[0].level = PRIMARIO`  
**When** a create request is submitted (with or without a `level` field)  
**Then** the ingresante is created with `level = PRIMARIO`  
**And** any `level` value in the request other than PRIMARIO is rejected or overridden by the system

#### SC-LVL-05 — Create without level rejected (all roles)
**Given** any user  
**When** a create request is submitted with no `level` field  
**Then** the API returns a validation error  
**And** no ingresante is created

---

## 2. Ciclo Lectivo (cycleId)

### Rules

1. `cycleId` MUST be present and non-null on every create request. Requests without a cycleId MUST be rejected with a validation error.
2. The set of available cycles MUST be filtered by the resolved level (whether chosen by ROOT/ADMIN or auto-assigned for other roles).
3. **ROOT users** MUST have access to all cycles in the system, regardless of level or institution.
4. **Non-ROOT users** MUST see only cycles associated with their resolved level (and their institution for non-ROOT/non-ADMIN roles).
5. The system MUST NOT accept a cycleId that does not belong to the set available for the resolved level of the requesting user.

### Rules — D1 Migration / Cleanup

6. Existing ingresante records with `cycleId IS NULL` MUST be deleted as part of the migration step that makes this field mandatory.
7. The cleanup query MUST operate across all tenants (multi-tenant).
8. The cleanup MUST be idempotent — running it multiple times MUST produce the same result.
9. A database backup MUST be performed before running this migration in production, given its destructive nature.

### Acceptance Scenarios

#### SC-CYC-01 — Create without cycleId rejected (all roles)
**Given** any user  
**When** a create request is submitted with no `cycleId` field  
**Then** the API returns a validation error  
**And** no ingresante is created

#### SC-CYC-02 — ROOT sees all cycles
**Given** a ROOT user who has selected level PRIMARIO  
**When** the available cycles are queried  
**Then** all cycles for PRIMARIO across all institutions are returned

#### SC-CYC-03 — ADMIN sees cycles for chosen level in their institution
**Given** an ADMIN user of institution X who selects level SECUNDARIO  
**When** the available cycles are queried  
**Then** only cycles associated with SECUNDARIO within institution X are returned

#### SC-CYC-04 — DIRECTOR sees cycles for their auto-assigned level
**Given** a DIRECTOR user with `userLevels[0].level = PRIMARIO`  
**When** the available cycles are queried  
**Then** only cycles associated with PRIMARIO for their institution are returned

#### SC-CYC-05 — cycleId not in allowed set is rejected
**Given** a DIRECTOR user with `userLevels[0].level = PRIMARIO`  
**When** a create request is submitted with a cycleId that belongs to SECUNDARIO  
**Then** the API returns a validation error  
**And** no ingresante is created

#### SC-CYC-06 — D1 migration: null cycleId ingresantes are deleted
**Given** there are ingresante records across one or more tenants where `cycleId IS NULL`  
**When** the migration runs  
**Then** all such records are deleted  
**And** records with a valid cycleId are unaffected  
**And** running the migration a second time deletes no additional records (idempotent)
