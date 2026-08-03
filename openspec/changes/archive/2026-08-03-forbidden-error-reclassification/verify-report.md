# Verify Report — forbidden-error-reclassification

**Verdict: PASS WITH WARNINGS**
**CRITICAL: 0 | WARNING: 1 | SUGGESTION: 0**

Independent adversarial verification, reproduced from source and live test execution (not trusting apply-progress claims). Branch refactor/forbidden-error-reclassification, HEAD 0c10b52, working tree clean, 9 commits ahead of main.

---

## Environment

- Docker container educandow-db (postgres:16-alpine, port 5433) confirmed UP (docker ps).
- pnpm --filter @educandow/domain build run BEFORE typecheck (stale-dist gotcha avoided).
- Unit suite: pnpm --filter api test — ran, full output captured.
- Typecheck: pnpm --filter api typecheck — ran after domain rebuild.
- Integration suite: pnpm --filter api test:integration — ran against the live container (375.79s, single-fork).

## FER Requirement Matrix

| Req | Verdict | Evidence |
|---|---|---|
| FER-R1 | PASS | api/src/application/shared/errors/forbidden-error.ts: export class ForbiddenError extends ApplicationError, super(message, FORBIDDEN, 403). rg for ForbiddenError under packages/domain returns 0 hits. packages/domain/src/index.ts no longer contains the export line. Classification test (forbidden-error.test.ts) asserts instanceof ApplicationError true, instanceof DomainError false, code === FORBIDDEN, httpStatus === 403 — PASSED at runtime (part of the 2189 green unit tests). |
| FER-R2 | PASS | File stands alone (not merged into authorization-errors.ts). Directory listing of api/src/application/shared/errors/ shows no index.ts barrel. Grep for ForbiddenError imported from @educandow/domain returns 1 hit, confirmed a false positive at nota-cursada-terciario.use-cases.ts line 176 (an inline domain type import on the same line as the bare, locally-imported ForbiddenError). |
| FER-R3 | PASS | Reproduced end-to-end via a live integration test, not just static inspection: api/test/integration/asistencia/3-door-enforcement.db.test.ts cases (a) and (b) (expect res.status toBe 403, lines 112 and 150) boot the real NestJS app plus Postgres, drive the record-day endpoint, and hit record-general-attendance-day.use-case.ts checkDoor2(), which returns err(new ForbiddenError(...)) — routed through AppExceptionFilter ApplicationError branch. Both cases PASSED in this run (not among the 6 integration failures). Unit-level controller/use-case tests for the other 7 modules (asistencia-reporting, asignacion-curso, grading, institution, nivel-terciario, student-observation, student) all passed (2189/2190 unit total). |
| FER-R4 | PASS | student.controller.ts throwGuardianError() and asistencia-reporting.controller.ts handleError() diffs are import-line-only (git diff main...HEAD); their existing unit tests (throw-guardian-error.spec.ts, asistencia-reporting.controller.test.ts) passed. |
| FER-R5 | PASS | pnpm --filter api typecheck exits 0 after pnpm --filter @educandow/domain build (confirmed the dist-staleness gotcha does not mask a false green — ran the rebuild first, then typecheck, both green). All 7 widened signatures confirmed present verbatim as DomainError-or-ForbiddenError unions (grep-verified at nota-cursada-terciario.use-cases.ts lines 57, 95, 134; docente-materia.use-cases.ts lines 37, 77, 103; student.use-cases.ts line 152). No any / as-unknown / cast found in the diff for these files. checkOwnership (student.use-cases.ts lines 197-200) confirmed NOT widened — still Result-void-ForbiddenError. |
| FER-R6 | PASS | Count of "throw new ForbiddenError" in generate-asistencia-mensual-pdf.use-case.ts is 7. assign-docente-to-curso.use-case.ts still async execute(...) returning a bare Promise (no Result) with 1 literal throw new ForbiddenError at line 45 — diff confirms only the import line changed. No throw-to-return-err conversions anywhere in git diff main...HEAD. |
| FER-R7 | PASS | Grep for FORBIDDEN in exception.filter.ts returns 0 hits. Read the file directly: instanceof ApplicationError branch is at line 90, instanceof DomainError branch at line 94 — ApplicationError evaluated first, confirming the removed DOMAIN_STATUS FORBIDDEN entry was genuinely dead code. |
| FER-R8 | PASS | api/src/application/shared/errors/__tests__/forbidden-error.test.ts matches the design spec verbatim: asserts all 4 required properties plus a custom-message variant. Ran green as part of the unit suite. |
| FER-R9 | PASS | Only class newly present under api/src/application/shared/errors/ is ForbiddenError (moved) — authorization-errors.ts and attendance-type-level-out-of-scope-error.ts are pre-existing. api/test/unit/patch-student.use-case.test.ts confirmed still at its original path; diff for this file is 3 lines (import only). |

## Test Execution Evidence (reproduced, not trusted from apply report)

### Unit suite — pnpm --filter api test
```
Test Files  1 failed | 216 passed (217)
     Tests  1 failed | 2189 passed (2190)
```
Sole failure: scripts/__tests__/archive-legacy-grading-data.spec.ts — AssertionError: expected written paths to include /tmp/archival-test/alpha/notas.json (Windows path-separator bug). Confirmed pre-existing and unrelated: last commit touching this file is b77a178 "feat(archival): add legacy grading archival script (s3pre PR-a1)", which predates this branch entirely; zero ForbiddenError reference in the file. Matches the apply report claim exactly — independently reproduced, not just trusted.

### Typecheck — pnpm --filter api typecheck
Exit 0, no output (clean), run after pnpm --filter @educandow/domain build.

### Integration suite — pnpm --filter api test:integration (NEW — not run by apply; Docker confirmed available this time)
```
Test Files  4 failed | 11 passed (15)
     Tests  6 failed | 42 passed (48)
Duration  375.79s
```
6 failures, all in files absent from this change diff (git diff main...HEAD --stat -- api/test/integration returns empty) and zero ForbiddenError references in any of the 4 failing files:

1. asistencia/3-door-enforcement.db.test.ts — case (c) only (the 200-path): PrismaClientValidationError, argument "behavior" is missing on attendanceType.create(). Schema/fixture drift — the behavior column was added by commit 8b8ee69 (pre-existing, unrelated feature), file last touched by 1b38a5e (pre-existing). Cases (a) and (b) — the two 403-asserting cases — PASSED.
2. asistencia/attendance-independence.db.test.ts — same behavior-field seed gap, same root cause, unrelated feature/test debt.
3. asistencia/subject-group-filter.db.test.ts (3 sub-tests) — TypeError, cannot read properties of undefined reading findLatestBefore: test constructs GenerateMonthlyAttendanceUseCase with only 5 constructor args, missing the monthStatusRepo 6th param added by commit cd25764 (pre-existing, unrelated PR-3b feature). Test file last touched by fc7c139 (pre-existing).
4. docente-ciclo/dc-assignment-creates.db.test.ts DC-S2 — assertion mismatch (expected undefined, wanted a uuid), file last touched by c9929b1 (pre-existing), unrelated to this change.

None of these 6 failures are a regression introduced by this change — proven by (a) zero diff footprint on any of the 4 files or their transitive constructor dependencies, (b) zero ForbiddenError reference, (c) each root-caused to a schema/fixture/wiring gap whose introducing commit predates this branch.

## Issues

### WARNING (1)
Pre-existing integration-suite debt discovered (out of scope for this change). 4 of 15 .db.test.ts files fail for reasons unrelated to ForbiddenError (a Prisma seed missing a behavior column, a GenerateMonthlyAttendanceUseCase test-wiring gap missing monthStatusRepo, and one assertion drift). This was not surfaced before because the apply-phase environment lacked Docker; this verify run had Docker and found it. Recommend opening a separate maintenance ticket — do not block this change archive on it, since it is demonstrably unrelated (zero diff footprint, zero ForbiddenError reference, root causes predate this branch).

No CRITICAL or SUGGESTION issues found.

---

## Tasks Checklist Cross-Check

All 7 phases in tasks.md marked complete; spot-checked against source for Phase 1, Phase 2 (spot: asignacion-curso, asistencia-reporting), Phase 3 (all 7 widenings), Phase 4 (domain deletion), Phase 5 (filter cleanup), Phase 6 (legacy test path), Phase 7 (verification gate greps) — all claims independently reproduced true.

---

Persistence note (hybrid): openspec is the committed source of truth for this artifact. Engram backfill at
topic_key sdd/forbidden-error-reclassification/verify-report (type architecture, project educandow,
scope project, capture_prompt false).
