# Spec: DER Phase 1 — No Capability Changes

## Summary

This change is **documentation-only**. No system capabilities are introduced, modified, or removed.

## Canonical Sources of Truth

| Domain | Implementation | Location |
|--------|---------------|----------|
| RBAC | `Role` → `UserRole` (M:N) + `RoleModule` with `actions: String[]` | Prisma schema / auth-access spec |
| Educational Levels | `EducationalLevelCode` enum + composite encoding (`level * 10 + modality`) | Domain constants — no DB table |

## What This Change Does

- Updates `docs/gap-analysis-der.md` to reflect that tables #2 (roles), #3 (usuarios_roles), #7 (permisos), #8 (roles_permisos), and #10 (niveles_educativos) are covered by the existing implementation.
- Updates `docs/plan-rbac-evaluacion.md` to document that the real RBAC uses module-based permissions (`RoleModule`), not flat `Permission` + `RolePermission` tables.
- Verifies `docs/diagrama-er.md` already reflects the real implementation.

## Impact on openspec/specs/

None. No existing capability spec is modified. No new capability spec is created.
