# Design: Academic Cycle Refactor

## Technical Approach

Bottom-up refactor following Clean Architecture. Two changes: (1) relax `code` from 4-digit numeric to alphanumeric uppercase 1–15 chars, (2) remove `description` from all layers. The entity, Prisma schema, DTOs, use cases, controller, and frontend are already aligned — only the CycleCode regex needs a minor tightening to match the spec.

## Architecture Decisions

### Decision: CycleCode regex format

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `^[A-Z0-9-]{1,15}$` | Allows hyphen as first character | Rejected |
| `^[A-Z0-9][A-Z0-9-]{0,14}$` | First char must be alphanumeric | **Chosen** |

**Rationale**: First character must be alphanumeric per spec (`^[A-Z0-9][A-Z0-9\-]{0,14}$`). A leading hyphen would cause ambiguity in sorting and encoding. Existing 4-digit numeric codes (`^\d{4}$`) remain valid as a strict subset. Backward-compatible.

### Decision: `description` removal — no VO ceremony

**Choice**: Remove `description` as a plain string from all layers. No `CycleDescription` VO was ever created — the field was always a raw `String?` in Prisma with no domain constraints.

**Alternatives considered**: Creating a `CycleDescription` VO just to delete it (unnecessary). Deleting directly from props, DTOs, and schema (chosen).

**Rationale**: `name` already conveys semantic identity. `description` adds no domain value. Removing a plain string field has no cascading domain impact. No barrel export, error class, or test file to delete.

### Decision: DTO validation stays loose on format

**Choice**: Zod DTO schemas validate length (1–15 chars) and required/non-empty, but not regex pattern. Uppercase normalization and format validation are deferred to `CycleCode.create()` in the domain layer.

**Rationale**: Follows existing codebase pattern — presentation validates shape (required fields, types, length), domain validates business rules (format). `CycleCode.create()` returns `ValidationError` which the controller maps to HTTP 422 via NestJS exception filters. No change to DTO schemas needed.

## Data Flow

```
POST /academic-cycles
  → ZodValidationPipe (code: 1–15 chars)
    → CreateAcademicCycleUC → CycleCode.create (regex + uppercase)
      → AcademicCycle.create → Repository.save → Prisma (code as-is)

GET /academic-cycles
  → ListAcademicCyclesUC → Repository.findActive/findAll
    → toDomain (CycleCode.reconstruct) → toCycleResponse (code: c.code.get())
      → Response: NO description field
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/domain/src/pedagogy/value-objects/cycle-code.ts` | Modify | Regex: `^[A-Z0-9][A-Z0-9-]{0,14}$` — disallow hyphen as first char. Update error message wording. |
| `packages/domain/src/pedagogy/__tests__/value-objects/cycle-code.test.ts` | Modify | Add test: `-ABC` (hyphen-first) rejected. Add test: 16-char code rejected. |
| `api/prisma/schema_tenant.prisma` | No change | Already has no `description` column; `code` is `String @unique` per spec. |
| `api/prisma/migrations/` | Investigate | Migration to drop `description` column — required only if column exists in deployed DB. Schema shows none. |

All other files in the proposal already omit `description` — entity, errors, barrel exports, DTOs, use cases, controller, repository, frontend types, and UI require no modification.

## Interfaces / Contracts

**CycleCode regex** (only code change):
```ts
// Current: /^[A-Z0-9-]{1,15}$/
// Target:  /^[A-Z0-9][A-Z0-9-]{0,14}$/
// First char: [A-Z0-9], remaining 0–14: [A-Z0-9-], total: 1–15
```

**API response contract** (`GET /v1/academic-cycles`): each cycle includes `uuid`, `code` (uppercase 1–15 chars), `name`, `level`, `modality`, `startDate`, `endDate`, `active`, and bimonths (null or ISO dates). Paginated responses add `page`, `pageSize`, `total`. `description` is absent.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `CycleCode.create('-ABC')` → `Err` | Vitest — extend `cycle-code.test.ts` |
| Unit | `CycleCode.create` 16+ chars → `Err` | Already covered; verify still passes with new regex |
| Unit | `toCycleResponse` omits `description` | Assert response object keys exclude `description` |
| Integration | Controller returns `code`, no `description` | HTTP-level test against controller |

## Migration / Rollout

**Migration**: If the `description` column exists in deployed databases, create a Prisma migration: `ALTER TABLE academic_cycles DROP COLUMN description`. Verify against production schema first — the current `schema_tenant.prisma` has no such column.

**Rollback**: Git revert the commit. If migration was executed, restore column from backup (data was intentionally discarded). The CycleCode regex change is backward-compatible — all existing 4-digit numeric codes remain valid.

## Open Questions

- [ ] Does any deployed database still have a `description` column on `academic_cycles`? (Current schema shows none — verify against production)
