# Proposal: vitest-swc-metadata (issue #100)

## Intent

**Problema**: la metadata de DI diverge entre test y producción. `emitDecoratorMetadata: true` (`api/tsconfig.json:6`) es un **no-op bajo esbuild**, el transform default de Vitest (esbuild issue #257, sin soporte). Producción usa SWC (`nest-cli.json` builder=swc), que SÍ emite `design:paramtypes`. Resultado: en tests, ningún parámetro tipado por clase recibe su token implícito, y los controllers "rompen en silencio" (params `undefined`) sin que ningún test los dispare.

**Por qué ahora**: `unplugin-swc@1.5.9` ya está instalado pero **nunca se wireó**. El footgun ya se pisó una vez (attendance-type, parcheado con `@Inject(Clase)` de andamiaje) y sigue latente en `StudentController` (12 use-cases sin red). Cerrar la brecha es barato y desactiva la clase entera de bug.

**Éxito**: paridad de metadata test↔prod; el andamiaje se elimina; el footgun queda cubierto por un guard.

## Scope

**In-scope**
1. Wirear `unplugin-swc/vite` en `api/vitest.config.ts` (`plugins: []`).
2. Remover los **6** `@Inject(Clase)` de andamiaje en `attendance-type.controller.ts:43-48` (categoría B). Su e2e existente los cubre.
3. Guard de DI para `StudentController`: verificar dentro de `Test.createTestingModule` que los 12 use-cases resuelven (no quedan `undefined`). SIN e2e completo de endpoints.

**Out-of-scope (declarado)**
- Los **8** `@Inject` legítimos (tokens Symbol/string: `PDF_PORT` x4, `MATERIA_PREVIA_REPOSITORY` x2, `'StudentRepository'`, `'EventBus'`). La reflexión resuelve clases, nunca tokens no-clase. **NUNCA se tocan.**
- e2e completo de los 12 endpoints de StudentController → follow-up ticket.

## Approach

**GATE OBLIGATORIO de dos pasos** (riesgo que el issue omite): unplugin-swc reemplaza el transform GLOBALMENTE (~2083 tests / 192 archivos), no selectivo por decorator. Para no confundir dos causas de regresión:

- **Paso A** — wirear unplugin-swc y correr `pnpm --filter api test` COMPLETO. Si algo se rompe acá, la causa es el **transform**, no la limpieza. Suite debe quedar verde antes de avanzar.
- **Paso B** — SOLO con la suite verde, remover los 6 `@Inject`. Si algo se rompe ahora, la causa es la **limpieza**. Aislás la señal.

**TDD (RED→GREEN natural)**: el guard de StudentController se escribe PRIMERO. Con esbuild (estado actual) DEBE FALLAR — la DI implícita está rota, los UC llegan `undefined`. Wirear unplugin-swc lo pone en VERDE. Ese es el RED→GREEN legítimo: el test documenta el fix, no lo persigue.

## Nivel pedagógico

**N/A** — es infraestructura de test (config de transform + andamiaje de DI), no toca dominio ni currícula. No hay contenido educativo afectado; aplica transversalmente a toda la suite.

## Criterio de éxito verificable

1. El e2e de attendance-type pasa **sin** los 6 `@Inject` (prueba que la DI implícita ahora resuelve).
2. El nuevo guard de StudentController pasa (12 UC resueltos).
3. `pnpm --filter api test` completo: **verde**, sin regresión de tiempo significativa.

## Estimación

~25 líneas (config +3, `-6` @Inject, guard ~15). **Un solo PR**, muy por debajo del budget de 400 líneas.
