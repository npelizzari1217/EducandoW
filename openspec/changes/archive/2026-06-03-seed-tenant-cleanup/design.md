# Design: Seed Tenant Cleanup & DB Push Policy

## Technical Approach

Two independent cleanup actions:
1. Delete `seed-tenant-data.ts` — redundant, non-idempotent, zero imports from anywhere
2. Insert HTML comments as deprecation warnings in 3 archive files referencing `prisma db push`

No code changes, no dependency updates, no test modifications required.

## Architecture Decisions

| # | Option | Tradeoff | Decision |
|---|--------|----------|----------|
| 1 | Delete `seed-tenant-data.ts` | Lose demo fixtures (student, teacher, course) | **Delete** — reference data already in `seed.ts`; demo data non-essential |
| 2 | Convert to `upsert()` | Keeps demo data but adds maintenance burden for hardcoded IDs | Rejected — demo data belongs in test factories, not seed scripts |
| 3 | Archive comment format | HTML `<!-- -->` vs markdown `> [!WARNING]` | **HTML comment** — visible in raw text, doesn't alter rendered markdown structure |

### Decision 1: DELETE seed-tenant-data.ts

**Choice**: Delete the file
**Alternatives considered**: Convert all `create()`/`createMany()` to `upsert()`
**Rationale**: 
- `seed.ts` already exports `seedAttendanceStatuses()` and `seedGradeScales()` — both idempotent with `upsert()`
- `seed-tenant.ts` imports and uses those functions — covers all essential tenant reference data
- The demo data (student "Juan Pérez", teacher "Carlos García", etc.) are hardcoded fixtures not referenced by any test
- `grep seed-tenant-data` returns zero results across all code, config, and docs

### Decision 2: HTML comment warning in archives

**Choice**: `<!-- ADVERTENCIA: prisma db push está DEPRECATED... -->` at file top
**Alternatives considered**: Rewrite archive content to remove references
**Rationale**: Archives are historical records — modifying their factual content is misleading. A warning preserves history while alerting future readers.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `api/prisma/seed-tenant-data.ts` | Delete | Redundant, non-idempotent, unreferenced |
| `openspec/changes/archive/2026-06-02-curso-por-ciclo/archive-report.md` | Modify | Insert deprecation warning |
| `openspec/changes/archive/2026-05-26-06-planes-de-estudio/tasks.md` | Modify | Insert deprecation warning |
| `openspec/changes/archive/2026-05-26-06-planes-de-estudio/design.md` | Modify | Insert deprecation warning |
| `openspec/changes/seed-tenant-cleanup/specs/tenant-database/spec.md` | Create | Delta spec: seed idempotency |
| `openspec/changes/seed-tenant-cleanup/specs/db-migration-policy/spec.md` | Create | New spec: db push prohibition |
| `openspec/specs/tenant-database/spec.md` | Modify | Archive phase: merge delta |
| `openspec/specs/db-migration-policy/spec.md` | Create | Archive phase: copy from change |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Integration | Seed idempotency (`seed-tenant.ts` runs twice) | Manual: run `pnpm --filter api seed-tenant` twice, verify exit 0 |
| Unit | `pnpm test` full suite | Automated: verify all existing tests pass without regression |
| Policy | Archive files contain warning | grep for "ADVERTENCIA.*db push.*DEPRECATED" in archive files |

## Open Questions

None.
