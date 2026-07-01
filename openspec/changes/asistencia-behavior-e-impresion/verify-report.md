# Verify Report — asistencia-behavior-e-impresion

**Status:** PASS (with checkpoints)
**Branch:** feat/asistencia-behavior-e-impresion
**Verified against:** spec #1657 (12 AC-P1-n + 17 AC-P2-n), design #1658, apply-progress #1660, tasks.md

## Test / Build results (re-run, not trusted from apply-progress alone)

`pnpm test` (turbo, forced, no cache):
- `@educandow/domain`: 110 files / 1269 tests — PASS
- `api`: 196 files / 1972 tests — PASS
- `web`: 49 files / 595 tests — PASS

`pnpm build` (turbo, forced, no cache): 3/3 tasks — PASS
- web build still emits the pre-existing `html2pdf-*.js` chunk (285 KB gzip), owned by
  `PremiumPrintReport.tsx` (unrelated). Confirms no NEW client-side PDF path was introduced
  (regression guard for AC-P2-3 / REQ-P2-2).

Numbers match apply-progress claims exactly (domain 1269 / api 1972 / web 595, build 3/3).

## AC-by-AC verification (code read, not just apply-progress trust)

### Parte 1 — behavior
| AC | Verdict | Evidence |
|----|---------|----------|
| AC-P1-1 | PASS | `AttendanceBehavior.create()` validates membership in 7-value set; DTOs use `z.nativeEnum(AttendanceBehaviorValue)` |
| AC-P1-2 | PASS | `absenceValue` untouched getter, independent of `behavior`; Decimal(4,2) unchanged |
| AC-P1-3 | PASS | seed use-case + `api/prisma/seed.ts` + migration SQL all map `P → NO_COMPUTA` |
| AC-P1-4 | PASS | same 3 sources map `SAB/DOM/X → NO_ELEGIBLE` |
| AC-P1-5 | PASS | `Update`/`Delete` use-cases call `entity.assertMutable()` before any mutation |
| AC-P1-6 | PASS | Create/Update DTOs + use-cases require/accept `behavior`; controller `toResponse` returns it |
| AC-P1-7 | PASS | `asistencia-mensual.tsx:497` filters combo by `t.behavior !== NO_ELEGIBLE_BEHAVIOR` |
| AC-P1-8 | PASS | same filter is inclusive of 1,2,4,5,6,7 (only excludes NO_ELEGIBLE) |
| AC-P1-9 | PASS | lock at line 761 checks `behavior === NO_ELEGIBLE_BEHAVIOR` only — DIA_NO_HABIL (7) stays selectable |
| AC-P1-10 | PASS (schema/migration) / **CHECKPOINT** (not executed) | `schema.prisma` declares `behavior AttendanceBehavior` non-null; migration SQL stages create-type→nullable→backfill→NOT NULL correctly. **NOT run against any tenant DB** — no DB in this sandbox. Must run `prisma migrate deploy` at actual deploy, dry-run against a prod dump first (Riesgo A, already flagged in design). This is a deferred deployment step, not a code defect. |
| AC-P1-11 | PASS | no `@@unique` constraint on `behavior` in schema; only `@@unique([level, code])` |
| AC-P1-12 | PASS | fractional absenceValue path independent of behavior validation |

### Parte 2 — impresión
| AC | Verdict | Evidence |
|----|---------|----------|
| AC-P2-1 | PASS | `btn-imprimir-general` → GET `/course-cycles/:id/asistencia-mensual/print` with `responseType:'blob'` |
| AC-P2-2 | PASS | `btn-imprimir-materia` → GET `/materias-curso-ciclo/:id/asistencia-mensual/print` |
| AC-P2-3 | PASS | `pdf-generator.service.ts`: `landscape: options?.landscape ?? false` (default preserved for boletín/constancia); use-case calls `generatePdf(html, { landscape: true })`; no `html2pdf` import anywhere in the new code path |
| AC-P2-4 | PASS | `.hbs` renders alumnos (rows) × `dayNumbers` (columns) via `{{lookup ../days this}}` |
| AC-P2-5..10 | PASS | `computeStudentTotals` formula: tardesJust=Σ(behavior=6), tardesInj=Σ(behavior=5), totalTardes=tardesJust+tardesInj, ausJust=Σ(behavior=2), ausInj=Σ(behavior=1), ausTotal=ausJust+ausInj — matches spec exactly |
| AC-P2-11 | PASS | `computeDiasHabiles` uses a `Set<number>` of day indices 1..daysInMonth; a day carries exactly one code so double-count is structurally impossible (ADR-07) |
| AC-P2-12 | PASS | only `NO_ELEGIBLE`/`DIA_NO_HABIL` subtracted; 1,2,4,5,6 all count as hábil |
| AC-P2-13 | PASS | both `executeGeneral`/`executeMateria` funnel into the same private `render()` pipeline |
| AC-P2-14 | PASS | Set-based, multiple feriados each contribute one index |
| AC-P2-15 | PASS | plain float sums, no rounding truncation before totals |
| AC-P2-16 | PASS | `Object.values(days)` over an empty record yields 0 for all six totals, no throw |
| AC-P2-17 | **PARTIAL — SUGGESTION** | Aggregation math correctly excludes any index beyond `daysInMonth` (the loop only runs `1..dim`), so totals/días-hábiles are never polluted. But the literal scenario text ("PDF renders columns 29/30/31 ... displays the marker 'X'") is not implemented — the PDF simply omits those columns instead of rendering them as "X". This is a deliberate, documented design call (tasks.md T3.2: "they render 'X' per web, but the pure function only sees valid day indices"). Functionally safe, but a literal spec-text deviation — confirm with product owner whether omission is acceptable or an explicit "X" column is expected in print output. |

## Regression check — boletín / constancia (shared `pdf-generator.service.ts`)

`pnpm --filter api test` for `src/application/reportes/__tests__` re-run in isolation: all green,
92%+ statement coverage, no change in call sites (`generate-boletin.use-case.ts:217` and
`generate-constancia-regular.use-case.ts:198` still call `generatePdf(html)` with zero args →
`landscape: false` default preserved). No regression.

## Coverage (re-measured, not trusted from apply-progress)

Scoped run (`vitest run --coverage` limited to `application/asistencia-reporting` +
`presentation/asistencia-reporting`, per-file via `coverage-summary.json`):

| File | Stmts | Branch | Funcs | Lines |
|------|-------|--------|-------|-------|
| `asistencia-reporting.errors.ts` | 100 | 100 | 100 | 100 |
| `generate-asistencia-mensual-pdf.use-case.ts` | 94.54 | **76.08** | 100 | 94.33 |
| `asistencia-reporting.controller.ts` | 100 | 100 | 100 | 100 |
| `asistencia-reporting.module.ts` | 0 | 100 | 0 | 0 |
| `dto/asistencia-reporting.dto.ts` | 100 | 100 | 100 | 100 |

- **WARNING**: use-case branch coverage is 76.08%, below the 80% project threshold. Confirmed root
  cause: uncovered branches are exclusively the negative/fallback paths inside `checkDoor2General`
  / `checkDoor2Materia` (courseCycle-not-found, docente-not-found, not-preceptor/no-group,
  tenant-client-null) — Door-2 authorization guards that are only exercised on the admin
  (isAdministrative bypass) happy path in the current test suite. Statements/lines/functions are
  all ≥94%, so the aggregation/rendering logic (the actual new business logic, REQ-P2-4..7) is
  fully exercised. Severity is contained because these branches fail CLOSED (`throw
  ForbiddenError`) — an untested branch here means a missing negative-path *test*, not a
  functional gap in production behavior. Recommend adding 4 negative-path unit tests
  (courseCycle-not-found ×2, not-preceptor, no-group) before considering this slice
  production-hardened, but this does not block archive.
- `asistencia-reporting.module.ts` at 0% matches the codebase-wide convention — **zero** `*.module.ts`
  files under `api/src/presentation/**` have a dedicated unit test (verified across all 22 module
  files). Not a regression introduced by this change.

## Tasks.md cross-check

All PR1–PR4 checkboxes are `[x]` except the single expected exception:
`pnpm --filter api prisma:migrate:tenant (dev) applies cleanly on a fresh tenant DB` — explicitly
left `[ ]` with a documented reason (no DB access in this sandbox; deferred to deploy). This is the
correct, honest state — not a false-complete claim.

## Findings summary

- **CRITICAL: 0**
- **WARNING: 1** — use-case branch coverage 76.08% (Door-2 fallback paths untested; fails closed, low risk)
- **SUGGESTION: 2** — (1) AC-P2-17 literal "X" column not rendered in print PDF (functionally safe, cosmetic); (2) none of this changes bundle size but the web build still carries the unrelated 285KB html2pdf chunk (pre-existing, opportunistic cleanup only)
- **DEPLOYMENT CHECKPOINT (not a fail): 1** — tenant migration (`AttendanceBehavior` enum + column + backfill) has not been run against any real database; must run `prisma migrate deploy` (with a prior dry-run against a prod dump, per Riesgo A) before/during actual deploy.

## Recommendation

`next_recommended: sdd-archive`. No CRITICAL issues block closing this change. The one WARNING
(branch coverage) and two SUGGESTIONs are non-blocking and can be tracked as fast-follow items;
the deployment checkpoint (migration execution) should be called out explicitly in the archive
report and/or a deploy runbook, since it is the only remaining action item outside the SDD cycle
itself.
