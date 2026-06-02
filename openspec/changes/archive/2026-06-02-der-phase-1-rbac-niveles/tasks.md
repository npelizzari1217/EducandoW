# Tasks: DER Phase 1 — RBAC + Niveles Educativos

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~50 (doc edits only) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Delivery strategy | single-pr |
| Decision needed before apply | No |

## Phase 1: Documentation Updates

- [ ] 1.1 Update `docs/gap-analysis-der.md`: mark RBAC tables (#2 roles, #3 usuarios_roles, #7 permisos, #8 roles_permisos) as ✅ IMPLEMENTED with note about module-based approach
- [ ] 1.2 Update `docs/gap-analysis-der.md`: mark #10 niveles_educativos as ✅ IMPLEMENTED via EducationalLevelCode enum + composite encoding
- [ ] 1.3 Add header note to `docs/plan-rbac-evaluacion.md`: "RBAC ya implementado — RoleModule + actions[] reemplaza Permission/RolePermission"
- [ ] 1.4 Verify `docs/diagrama-er.md` already reflects actual implementation

## Phase 2: Verification

- [ ] 2.1 Read all 3 docs and confirm consistency
- [ ] 2.2 Run `git diff --stat` to confirm only docs changed
