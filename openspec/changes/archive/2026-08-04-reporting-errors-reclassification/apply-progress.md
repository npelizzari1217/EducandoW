# Apply Progress — reporting-errors-reclassification

**Status:** COMPLETO — los 4 slices (0/1/2/3). 4 ramas stacked desde `main` (`e8ada82`): `refactor/reporting-errors-shared`
→ `-asistencia` → `-boletin` → `-constancia`. 7 commits. Código ~24 files / 623+/321-.

## Slice 0 — shared (aditivo, `refactor/reporting-errors-shared`)

| Hash | Commit |
|------|--------|
| `c0d4f7d` | docs(sdd): plan reporting-errors-reclassification |
| `c4c0728` | feat(errors): 8 subclases DomainError (`packages/domain/src/reportes/errors/`) + `InstitutionNotFoundError` + 8 `DOMAIN_STATUS` entries + `unwrapResultOrThrow` bound `httpStatus?:number` + rama `DomainError` |

Aditivo confirmado: cero archivos de use-case tocados.

## Slice 1 — AsistenciaReporting (`-asistencia`)

| Hash | Commit |
|------|--------|
| `7f47d8e` | refactor(asistencia-reporting): reclassify errors — 5 call-sites en generate-asistencia-mensual-pdf; borrado `asistencia-reporting.errors.ts` |

## Slice 2 — Boletin + batch (`-boletin`)

| Hash | Commit |
|------|--------|
| `09cbe3b` | refactor(boletin): generate-boletin (7 sites) + generate-boletin-batch (2 sites); borrado inline `BoletinError` |
| `f132ae9` | docs(sdd): mark Slice 2 tasks complete |

## Slice 3 — Constancia + cierre (`-constancia`)

| Hash | Commit |
|------|--------|
| `3387fcf` | refactor(constancia): generate-constancia-regular (7 sites incl `InstitutionNotFoundError`); borrado `ConstanciaError`; limpiado doc-comment stale |
| `40eb68c` | docs(sdd): sync application-error-handling canonical spec |

## Verificación (por slice, secuencia `domain build → typecheck → test → lint`)

- `tsc` verde; `pnpm --filter api test` 218/218 files, 2219/2219 tests verdes; `pnpm build` monorepo 3/3 packages verdes.
- `lint`: 5 errores PRE-EXISTENTES ajenos (diff vacío en esos files), cero nuevos.
- RED→GREEN por slice (el guard de `DOMAIN_STATUS` 0.8 fue genuinamente RED con status 400).
- **RER-R5 grep guard full-tree**: 0 hits `BoletinError|ConstanciaError|AsistenciaReportingError` fuera de `openspec/`.
- Único wire-code change: 3 guards tenant `INTERNAL_ERROR` → `TENANT_CLIENT_UNAVAILABLE` (500 igual). Los otros 8 códigos preservados. Clases base sin tocar.

Verify: VEREDICTO **PASS** (0 CRITICAL, 0 WARNING, 1 SUGGESTION cosmética).
