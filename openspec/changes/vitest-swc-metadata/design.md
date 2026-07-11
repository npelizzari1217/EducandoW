# Design: vitest-swc-metadata (issue #100)

- **Change:** `vitest-swc-metadata`
- **Store:** hybrid (engram `sdd/vitest-swc-metadata/design` + este archivo)
- **Basado en:** `proposal.md` + `specs/spec.md` (VSM-R1..R6 / VSM-Sx) + `explore` (#1784)
- **Naturaleza:** infraestructura de test (transform de Vitest + andamiaje DI). No toca dominio ni Clean Arch de producción. La única arista arquitectónica es **paridad de metadata DI test↔prod**.

---

## 1. Contexto arquitectónico (el porqué del transform)

El árbol de DI de NestJS resuelve dependencias de constructor por CLASE leyendo `design:paramtypes` (metadata emitida por `emitDecoratorMetadata`). Producción compila con SWC (`nest-cli.json` builder=swc) que SÍ emite esa metadata. Vitest compila con **esbuild**, que **ignora `emitDecoratorMetadata`** (esbuild #257, sin fix). Consecuencia: bajo test, ningún parámetro tipado-por-clase recibe su token implícito → params `undefined` → "rompe en silencio" salvo que un test ejercite DI real de ese controller.

El fix es un **cambio de transform global**: reemplazar esbuild por `unplugin-swc` en el pipeline de Vite/Vitest, replicando las opciones de decorator de prod. No es un cambio localizado — afecta la transpilación de los ~2083 tests / 192 archivos. Por eso el diseño gira alrededor de **aislar la señal de regresión** (gate de dos pasos) y **documentar el fix con un guard RED→GREEN** en lugar de dejarlo como side-effect mudo.

---

## 2. Config de unplugin-swc — parидad exacta con prod (VSM-R1)

### Dónde y cómo

`unplugin-swc` expone `.vite()` que devuelve un plugin de Vite. Los plugins de transform viven en el `plugins: []` **de nivel raíz** de la config (el pipeline de transform de Vite), no dentro de `test:`. (Nota: VSM-S1 dice "test.plugins" de forma laxa; Vitest hereda `plugins` de Vite a nivel raíz — ahí es donde el hook `transform` corre. La verificación **autoritativa** de VSM-S1/S5 es el guard de la §4, que prueba el COMPORTAMIENTO, no la forma del objeto.)

No existe `.swcrc` en el repo (confirmado): nest-cli deriva las opciones SWC de `tsconfig.build.json` → `tsconfig.json` (`emitDecoratorMetadata: true`, `experimentalDecorators: true`, target `ES2022` heredado de `tsconfig.base.json`). Como no hay `.swcrc`, hay que **inline-ar** las opciones equivalentes en la config de Vitest para lograr paridad.

### Config final propuesta

```ts
// api/vitest.config.ts
import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import path from 'path';

export default defineConfig({
  plugins: [
    // Paridad con prod (nest-cli builder=swc): replica emitDecoratorMetadata +
    // experimentalDecorators de tsconfig(.build).json para emitir design:paramtypes.
    swc.vite({
      jsc: {
        target: 'es2022',                 // = tsconfig.base target ES2022
        parser: {
          syntax: 'typescript',
          decorators: true,               // = experimentalDecorators (parser)
        },
        transform: {
          legacyDecorator: true,          // = experimentalDecorators (transform)
          decoratorMetadata: true,        // = emitDecoratorMetadata → design:paramtypes
        },
        keepClassNames: true,             // preserva class names (tokens de DI por clase)
      },
      module: { type: 'es6' },            // Vitest consume ESM; su runner inyecta __dirname
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    // ...resto sin cambios (include/exclude/coverage/server.deps.inline)...
  },
  resolve: { /* alias sin cambios */ },
});
```

### De dónde sale la paridad (y qué NO se replica)

| Opción SWC (test) | Origen en prod | Rol |
|---|---|---|
| `transform.decoratorMetadata: true` | `emitDecoratorMetadata: true` (tsconfig) | **LA CLAVE** — emite `design:paramtypes` |
| `transform.legacyDecorator: true` + `parser.decorators: true` | `experimentalDecorators: true` | habilita el modelo de decorators de Nest |
| `jsc.target: 'es2022'` | `target: ES2022` (tsconfig.base) | mismo downlevel |
| `keepClassNames: true` | — (safety) | evita que un minify/rename rompa tokens por clase |
| `module: { type: 'es6' }` | prod usa `commonjs` | **NO se replica a propósito** |

**Nuance de paridad:** lo que importa igualar es la **metadata de decorators**, no el formato de módulo. Prod emite CJS (`module: commonjs`); en test usamos `es6` porque el runner de Vitest consume ESM y ya inyecta `__dirname`/`__filename` en su module runner. Igualar `module` a `commonjs` sería CONTRAPRODUCENTE (rompería el pipeline ESM de Vitest). La paridad relevante — la que arregla el bug de DI — es exclusivamente `decoratorMetadata + legacyDecorator + target`. Este es el punto sutil del diseño: **paridad de metadata, no de formato de módulo.**

---

## 3. Secuencia TDD oficial — combinar gate de dos pasos con RED→GREEN (EL CORAZÓN)

Existe una tensión real: el **gate** (proposal) pide "wirear unplugin-swc PRIMERO y correr la suite" (paso A), pero el **TDD del guard** exige verlo FALLAR con esbuild ANTES de wirear. Si wireás primero, el guard nace verde y **perdés el RED** (perdés la prueba empírica de que el bug existía). La resolución es **ordenar por commits atómicos** de modo que ambos invariantes se cumplan:

### Orden EXACTO (5 pasos, work-unit commits)

1. **RED — escribir el guard, verlo fallar con esbuild.**
   Escribir `student.controller.di.test.ts` (§4). Correr SOLO ese archivo con la config actual (esbuild, sin tocar `vitest.config.ts`).
   → **DEBE FALLAR**: los 12 UC tipados-por-clase quedan `undefined` (o `.compile()` tira "Nest can't resolve dependencies"). RED legítimo + **prueba empírica de que el bug existe** hoy en `StudentController`.
   `test:` commit del guard rojo.

2. **GREEN + Gate paso A — wirear unplugin-swc y correr la SUITE COMPLETA.**
   Aplicar la config de la §2. Correr `pnpm --filter api test` **entero** (no solo el guard).
   → El guard PASA (metadata emitida). → La suite completa DEBE quedar VERDE.
   Si algo se rompe acá, la causa es **el transform** (aislada, paso A del gate). El guard verde = VSM-S5 GREEN; la suite verde = VSM-R6.
   `chore:`/`test:` commit del wireo (config + guard ahora verde viajan juntos).

3. **Gate paso B — remover los 6 `@Inject` de andamiaje.**
   SOLO con la suite verde: quitar los 6 `@Inject(Clase)` de `attendance-type.controller.ts:43-48` (y `Inject` del import de `@nestjs/common` si queda sin uso). Correr `attendance-type.controller.e2e.test.ts`.
   → DEBE seguir VERDE sin tocar assertions/mocks (VSM-S3/R3). Si se rompe ahora, la causa es **la limpieza** (aislada, paso B del gate).
   `refactor:` commit de la limpieza.

4. **Verificación de guardarraíl (VSM-R4).** Inspección de los 8 `@Inject(TOKEN)` legítimos intactos (§6). Sin commit propio — es revisión.

5. **Cierre — suite completa final + tiempo.** `pnpm --filter api test` verde de punta a punta; comparar wall-time contra baseline (§5).

### Por qué este orden satisface ambos

- El **RED** se captura en el paso 1 corriendo el guard **aislado** con la config vieja — no necesitás retener esbuild en toda la suite, solo no wirear todavía.
- El **gate paso A** (suite completa post-wireo) ocurre en el paso 2, DESPUÉS de que el guard ya nació rojo. El wireo es simultáneamente el GREEN del guard y el paso A del gate.
- El **gate paso B** (limpieza) queda estrictamente después de la suite verde, preservando el aislamiento de causas.

Regla de oro: **nunca** wirear unplugin-swc antes de tener el guard rojo commiteado. Es la diferencia entre "test que documenta el fix" y "test que persigue el fix".

---

## 4. Estrategia del guard de StudentController (VSM-R5 / VSM-S2a / VSM-S5)

### Decisión: testing module ligero, NO `StudentModule` real

Importar `StudentModule` arrastraría `AuthModule` + `PrismaStudentRepository`/`PrismaStudentGuardianRepository` + 13 `useFactory` con `inject: ['StudentRepository', ...]` → infraestructura Prisma real y mocking pesado (el mismo dolor que tuvo el pdf-port con los feature modules). **Rechazado.**

**Elegido:** un testing module ad-hoc que declara `controllers: [StudentController]` y provee los 12 use-cases como **stubs por token-clase** (mismo patrón que `attendance-type.controller.e2e.test.ts`, líneas 79-86). Esto ejercita EXACTAMENTE lo que el transform arregla: que el constructor del controller **resuelva cada parámetro tipado-por-clase por su `design:paramtypes`**. Sin `AppModule`, sin Prisma, sin AuthModule.

- Los `@UseGuards(AuthGuard, RolesGuard)` del controller NO se resuelven en construcción (son metadata de request-time). `.compile()` + obtener el controller NO instancia guards → no hace falta overridearlos ni proveerlos.
- El param 13 (`@Inject('StudentRepository')`, categoría A) resuelve por su decorator explícito **incluso bajo esbuild** — hay que proveer `{ provide: 'StudentRepository', useValue: stub }` para que compile, pero NO es lo que prueba el fix. El fix se prueba en los **12 tipados-por-clase**.

### Cómo se inspecciona que los params NO son `undefined`

Los campos son `private readonly` pero en runtime son propiedades accesibles. Tras `.compile()`, obtener la instancia (`moduleRef.get(StudentController)`) y afirmar por acceso a propiedad (bracket/`as any`) que cada uno de los 12 es el stub provisto (no `undefined`).

### Setup concreto (ilustrativo)

```ts
// api/src/presentation/student/__tests__/student.controller.di.test.ts
import { describe, it, expect } from 'vitest';
import { Test } from '@nestjs/testing';
import { StudentController } from '../student.controller';
import {
  CreateStudentUseCase, ListStudentsUseCase, GetStudentUseCase, DeleteStudentUseCase,
  PatchStudentUseCase, GetMyStudentDataUseCase, GetMyChildrenUseCase,
  AssignGuardianUseCase, RemoveGuardianUseCase, ListGuardiansUseCase,
  CreateStudyTutorUseCase, UpdateStudyTutorUseCase,
} from '../../../application/student/use-cases/student.use-cases';

// Los 12 UC tipados-por-clase (el orden no importa para providers).
const CLASS_UCS = [
  CreateStudentUseCase, ListStudentsUseCase, GetStudentUseCase, DeleteStudentUseCase,
  PatchStudentUseCase, GetMyStudentDataUseCase, GetMyChildrenUseCase,
  AssignGuardianUseCase, RemoveGuardianUseCase, ListGuardiansUseCase,
  CreateStudyTutorUseCase, UpdateStudyTutorUseCase,
] as const;

// Nombres de campo en el constructor, para afirmar que ninguno quedó undefined.
const FIELDS = [
  'createUC','listUC','getUC','deleteUC','patchUC','myDataUC','myChildrenUC',
  'assignGuardianUC','removeGuardianUC','listGuardiansUC','createStudyTutorUC','updateStudyTutorUC',
] as const;

describe('StudentController — DI implícita (guard VSM-R5)', () => {
  it('resuelve los 12 use-cases tipados-por-clase, ninguno undefined', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [StudentController],
      providers: [
        ...CLASS_UCS.map((UC) => ({ provide: UC, useValue: { execute: () => {} } })),
        { provide: 'StudentRepository', useValue: { search: () => [] } }, // token string (cat. A)
      ],
    }).compile();

    const ctrl = moduleRef.get(StudentController);
    for (const field of FIELDS) {
      expect((ctrl as any)[field], `${field} debe resolver`).toBeDefined();
    }
  });
});
```

### Estado esperado por transform

- **esbuild (paso 1, RED):** sin `design:paramtypes`, Nest no conoce los tokens de los 12 params. Falla de una de dos formas — ambas son RED válido: (a) `.compile()` lanza "Nest can't resolve dependencies of StudentController (...)", o (b) el controller se construye sin args y los 12 campos son `undefined` → falla la aserción. El test debe morir en rojo; cualquiera de las dos formas documenta el bug.
- **unplugin-swc (paso 2, GREEN):** metadata presente → Nest mapea cada param a su token-clase → inyecta cada stub → 12 campos definidos → verde.

Contraste con el test existente `throw-guardian-error.spec.ts`: ese usa `Object.create(prototype)` y **popula los campos a mano**, BYPASSEANDO la DI — por eso nunca detectó el bug. El guard nuevo es su complemento: prueba la RESOLUCIÓN real de DI.

---

## 5. Vectores de regresión del transform (cómo se detecta cada uno)

El wireo cambia el transform de los ~2083 tests. La **suite completa verde (VSM-R6)** cubre la mayoría, pero estos son los sospechosos nombrados a vigilar si algo cae:

| # | Vector | Riesgo | Sospechosos / cómo detectar |
|---|---|---|---|
| 1 | **`vi.mock()` hoisting bajo SWC** | El mocker de Vitest hoista `vi.mock()` por análisis estático; SWC puede reordenar/emitir helpers (`_ts_decorate`) que interactúen distinto con el interceptor de módulos | Correr la SUITE COMPLETA (no un test aislado). Sospechosos: cualquier `*.test.ts` con `vi.mock()` top-level. `rg "vi\.mock\(" api/src` para enumerar. Síntoma: "cannot access before initialization" o mock no aplicado |
| 2 | **CJS vs ESM / `__dirname`** | `module: es6` emite ESM; `__dirname` no existe en ESM puro. Vitest lo inyecta en su runner, pero hay que confirmarlo | Sospechosos concretos: tests de PDF que usan `path.resolve(__dirname, ...)` — `generate-boletin`, `generate-constancia-regular`, `generate-attendance-types-pdf`, `generate-asistencia-mensual-pdf`. Síntoma: `__dirname is not defined` o path roto a templates `.hbs` |
| 3 | **Shape del helper de decorators + reflect-metadata** | SWC emite `_ts_decorate`/`_ts_metadata` con shape distinto a `tslib`; si reflect-metadata no ve `design:paramtypes` el fix no funciona | Cubierto por los 3 tests que ejercen DI real: el guard nuevo (§4), `attendance-type.controller.e2e.test.ts`, y `app.e2e.test.ts` (importa `AppModule` completo). Si estos pasan, la metadata se emite bien |
| 4 | **Metadata nueva cambia comportamiento latente** | Clases `@Injectable()` que hoy reciben params `undefined` (mock-friendly por accidente) empezarán a recibir metadata real | Solo detectable con la SUITE COMPLETA. No hay sospechoso puntual — es el argumento central del gate paso A: correr todo antes de la limpieza |
| 5 | **Performance de la suite** | unplugin-swc no cachea tan agresivo como el pipeline default de Vite | Medir wall-time de `pnpm --filter api test` antes (baseline esbuild) y después. SWC es nativo (Rust), se espera igual o más rápido; una regresión grande sería la señal |
| — | Arch test `no-infra-pdf-import.arch.test.ts` | **NO afectado** — lee el `.ts` crudo con `fs.readFileSync` + regex, no el output transformado (confirmado en explore) | n/a |

Regla operativa: la señal primaria es **suite completa verde**; los sospechosos 1-2 son dónde mirar PRIMERO si el paso 2 (gate A) rompe.

---

## 6. Verificación de VSM-R4 (no over-cleanup) — lectura

**Decisión: NO se agrega un test/aserción dedicada. Se cubre por la suite verde + revisión de código.**

Razonamiento: los 8 `@Inject(TOKEN)` legítimos son **load-bearing** — la reflexión resuelve clases, nunca tokens `Symbol`/string. Si se removiera cualquiera, la suite ya rompe:

- Remover `@Inject(PDF_PORT)` (x4) → `reporting.module.test.ts` + los 4 tests de use-cases de PDF fallan (Symbol token irresoluble por metadata).
- Remover `@Inject(MATERIA_PREVIA_REPOSITORY)` (x2) → tests de `upsert-materia-previa` / `list-materias-previas` fallan.
- Remover `@Inject('StudentRepository')` → el guard §4 falla en compile (token string sin metadata) + `StudentController.search` rompe.
- Remover `@Inject('EventBus')` → `user-registered.handler` no resuelve.

O sea: **la suite completa YA es el guardarraíl contra over-cleanup**. Un test dedicado que grepee los 8 sitios sería redundante y frágil (acoplado a líneas). VSM-S4 se satisface como **inspección manual en review** (paso 4 de la secuencia), no como test automatizado. El scope del change son 6 líneas removidas; el reviewer confirma que solo esas 6 (categoría B, todas en `attendance-type.controller.ts`) desaparecieron.

---

## 7. ADRs

### ADR-1 — Transform: unplugin-swc global inline vs `.swcrc` compartido
**Decisión:** opciones SWC inline en `vitest.config.ts`, sin crear `.swcrc`.
**Rationale:** prod no tiene `.swcrc` (nest-cli deriva de tsconfig). Crear uno compartido acoplaría prod y test a un tercer archivo y podría alterar el build de prod. Inline mantiene el cambio contenido en un solo archivo de test y explícito.
**Rechazado:** crear `.swcrc` (unplugin-swc lo leería) — más superficie, riesgo de tocar prod.

### ADR-2 — Guard: testing module ligero vs `StudentModule` real
**Decisión:** módulo ad-hoc con 12 stubs por token-clase.
**Rationale:** prueba la resolución de DI (lo que el transform arregla) sin arrastrar Prisma/AuthModule. Espeja el patrón ya probado en attendance-type e2e.
**Rechazado:** importar `StudentModule` — arrastra infra real, mocking pesado, mide de más.

### ADR-3 — Orden TDD: guard rojo ANTES de wirear
**Decisión:** commit del guard rojo (esbuild) → wireo (verde + gate A) → limpieza (gate B).
**Rationale:** preserva el RED→GREEN (prueba empírica del bug) sin romper el aislamiento de causas del gate de dos pasos.
**Rechazado:** wirear primero (gate literal) — el guard nacería verde, se pierde el RED y el valor documental.

### ADR-4 — `module: es6` en test vs `commonjs` de prod
**Decisión:** `es6` en test.
**Rationale:** Vitest consume ESM e inyecta `__dirname`; forzar `commonjs` rompería su pipeline. La paridad que importa es de metadata (`decoratorMetadata`), no de formato de módulo.
**Rechazado:** `commonjs` para "igualar prod" — igualaría lo irrelevante y rompería lo relevante.

---

## 8. Estimación de líneas (por archivo)

| Archivo | Δ | Detalle |
|---|---|---|
| `api/vitest.config.ts` | +12 | import de `unplugin-swc` + bloque `plugins: [swc.vite({ jsc:{...}, module:{...} })]` con opciones de paridad explícitas |
| `api/src/presentation/attendance-type/attendance-type.controller.ts` | −7 | −6 `@Inject(Clase)` + quitar `Inject` del import de `@nestjs/common` (queda sin uso) |
| `api/src/presentation/student/__tests__/student.controller.di.test.ts` | +40 (nuevo) | testing module ligero + 12 stubs + loop de aserción |
| **Total** | **~+45 neto** | 1 solo PR, MUY por debajo del budget de 400 líneas → no aplica review workload guard |

**Corrección al proposal:** el proposal estimó ~25 líneas (guard ~15). El guard realista con 12 stubs + setup es ~40. Sigue siendo un PR chico. La estimación de config sube de +3 a +12 porque las opciones de paridad de decorators se explicitan (no se delega a un `.swcrc`).

---

## 9. Trazabilidad diseño → spec

| Spec | Resuelto por |
|---|---|
| VSM-R1 / S1 | §2 config (plugins raíz, opciones de paridad) |
| VSM-R2 / S2a,S2b | §4 guard (S2a) + §3 paso 3 e2e attendance-type verde (S2b) |
| VSM-R3 / S3 | §3 paso 3 (limpieza tras suite verde) |
| VSM-R4 / S4 | §6 (cubierto por suite + review, sin test dedicado) |
| VSM-R5 / S5 | §4 guard RED→GREEN + §3 orden |
| VSM-R6 / S6 | §3 paso 2 y 5 (suite completa) + §5 vectores |
