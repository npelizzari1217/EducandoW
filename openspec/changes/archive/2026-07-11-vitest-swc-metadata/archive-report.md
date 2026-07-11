# Archive Report: vitest-swc-metadata (issue #100)

- **Veredicto:** CERRADO — verify PASS (0 CRITICAL, 0 WARNING)
- **Archivado:** 2026-07-11, en `openspec/changes/archive/2026-07-11-vitest-swc-metadata/`
- **Capability nueva:** `openspec/specs/test-infrastructure/spec.md` (VSM-R1..R6)

## Resultado final

`unplugin-swc` wireado en `api/vitest.config.ts` con paridad exacta de metadata de decorators contra producción (`nest-cli.json` builder=swc). El transform de test ahora emite `design:paramtypes`, cerrando la clase de bug donde parámetros de constructor tipados-por-clase resolvían a `undefined` bajo Vitest/esbuild sin que ningún test lo detectara.

## Requisitos cumplidos (VSM-R1..R6)

| Requisito | Estado | Evidencia |
|---|---|---|
| VSM-R1 — unplugin-swc wireado | Cumplido | `api/vitest.config.ts`: `plugins: [swc.vite({...})]` a nivel raíz, `decoratorMetadata: true` |
| VSM-R2 — DI implícita resuelve en TestingModule | Cumplido | `student.controller.di.test.ts`: 12 use-cases resueltos, verificado GREEN |
| VSM-R3 — andamiaje removido de AttendanceTypeController | Cumplido | 6 `@Inject(Clase)` eliminados, e2e 14/14 verde |
| VSM-R4 — tokens legítimos intactos | Cumplido | 8 sitios `@Inject(TOKEN)` (Symbol/string) sin tocar |
| VSM-R5 — guard RED→GREEN | Cumplido, verificado empíricamente | Reproducido RED revirtiendo config temporalmente en verify |
| VSM-R6 — suite completa sin regresión | Cumplido | 205/205 archivos, 2084/2084 tests, exit 0 |

## Commits (5, rama `chore/vitest-swc-metadata`)

1. `835bdf5` — `test(student): add DI parity guard for StudentController (RED)`
2. `46f0eaf` — `fix(api): split type-only imports in list-grupos-global use-case`
3. `a55eb1a` — `feat(api): wire unplugin-swc in vitest for design:paramtypes parity`
4. `efa3977` — `refactor(api): drop redundant @Inject scaffolding from AttendanceTypeController`
5. `f8ba34e` — bookkeeping SDD (`openspec/` únicamente, no forma parte del diff de código)

Diff de código (excl. `openspec/`), `main..HEAD`: **4 archivos, +65/−9 (~65 líneas)**.

## Tests

- Suite completa `pnpm --filter api test`: **205/205 archivos, 2084/2084 tests, exit 0**. Corrida 3 veces durante apply (baseline esbuild, post Gate A, post Gate B) y una vez más de forma independiente durante verify — consistente en todas.
- Typecheck `pnpm --filter api typecheck`: exit 0, limpio.
- Wall-time: ~54.2s (baseline esbuild) → 57.14s (Gate A) → 59.15s (Gate B) — SWC ~5-9% más lento, dentro del ruido de una sola corrida en una sola máquina (ver Follow-ups).

## La historia: un intento fallido y su revert

Antes del enfoque final hubo un **primer intento revertido**, documentado en detalle porque es la lección más valiosa del change:

**Qué se intentó:** activar la regla ESLint `@typescript-eslint/consistent-type-imports` con `eslint --fix` global, como forma "determinística" de resolver imports mixtos type/runtime desde `@educandow/domain` antes de wirear `unplugin-swc`.

**Por qué falló:** esa regla es **incompatible con la DI de NestJS bajo `emitDecoratorMetadata`**. El autofix convierte automáticamente los imports de parámetros de constructor en clases `@Injectable()`/`@Controller()` a `import type`, sin distinguir si esa clase se usa como tipo de parámetro DI. Un `import type` no genera una referencia de runtime — TypeScript no emite el símbolo, y sin el símbolo en runtime, `emitDecoratorMetadata` no puede emitir `design:paramtypes` para ese parámetro. Resultado: la regla que se suponía iba a "arreglar" imports rompía la metadata de DI que el change entero existe para reparar — y lo hacía en **producción también**, no solo en test, porque prod ya compila con SWC + `emitDecoratorMetadata` vía `nest-cli`.

**Magnitud del intento fallido:** el autofix tocó **247 archivos** (923 inserciones / 879 eliminaciones) y forzó **124 `eslint-disable`** adicionales para los casos que rompían de forma más obvia, todo para resolver un problema cuya solución final terminó siendo de **~65 líneas en 4 archivos**.

**Qué se hizo:** el usuario decidió revertir con `git reset` antes de continuar con esta sesión de apply. La sesión de apply documentada arriba es un **redo** desde cero con el enfoque quirúrgico.

**El enfoque final (mínimo, quirúrgico):**
1. Wirear `unplugin-swc` directamente (sin tocar ESLint).
2. Arreglar a mano **solo** `list-grupos-global.use-case.ts` — el único archivo, de 87 auditados con imports mixtos, que realmente rompía bajo SWC, porque es el único con un `vi.mock('@educandow/domain')` **estricto** en su test.
3. Limpiar el andamiaje `@Inject(Clase)` de `AttendanceTypeController` (6 sitios).
4. Guard de DI para `StudentController` (RED con esbuild → GREEN con unplugin-swc).

**Lección (para el registro permanente del proyecto):** no existe una solución global limpia para el antipatrón de imports mixtos type/runtime en este codebase. `NestJS` + `emitDecoratorMetadata` es estructuralmente incompatible con forzar `import type` vía regla de lint automática, porque esa regla no puede saber si un import de clase alimenta un parámetro de constructor DI. La única solución segura es **quirúrgica, archivo por archivo**, activada solo cuando ese archivo específico gana un `vi.mock` estricto que expone el problema.

## Follow-ups (NO implementados — quedan registrados)

1. **Deuda latente de imports mixtos:** de los 87 archivos auditados con imports mixtos type/runtime desde `@educandow/domain`, ~27 quedan en riesgo "MEDIO" — no rompen hoy (ningún `vi.mock('@educandow/domain')` estricto los ejercita) pero romperían si un test futuro gana ese patrón de mock. Riesgo bajo, aceptado explícitamente. Si se decide resolver, hacerlo **quirúrgicamente por archivo** (nunca con regla global — ver historia arriba).
2. **Performance:** SWC transform ~5-9% más lento que esbuild (57-59s vs ~54s baseline) en una sola corrida, una sola máquina. Informal, dentro del ruido, no bloqueante. Sin presupuesto formal de performance en scope (exclusión declarada en `proposal.md`).
3. **e2e completo de `StudentController`:** solo se cubrió el guard de DI (resolución de los 12 use-cases en construcción). Los 12 endpoints no tienen e2e de comportamiento — follow-up ticket separado, fuera de scope de este change.

## Correcciones aplicadas antes de archivar (reconciliación de verify)

- `design.md §4`: corregida la afirmación de que los guards `@UseGuards` no se instancian en `.compile()` — es falsa con metadata real (Nest los instancia eagerly), motivo por el cual el guard final necesitó `.overrideGuard(AuthGuard)`.
- `design.md §8`: estimación de líneas actualizada de ~45 (pre-implementación) a la cifra real ~65 líneas / 4 archivos.

## Trazabilidad de artefactos

| Artefacto | Ruta |
|---|---|
| Proposal | `openspec/changes/archive/2026-07-11-vitest-swc-metadata/proposal.md` |
| Spec (delta, histórico) | `openspec/changes/archive/2026-07-11-vitest-swc-metadata/specs/spec.md` |
| Design (corregido) | `openspec/changes/archive/2026-07-11-vitest-swc-metadata/design.md` |
| Tasks | `openspec/changes/archive/2026-07-11-vitest-swc-metadata/tasks.md` |
| Apply progress | `openspec/changes/archive/2026-07-11-vitest-swc-metadata/apply-progress.md` |
| Verify report | `openspec/changes/archive/2026-07-11-vitest-swc-metadata/verify-report.md` |
| Capability canónica (nueva) | `openspec/specs/test-infrastructure/spec.md` |
| Engram | `sdd/vitest-swc-metadata/archive-report` |
