# Archive Report — forbidden-error-reclassification

**Archived:** 2026-08-03 · **Verdict:** PASS WITH WARNINGS (0 CRITICAL, 1 WARNING — pre-existing, unrelated).
**Épico:** application-error-handling. **CONSUMER slice** (follow-up #1). **Nivel pedagógico:** N/A.

## What shipped

Reclassified the generic `ForbiddenError` (AuthZ caller-context) from `DomainError` → `ApplicationError`,
transversally, settling the "Opción A" debt deferred during `asistencia-result-migration`.

- New class `api/src/application/shared/errors/forbidden-error.ts` — `extends ApplicationError`,
  `constructor(message = 'Forbidden') { super(message, 'FORBIDDEN', 403); }`. Own file, no barrel.
- Deleted `packages/domain/src/shared/errors/forbidden-error.ts` + its export in `packages/domain/src/index.ts`.
- Split-import across 17 production files (8 modules) + 16 test files.
- Widened 7 use-case signatures (`nota-cursada-terciario` ×3, `docente-materia` ×3, `student` PatchStudent ×1)
  to `Result<T, DomainError | ForbiddenError>`.
- Removed dead `DOMAIN_STATUS['FORBIDDEN']` entry from `exception.filter.ts`.
- **No behavior change**: HTTP 403 preserved. **3rd real consumer** of the `ApplicationError` catalog.

## Delivery

- Option A — one atomic PR. Branch `refactor/forbidden-error-reclassification` from main (85b274a).
- 9 commits, HEAD `0c10b52`. **Not yet pushed / no PR opened** at archive time (awaiting user OK).

## Verification (independent reproduction, Docker available)

- FER-R1..R9 all PASS with evidence (see `verify-report.md`).
- `tsc --noEmit` exit 0 (after `@educandow/domain` dist rebuild).
- Unit: 2189/2190 (1 pre-existing unrelated failure). Integration: the 403-invariant path
  (`3-door-enforcement.db.test.ts`) PASSED end-to-end against live Postgres — FER-R3 proven live.
- **WARNING (1):** pre-existing integration-suite debt (4 `.db.test.ts` files on main, root commits
  `8b8ee69`/`cd25764` dated 2026-07-01) surfaced now that Docker is available. Zero `ForbiddenError`
  footprint, unrelated to this change. Tracked as a separate maintenance ticket. Does NOT block archive.

## Canonical spec sync

Updated `openspec/specs/application-error-handling/spec.md`:
- Asistencia entry: the "ForbiddenError NOT reclassified / deferred" note replaced by "reclassification
  completed by `forbidden-error-reclassification` (archived 2026-08-03)".
- `reportes`/`asistencia-reporting` entry: "BLOCKED until PR #111 merges" → "UNBLOCKED (PR #111 merged
  2026-07-12)"; noted its `ForbiddenError` throws already reclassified; flagged as épico follow-up #2.
- Added a dedicated `ForbiddenError` reclassification entry (FULLY DONE).

## Follow-ups (épico error-handling)

- **#2 asistencia-reporting/reportes** — UNBLOCKED (PR #111 merged). Migrate `BoletinError`/`ConstanciaError`/
  `AsistenciaReportingError` → `ApplicationError` + `Result` (30 throws).
- **#3 module queue** — `pedagogy`, `ingresante`, `institution`, `asignacion-curso`, `nivel-terciario`.
- **Separate ticket** — fix the 4 pre-existing failing integration `.db.test.ts` on main.
