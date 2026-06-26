# Verify Report: constancia-alumno-regular

**Verdict:** PASS WITH WARNINGS
**Branch:** feat/constancia-pr3-frontend (all 3 slices)
**Date:** 2026-06-26

## Test Suite Results

| Workspace | Files | Tests | Status |
|-----------|-------|-------|--------|
| api | 171 | 1698 | ALL GREEN |
| web | 45 | 499 | ALL GREEN |

Typecheck: api (tsc --noEmit) = CLEAN; web (tsc --noEmit) = CLEAN.

## Coverage on New Files

| File | Stmts | Branches | Funcs | Lines |
|------|-------|----------|-------|-------|
| generate-constancia-regular.use-case.ts | 96% | 69.23% ⚠️ | 100% | 95.83% |
| resolve-logo-data-uri.ts | 94.11% | 100% | 50%* | 100% |
| constancia.dto.ts | all scenarios tested (not in table — dynamic import) | | | |
| constancia.template.ts | ConstanciaError class tested; DatosConstancia is interface (no runtime code) | | | |
| useConstancia.ts | 100% | 100% | 100% | 100% |
| AlumnosCursoCicloPanel.tsx | 88.66% | 91.42% | 88.88% | 89.7% |

*resolve-logo-data-uri.ts: 50% function — AbortController timeout callback () => controller.abort() is never triggered in tests (fetch is mocked to reject/resolve immediately). Statement and branch coverage are fine.

**WARNING-1**: generate-constancia-regular.use-case.ts branch coverage 69.23% — below 80% threshold.
Uncovered: `if (!tenantClient)` true branch (lines 89-92) and `if (!this.template)` true branch (lines 185-190). These are defensive infrastructure guards, not business logic. All eligibility + assembly branches ARE covered.

## REQ → Coverage Matrix

| REQ | Scenario | File(s) | Status |
|-----|----------|---------|--------|
| REQ-1 | Sc1.1/1.2 — province nullable | api/prisma_master/schema.prisma (province String?), migration SQL | PASS |
| REQ-2 | Sc2.1 — 401 without token | controller-level AuthGuard (inherited, not unit-tested in isolation) | PASS |
| REQ-2 | Sc2.2 — 403 without REPORTS:READ | @Roles on handler + RolesGuard (inherited guard, not unit-tested in isolation) | PASS |
| REQ-3 | Sc3.1–3.5 — Zod validation | constancia-dto.test.ts (6 cases + 5 calendar cases) | PASS |
| REQ-4 | Sc4.1 — axccId not found → 404 | use-case test (a), controller test | PASS |
| REQ-4 | Sc4.2 — eligible → PDF | use-case test (c) | PASS |
| REQ-4 | Sc4.3 — fechaDePase set → 422 | use-case test (b), controller test | PASS |
| REQ-5 | Sc5.1 — all data groups | use-case test (d) — asserts Groups A/B/C/D in rendered HTML | PASS |
| REQ-5 | Sc5.2 — logo absent | use-case test (e) — resolveLogoDataUri returns null, no data:image | PASS |
| REQ-5 | Sc5.3 — CUE/province absent | use-case test (f) — province null, no Buenos Aires in HTML | PASS |
| REQ-5 | Sc5.4 — minimal institution | use-case test (f) variant | PASS |
| REQ-5 | Sc5.5 — fechaEmision es-AR | use-case test (g) + 4 month parameterized tests | PASS |
| REQ-6 | Sc6.1 — 200, Content-Type, Content-Disposition | controller test (happy path) | PASS |
| REQ-6 | Sc6.2 — stateless | No PdfStorageService injected; stateless by design, use-case code | PASS |
| REQ-7 | Sc7.1 — master/tenant isolation | use-case test [fix-5] — explicit assertion on which client calls which table | PASS |
| REQ-8 | Sc8.1 — button visible | W-C1 | PASS |
| REQ-8 | Sc8.2 — modal with defaults | W-C3 (destinatario + today date via todayLocalISO) | PASS |
| REQ-8 | Sc8.3 — Imprimir | W-C4 + Sc8.3 in useConstancia.test.ts | PASS |
| REQ-8 | Sc8.4 — Descargar | W-C5 + Sc8.4 in useConstancia.test.ts | PASS |
| REQ-8 | Sc8.5 — 422 shown in UI | W-C6, W-C7, Sc8.5, Sc8.5b | PASS |

## Task Completion Matrix

| Task | Status | Evidence |
|------|--------|----------|
| T-01 | DONE | province String? in schema.prisma line 26 |
| T-02 | DONE | migration 20260626120000_add_institution_province/migration.sql |
| T-03 | DONE | generate-constancia-regular.use-case.test.ts — 18 tests incl. fixes |
| T-04 | DONE | constancia.template.ts — DatosConstancia + ConstanciaError |
| T-05 | DONE | generate-constancia-regular.use-case.ts — full 4-step flow |
| T-06 | DONE | resolve-logo-data-uri.test.ts — 13 tests |
| T-07 | DONE | resolve-logo-data-uri.ts — AbortController + clearTimeout after arrayBuffer |
| T-08 | DONE | constancia-regular.hbs — 4 groups, Handlebars conditionals |
| T-09 | DONE | constancia-dto.test.ts — 11 tests |
| T-10 | DONE | constancia.dto.ts — ConstanciaBodySchema + calendar refine |
| T-11 | DONE | constancia-controller.test.ts — 6 tests (404/422/500/happy/filename/rethrow) |
| T-12 | DONE | reportes.controller.ts — @Post + @Roles + ZodValidationPipe + error mapping |
| T-13 | DONE | reportes.module.ts — useFactory with PdfGeneratorService + PrismaService |
| T-14 | DONE | useConstancia.test.ts — 7 tests (Sc8.3/3b/4/4b/5/5b) |
| T-15 | DONE | useConstancia.ts — printConstancia + downloadConstancia |
| T-16 | DONE | alumnos-curso-ciclo-panel.test.tsx — W-C1 through W-C7 |
| T-17 | DONE | AlumnosCursoCicloPanel.tsx — button + modal + handlers |
| T-18 | DONE | api: 1698 tests GREEN; web: 499 tests GREEN; typecheck clean |

## Design Decisions Audit

| Decision | Spec | Implementation | Status |
|----------|------|----------------|--------|
| Stateless (no PdfStorageService) | REQ-6 Sc6.2 | No PdfStorageService in use case; useFactory injects only PdfGeneratorService + PrismaService | PASS |
| Logo as data-URI | design/GAP-4 | resolveLogoDataUri helper; <img src="{{logoDataUri}}"> conditional | PASS |
| Date without TZ shift | design | parseFechaEmision splits on "-", uses parseInt components | PASS |
| AuthZ REPORTS:READ | REQ-2 | @Roles('ROOT', { module: 'REPORTS', action: 'READ' }) on handler | PASS |
| Render conditional (SHOULD fields) | REQ-5 | {{#if cue}}, {{#if localidad}}, {{#if provincia}}, {{#if logoDataUri}} | PASS |
| Content-Disposition: inline | REQ-6 Sc6.1 | inline; filename="constancia-regular-${axccId}.pdf" | PASS |
| Master/tenant isolation | REQ-7 | prisma.getMasterClient() for institution; TenantContext.getClient() for tenant tables | PASS |

## Warnings

WARNING-1: generate-constancia-regular.use-case.ts branch coverage 69.23% — below 80%.
- Uncovered true branches: !tenantClient guard (line 89-92), !this.template guard (lines 185-190)
- Root cause: both require infrastructure-level mocking (TenantContext returning null, fs.existsSync returning false) not currently in the test suite
- Mitigation: statement/line coverage at 96%/95.83%; all eligibility + assembly business branches ARE covered
- Recommendation: add 2 targeted tests (mock TenantContext.getClient to return null; mock fs.existsSync to return false for template path) to push branch coverage above 80%

WARNING-2: resolve-logo-data-uri.ts function coverage 50% — the AbortController timeout callback `() => controller.abort()` is never triggered.
- Root cause: tests mock fetch to reject/resolve immediately without triggering the 5s timeout
- Mitigation: 100% branch and line coverage; the callback is a 1-line closure with no branching

## Suggestions

SUGGESTION-1: The @map("province") decorator was intentionally omitted (fix-6: redundant when column name matches field name). This is correct but differs from the design spec literal. No action needed.

SUGGESTION-2: Consider adding vi.useFakeTimers + AbortController trigger test to resolve WARNING-2 and push resolve-logo-data-uri.ts function coverage to 100%.

SUGGESTION-3: The constancia.dto.ts ConstanciaBodySchema includes a calendar-date refine beyond what the spec strictly requires (only regex was specced). This is a defense-in-depth improvement, not a gap.

## Unchanged Capabilities

Boletín single (GET /boletin/:id) and batch (GET /boletin/curso/:id) are unchanged — confirmed by their existing tests passing with no modifications (1698 API tests pass; boletin test files untouched).
