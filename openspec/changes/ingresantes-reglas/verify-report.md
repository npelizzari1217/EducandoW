# Verify Report: ingresantes-reglas

**Date**: 2026-06-12
**Branch**: feat/ingresantes-reglas
**Verdict**: PASS WITH WARNINGS — 0 CRITICAL, 2 WARNING, 2 SUGGESTION

---

## Task Completion

All tasks A–F are marked [x] in tasks.md. No pending or deferred items.

---

## Test Results (real runs)

| Package | Files | Tests | Result |
|---------|-------|-------|--------|
| packages/domain | 92 | 1033 | ALL PASS |
| api (total) | 114 | 1109 | 6 FAIL pre-existing\* |
| api — ingresante use-cases | 1 | 32 | ALL PASS |
| api — cleanup script | 1 | 6 | ALL PASS |
| web (total) | 32 | 351 | ALL PASS |
| web — ingresantes page | 1 | 6 | ALL PASS |

\* Pre-existing failures: `postgres-admin.service.test.ts` (6) and `ensure-institution-levels.test.ts` — both related to Pool mock incompatibility, no relation to this change.

### TypeScript

- `packages/domain`: 0 errors
- `api`: 11 errors — all pre-existing (`study-plan.use-cases.test.ts`, `course-cycle.dto.test.ts`, `competency.controller.spec.ts`). **Zero new errors in ingresante files.**
- `web`: 0 errors
- `vite build`: SUCCESS (pre-existing chunk-size warnings unrelated to this change)

---

## Spec Verification

### Spec 01 — Máquina de estados (SC-SM-01..10): PASS

| Scenario | Status |
|----------|--------|
| SC-SM-01 INSCRIPTO→PAGO_MATRICULA valid | ✓ TRANSITIONS map + test |
| SC-SM-02 INSCRIPTO→ACEPTADO rejected (skip) | ✓ tested in B-1 |
| SC-SM-03 PAGO_MATRICULA→INSCRIPTO rejected (backward) | ✓ tested in B-1 |
| SC-SM-04 INGRESO terminal immutable | ✓ tested |
| SC-SM-05 NO_INGRESARA terminal immutable | ✓ tested |
| SC-SM-06..08 NO_INGRESARA from any non-terminal | ✓ tested |
| SC-SM-09 Direct INGRESO via status-update rejected | ✓ explicit guard before transitionTo |
| SC-SM-10 Legacy record / D2 non-retroactive | ✓ reconstruct() bypasses validation + test |

`setStatus()` is confirmed removed. `transitionTo()` + `markIngreso()` use Result pattern.

### Spec 02 — Campos obligatorios (SC-LVL-01..05, SC-CYC-01..06): PASS WITH 1 WARNING

| Scenario | Status |
|----------|--------|
| SC-CYC-01 No cycleId rejected | ✓ Zod uuid (DTO) + use-case guard |
| SC-CYC-05 cycleId level mismatch rejected | ✓ cycle.level.code vs level.levelCode in use-case |
| SC-LVL-01 ROOT creates with explicit level | ✓ allLevels path in controller |
| SC-LVL-02 ADMIN creates with institution level | ✓ allLevels path (indirect: tenant scoping) |
| SC-LVL-03 ADMIN wrong level rejected | WARNING — indirect only (see below) |
| SC-LVL-04 DIRECTOR level auto-assigned | ✓ controller overrides body.level |
| SC-LVL-05 No level rejected | ✓ Zod min(1) + use-case |
| SC-CYC-06 D1 cleanup deletes null-cycleId rows | ✓ script + tests + migration applied |

D1 migration `20260612180000_ingresante_cycle_required` confirmed applied. DB column `cycle_id` is NOT NULL with ON DELETE RESTRICT FK. Zero NULL rows in active tenant.

### Spec 03 — Promote transaccional (SC-PRM-01..06): PASS

| Scenario | Status |
|----------|--------|
| SC-PRM-01 Successful promote (Student + Enrollment + INGRESO) | ✓ tested |
| SC-PRM-02 Student creation fails → full rollback | ✓ tested |
| SC-PRM-03 Enrollment creation fails → full rollback | ✓ tested |
| SC-PRM-04..05 Non-ACEPTADO rejected | ✓ tested |
| SC-PRM-06 STUDENTS.CREATE permission required | ✓ @Roles decorator |

`PrismaTenantTransactionRunner` correctly rebinds `TenantContext` ALS with `tx` client so all repo calls inside `runner.run()` transparently use the transaction.

---

## Issues

### WARNING-1: `markNoIngresara()` bypasses state machine

**File**: `packages/domain/src/ingresante/entities/ingresante.ts` line 127

`markNoIngresara()` directly mutates `this.props.status` without calling `canTransitionTo()`. It is currently **dead code** (zero callers in the entire codebase) but is a latent correctness bug: any future caller would bypass terminal-immutability rules. Should be removed or rewritten to delegate to `transitionTo()`.

### WARNING-2: No controller-level unit tests for role-based level enforcement

SC-LVL-01 through SC-LVL-04 are not covered at the controller layer. There are no unit tests for `IngresanteController.create()` that verify:
- ROOT/ADMIN: body.level passes through unchanged
- DIRECTOR/SECRETARIO: body.level is overridden with their composite level
- User with empty `compositeLevels`: `BadRequestException` thrown

The ADMIN path is indirectly verified via ING-2 (web test). The DIRECTOR override path has no automated test coverage.

### SUGGESTION-1: SC-LVL-03 ADMIN level validation is indirect

Backend only validates that the submitted `cycleId` matches the submitted `level` (cycle.level.code === level.levelCode). It does NOT maintain a whitelist of levels the ADMIN user may access. Protection comes from tenant DB scoping: ADMIN can only find cycles within their institution's tenant DB, which naturally limits available cycleIds. This is effective in practice but does not strictly implement the spec wording ("API returns a validation error" for ADMIN using a level not in their institution).

Risk: LOW. Would only matter if an institution's tenant DB contained cycles for multiple educational levels AND an ADMIN wanted to submit an unauthorized level+cycleId combination.

### SUGGESTION-2: Web tests missing F-1 fixed-level scenario

`ingresantes.test.tsx` only mocks an ADMIN user (`roles: ['ADMIN']`). The DIRECTOR/SECRETARIO scenario where the level field is a disabled `<input>` auto-set from `userLevels[0]` is not tested at the component level.

---

## DB State (local environment)

- **educandow_ccaeff56** (active tenant): `ingresantes.cycle_id` is `NOT NULL`, FK is `ON DELETE RESTRICT`, 1 row present with valid `cycleId`.
- **educandow_5282eecf**: no `ingresantes` table — this DB pre-dates the `add_ingresantes` migration; not a regression.
- Migration `20260612180000_ingresante_cycle_required` applied.

---

## Known Debts (Acceptable, Documented)

1. **D1 cleanup + NOT NULL migration are MANUAL deploy steps** — must run `cleanup-ingresantes-sin-ciclo.ts` before `prisma:migrate:tenant:deploy`, with backup. Documented in `design.md` and task E-3.
2. **Frontend non-ROOT/ADMIN assumes `userLevels[0]`** — institutions where a non-admin user has multiple levels are not supported in this release. Documented in decision D3.
