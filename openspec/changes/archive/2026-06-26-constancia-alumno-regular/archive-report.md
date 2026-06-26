# Archive Report — constancia-alumno-regular

**Archived:** 2026-06-26
**Verdict:** PASS WITH WARNINGS (2 warnings — both accepted, non-blocking)
**Delivery:** 3 chained PRs (stacked-merge workflow)

---

## What was shipped

**Feature:** "Constancia de Alumno Regular" — administrative staff can now print or download
a PDF certificate of current enrollment directly from `AlumnosCursoCicloPanel`. The document
certifies that a student is an active regular student, for third-party use (social insurance,
transport subsidy, scholarships, etc.). Previously generated manually outside the system.

**New capability:** `constancia-regular`
**Levels affected:** ALL (INICIAL, PRIMARIO, SECUNDARIO, TERCIARIO) — eligibility is structural,
template is level-agnostic.

**Pull Requests merged (main):**

| PR | Slice | Title |
|----|-------|-------|
| #76 | PR #1 — Schema + Application | province field, migration, use-case + tests |
| #79 | PR #2 — Infra + Presentation | HBS template, DTO/Zod, controller, module wiring |
| #80 | PR #3 — Frontend | useConstancia hook, modal, AlumnosCursoCicloPanel button |

Note: PRs #77 and #78 were created as intermediate branches during stacked-merge recovery
(rebase conflicts on PR #2) and were closed/superseded by #79 and #80 respectively.

---

## Architecture summary

- **Use case:** `GenerateConstanciaRegularUseCase` in `api/src/application/reportes/`.
  Mixes master DB (Institution) + tenant DB (AlumnosXCursoXCiclo, Student, CourseCycle,
  CourseSection, AcademicCycle). Validates eligibility with typed `ConstanciaError`
  (mirrors `BoletinError` pattern). Stateless — no disk cache, no DB write.
- **Logo:** resolved to base64 data-URI via `resolveLogoDataUri` helper (AbortController 5s
  timeout, fetch failure → omit logo gracefully). Data-URI approach is the only reliable
  path for `puppeteer.setContent()` in headless Chromium (no base URL, no external network).
- **Date:** `fechaEmision` parsed by splitting on `"-"` and using `parseInt` components to
  avoid timezone shift from `new Date(iso)`. Formatted in es-AR long format via `Intl`.
- **AuthZ:** reuses existing `@Roles('ROOT', { module: 'REPORTS', action: 'READ' })` —
  no new permission or module introduced.

---

## Test results

| Suite | Files | Tests | Status |
|-------|-------|-------|--------|
| api | 171 | 1698 | ALL GREEN |
| web | 45 | 499 | ALL GREEN |

Typecheck: api (tsc --noEmit) = CLEAN; web (tsc --noEmit) = CLEAN.

Use-case coverage: 96% stmts / 69.23% branches⚠️ / 100% funcs / 95.83% lines.
All eligibility + assembly branches covered; only two defensive infrastructure guards uncovered.

---

## Accepted warnings

**WARNING-1 — branch coverage below 80% on use-case:**
Uncovered: `!tenantClient` guard (lines 89–92) and `!this.template` guard (lines 185–190).
Both are infrastructure-level defensive checks, not business logic. All REQ-4 eligibility
branches and REQ-5 assembly branches ARE fully covered. Mitigation path: add 2 targeted
tests mocking TenantContext.getClient → null and fs.existsSync → false.

**WARNING-2 — function coverage 50% on resolve-logo-data-uri.ts:**
The AbortController timeout callback `() => controller.abort()` is never triggered in tests
(fetch is mocked to resolve/reject immediately). 100% branch and line coverage; the callback
is a 1-line closure with no branching. No action required.

---

## Canonical spec merge

| Spec file | Change |
|-----------|--------|
| `openspec/specs/constancia-regular/spec.md` | **CREATED** — new master spec for the `constancia-regular` capability (8 requirements, all scenarios from delta) |
| `openspec/specs/institution-lifecycle/spec.md` | **UPDATED** — added `province` row to the Extended Identity Fields table |
| `openspec/specs/report-cards/spec.md` | **UNCHANGED** — boletín capabilities are unaffected; constancia-regular is a separate capability |

---

## Files changed in codebase

| File | Change |
|------|--------|
| `api/prisma_master/schema.prisma` | `province String?` added to Institution model |
| `api/prisma_master/migrations/20260626120000_add_institution_province/migration.sql` | New — additive nullable column migration |
| `api/src/application/reportes/generate-constancia-regular.use-case.ts` | New — eligibility check + data assembly + PDF render |
| `api/src/application/reportes/__tests__/generate-constancia-regular.use-case.test.ts` | New — 18 unit tests |
| `api/src/application/reportes/templates/constancia.template.ts` | New — `DatosConstancia` interface + `ConstanciaError` class |
| `api/src/infrastructure/reporting/helpers/resolve-logo-data-uri.ts` | New — logo fetch → base64 data-URI (AbortController, 5s timeout) |
| `api/src/infrastructure/reporting/helpers/resolve-logo-data-uri.test.ts` | New — 13 unit tests |
| `api/src/infrastructure/reporting/html-templates/constancia-regular.hbs` | New — A4 Handlebars template, 4 groups, conditional logo/CUE/province |
| `api/src/presentation/reportes/dto/constancia.dto.ts` | New — ConstanciaBodySchema (Zod) + DTO type |
| `api/src/presentation/reportes/__tests__/constancia-dto.test.ts` | New — 11 Zod validation tests |
| `api/src/presentation/reportes/__tests__/constancia-controller.test.ts` | New — 6 controller tests (404/422/500/happy/filename/rethrow) |
| `api/src/presentation/reportes/reportes.controller.ts` | Modified — added `@Post('constancia-regular/:axccId')` handler |
| `api/src/presentation/reportes/reportes.module.ts` | Modified — added `GenerateConstanciaRegularUseCase` via useFactory |
| `web/src/hooks/useConstancia.ts` | New — `printConstancia` + `downloadConstancia` (POST → blob) |
| `web/src/hooks/__tests__/useConstancia.test.ts` | New — 7 hook tests |
| `web/src/pages/dashboard/components/AlumnosCursoCicloPanel.tsx` | Modified — "Constancia" button + modal (destinatario + fechaEmision) |
| `web/src/pages/dashboard/components/__tests__/alumnos-curso-ciclo-panel.test.tsx` | Modified — 7 new test cases (W-C1 through W-C7) |

---

## Deferred items (not implemented — follow-up if needed)

1. **Firmante configurable** — signatoryName / signatoryTitle on Institution for formal signature block. Currently: blank "Firma y Sello" line.
2. **Audit log** — no traza of constancias emitted. By design (stateless).
3. **Nro de legajo / matrícula** — not specced; not in the domain model.
4. **Branch coverage gap** — WARNING-1 (2 infrastructure guard tests to add if coverage gate is tightened).

---

## Engram artifact IDs (traceability)

| Artifact | Engram ID |
|----------|-----------|
| explore | #1471 |
| proposal | #1472 |
| design | #1473 |
| spec | #1474 |
| tasks | #1475 |
| apply-progress | #1477 |
| verify-report | #1482 |
| archive-report | (saved to engram topic `sdd/constancia-alumno-regular/archive-report`) |

---

## Lessons learned

- **Stacked PR merge order matters:** PRs #77/#78 were created when the PR#2 branch was
  already pushed. After rebasing to resolve conflicts, new branches (#79/#80) were opened
  and #77/#78 were closed. Always rebase the entire stack before opening downstream PRs.
- **Puppeteer + logo:** `puppeteer.setContent()` has no base URL context — `file://` and
  public URL approaches both fail in headless. Only base64 data-URIs work reliably.
- **TZ-safe date parsing:** `new Date("2026-06-26")` produces midnight UTC, which converts to
  the previous day in UTC-3 (Argentina). Always split ISO strings manually for display-only
  dates (no clock needed).
- **@map("province") is redundant** when the Prisma field name matches the DB column name
  exactly. Omitting it is correct; the design spec included it unnecessarily (fix-6 applied).
