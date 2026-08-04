# Apply Progress — asistencia-reporting-result

**Status:** COMPLETO — los 4 slices (A/B/C/D), 28/28 throws convertidos. Base rebaseada sobre
post-#124 `main`. 18 commits sobre `main` (planning `3b7dd2e` + A×4 + B×4 + C×4 + D×5). Ramas
stacked `-a`→`-b`→`-c`→`-d`.

## Slice A — asistencia-reporting (rama `refactor/asistencia-reporting-result`)

| Hash | Commit |
|------|--------|
| `3dc7b2b` | refactor(http): widen unwrapResultOrThrow bound, preserve error code (Option B) |
| `2faae58` | refactor(asistencia-reporting): return Result from generate-asistencia-mensual-pdf (12 throws) |
| `12b6ddb` | refactor(asistencia-reporting): consume Result in controller, drop handleError/try-catch |
| `aec48d7` | test(asistencia-reporting): migrate helper/filter/use-case/controller tests to Result |

Option B: `unwrap-result-or-throw.ts` bound → estructural `{ httpStatus, code, message }`, body con
`code` (L40); `exception.filter.ts` rama HttpException re-lee `obj.code` (L92). RED→GREEN confirmado.

## Slice B — boletin (rama `-b`)

| Hash | Commit |
|------|--------|
| `6682c2c` | refactor(reportes): return Result from generate-boletin (7 throws) |
| `1859d2b` | refactor(reportes): consume boletin Result in getBoletin |
| `3ca2899` | test(reportes): migrate boletin use-case + controller tests to Result |
| `a129dba` | docs(tasks): mark Slice B tasks complete |

`BOLETIN_LEVEL_UNKNOWN` en 2 sites DISTINTOS (getBaseLevel unknown-code vs guard !template known-level),
convertidos por separado. Los 3 tests hermanos (inicial/terciario/docente-s2) sí tenían tests
execute-level → convertidos también.

## Slice C — boletin-batch (rama `-c`)

| Hash | Commit |
|------|--------|
| `426c2ec` | refactor(reportes): Result-return generate-boletin-batch (Promise<Buffer> -> Result) |
| `9ff09d2` | refactor(reportes): retrofit getBoletinBatch to unwrapResultOrThrow |
| `10bb9d9` | test(reportes): migrate batch tests + add net-new getBoletinBatch controller test |
| `22c9b3c` | docs(tasks): mark Slice C tasks complete |

Firma `Promise<Buffer>` → `Promise<Result<Buffer, BoletinError>>`. Test net-new `getBoletinBatch`
RED→GREEN genuino. Import sweep de `BoletinError` pulled-forward acá (por `noUnusedLocals`).

## Slice D — constancia + docs (rama `-d`)

| Hash | Commit |
|------|--------|
| `1f667b3` | refactor(reportes): return Result from generate-constancia-regular (7 throws) |
| `b73af25` | refactor(reportes): consume constancia Result, remove dead ConstanciaError import |
| `90cb25f` | test(reportes): migrate constancia tests, delete legacy constancia-controller.test.ts |
| `e24522d` | docs(spec): correct application-error-handling consumer entry (ARR-R8) |
| `ab28ad9` | docs(tasks): mark Slice D tasks complete |

`INSTITUTION_NOT_FOUND`/status sin cambio (ambiguos, diferidos). Borrado `constancia-controller.test.ts`
(149 líneas legacy). Canónico corregido (ARR-R8).

## Verificación (todos los slices)

- `pnpm --filter api typecheck` → exit 0.
- `pnpm --filter api test` → 2191/2192 (única falla pre-existente `archive-legacy-grading-data.spec.ts`,
  Windows path, ajena, no en diff). `pnpm --filter api build` limpio.
- `rg "throw new"` en los 4 use-cases → 0 (invariante whole-change).
- `constancia-controller.test.ts` absent; sin cambio de `extends` en las 3 clases; sin `instanceof` en
  los controllers; canónico L206 corregido.

## Desviaciones documentadas

1. Slice C pulled-forward el import sweep de `BoletinError` (`noUnusedLocals` rompía `tsc` sin él).
2. Slice B convirtió los 3 test hermanos (inicial/terciario/docente-s2) que sí tenían tests execute-level.
