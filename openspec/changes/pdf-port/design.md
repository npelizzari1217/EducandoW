# Design — PDF Port (Inversión de Dependencia, ADR-06)

- Change: `pdf-port`
- Store: hybrid (engram `sdd/pdf-port/design` + este archivo)
- Lee: `specs/spec.md` (PDP-R1..R6 / PDP-S1..S6, MANDA) + `proposal.md`
- Arquitectura: Clean/Hexagonal. Patrón: DIP vía port + token `Symbol`. Refactor puro de dependencias, motor y salida intactos.
- Fuera de alcance (heredado del spec): `Result<Buffer,PdfError>`, `onModuleDestroy` en el port, unificar tokens legados string-literal.

---

## 0. Hallazgos que condicionan el diseño (leídos del código real)

Dos hechos NO obvios que cambian la implementación respecto de lo que sugiere el spec a primera vista:

### H1 — Los 4 use-cases se cablean con `useFactory`, no con auto-wiring de clase
En los 3 módulos feature cada use-case es:
```ts
{ provide: GenerateXUseCase, useFactory: (pdfGen, ...) => new GenerateXUseCase(pdfGen, ...), inject: [PdfGeneratorService, ...] }
```
Con `useFactory`, Nest **NO lee** los decoradores `@Inject` del constructor: resuelve el array `inject` y lo pasa posicionalmente. Consecuencia:

- Lo que INVIERTE la dependencia en runtime es cambiar `inject: [PdfGeneratorService]` → `inject: [PDF_PORT]` en cada módulo.
- Lo que elimina la flecha prohibida `application→infra` (PDP-R2, el requisito central) es cambiar el **import** dentro del archivo del use-case: sacar `import { PdfGeneratorService } from '../../infrastructure/...'` y tipar el param como `PdfPort`.
- El decorador `@Inject(PDF_PORT)` que pide PDP-R3 es, con `useFactory`, **documental/future-proof** (se lee solo si alguien migra a provider por clase). Se agrega igual porque el spec lo exige y es inocuo: no rompe el `new` de los tests ni el factory.

### H2 — Los tests de use-case instancian con `new`, con mock estructural sin tipo
```ts
const pdfGenerator = { generatePdf: vi.fn().mockResolvedValue(Buffer.from('PDF')) };
const uc = new GenerateAttendanceTypesPdfUseCase(pdfGenerator, prisma, repo);
```
No hay `import` de `PdfGeneratorService` en los tests (solo aparece en un comentario). El mock es un objeto literal validado estructuralmente contra el tipo del param. Al pasar el param de `PdfGeneratorService` a `PdfPort`, `{ generatePdf }` sigue satisfaciendo el tipo → **cero cambios en esos tests** (PDP-R6/S6 se cumple sin tocar la forma del mock).

### H3 — `GeneratePdfOptions` no tiene otros consumidores
`rg 'GeneratePdfOptions' api/src` → **1 solo archivo**: `pdf-generator.service.ts` (su definición). El barrel `infrastructure/reporting/index.ts` NO lo re-exporta. El único caller con options (`generate-asistencia-mensual-pdf`) pasa un literal `{ landscape: true }` sin importar el tipo. Moverla al port no rompe ningún import existente ni el barrel.

### H4 — El patrón `useExisting` en scope consumidor YA está probado por #107
`reporting.module.test.ts` (PR #107) hace `{ provide: 'A_PDF', useExisting: PdfGeneratorService }` dentro de módulos que solo importan `ReportingModule`. Prueba que `ReportingModule` exporta la CLASE y que un `useExisting: PdfGeneratorService` resuelve en el injector del consumidor. Esto valida el aliasing que vamos a usar.

---

## 1. Decisión: `useExisting` vs `useClass` (PDP-R5) — ADR

**Elegido: `{ provide: PDF_PORT, useExisting: PdfGeneratorService }`.**

`useExisting` crea un **alias** al provider existente: `PDF_PORT` y `PdfGeneratorService` resuelven a la MISMA instancia singleton — la que gestiona el `Browser` de Puppeteer (RPI-R1 de #107). `=== true`.

**Descartado: `useClass: PdfGeneratorService`.** Registraría un provider SEPARADO bajo el token `PDF_PORT` → Nest instancia un SEGUNDO `PdfGeneratorService` → segundo `Browser` de Puppeteer al primer `generatePdf`. Deshace exactamente la unificación de instancia de #107 (RPI-R1/R2/R3). PDP-S5 (`===`) fallaría.

**Descartado: `useValue`.** Requeriría instanciar a mano; pierde el ciclo de vida `onModuleDestroy` que Nest gestiona sobre el provider de clase.

---

## 2. Decisión: dónde se registra `PDF_PORT` — scoping DI — ADR

**Elegido: `ReportingModule` provee `PDF_PORT` (useExisting) y lo EXPORTA, junto a `PdfGeneratorService`.**

```ts
// infrastructure/reporting/reporting.module.ts
@Module({
  providers: [
    PdfGeneratorService,
    { provide: PDF_PORT, useExisting: PdfGeneratorService },
  ],
  exports: [PdfGeneratorService, PDF_PORT],
})
export class ReportingModule {}
```

Los 3 módulos feature YA importan `ReportingModule` → reciben el token `PDF_PORT` **gratis**, sin declarar el provider. El único cambio en ellos es el `inject` del `useFactory` (H1). Provider centralizado = DRY, y no obliga a tocar los 3 módulos para el provider.

Por qué funciona el scoping: `useExisting: PdfGeneratorService` se resuelve en el injector de `ReportingModule`, donde `PdfGeneratorService` es provider propio → alias válido en el MISMO injector, misma instancia. Al exportar `PDF_PORT`, el token viaja a cualquier módulo que importe `ReportingModule` y sigue apuntando al singleton (los providers exportados no se re-instancian, se comparten). Consistente con H4.

**Descartado: registrar `{ provide: PDF_PORT, useExisting: PdfGeneratorService }` en CADA módulo feature.** Funciona (H4 lo prueba: `PdfGeneratorService` está exportado, así que `useExisting` resuelve en el scope del consumidor), pero es duplicación x3 del mismo wiring y ensucia los 3 módulos. Rechazado por DRY. El aliasing pertenece al módulo dueño del singleton.

---

## 3. Decisión: relocation de `GeneratePdfOptions` (PDP-R1/R4) — ADR

**Elegido: mover la definición al port; infra la reimporta.**

- `pdf.port.ts` define y exporta `GeneratePdfOptions` (mismo nombre, misma forma).
- `pdf-generator.service.ts` borra su `export interface GeneratePdfOptions {...}` y hace `import type { PdfPort, GeneratePdfOptions } from '.../application/shared/ports/pdf.port'`. Flecha `infra→application` = permitida (DIP).

No rompe nada (H3): sin re-export en el barrel, sin otros importers, el caller de `{landscape:true}` no depende del tipo. **Ningún cambio en `index.ts`.**

---

## 4. Decisión: test de arquitectura (PDP-R2/S2) — ADR

**Elegido: test Vitest que escanea el árbol `api/src/application/` y falla si algún archivo importa el path de infra del servicio PDF.**

Mecanismo (nuevo archivo `api/src/application/__tests__/no-infra-pdf-import.arch.test.ts`):
```ts
// lee recursivamente *.ts bajo api/src/application (excluye __tests__)
// aserción PRIMARIA (robusta): ninguna línea de import referencia el PATH del servicio
const FORBIDDEN_PATH = /from\s+['"][^'"]*infrastructure\/reporting\/pdf-generator\.service['"]/;
// aserción SECUNDARIA: ningún import declara el identificador de la clase
const FORBIDDEN_IMPORT = /^\s*import\b[^;]*\bPdfGeneratorService\b/m;
```

**Por qué path-based como aserción primaria:** el JSDoc de `generate-asistencia-mensual-pdf.use-case.ts` contiene el texto `PdfGeneratorService.generatePdf` en un comentario. Un `\bPdfGeneratorService\b` a secas daría **falso positivo**. Escanear el PATH del import (o restringir el identificador a líneas `import`) evita ese ruido. Esta es la sutileza clave del test.

**Tradeoffs frente a alternativas:**
- ESLint `no-restricted-imports`: buena valla estructural, pero `pnpm lint` es un comando separado de `pnpm test`; TDD estricto quiere un RED dentro del test runner + coverage. Se puede sumar como refuerzo en un follow-up, no como la verificación TDD principal.
- grep en CI: fuera del runner, frágil, sin RED reproducible localmente. Descartado.

El test **FALLA HOY** (los 4 use-cases importan la clase) → RED legítimo. Pasa a GREEN tras el refactor de los 4 use-cases (paso 8).

---

## 5. Decisión: test de instancia única (PDP-S5) — ADR

**Elegido: extender `reporting.module.test.ts` (reusa el mock de puppeteer de #107) con un `it` nuevo.**

```ts
it('resolves PDF_PORT and PdfGeneratorService to the same instance (PDP-S5)', async () => {
  const moduleRef = await Test.createTestingModule({ imports: [ReportingModule] }).compile();
  expect(moduleRef.get(PDF_PORT)).toBe(moduleRef.get(PdfGeneratorService)); // ===
});
```

Reusa el `vi.mock('puppeteer', ...)` y el `beforeEach` ya presentes en ese archivo. No arma módulos stub nuevos: `ReportingModule` ahora expone ambos tokens. **RED** hasta que el paso 5 agregue el provider+export; **GREEN** después.

---

## 6. Contrato del port (PDP-R1) — artefacto nuevo

`api/src/application/shared/ports/pdf.port.ts`:
```ts
export interface GeneratePdfOptions {
  landscape?: boolean;
  margin?: Partial<{ top: string; bottom: string; left: string; right: string }>;
}
export interface PdfPort {
  generatePdf(html: string, options?: GeneratePdfOptions): Promise<Buffer>;
}
export const PDF_PORT = Symbol('PDF_PORT');
```
Token `Symbol` (patrón nuevo, alineado con `MATERIA_PREVIA_REPOSITORY`, no string-literal legado). Sin `@Injectable` (es application puro).

---

## 7. Wiring antes / después (concreto)

### 7.1 `ReportingModule` (infra) — dueño del singleton
ANTES: `providers: [PdfGeneratorService]`, `exports: [PdfGeneratorService]`.
DESPUÉS: agrega `{ provide: PDF_PORT, useExisting: PdfGeneratorService }` a providers y `PDF_PORT` a exports. (+import de PDF_PORT desde el port.)

### 7.2 Cada use-case (application)
ANTES:
```ts
import { PdfGeneratorService } from '../../infrastructure/reporting/pdf-generator.service';
constructor(private readonly pdfGenerator: PdfGeneratorService, ...) {}
```
DESPUÉS:
```ts
import { Inject } from '@nestjs/common';
import { PdfPort, PDF_PORT } from '../shared/ports/pdf.port'; // ruta relativa según carpeta
constructor(@Inject(PDF_PORT) private readonly pdfGenerator: PdfPort, ...) {}
```
(el cuerpo — `this.pdfGenerator.generatePdf(html, ...)` — no cambia). Nota: `generate-attendance-types-pdf` vive un nivel más profundo (`use-cases/`), la ruta relativa lleva un `../` extra.

### 7.3 Cada módulo feature (presentation) — solo el `inject` del factory
ANTES (ej. reportes.module):
```ts
import { PdfGeneratorService } from '../../infrastructure/reporting/pdf-generator.service';
useFactory: (pdfGen: PdfGeneratorService, ...) => new GenerateBoletinUseCase(pdfGen, ...),
inject: [PdfGeneratorService, PdfStorageService, ...],
```
DESPUÉS:
```ts
import { PdfPort, PDF_PORT } from '../../application/shared/ports/pdf.port';
useFactory: (pdf: PdfPort, ...) => new GenerateBoletinUseCase(pdf, ...),
inject: [PDF_PORT, PdfStorageService, ...],
```
Se elimina el import de `PdfGeneratorService` (ya no se referencia el token de clase). El provider de `PDF_PORT` NO se declara aquí: llega por `imports: [ReportingModule]`.

- `reportes.module`: 2 factories (boletin + constancia) → 2 inject arrays.
- `asistencia-reporting.module`: 1 factory.
- `attendance-type.module`: 1 factory (los otros 5 use-cases no tocan PDF).

Estado intermedio seguro: si se cambian use-cases (7.2) antes que módulos (7.3), el factory sigue con `inject: [PdfGeneratorService]` y `PdfGeneratorService implements PdfPort` → asignable al param `PdfPort`. Compila y corre. Sin ventana rota.

---

## 8. Orden TDD (test primero — RED legítimo → GREEN)

| # | Acción | Estado esperado |
|---|--------|-----------------|
| 1 | Escribir test de arquitectura §4 (PDP-S2) | **RED** — 4 use-cases importan la clase HOY |
| 2 | Escribir test de contrato del port (PDP-S1) | **RED** — `pdf.port.ts` no existe |
| 3 | Crear `pdf.port.ts` (§6) | S1 **GREEN** (S2 sigue RED) |
| 4 | Escribir test instancia única en `reporting.module.test.ts` (PDP-S5) | **RED** — `PDF_PORT` aún no provisto |
| 5 | `ReportingModule`: provider `useExisting` + export (§7.1) | S5 **GREEN** |
| 6 | Escribir/ajustar test PDP-S4 (service `implements PdfPort`, importa `GeneratePdfOptions` del port) | **RED** |
| 7 | `pdf-generator.service.ts`: `implements PdfPort`, reimporta `GeneratePdfOptions`, borra su export propio (§3) | S4 **GREEN** |
| 8 | Refactor 4 use-cases (§7.2): import PdfPort + `@Inject(PDF_PORT)` + tipo | **S2 GREEN** (flecha application→infra eliminada) |
| 9 | Refactor 3 módulos feature (§7.3): `inject: [PDF_PORT]` | wiring runtime correcto; suite de use-cases sigue verde (PDP-S6) |
| 10 | `pnpm test` completo + coverage ≥ 80% | todo verde |

Nota PDP-S3: el spec lo describe con `{ provide: PDF_PORT, useValue: {...} }` en TestingModule, pero los tests reales instancian con `new` y mock estructural (H2). Esos tests YA prueban que el constructor acepta un `PdfPort` sin requerir provider bajo la clase. Un test DI-level (TestingModule con provider `PDF_PORT`) es **aditivo/opcional**, no es el RED/GREEN del refactor. Se deja a criterio de `sdd-tasks` sumarlo si se quiere paridad literal con S3.

---

## 9. Estimación de líneas (cambiadas/nuevas)

| Archivo | Tipo | ~Líneas |
|---------|------|---------|
| `application/shared/ports/pdf.port.ts` | nuevo | 20 |
| `infrastructure/reporting/pdf-generator.service.ts` | edit (import + implements, -export interface) | 8 |
| `application/attendance-type/use-cases/generate-attendance-types-pdf.use-case.ts` | edit | 3 |
| `application/reportes/generate-constancia-regular.use-case.ts` | edit | 3 |
| `application/reportes/generate-boletin.use-case.ts` | edit | 3 |
| `application/asistencia-reporting/generate-asistencia-mensual-pdf.use-case.ts` | edit | 3 |
| `infrastructure/reporting/reporting.module.ts` | edit (provider+export+import) | 4 |
| `presentation/reportes/reportes.module.ts` | edit (2 factories) | 8 |
| `presentation/asistencia-reporting/asistencia-reporting.module.ts` | edit | 5 |
| `presentation/attendance-type/attendance-type.module.ts` | edit | 4 |
| **Producción subtotal** | | **~61** |
| `application/__tests__/no-infra-pdf-import.arch.test.ts` | nuevo (S2) | 30 |
| test contrato port (S1) | nuevo | 20 |
| `reporting.module.test.ts` (S5, +1 it) | edit | 12 |
| test S4 (en `pdf-generator.service.test.ts`) | edit | 15 |
| use-case tests existentes (S6) | sin cambio | 0 |
| **Tests subtotal** | | **~77** |
| **TOTAL** | | **~138** |

**~138 líneas < 400 → UN SOLO PR. Sin chained-pr, sin `size:exception`.** (Coincide con la estimación 90-120 del proposal, +tests de arquitectura.)

---

## 10. Riesgos / supuestos

- **R1 (bajo):** el JSDoc de `generate-asistencia-mensual-pdf` menciona `PdfGeneratorService` en texto — el test de arquitectura DEBE ser path-based o restringido a líneas `import` para no dar falso positivo (§4). Alternativa: limpiar también ese comentario.
- **R2 (bajo):** `@Inject(PDF_PORT)` es documental bajo `useFactory` (H1); si en el futuro se migran los use-cases a provider por clase, ese decorador pasa a ser funcional. No hay acción ahora, pero conviene que `sdd-tasks` lo deje anotado para no confundir a quien lea el módulo.
- **R3 (muy bajo):** el test S5 depende del mock de puppeteer ya presente en `reporting.module.test.ts`; si se moviera a archivo nuevo habría que replicar el `vi.mock('puppeteer')`. Se recomienda extender el archivo existente.
- **Supuesto:** `PdfGeneratorService` conserva `onModuleDestroy` (fuera de alcance del port). `implements PdfPort` se SUMA a `implements OnModuleDestroy` (`implements PdfPort, OnModuleDestroy`).
