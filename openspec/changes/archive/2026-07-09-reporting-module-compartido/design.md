# Design: reporting-module-compartido

**Issue**: #101 · **Change**: `reporting-module-compartido` · **Nivel pedagógico afectado**: `ALL` · **Fase**: design

> Scope (confirmado por el usuario): enfoque (a) — `ReportingModule` hoja con
> `providers/exports: [PdfGeneratorService]`, importado por `asistencia-reporting`, `reportes` y
> `attendance-type` (que quitan el provider de su propio `providers:`), **más** `enableShutdownHooks()`
> en `main.ts` (enmienda 1). **Fuera de scope**: `PdfPort`, token `Symbol`, mover a otra capa, resolver
> ADR-06. Ver §Follow-up.

## 1. Arquitectura elegida

**Patrón**: *shared leaf provider module* (módulo hoja compartido, sin controller).
Un único `ReportingModule` declara `PdfGeneratorService` en `providers` y lo `exports`. Los tres
módulos feature lo `imports` en vez de re-declarar el provider. Nest de-duplica un provider
exportado por un módulo compartido → **una sola instancia** de `PdfGeneratorService` en todo el grafo
→ un solo `browserPromise` → un solo Chrome vivo, y **un solo** `onModuleDestroy` en el shutdown.

Precedente directo en el repo: `infrastructure/event-bus/event-bus.module.ts` (módulo de provider
compartido que vive en `infrastructure/`, junto a su servicio). También el patrón funcional
`ReportesModule → PedagogyModule` (un módulo importa a otro para reusar un servicio exportado).

### Flujo de datos / integración

```
                         infrastructure/reporting/
                         ┌───────────────────────────────┐
                         │ ReportingModule               │
                         │   providers: [PdfGenerator…]  │
                         │   exports:   [PdfGenerator…]  │  ← 1 instancia (singleton Nest)
                         └───────────────┬───────────────┘
              imports │            imports │            imports │
        ┌─────────────┴──────┐  ┌──────────┴───────┐  ┌─────────┴────────────┐
        │ AsistenciaReporting│  │ ReportesModule   │  │ AttendanceTypeModule │
        │ Module (presentat.)│  │ (presentation)   │  │ (presentation)       │
        └────────────────────┘  └──────────────────┘  └──────────────────────┘
   useFactory inject:[PdfGeneratorService]  ← el token queda visible por el export; los
   bloques useFactory NO cambian, siguen inyectando por la clase.

   main.ts: app.enableShutdownHooks() ⇒ SIGTERM/SIGINT → destroy ReportingModule
            → 1 onModuleDestroy → browser.close() 1 vez.
```

## 2. Decisiones (ADR-style)

### ADR-01 — Ubicación del `ReportingModule`: `infrastructure/reporting/`

**Decidido**: el archivo vive en `api/src/infrastructure/reporting/reporting.module.ts`, junto al
`PdfGeneratorService`. Se agrega su re-export al barrel existente `infrastructure/reporting/index.ts`.
**El servicio NO se mueve de capa** — ya está en `infrastructure/` (capa correcta: usa Puppeteer).

**Por qué**:
- El repo YA tiene el precedente exacto: `infrastructure/event-bus/event-bus.module.ts` es un módulo
  de provider compartido que vive en `infrastructure/`, co-ubicado con su servicio.
- La regla clean-arch del proyecto dice literalmente "el wiring de DI vive en `infrastructure/`".
  `ReportingModule` es puro wiring de un servicio de infraestructura: **sin controller, sin use case,
  sin nada de presentation**. No es un módulo feature.
- Cohesión: el módulo que gobierna el ciclo de vida del browser queda al lado del servicio que lo abre.

**Rechazado — `presentation/reporting/`**: sería por "consistencia" con los tres módulos hermanos,
pero esos SON módulos feature (tienen controller + use cases). `ReportingModule` no tiene controller;
es un provider module de infraestructura. El precedente correcto es `EventBusModule` (infra), no los
feature modules.

**Scope creep evitado**: mover `PdfGeneratorService` a otra ubicación/capa NO se hace — ya está bien
ubicado. Cero cambios de capa.

### ADR-02 — Test de instancia única: stub consumer modules (semántica DI) + aserción de metadata (los 3 reales)

Este es **el riesgo principal del change**. Ver §3 para el detalle completo. Dos piezas
complementarias:

1. **Semántica de DI (opción ii — stub consumer modules)**: dos módulos *stub* importan
   `ReportingModule` y se afirma identidad referencial (`===`) del `PdfGeneratorService` resuelto desde
   cada uno, más un spy de `puppeteer.launch` para "un solo browser". Se rechazan (i) — grafo real
   frágil/caro — y (iii) — no prueba la invariante.
2. **Cobertura de los 3 módulos reales (enmienda 2 — aserción estática de metadata)**: sin instanciar
   el grafo de DI, se lee la metadata `@Module` de cada feature module y se afirma que importa
   `ReportingModule` y NO declara `PdfGeneratorService` en `providers`. Cierra `RPI-R1` del spec, que
   el test de stubs no puede cubrir. Ver §3.

### ADR-03 — Verificación de "un solo browser" por spy sobre `puppeteer.launch`

Se reusa el patrón ya existente `vi.mock('puppeteer')` de
`infrastructure/reporting/__tests__/pdf-generator.service.test.ts` (mock a nivel de módulo, spy
`mockLaunch`). Como `getBrowser()` es lazy y cachea en `browserPromise`, varias llamadas a
`generatePdf` sobre la instancia compartida deben invocar `launch` **exactamente una vez**. Nunca se
lanza Chrome real. Ver §4.

### ADR-04 — Shutdown hooks: `app.enableShutdownHooks()` ENTRA en este change

**Decidido (enmienda 1, aprobada por el usuario)**: agregar `app.enableShutdownHooks()` en
`api/src/main.ts`, **después de** `app.use(cookieParser())` y **antes de**
`await app.listen(config.port)`.

**Por qué entra (no es follow-up)**:
- Condición **PRE-EXISTENTE ausente**, no una regresión de este change: `rg 'enableShutdownHooks'
  api/src` → cero resultados. HOY `onModuleDestroy` (`pdf-generator.service.ts:91-102`) corre solo ante
  un `app.close()` explícito (p.ej. `afterAll` en tests), **no** ante SIGTERM/SIGINT del proceso.
- Sin el hook, el MUST del spec `RPI-R3` ("el browser MUST cerrarse exactamente una vez al apagar") es
  **inalcanzable**: el hook nunca dispara. Consolidar 3 instancias en 1 solo cambia *cuántos* browsers
  quedan sin cerrar; no cierra ninguno por sí mismo. Por eso el fix del lifecycle debe viajar con la
  consolidación en el mismo change.

**Lógica de `onModuleDestroy` NO se toca**: queda idéntica. Con una sola instancia poseída por
`ReportingModule` hay **un solo** `onModuleDestroy`; ningún módulo feature posee ya el provider →
ninguno puede cerrar el browser antes de tiempo.

### ADR-05 — Se descarta `@Global()`

Confirmado en proposal/explore: `@Global()` está reservado a cross-cutting real (`EventBusModule`).
`PdfGeneratorService` es feature-scoped a tres módulos nombrados → import explícito, no global.

## 3. RIESGO PRINCIPAL — test de instancia única (resuelto)

**El punto donde el change puede fracasar.** La exploración advirtió: armar un `TestingModule` con los
tres módulos feature REALES arrastra `AuthModule`, `PrismaService` y ~10 repos Prisma; hoy NINGÚN test
del repo construye un `TestingModule` desde módulos feature reales (territorio nuevo).

### Opciones evaluadas (semántica de DI)

**(i) `TestingModule` con los 3 módulos reales + `overrideProvider`.**
Es lo más fiel al grafo de producción, PERO: para compilar hay que overridear `AuthModule`
(JWT/env/guards), `PrismaService` y toda la lista de repos Prisma. Frágil (se rompe ante cualquier
cambio no relacionado en esos módulos), caro de mantener, y mezcla concerns ORTOGONALES a la
invariante bajo prueba. Alto costo, superficie colateral enorme. **Rechazada.**

**(iii) Test unitario del `ReportingModule` (resolverlo dos veces y comparar).**
NO prueba lo que importa. Dos `Test.createTestingModule({ imports: [ReportingModule] })` crean dos
contenedores DI distintos → dos instancias → siempre `!==` aun con código correcto. Y resolver dos
veces el MISMO contenedor siempre devuelve el singleton, con o sin sharing entre módulos. O falla
siempre o pasa trivialmente: no ejercita el cruce entre módulos. **Rechazada.**

**(ii) Stub consumer modules importando `ReportingModule`. ← ELEGIDA.**
Dos módulos test-only (`ConsumerAModule`, `ConsumerBModule`), cada uno
`@Module({ imports: [ReportingModule] })`, replican EXACTAMENTE lo que hace un módulo feature (importar
el módulo compartido) SIN arrastrar `AuthModule`/Prisma. Cada stub expone su instancia resuelta con un
marcador `useExisting` y la exporta; un `TestingModule` raíz importa ambos stubs y afirma que
`'A_PDF' === 'B_PDF'`. Prueba la semántica de DI que realmente nos importa: **múltiples módulos que
importan `ReportingModule` comparten una sola instancia**. Hermético (solo Puppeteer se mockea, con el
patrón ya existente), rápido, y no acopla el test a la evolución de `AuthModule`/Prisma.

### Cierre del drift con el spec — aserción estática de metadata (enmienda 2)

El test (ii) valida stubs, no los tres módulos feature REALES → deja `RPI-R1` ("identidad referencial
resuelta desde los 3 módulos feature") sin cobertura. Se cierra con una **aserción estática de la
metadata de `@Module`**, SIN instanciar el grafo de DI (así no se arrastra `AuthModule`/Prisma):

Para cada uno de `AsistenciaReportingModule`, `ReportesModule`, `AttendanceTypeModule`:
- `Reflect.getMetadata('imports', X)` **incluye** `ReportingModule`, y
- `Reflect.getMetadata('providers', X)` **NO incluye** `PdfGeneratorService`.

Barato, rápido, sin DI, y cubre exactamente lo que el test de stubs no puede: que los tres reales
efectivamente delegan el provider al módulo compartido. Va en el mismo archivo de test.

**Por qué (ii)+metadata es suficiente y no necesitamos (i):** "un provider exportado por un módulo
compartido produce un singleton entre importadores" es una garantía del framework NestJS, verificada
por (ii). Que los tres reales USEN ese mecanismo (importar el módulo, no declarar la copia) lo verifica
la aserción de metadata + el typecheck/build + los tests existentes en verde. No hace falta re-testear
el framework con el grafo real completo.

### Snippet ilustrativo (NO es código de producción — guía del test)

```ts
// infrastructure/reporting/__tests__/reporting.module.test.ts
vi.mock('puppeteer', () => ({ default: { launch: (...a: unknown[]) => mockLaunch(...a) } }));

// — semántica DI (opción ii) —
@Module({
  imports: [ReportingModule],
  providers: [{ provide: 'A_PDF', useExisting: PdfGeneratorService }],
  exports: ['A_PDF'],
})
class ConsumerAModule {}
// ConsumerBModule idéntico con 'B_PDF'
expect(moduleRef.get('A_PDF')).toBe(moduleRef.get('B_PDF'));      // misma instancia (===)

// — un solo browser (ADR-03) —
const svc = moduleRef.get<PdfGeneratorService>(PdfGeneratorService);
await svc.generatePdf('<html></html>'); await svc.generatePdf('<html></html>');
expect(mockLaunch).toHaveBeenCalledTimes(1);

// — cierre del drift con el spec (metadata de los 3 reales, sin DI) —
for (const M of [AsistenciaReportingModule, ReportesModule, AttendanceTypeModule]) {
  expect(Reflect.getMetadata('imports', M)).toContain(ReportingModule);
  expect(Reflect.getMetadata('providers', M)).not.toContain(PdfGeneratorService);
}
```

## 4. Verificación "un solo browser" y cierre único (puntos 3 y 4)

**Un solo browser** — sobre la instancia compartida, `generatePdf` dos o más veces y afirmar:

```ts
expect(mockLaunch).toHaveBeenCalledTimes(1);   // getBrowser() es lazy + cachea browserPromise
```

**Cierre exactamente una vez al apagar (RPI-R3)** — armar un `TestingModule`/app que importe
`ReportingModule`, ejercitar `generatePdf` (para forzar el lazy-launch), y luego `await app.close()`.
Con el `vi.mock` de puppeteer (el `mockBrowser.close` spy ya existe en el patrón de ADR-03), afirmar:

```ts
await svc.generatePdf('<html></html>');   // browserPromise ya resuelto
await app.close();                          // dispara onModuleDestroy 1 vez
expect(mockBrowser.close).toHaveBeenCalledTimes(1);
```

`app.close()` alcanza — NO hace falta emitir SIGTERM real. `enableShutdownHooks()` es lo que, en
producción, hace que la señal del proceso invoque el mismo camino de `app.close()`.

Una sola instancia (probado en §3) ⇒ un solo `browserPromise` ⇒ un solo `launch` ⇒ un solo
`onModuleDestroy` ⇒ un solo `browser.close()`. Nunca se lanza Chrome real.

## 5. Lifecycle (punto 4) — resuelto con enableShutdownHooks

- Tras consolidar hay **una** `PdfGeneratorService` poseída por `ReportingModule` → **un solo**
  `onModuleDestroy`. Ningún módulo feature posee ya el provider → ninguno puede cerrar el browser
  prematuramente.
- **No se toca `onModuleDestroy`** (`pdf-generator.service.ts:91-102`): la lógica queda idéntica.
- **`main.ts` recibe `app.enableShutdownHooks()`** (ADR-04) después de `app.use(cookieParser())` y
  antes de `await app.listen(...)`. Es una condición pre-existente ausente, no una regresión: sin ella
  `RPI-R3` sería inalcanzable porque `onModuleDestroy` nunca dispararía ante SIGTERM/SIGINT.

## 6. Orden de implementación TDD estricto (test primero)

`strict_tdd: true` · `test_command: pnpm test` (raíz) / `pnpm --filter api test` · coverage ≥ 80%.

1. **RED (módulo compartido)** — Escribir `infrastructure/reporting/__tests__/reporting.module.test.ts`:
   - stub `ConsumerAModule`/`ConsumerBModule` importando `ReportingModule`; afirmar `===` (§3).
   - afirmar `puppeteer.launch` invocado exactamente 1 vez tras varios `generatePdf` (§4).
   - FALLA: `reporting.module.ts` no existe → error de compilación/import.
2. **GREEN (módulo compartido)** — Crear `infrastructure/reporting/reporting.module.ts` con
   `providers: [PdfGeneratorService]` / `exports: [PdfGeneratorService]`. Re-exportar en el barrel
   `index.ts`. El test del paso 1 pasa.
3. **RED (metadata de los 3 reales)** — Agregar al mismo archivo la aserción de metadata (§3): imports
   incluye `ReportingModule`, providers NO incluye `PdfGeneratorService`. FALLA con los módulos
   feature actuales (aún declaran el provider y no importan `ReportingModule`).
4. **GREEN / REFACTOR (los 3 feature modules)** — En los tres: agregar `ReportingModule` a `imports`,
   quitar `PdfGeneratorService` de `providers`, borrar el `import` de la clase concreta ahora
   innecesario. Los bloques `useFactory` que inyectan `PdfGeneratorService` NO cambian (el token queda
   visible por el `exports`). Eliminar el comentario de deuda `attendance-type.module.ts:21-27`. El
   test del paso 3 pasa; los existentes siguen verde (comportamiento preservado).
5. **RED (cierre único)** — Escribir el test de shutdown (§4): `generatePdf` + `app.close()` →
   `mockBrowser.close` llamado 1 vez. Este paso valida la semántica de cierre único y protege `RPI-R3`.
6. **GREEN (main.ts)** — Agregar `app.enableShutdownHooks()` en `main.ts` (ADR-04). Cierra el hueco de
   producción para que SIGTERM/SIGINT recorran el mismo camino que `app.close()`.
7. **Regresión** — `pnpm --filter api test` + `typecheck` en verde. Los tests existentes no se ven
   afectados: `pdf-generator.service.test.ts` instancia el servicio con `new` (no toca DI);
   `attendance-type.controller.e2e.test.ts` arma su propio `TestingModule` con controller + use cases
   mockeados y NO importa `AttendanceTypeModule` real.

## 7. Limpieza (punto 6)

Eliminar el bloque de comentario `attendance-type.module.ts:21-27` (cita `design.md §9` del change
archivado). Se hace en el paso 4.

## 8. Estimación de líneas (por archivo)

| Archivo | Tipo | Líneas ~cambiadas |
|---|---|---|
| `infrastructure/reporting/reporting.module.ts` | nuevo | ~12 |
| `infrastructure/reporting/__tests__/reporting.module.test.ts` | nuevo | ~105 (stubs `===` + launch + metadata de los 3 reales + shutdown/close) |
| `infrastructure/reporting/index.ts` | +export | ~1 |
| `main.ts` | +`enableShutdownHooks()` | ~1 |
| `presentation/attendance-type/attendance-type.module.ts` | edit (quita provider + comentario 7 líneas + import; agrega import/imports) | ~12 tocadas |
| `presentation/reportes/reportes.module.ts` | edit | ~5 tocadas |
| `presentation/asistencia-reporting/asistencia-reporting.module.ts` | edit | ~5 tocadas |
| **Total** | | **≈ 141 líneas** (dominado por el test nuevo) |

**Muy por debajo de 400 → un solo PR.** No dispara PRs encadenados (`chained-pr`).
Rollback: revertir el commit restaura los tres `providers:` originales y quita el shutdown hook.

## 9. Follow-up (tickets separados, NO en este change)

- Introducir `PdfPort` (token `Symbol`) en `application/` e implementarlo en `infrastructure/`, y
  hacer que los 4 use-cases inyecten el port en vez de la clase concreta → resuelve la violación
  ADR-06 (application importa infraestructura concreta).
