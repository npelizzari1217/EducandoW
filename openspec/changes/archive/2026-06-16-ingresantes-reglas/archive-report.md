# Archive Report: ingresantes-reglas

**Archived**: 2026-06-16  
**Branch at close**: feat/ingresantes-reglas (merged to main)  
**Verify verdict**: PASS WITH WARNINGS — 0 CRITICAL  
**Final status**: CLOSED

---

## What was delivered

Hardened the Ingresante (pre-enrollment admission) capability across three axes:

1. **State machine enforced in domain/API** — `IngresanteStatus` VO holds the TRANSITIONS map + `canTransitionTo()` + `isTerminal()`. The entity exposes `transitionTo(): Result<void, ValidationError>` and `markIngreso()` with precondition. `setStatus()` removed. The `UpdateIngresanteStatusUseCase` delegates to `transitionTo()`. Direct writes to INGRESO via the status-update endpoint are explicitly blocked.

2. **Mandatory level + cycleId on create, role-scoped** — `cycleId` is now NOT NULL at the DB level (migration `20260612180000_ingresante_cycle_required` applied). Controller resolves `resolveAccessScope(user)`: ROOT/ADMIN submit level freely; others get `userLevels[0].level` auto-assigned and locked. Use-case validates `cycle.level === level` coherence.

3. **Promote is atomic** — `TenantTransactionRunner` port + `PrismaTenantTransactionRunner` infra impl rebind `TenantContext` ALS to the `tx` client. `PromoteIngresanteUseCase` runs Student create + Enrollment create + `markIngreso()` + save inside a single Prisma transaction. Any failure throws → rollback; no orphan Student.

4. **D1 cleanup** — `api/scripts/cleanup-ingresantes-sin-ciclo.ts` iterates all tenants, deletes `cycleId IS NULL` ingresantes. Idempotent, threshold-guarded, tested (6 tests passing). This is a MANUAL deploy step.

---

## Spec merge

Delta specs (3 files) merged into a single new canonical spec:

- **Source**: `openspec/changes/archive/2026-06-16-ingresantes-reglas/specs/01-state-machine.md`
- **Source**: `openspec/changes/archive/2026-06-16-ingresantes-reglas/specs/02-required-fields.md`
- **Source**: `openspec/changes/archive/2026-06-16-ingresantes-reglas/specs/03-promote-transactional.md`
- **Canonical**: `openspec/specs/ingresante/spec.md` (new capability; no prior canonical existed)

Rationale for consolidation (not split): all three specs govern the same Ingresante entity in the same admission domain. The project pattern for comparably-sized, tightly-coupled capabilities is a single spec file (e.g., `enrollment/spec.md` covers entity, repository, and endpoint requirements together). Scenario IDs SC-SM-*, SC-LVL-*, SC-CYC-*, SC-PRM-* are preserved verbatim.

---

## Issue resolution

### WARNING-1: `markNoIngresara()` bypassed state machine
**Status: RESOLVED**  
Fixed in commit `e499d3a`. `markNoIngresara()` now delegates to `transitionTo()` instead of directly mutating `this.props.status`. Terminal-immutability rules apply.

### WARNING-2: No controller-level tests for role-based level enforcement
**Status: RESOLVED**  
`api/src/presentation/ingresante/__tests__/ingresante.controller.spec.ts` added (merged via PR #7). Covers SC-LVL-01/02/04a/04b (ROOT pass-through, ADMIN pass-through, DIRECTOR override, empty-compositeLevels → 400).

### SUGGESTION-2: Web DIRECTOR fixed-level test missing
**Status: RESOLVED**  
DIRECTOR/SECRETARIO fixed-level scenario added to `web/src/pages/dashboard/__tests__/ingresantes.test.tsx` (merged via PR #7).

---

## Remaining documented debts

| ID | Description | Risk | Action |
|----|-------------|------|--------|
| SUGGESTION-1 / D-ADMIN-LVL | SC-LVL-03 ADMIN level validation is indirect (tenant DB scoping, not explicit whitelist). Effective in practice. | LOW | Accept as documented; re-evaluate if multi-level institution use-cases arise |
| D-MANUAL-DEPLOY | D1 cleanup script + NOT NULL migration are MANUAL deploy steps. Backup required before production run. | OPERATIONAL | Documented in design.md task E-3 and canonical spec Known Debts |
| D-MULTI-LEVEL | Frontend non-ROOT/ADMIN assumes `userLevels[0]`. Multi-level non-admin users not supported. | LOW | Documented in decision D3 and canonical spec Known Debts |

---

## Artifact index

| Artifact | Location |
|----------|----------|
| Proposal | `openspec/changes/archive/2026-06-16-ingresantes-reglas/proposal.md` |
| Decisions | `openspec/changes/archive/2026-06-16-ingresantes-reglas/decisions.md` |
| Spec 01 (state machine) | `openspec/changes/archive/2026-06-16-ingresantes-reglas/specs/01-state-machine.md` |
| Spec 02 (required fields) | `openspec/changes/archive/2026-06-16-ingresantes-reglas/specs/02-required-fields.md` |
| Spec 03 (promote transactional) | `openspec/changes/archive/2026-06-16-ingresantes-reglas/specs/03-promote-transactional.md` |
| Design | `openspec/changes/archive/2026-06-16-ingresantes-reglas/design.md` |
| Tasks | `openspec/changes/archive/2026-06-16-ingresantes-reglas/tasks.md` |
| Verify report | `openspec/changes/archive/2026-06-16-ingresantes-reglas/verify-report.md` |
| Canonical spec (merged) | `openspec/specs/ingresante/spec.md` |
