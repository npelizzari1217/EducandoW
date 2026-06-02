# Design: DER Phase 1 — RBAC + Niveles Educativos

## Technical Approach

Documentation-only alignment. No code changes. Update DER docs to reflect actual implementation.

## Architecture Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Mark RBAC as ✅ IMPLEMENTED | `Role` + `UserRole` + `RoleModule` with `actions[]` is functionally equivalent to DER's `roles` + `usuarios_roles` + `permisos` + `roles_permisos` |
| 2 | Mark niveles as ✅ IMPLEMENTED | `EducationalLevelCode` enum + composite encoding is the canonical source of truth; fixed domain concepts are enums, not data |
| 3 | Update gap-analysis, not ER diagram | `diagrama-er.md` already reflects reality; only `gap-analysis-der.md` is stale |
| 4 | Add note to plan-rbac-evaluacion.md | Prevent future confusion — the plan assumes flat tables that already exist as module-based |

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `docs/gap-analysis-der.md` | Modify | Update rows #2, #3, #7, #8 → ✅ IMPLEMENTED; #10 → ✅ IMPLEMENTED (enum) |
| `docs/plan-rbac-evaluacion.md` | Modify | Add header note: "RBAC ya implementado con RoleModule + actions[]" |
| `docs/diagrama-er.md` | Verify | Already correct — no changes needed |

## Testing Strategy

No automated tests — documentation review. Verify by reading updated files for accuracy.
