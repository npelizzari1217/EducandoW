# Apply Progress — forbidden-error-reclassification

**Status:** COMPLETO (39/39 tareas, 7 fases). Rama `refactor/forbidden-error-reclassification` desde main (85b274a). 9 commits, HEAD `0c10b52`, working tree limpio.

## Commits

| Hash | Commit |
|------|--------|
| `455e645` | docs(sdd): add forbidden-error-reclassification planning artifacts |
| `10fa2bc` | test(shared-errors): add ForbiddenError classification test (RED) |
| `34a57a1` | refactor(shared-errors): reclassify ForbiddenError as ApplicationError (GREEN) |
| `a09ac14` | refactor(application): split-import ForbiddenError to local api path across 17 consumers |
| `204bd25` | refactor(nivel-terciario,student): widen Result signatures to `DomainError \| ForbiddenError` |
| `cf12c83` | refactor(domain): remove ForbiddenError class and barrel export |
| `d05f166` | refactor(exception-filter): remove dead `DOMAIN_STATUS['FORBIDDEN']` |
| `ed95330` | test(*): split-import ForbiddenError to local api path across 16 test files |
| `0c10b52` | docs(sdd): mark tasks complete |

## Per-phase

- **Phase 1** (classification test RED→GREEN): done — `10fa2bc`, `34a57a1`. Nueva clase `api/src/application/shared/errors/forbidden-error.ts` (`extends ApplicationError`, `super(message, 'FORBIDDEN', 403)`).
- **Phase 2** (17 production import swaps): done — `a09ac14`.
- **Phase 3** (7 signature widenings): done — `204bd25`. Drift menor: `PatchStudentUseCase.execute` era L152 (no L151), reconciliado por nombre; `checkOwnership` confirmado NO widened.
- **Phase 4** (domain deletion + barrel): done — `cf12c83`.
- **Phase 5** (filter cleanup): done — `d05f166`.
- **Phase 6** (16 test import swaps): done — `ed95330`. Enumeración: hubo que extender el grep a `.spec.ts` además de `.test.ts` (4 de los 16 son `.spec.ts`). Legacy `api/test/unit/patch-student.use-case.test.ts`: import-only, no movido.
- **Phase 7** (verification gate): done — resultados en verify-report.md.

## Verification (apply run)

- `pnpm --filter api typecheck` → **exit 0**. GOTCHA: hubo que rebuildear el `dist/` stale de `@educandow/domain` primero — pnpm resuelve tipos del output compilado, no del source; sin rebuild, `tsc` quedaba falso-verde con el export viejo cacheado.
- `pnpm test` (unit mockeado) → **2189/2190**. Única falla: `api/scripts/__tests__/archive-legacy-grading-data.spec.ts` (bug pre-existente de path-separator Windows, no está en el diff, 0 refs `ForbiddenError`).
- Integración: no corrida en el apply run (se corrió en verify, ver verify-report.md).
- Greps: residuo `packages/domain` = 0; `DOMAIN_STATUS` FORBIDDEN = 0; throw idiom preservado (asistencia-reporting 7, asignacion-curso 1).
