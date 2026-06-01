# Exploration: Educational Levels Across the Codebase — Full Mapping

> **Date**: 2026-06-01 | **Phase**: EXPLORE | **Type**: Research for design

---

## 1. Institution Levels

### Domain Entity (`Institution`)

**File**: `packages/domain/src/institution/entities/institution.ts`

The institution stores levels in a RELATIONAL format via `InstitutionLevelEntry[]`:

```ts
export interface InstitutionLevelEntry {
  level: EducationalLevelCode;   // 1=Inicial, 2=Primario, 3=Secundario, 4=Terciario, 9=Admin
  modality: EducationalModalityCode; // 0=Común, 1=Talleres, 2=Bilingüismo, 9=Todos
}

// In InstitutionProps:
institutionLevels: InstitutionLevelEntry[];
```

The `Institution` class has these level-related members:

| Member | Type | Behavior |
|--------|------|----------|
| `institutionLevels` (getter) | `InstitutionLevelEntry[]` | Returns copy of `{level, modality}` array |
| `levels` (getter) | `Level[]` | Computed: maps each entry through `Level.fromParts(level, modality)` → returns `Level` VOs |
| `hasLevel(levelCode, modalityCode)` | `boolean` | Exact match (level + modality) |
| `hasEducationalLevel(levelCode)` | `boolean` | Base level match (ignores modality) — e.g. "tiene Inicial?" |
| `addLevel(levelCode, modalityCode)` | `void` | Push if not exists |

### DB Schema (Prisma Master)

**File**: `api/prisma/schema_master.prisma`

Institutions use a **separate junction table** `InstitutionLevel` (NOT a JSON/array column):

```prisma
model Institution {
  // ... 25 fields ...
  levels  InstitutionLevel[]   // One-to-many relation
}

model InstitutionLevel {
  id            String @id @default(uuid())
  institutionId String
  level         Int    // EducationalLevelCode (1-4, 9)
  modality      Int    // EducationalModalityCode (0-2, 9)
  institution   Institution @relation(...)
  @@unique([institutionId, level, modality])
  @@map("institution_levels")
}
```

### API Response (`toResponse()`)

**File**: `api/src/presentation/institution/institution.controller.ts` (line 23-61)

```ts
function toResponse(inst: Institution) {
  return {
    // ...
    levels: inst.levels.map((l) => l.toCode()),           // [10, 11, 20, 30, 40] ← composite codes
    institution_levels: inst.institutionLevels.map((il) => ({  // [{level:1, modality:0}, ...]
      level: il.level,
      modality: il.modality,
    })),
    // ...
  };
}
```

**Two formats in the API response**:
- `levels: number[]` — composite codes (`10`, `20`, `30`, `40`) — LEGACY, used by frontend sidebar filter
- `institution_levels: {level: number, modality: number}[]` — NEW format with separate level+modality

### DTO for Institution Create/Update

**File**: `api/src/presentation/institution/dto/create-institution-full.dto.ts`

```ts
const institutionLevelSchema = z.object({
  level: z.string().min(1),
  modality: z.string().optional().default('COMUN'),
});

const InstitutionFullBaseSchema = z.object({
  // ...
  institution_levels: z.array(institutionLevelSchema).optional(),
  levels: z.array(levelNameEnum).optional(),   // Legacy: ["INICIAL", "PRIMARIO"]
});

// At least one level required:
export const CreateInstitutionFullSchema = InstitutionFullBaseSchema.refine(
  (data) => !!(data.institution_levels?.length || data.levels?.length),
  { message: 'Debés seleccionar al menos un nivel educativo...' }
);
```

### Use Case — Level Parsing

**File**: `api/src/application/institution/use-cases/institution.use-cases.ts` (line 433-457)

```ts
function parseInstitutionLevels(input): InstitutionLevelEntry[] {
  // New format: institution_levels: [{level: "1", modality: "COMUN"}]
  if (input.institution_levels && input.institution_levels.length > 0) {
    return input.institution_levels.map((il) => ({
      level: parseLevelCode(il.level),       // string "1" → EducationalLevelCode.INICIAL
      modality: parseModalityCode(il.modality ?? 'COMUN')
    }));
  }
  // Legacy: levels: ["INICIAL", "PRIMARIO"]
  if (input.levels && input.levels.length > 0) {
    return input.levels.map((name) => {
      const parsed = parseLevelName(name); // Level.create("INICIAL") → Level VO
      return { level: parsed.levelCode, modality: parsed.modalityCode };
    });
  }
  return [];
}
```

### Prisma Repository — Level Persistence

**File**: `api/src/infrastructure/persistence/prisma/repositories/prisma-institution.repository.ts`

- `save()` and `update()` both **delete existing levels and recreate** them via `institutionLevel.deleteMany()` + `create: [...]`
- `toDomain()`: maps `record.levels[]` to `institutionLevels: [{level, modality}]`

### Frontend Institution Form

**File**: `web/src/pages/dashboard/institutions.tsx`

- Uses `PEDAGOGICAL_LEVELS` from `web/src/constants/levels.ts` (10 levels: 10-12, 20-22, 30-32, 40)
- Selected levels stored as `Set<number>` of indices into `PEDAGOGICAL_LEVELS` array
- Converted to payload: `indicesToInstitutionLevels()` → `[{level: "1", modality: "0"}, ...]` (strings!)
- Loaded from API: `institutionLevelsToIndices()` matches `institution_levels` against `PEDAGOGICAL_LEVELS`
- Fallback: `codesToIndices()` for legacy `levels: number[]` codes
- Checkboxes for all 10 pedagogical levels, grouped by label

---

## 2. User Entity

### Domain Entity (`User`)

**File**: `packages/domain/src/auth/entities/user.ts`

The User entity has **SINGLE level** and **SINGLE modality** fields (NOT arrays):

```ts
export interface UserProps {
  // ...
  institutionId?: string;
  level?: EducationalLevelCode;    // SINGLE code: 1, 2, 3, 4, or 9
  modality?: EducationalModalityCode; // SINGLE code: 0, 1, 2, or 9
  // ...
}

// Key methods:
assignLevel(level: EducationalLevelCode): void
assignModality(modality: EducationalModalityCode): void
```

**IMPORTANT**: The User entity has ONE `level` field — a single `EducationalLevelCode` — NOT an array. This means a user is scoped to exactly one base educational level (or none).

### DB Schema (Prisma Master)

**File**: `api/prisma/schema_master.prisma`

```prisma
model User {
  id            String   @id
  // ...
  institutionId String?
  level         Int?     // EducationalLevelCode (1-4, 9) — SINGLE value
  modality      Int?     // EducationalModalityCode (0-2, 9)
  // ...
}
```

**No relationship between User and InstitutionLevel.** The `level` column is a standalone `Int` — it is NOT a foreign key to `InstitutionLevel`. There is no join table connecting users to multiple levels.

### User DTOs

**File**: `api/src/presentation/users/dto/create-user.dto.ts`

```ts
export const CreateUserSchema = z.object({
  // ...
  level: z.number().int().min(1).max(9).optional(),      // SINGLE number
  modality: z.number().int().min(0).max(9).optional(),
  // ...
});
```

**File**: `api/src/presentation/users/dto/update-user.dto.ts`

```ts
export const UpdateUserSchema = z.object({
  // ...
  level: z.number().int().min(1).max(9).optional().nullable(),      // SINGLE, nullable
  modality: z.number().int().min(0).max(9).optional().nullable(),
  // ...
});
```

### User Use Case (Create)

**File**: `api/src/application/users/use-cases/users.use-cases.ts`

- `create()`: stores `level` and `modality` directly on the `user` table
- `update()`: allows changing `level` and `modality`
- Response `userToResponse()`: returns `level` and `modality` as raw numbers

### User Repository

**File**: `api/src/infrastructure/persistence/prisma/repositories/prisma-user.repository.ts`

- `save()`: persists `user.level ?? null` and `user.modality ?? null`
- `toDomain()`: reads `record.level` and `record.modality` from Prisma row → casts to `EducationalLevelCode`/`EducationalModalityCode`

### Frontend User Form

**File**: `web/src/pages/dashboard/users.tsx`

- Dropdown for "Nivel educativo" with options from `LEVEL_LABELS` (1,2,3,4,9)
- **Single level** per user — stored as `form.level` (string, parsed to `parseInt` before sending)
- Table column "Nivel educativo" renders `levelLabel(u.level)` — which shows just one label

### Key Gap: User ↔ Levels relationship

| Aspect | Current | What's missing |
|--------|---------|----------------|
| User level count | **1** (`Int?`) | No multi-level support |
| Relation to InstitutionLevel | **None** (standalone Int) | Should reference `InstitutionLevel` table |
| Multi-level users | ❌ Not supported | A SECRETARIO might need to manage both Primario and Secundario |
| User ↔ Institution consistency | User can have level that institution doesn't have | No cross-validation |

---

## 3. Login / Me Endpoint

### GET /v1/auth/me

**File**: `api/src/presentation/auth/auth.controller.ts` (line 107-111)

```ts
@Get('me')
@UseGuards(AuthGuard)
async me(@CurrentUser() user: { userId: string; roles: string[]; institutionId?: string; level?: number }) {
  return { data: user };
}
```

**What it returns**: The JWT payload extracted by `AuthGuard` — NOT a full user object from the DB.

### JWT Payload Structure

**File**: `api/src/infrastructure/auth/jwt-auth-port.ts`

```ts
export interface JwtPayload {
  sub: string;           // userId
  roles: string[];       // ["ADMIN", "TEACHER"]
  modules?: { moduleCode: string; actions: string[] }[];
  institutionId?: string;
  level?: number;        // ← SINGLE EducationalLevelCode (1-4, 9)
  dbName?: string | null;
}
```

### AuthGuard User Extraction

**File**: `api/src/infrastructure/auth/guards/auth.guard.ts`

```ts
export interface AuthenticatedUser {
  userId: string;
  roles: string[];
  modules?: { moduleCode: string; actions: string[] }[];
  institutionId?: string;
  level?: number;        // SINGLE number
  dbName?: string | null;
}
```

### Login Use Case — What Gets Put in the JWT

**File**: `api/src/application/auth/use-cases/login.use-case.ts` (line 69-76)

```ts
const accessToken = this.authPort.sign({
  sub: userId,
  roles: user.roles,
  modules: user.modules,
  institutionId: user.institutionId,
  level: user.level,          // ← User.`level` (single EducationalLevelCode)
  dbName,
});
```

The login response `user` object also includes:

```ts
user: {
  id: userId,
  email: user.email.get(),
  name: user.name,
  role: user.role,          // Legacy: first role string
  roles: user.roles,        // Full array
  modules: user.modules,
  institutionId: user.institutionId,
  level: user.level,        // SINGLE number
  dbName,
}
```

### GET /v1/institutions/me (Institution config)

**File**: `api/src/presentation/institution/institution.controller.ts` (line 88-98)

```ts
@Get('me')
async me(@Req() req: Request) {
  const user = (req as AuthenticatedRequest).user;
  const institutionId = user?.institutionId ?? null;
  if (!institutionId) return { data: null, reason: 'no_institution' };
  const result = await this.getMeUC.execute(institutionId);
  return { data: toResponse(result.unwrap()) };
}
```

This returns the FULL institution config with levels:

```ts
{
  levels: [10, 11, 20],        // Composite codes (from institution)
  institution_levels: [{level:1, modality:0}, {level:1, modality:1}, {level:2, modality:0}]
}
```

### Frontend Auth Context

**File**: `web/src/context/auth-context.tsx` (line 4)

```ts
interface User {
  id: string; email: string; name: string; role: string;
  roles?: string[];
  institutionId?: string;
  level?: number;       // ← single number from JWT
  modules?: { moduleCode: string; actions: string[] }[];
}
```

Stored in `localStorage` under key `user`. Contains `level` as a single number.

### Frontend Institution Context

**File**: `web/src/context/institution-context.tsx` (line 34)

```ts
export interface InstitutionConfig {
  // ... 25 fields ...
  levels: number[];       // ← number[] — composite codes, multi-level
}
```

Fetched from `GET /institutions/me` and stored in React context. The `levels` field contains ALL the institution's levels as composite codes.

---

## 4. Sidebar Level Filtering

### How `configuredLevels` Are Derived

**File**: `web/src/components/layout/sidebar.tsx` (line 111-112)

```ts
const { config } = useInstitution();  // InstitutionConfig from InstitutionContext
const hasLevels = config.levels.length > 0;              // Binary: any level?
const baseLevels = new Set(config.levels.map((code) => Math.floor(code / 10)));  // Set<1|2|3|4>
```

`baseLevels` extracts the **base level codes** (1-4) from composite codes (like `10`, `20`, `30`, `40`):
- `config.levels = [10, 11, 20]` → `baseLevels = Set(1, 2)`
- This means the institution has Inicial (codes 10, 11) and Primario (code 20)

### Filter Chain

**File**: `web/src/components/layout/sidebar.tsx` (line 86-104)

```ts
function makeFilterItem(user, hasLevels, baseLevels, sendEmail, sendMessages) {
  return (item: NavItem): boolean => {
    // 1. Role-based
    if (item.roles && user && !item.roles.includes(user.role)) return false;
    // 2. Generic level requirement — any level?
    if (item.requiresLevel && !hasLevels && user?.role !== 'ROOT') return false;
    // 3. SPECIFIC level filtering (base level code: 1,2,3,4)
    if (item.levelId !== undefined && user?.role !== 'ROOT' && !baseLevels.has(item.levelId)) return false;
    // 4. Feature flags
    if (item.featureFlag === 'send_email' && !sendEmail) return false;
    if (item.featureFlag === 'send_messages' && !sendMessages) return false;
    return true;
  };
}
```

### NavItem Interface

```ts
interface NavItem {
  label: string;
  path: string;
  roles?: string[];
  requiresLevel?: boolean;   // Show when institution has ANY level
  levelId?: number;          // 1=Inicial, 2=Primario, 3=Secundario, 4=Terciario
  featureFlag?: 'send_email' | 'send_messages';
}
```

### Level-Specific Items in navGroups

The sidebar already has level-specific filtering via `levelId`:
- Items with `levelId: 1` (Inicial): Salas, Informes Evolutivos, Planificaciones
- Items with `levelId: 2` (Primario): Grados, Calificaciones
- Items with `levelId: 3` (Secundario): Cursos, Mesas de Examen
- Items with `levelId: 4` (Terciario): Carreras, Inscripciones

These items are inside the "Académico" group. They filter based on **institution** levels, not user levels.

### What's NOT filtered by User Level

**The sidebar currently filters by INSTITUTION levels only.** The `user.level` field (single number from JWT) is NOT used anywhere in the sidebar filtering logic. This means:
- A user with `level: 1` (Inicial) at an institution with Inicial + Secundario will see BOTH level groups
- There's no per-user level scoping in the sidebar

---

## 5. Level Value Objects

### `EducationalLevelCode` (enum)

**File**: `packages/domain/src/shared/value-objects/educational-level.ts`

```ts
export enum EducationalLevelCode {
  INICIAL = 1,
  PRIMARIO = 2,
  SECUNDARIO = 3,
  TERCIARIO = 4,
  ADMINISTRACION = 9,
}
```

**Key behaviors**:
- `EducationalLevel.fromLevelCode(compositeCode)`: extracts base from composite code via `Math.floor(code / 10)`
- `EducationalLevel.isPedagogical`: checks code is 1-4 (not 9)
- Labels: "Inicial", "Primario", "Secundario", "Terciario", "Administración"

### `EducationalModalityCode` (enum)

**File**: `packages/domain/src/shared/value-objects/educational-modality.ts`

```ts
export enum EducationalModalityCode {
  COMUN = 0,
  TALLERES = 1,
  BILINGÜISMO = 2,
  TODOS = 9,
}
```

### `LevelType` (enum — composite codes)

**File**: `packages/domain/src/institution/value-objects/level.ts`

```ts
export enum LevelType {
  INICIAL = 10,
  TALLERES_INICIAL = 11,
  BILINGÜISMO_INICIAL = 12,
  PRIMARIO = 20,
  TALLERES_PRIMARIO = 21,
  BILINGÜISMO_PRIMARIO = 22,
  SECUNDARIO = 30,
  TALLERES_SECUNDARIO = 31,
  BILINGÜISMO_SECUNDARIO = 32,
  TERCIARIO = 40,
  ADMINISTRACION = 90,
  TODOS = 99,
}
```

**Composite code formula**: `levelCode * 10 + modalityCode`
- `INICIAL(1) + COMUN(0) = 10`
- `PRIMARIO(2) + TALLERES(1) = 21`
- `SECUNDARIO(3) + BILINGÜISMO(2) = 32`

### `Level` Value Object

**File**: `packages/domain/src/institution/value-objects/level.ts`

Key methods:
| Method | Returns | Description |
|--------|---------|-------------|
| `Level.create(value)` | `Result<Level>` | From string ("INICIAL") or number (10) |
| `Level.fromParts(levelCode, modalityCode)` | `Level` | From base level + modality codes |
| `level.get()` | `LevelType` | Composite code (10, 20, etc.) |
| `level.toCode()` | `number` | Same as `get()` |
| `level.levelCode` | `EducationalLevelCode` (1-4) | Extracted base level |
| `level.modalityCode` | `EducationalModalityCode` (0-2) | Extracted modality |
| `level.educationalLevel` | `EducationalLevel` | VO with label, isPedagogical |
| `level.modality` | `EducationalModality` | VO with label, isPedagogical |
| `level.belongsToLevel(levelCode)` | `boolean` | Checks base level match |
| `level.hasModality(modalityCode)` | `boolean` | Checks modality match |
| `level.isPedagogical` | `boolean` | Excludes ADMINISTRACION/TODOS |
| `Level.allPedagogical()` | `Level[]` | All 10 pedagogical levels |
| `Level.forLevel(levelCode)` | `Level[]` | Levels for a specific base level |

### `LEVEL_CATALOG` (canonical catalog)

**File**: `packages/domain/src/institution/value-objects/level-catalog.ts`

12 entries total: 10 pedagogical + ADMINISTRACION + TODOS. Each has `code`, `name`, `label`, `levelCode`, `modalityCode`, `pedagogical`.

### Frontend Constants

**File**: `web/src/constants/levels.ts`

Duplicates the domain catalog for frontend use:
- `LEVEL_CATALOG`: `LevelOption[]` — 12 entries
- `PEDAGOGICAL_LEVELS`: `LevelOption[]` — 10 entries (pedagogical only)
- `LEVELS_BY_BASE`: `Record<number, LevelOption[]>` — grouped by base level code (1-4)
- `LEVEL_LABELS`: `Record<number, string>` — code → label lookup
- `levelLabel(code)`: helper function

---

## Summary of Level Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ INSTITUTION levels (multi)                                      │
│ DB: InstitutionLevel (level=1..4, modality=0..2)                │
│ API: { levels: [10,20,30], institution_levels: [{..},{..}] }   │
│ FE: InstitutionConfig.levels: number[]                          │
│                                                                 │
│ Used by: Sidebar filtering (which menus to show)                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ USER level (SINGLE)                                             │
│ DB: User.level (Int?, 1..9) — standalone, no FK relation        │
│ JWT: { level: 1 }                                               │
│ API /me: { level: 1 }                                           │
│ FE: User.level: number                                          │
│                                                                 │
│ Used by: NOTHING in the sidebar currently                       │
│          NOT used for route guarding or content filtering        │
└─────────────────────────────────────────────────────────────────┘
```

**Key insight**: The system has TWO separate level concepts:
1. **Institution levels** (many) → which pedagogical contexts exist at this school
2. **User level** (one) → which single pedagogical context this user belongs to

Currently, ONLY institution levels are used for filtering (sidebar). User level exists in the data model but is not consumed by the UI for access control. This is the gap you likely want to close.

---

## Affected Areas Summary

| File | Role in Level Handling |
|------|----------------------|
| `packages/domain/src/institution/entities/institution.ts` | Entity: `institutionLevels` array, `levels` getter, `hasLevel`, `hasEducationalLevel` |
| `packages/domain/src/auth/entities/user.ts` | Entity: `level` (single EducationalLevelCode), `modality` (single) |
| `packages/domain/src/institution/value-objects/level.ts` | `Level` VO, `LevelType` enum, composite code math |
| `packages/domain/src/institution/value-objects/level-catalog.ts` | `LEVEL_CATALOG`, `LEVEL_LABELS`, `LEVEL_NAMES` |
| `packages/domain/src/shared/value-objects/educational-level.ts` | `EducationalLevelCode` enum (1-4,9) + `EducationalLevel` VO |
| `packages/domain/src/shared/value-objects/educational-modality.ts` | `EducationalModalityCode` enum (0-2,9) + `EducationalModality` VO |
| `api/prisma/schema_master.prisma` | `InstitutionLevel` table (level+modality), `User.level` column |
| `api/src/presentation/institution/institution.controller.ts` | `GET /me` → full institution config, `toResponse()` with `levels` + `institution_levels` |
| `api/src/presentation/institution/dto/create-institution-full.dto.ts` | DTO: `institution_levels[]` (new), `levels[]` (legacy) |
| `api/src/application/institution/use-cases/institution.use-cases.ts` | `parseInstitutionLevels()` — new + legacy format parsing |
| `api/src/infrastructure/persistence/prisma/repositories/prisma-institution.repository.ts` | `save()`, `update()`: delete+recreate InstitutionLevel rows |
| `api/src/presentation/auth/auth.controller.ts` | `GET /v1/auth/me` — returns JWT payload (user.level, institutionId) |
| `api/src/application/auth/use-cases/login.use-case.ts` | Builds JWT payload: `level: user.level` |
| `api/src/infrastructure/auth/guards/auth.guard.ts` | Extracts `level` from JWT into `AuthenticatedUser` |
| `api/src/infrastructure/auth/jwt-auth-port.ts` | `JwtPayload.level: number` |
| `api/src/presentation/users/users.controller.ts` | User CRUD: accepts/returns `level` |
| `api/src/presentation/users/dto/create-user.dto.ts` | `level: number`, `modality: number` — single values |
| `api/src/application/users/use-cases/users.use-cases.ts` | `userToResponse()` includes `level` + `modality` |
| `api/src/infrastructure/persistence/prisma/repositories/prisma-user.repository.ts` | Maps `User.level`/`User.modality` to/from DB |
| `web/src/context/institution-context.tsx` | `InstitutionConfig.levels: number[]` — fetched from `GET /institutions/me` |
| `web/src/context/auth-context.tsx` | `User.level?: number` — from JWT (login response) |
| `web/src/components/layout/sidebar.tsx` | Filters menus by **institution** `baseLevels` (Set of 1..4), NOT by user.level |
| `web/src/components/layout/SidebarGroup.tsx` | Collapsible group container — no level logic |
| `web/src/constants/levels.ts` | Frontend catalog: `PEDAGOGICAL_LEVELS`, `LEVELS_BY_BASE`, `LEVEL_LABELS` |
| `web/src/pages/dashboard/institutions.tsx` | Form: checkbox grid of PEDAGOGICAL_LEVELS → `institution_levels[]` payload |
| `web/src/pages/dashboard/users.tsx` | Form: dropdown of `LEVEL_LABELS` for single `level` field |

---

## Ready for Proposal

**Yes.** This exploration covers all 5 requested areas exhaustively. The key findings:
1. Institution levels are multi-valued, stored relationally, exposed as both composite codes and structured entries.
2. User level is single-valued, standalone, and currently UNUSED for access control.
3. The `/me` endpoint returns only the JWT payload (user level) — NOT merged with institution levels.
4. The sidebar filters by institution levels only — user level is completely ignored.
5. The level value object system is thorough: base codes (1-4), modality codes (0-2), composite codes (base*10+modality), and full catalog.

**Next recommended phase**: SDD-PROPOSE if this research is for a specific change. The gap between institution-level filtering (sidebar) and user-level access control is the most notable finding.
