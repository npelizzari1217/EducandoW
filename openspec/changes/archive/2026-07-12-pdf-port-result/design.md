# Design: pdf-port-result — Result end-to-end en el path PDF

> Fase `design` del change `pdf-port-result`. Lee y obedece:
> - Spec (MANDA): `specs/reporting-infrastructure/spec.md` (`PPR-R1..R6`, `PPR-S1..S9`).
> - Proposal: `proposal.md` (variante **(ii)** — solo el error de PDF fluye como Result).
>
> Alcance CERRADO: el fallo de **generación de PDF** viaja como `Result<Buffer, PdfError>` de
> punta a punta (port → service → use-cases → helper → controllers). Todo otro error
> (validación de negocio) sigue por `throw`. NO se toca la base de error-model.

## 1. Arquitectura elegida (patrón + capas + bordes)

Patrón: **doble canal de error transitorio, con materialización en el borde de `presentation`**.

- **Canal A — Result (nuevo, solo PDF):** el fallo de infra de Puppeteer se representa como
  `err(PdfError)` y se propaga como VALOR devuelto por todo `application/`, sin `throw`.
- **Canal B — throw (preexistente, todo lo no-PDF):** validaciones de negocio
  (`BoletinError`, `ConstanciaError`, `AsistenciaReportingError`, `AttendanceTypeLevelOutOfScopeError`,
  template-not-found) siguen lanzándose como excepciones, tal como hoy.

Ambos canales **convergen en HTTP** dentro de `presentation/`:
- El Result se materializa con el helper `unwrapResultOrThrow`, que ante `err` lanza `HttpException`.
- Los throws siguen manejándose por el `try/catch` existente de cada controller y/o el
  `AppExceptionFilter` global.

Respeta la regla de capas del proyecto (clean-arch):
- `PdfError` vive en `application/shared/errors/` — renderizar PDF no es regla de `packages/domain`.
- El `Result` viene de `@educandow/domain` (`application → domain`, permitido).
- El port sigue en `application/shared/ports/`, implementado en `infrastructure/reporting/`.
- El helper vive en `presentation/` — **presentation SÍ puede lanzar** `HttpException`
  (la regla no-throw es de domain/application), así reusamos el pipeline `HttpException → filter`.

### Regla de oro del scope: `throw` sigue prohibido en `application` SOLO para el error de PDF

La spec no exige convertir los throws no-PDF. Este change baja el fallo de PDF (el único que hoy
sube crudo desde infra) al canal Result. Los throws de validación ya existían y son un smell
**reconocido y bounded**, cuyo cierre es un change aparte (`app-error-model`, requiere base
`ApplicationError` — hallazgo del explore, HOY NO EXISTE).

## 2. Mapa de componentes y flujo de datos

```
HTTP request
   │
   ▼
[Controller]  (presentation) ── @Res() manual, arma headers + res.send(buffer)
   │  try {                                          ┌─ canal B (throw): BoletinError, etc.
   │    result = await useCase.execute(...)  ────────┤   → catch existente → res.status().json()
   │    buffer = unwrapResultOrThrow(result) ────────┤   → o AppExceptionFilter global
   │    res.send(buffer)                             └─ canal A (Result err): HttpException(500)
   │  } catch (err) { ...existente... }
   ▼
[UseCase]  (application) ── devuelve Promise<Result<Buffer, PdfError>>
   │  · valida negocio → puede THROW (canal B, sin cambios)
   │  · const result = await this.pdf.generatePdf(html[, opts])
   │  · propaga result tal cual  ── o, si post-procesa, unwrap→proceso→ok(buffer)
   ▼
[PdfPort]  (application/shared/ports) ── generatePdf(): Promise<Result<Buffer, PdfError>>
   ▼
[PdfGeneratorService]  (infrastructure/reporting) ── implementa el port
      try { ... return ok(Buffer.from(pdf)) }
      catch (e) { return err(new PdfError({ cause: e })) }   // NO re-lanza
```

### Integración / puntos de contacto (inventario cerrado)

| # | Archivo | Rol | Cambio |
|---|---------|-----|--------|
| 1 | `application/shared/errors/pdf.error.ts` **(nuevo)** | Tipo de error | crear `PdfError` |
| 2 | `application/shared/ports/pdf.port.ts` | Contrato | firma → `Promise<Result<Buffer, PdfError>>` |
| 3 | `infrastructure/reporting/pdf-generator.service.ts` | Impl del port | catch → `err`, happy → `ok` |
| 4 | `application/reportes/generate-boletin.use-case.ts` | UC (post-proceso) | propaga Result + storage |
| 5 | `application/reportes/generate-constancia-regular.use-case.ts` | UC (pura) | propaga Result |
| 6 | `application/attendance-type/use-cases/generate-attendance-types-pdf.use-case.ts` | UC (pura) | propaga Result |
| 7 | `application/asistencia-reporting/generate-asistencia-mensual-pdf.use-case.ts` | UC (pura, 2 entrypoints) | propaga Result |
| 8 | `application/reportes/generate-boletin-batch.use-case.ts` **(5.º, no listado en spec)** | UC consumidor | adapta consumo del Result |
| 9 | `presentation/shared/http/unwrap-result-or-throw.ts` **(nuevo)** | Helper Result→HTTP | crear |
| 10 | `presentation/reportes/reportes.controller.ts` | Controller (2 endpoints PDF) | insertar helper |
| 11 | `presentation/attendance-type/attendance-type.controller.ts` | Controller (`printList`) | insertar helper |
| 12 | `presentation/asistencia-reporting/asistencia-reporting.controller.ts` | Controller (2 endpoints) | insertar helper |

**Tests tocados:** `pdf.port.test.ts`, `pdf-generator.service.test.ts`, los 4 tests de use-case,
el test de batch, `unwrap-result-or-throw.test.ts` (nuevo), y los 3 tests de controller.

## 3. Decisiones (ADR-style)

### ADR-1 — `PdfError`: clase en `application/shared/errors/`, `cause` nativo

**Elegido:**
```ts
// api/src/application/shared/errors/pdf.error.ts
export class PdfError extends Error {
  readonly code = 'PDF_GENERATION_FAILED';
  readonly httpStatus = 500;
  readonly cause?: unknown;
  constructor(options?: { cause?: unknown }) {
    super('PDF generation failed');
    this.name = 'PdfError';
    this.cause = options?.cause;
  }
}
```
- `code`/`httpStatus` como campos `readonly` con literal (cumple PPR-S3).
- `cause?: unknown` declarado explícito y asignado en el ctor. NO se usa `super(msg,{cause})` para
  no depender del `lib` de tsconfig; la propiedad propia es equivalente y robusta.
- Firma del ctor = `new PdfError({ cause: e })` (objeto de opciones), como pide el diseño.

**Barrel:** NO se crea barrel nuevo. Se importa directo desde `pdf.error.ts`, coherente con la
convención vigente (`BoletinError` se importa desde su use-case; `ConstanciaError` desde su template).
Existe `application/reportes/index.ts` pero es de reportes, no de shared/errors. Un solo tipo no
justifica un barrel.

**Descartado:** base `ApplicationError` compartida → fuera de scope (no existe, bloqueante de
variante (i), no de (ii)). Un enum/union de códigos → infra tiene catch genérico, no clasifica causas.

---

### ADR-2 — Service: `catch → err(PdfError)`, `happy → ok(buffer)`

Firma pasa de `Promise<Buffer>` a `Promise<Result<Buffer, PdfError>>`.

**Antes** (`pdf-generator.service.ts:26-52`):
```ts
async generatePdf(html: string, options?: GeneratePdfOptions): Promise<Buffer> {
  const page = await this.newPage();
  try {
    await page.setContent(html, { waitUntil: 'load', timeout: 15_000 });
    const pdf = await page.pdf({ /* ... */ });
    return Buffer.from(pdf);
  } catch (err) {
    this.logger.error(`PDF generation failed: ${(err as Error).message}`);
    throw err;                                    // ← sube crudo hasta el filter
  } finally {
    await page.close();
  }
}
```
**Después:**
```ts
async generatePdf(html: string, options?: GeneratePdfOptions): Promise<Result<Buffer, PdfError>> {
  const page = await this.newPage();
  try {
    await page.setContent(html, { waitUntil: 'load', timeout: 15_000 });
    const pdf = await page.pdf({ /* ...igual... */ });
    return ok(Buffer.from(pdf));                  // ← happy path envuelto
  } catch (e) {
    this.logger.error(`PDF generation failed: ${(e as Error).message}`);
    return err(new PdfError({ cause: e }));       // ← NO re-lanza; cause preservado
  } finally {
    await page.close();
  }
}
```
`ok`/`err` importados de `@educandow/domain`; `PdfError` de `application/shared/errors/pdf.error`.
Cumple PPR-R2/S2: la promesa RESUELVE en `err`, no rechaza; `cause` = error original.
El `finally { page.close() }` intacto. Nota: un fallo de `getBrowser()`/`newPage()` ocurre ANTES
del try y hoy rechaza — queda igual (out of scope; el catch cubre setContent/pdf, que es lo que la
spec exige). *(riesgo menor, ver §6)*.

---

### ADR-3 — Coexistencia de mecanismos: ACEPTABLE y correcta para (ii) *(el punto delicado)*

**Contrato dual de cada use-case tras el cambio:**
> Devuelve `Promise<Result<Buffer, PdfError>>` **Y** puede `throw` sus errores de validación
> ANTES de llamar al port.

Ejemplo concreto (`generate-boletin`): puede `throw new BoletinError('AXCC_NOT_FOUND', 404)` en el
paso 1, o `return err(PdfError)` en el paso 11. Dos canales, una firma. La firma es "honestamente
parcial": *"el paso PDF es un Result; todo lo previo puede lanzar"*.

**¿Es aceptable? SÍ. Mi lectura (sin edulcorar):**

1. **Es un smell, pero PREEXISTENTE y BOUNDED.** Los throws ya estaban; este change NO los agrega ni
   los regresa. Solo baja al canal Result el ÚNICO error que hoy sube crudo desde infra (el de PDF).
2. **La honestidad del tipo es transitoria, no final.** El end-state (todo el error-model como
   Result con union `PdfError | BoletinError | ...`) es exactamente la variante **(i)**, que el
   proposal descartó: obliga a una base `ApplicationError` inexistente y a reescribir 3–6 throws +
   tests por use-case (~500-600 líneas). Cerrar el smell AHORA sería ceremonia sub-horneada.
3. **En el borde ambos canales CONVERGEN sin fricción.** El controller maneja los dos con el mismo
   destino HTTP: `try/catch` para los throws (ya existente) + `unwrapResultOrThrow` para el Result
   (que lanza `HttpException`, cayendo en el MISMO catch o en el filter global). El consumidor no
   razona dos modelos divergentes: todo termina en `HttpException → AppExceptionFilter`.

**¿Hay forma más limpia DENTRO de (ii)? No sin romper el scope.**
- Envolver el UC entero en try/catch y devolver `err` de los throws → requiere union de errores =
  variante (i) = fuera de scope.
- Dejarlo como está es el costo honesto del enfoque incremental. Se documenta a los gritos y se
  nombra el follow-up: **`app-error-model`** (primero necesita la base `ApplicationError`).

**Prueba de que el patrón COMPONE:** el 5.º use-case (`generate-boletin-batch`, ADR-5) consume al
single UC y maneja LOS DOS canales en el mismo loop (`isErr()` para el PDF, `try/catch` para
`BoletinError`), ambos → "saltear alumno, seguir". Es la mejor evidencia de que la coexistencia es
manejable y no viral.

---

### ADR-4 — Use-cases: propagación directa vs post-proceso

**Regla general (los 3 puros): propagar el Result tal cual.** El port ya devuelve
`Result<Buffer, PdfError>`, así que el UC solo cambia el tipo de retorno y reenvía.

- **`generate-constancia-regular`** (`:198`) — pura:
  ```ts
  // antes:  return this.pdfGenerator.generatePdf(html);   // Promise<Buffer>
  // después: return this.pdfGenerator.generatePdf(html);   // ya es Promise<Result<Buffer,PdfError>>
  ```
  Solo cambia la firma de `execute(): Promise<Result<Buffer, PdfError>>`. Cero lógica nueva.

- **`generate-attendance-types-pdf`** — pura, pero el retorno sale de `render()` (privado):
  cambian las firmas de `render()` y `execute()`. `render()` sigue lanzando
  `new Error('Template ... no encontrado')` (`:110`) → canal B, intacto.

- **`generate-asistencia-mensual-pdf`** — pura, con **DOS entrypoints** (`executeGeneral`,
  `executeMateria`) que hacen `return this.render(...)`. Cambian las 3 firmas
  (los dos públicos + `render`). `render` sigue lanzando `AsistenciaReportingError` (template) →
  canal B, intacto.

**Excepción (post-proceso): `generate-boletin`** — hace algo con el buffer DESPUÉS de generarlo
(guarda a disco vía `pdfStorage.save`). Debe unwrap-ear, post-procesar y re-envolver:

**Antes** (`generate-boletin.use-case.ts:216-224`):
```ts
const pdfBuffer = await this.pdfGenerator.generatePdf(html);      // Promise<Buffer>
await this.pdfStorage.save(axcc.id, pdfBuffer);                   // post-proceso
return pdfBuffer;
```
**Después:**
```ts
const result = await this.pdfGenerator.generatePdf(html);        // Result<Buffer,PdfError>
if (result.isErr()) return result;                               // propaga el err sin guardar
const pdfBuffer = result.unwrap();
await this.pdfStorage.save(axcc.id, pdfBuffer);                  // post-proceso solo en éxito
return ok(pdfBuffer);
```
**Segundo punto en `generate-boletin`: el cache-first** (`:132-137`) también devuelve un Buffer
crudo y debe envolverse:
```ts
// antes:  return fs.promises.readFile(cachedPath);
// después: return ok(await fs.promises.readFile(cachedPath));
```
Firma de `execute()` → `Promise<Result<Buffer, PdfError>>`. Los `throw new BoletinError(...)` de
validación (pasos 1-10) quedan intactos (canal B).

**Verificación de los 4 (¿quién post-procesa el buffer?):**
| Use-case | Post-proceso del buffer | Cambio |
|----------|-------------------------|--------|
| generate-boletin | **SÍ** — `pdfStorage.save` + rama cache-first | unwrap → save → `ok`; cache-first → `ok` |
| generate-constancia | No | propaga directo |
| generate-attendance-types | No | propaga directo (vía `render`) |
| generate-asistencia-mensual | No | propaga directo (vía `render`, ×2 entrypoints) |

---

### ADR-5 — Hallazgo: `generate-boletin-batch` es un 5.º consumidor que la spec NO lista

`GenerateBoletinBatchUseCase` (`generate-boletin-batch.use-case.ts:79`) consume al single UC:
```ts
const pdfBuffer = await this.singleUC.execute(row.id);   // HOY: espera un Buffer
archive.append(pdfBuffer, { name: ... });
```
Con el cambio, `singleUC.execute()` devuelve `Result<Buffer, PdfError>` →
`archive.append(<Result>, ...)` **appendearía basura** y el `try/catch` del loop **ya no atraparía**
los fallos de PDF (ahora son `err` devuelto, no throw). La política "saltear el que falla, seguir"
se rompería en silencio. Confirmado en su test: `makeSingleUC` mockea `return Buffer.from(...)` /
`throw BoletinError` (`generate-boletin-batch.use-case.test.ts:107-114`).

**Adaptación (maneja LOS DOS canales — es el ejemplo vivo del ADR-3):**
```ts
try {
  const result = await this.singleUC.execute(row.id);
  if (result.isErr()) {                                  // canal A: fallo de PDF → saltear
    this.logger.error(`Failed ... ${result.unwrapErr().message}`);
    continue;
  }
  const pdfBuffer = result.unwrap();
  archive.append(pdfBuffer, { name: `boletin_${studentName}.pdf` });
  successCount++;
} catch (err) {                                          // canal B: BoletinError (validación) → saltear
  this.logger.error(`Failed ... ${(err as Error).message}`);
}
```
El `BATCH_ALL_FAILED` (throw `BoletinError`, `:97-103`) queda igual. El batch **sigue devolviendo
`Promise<Buffer>` (el ZIP) y sigue lanzando `BoletinError`** — NO se convierte a Result (su error no
es un `PdfError`; los fallos de PDF por alumno se absorben). Su test cambia el mock del single UC a
`ok(...)`/`err(new PdfError())`. Impacto: ~6 líneas de prod + ~15 de test. **Sube la estimación del
proposal (que no lo contó).**

---

### ADR-6 — Helper `unwrapResultOrThrow` en `presentation/shared/http/`

**Elegido:**
```ts
// api/src/presentation/shared/http/unwrap-result-or-throw.ts
import { HttpException } from '@nestjs/common';
import type { Result } from '@educandow/domain';
import type { PdfError } from '../../../application/shared/errors/pdf.error';

export function unwrapResultOrThrow<T>(result: Result<T, PdfError>): T {
  if (result.isErr()) {
    const error = result.unwrapErr();
    throw new HttpException(
      { statusCode: error.httpStatus, error: error.code, message: error.message },
      error.httpStatus,                                  // = PdfError.httpStatus (500)
    );
  }
  return result.unwrap();
}
```
- Genérico `<T>` (más reusable que `Result<Buffer, PdfError>`; sigue cumpliendo PPR-R5).
- Ubicación: `presentation/shared/http/` — sigue la convención de una-carpeta-por-concern
  (`filters/`, `pipes/`, `interceptors/`). Cumple "presentation/shared/ MUST exportar".
- Lanza `HttpException` (presentation SÍ puede lanzar) → reusa `HttpException → AppExceptionFilter`.

**Nota sobre el body (importante, decisión consciente):** `AppExceptionFilter` reescribe la
respuesta a `{ error: { status, code, message } }` y para `HttpException` **extrae `message` pero
NO `code`** (`exception.filter.ts:75-89`; `code` solo se setea para `DomainError`). Resultado: la
respuesta del PDF-error sale con **status 500 + message correctos**, pero el `code`
`PDF_GENERATION_FAILED` NO aparece en el body. **PPR-S8 se cumple igual** ("status 500 + body
mapeado desde PdfError" → status y message alcanzan).

- **Opción minimalista (RECOMENDADA para no expandir scope):** dejar el filter como está. Aceptar
  que el `code` no viaja en el body. Cero archivos extra.
- **Opción +2 líneas (SUGGESTION, no bloqueante):** en la rama `HttpException` del filter, si el
  objeto de respuesta trae `code: string`, setear `code = obj.code`. Superficializa el
  `PDF_GENERATION_FAILED`. Es el ÚNICO punto donde el scope podría estirarse 2 líneas; queda a
  criterio de `apply`. NO se toma por defecto (el filter no está en el inventario de scope).

---

### ADR-7 — Controllers: insertar el helper, conservar el `try/catch` no-PDF

Los 3 controllers usan `@Res()` + `res.send(buffer)` manual. El helper lanza ANTES de `res.send`,
así que el filter/catch aún puede escribir la respuesta (el response no se envió todavía).

- **`reportes.controller`** (2 endpoints PDF: `getBoletin`, `createConstanciaRegular`; el
  `getBoletinBatch` NO cambia su consumo — el batch sigue devolviendo Buffer):
  ```ts
  // antes:
  const pdfBuffer = await this.singleUC.execute(alumnosXCursoXCicloId);
  // después:
  const result = await this.singleUC.execute(alumnosXCursoXCicloId);
  const pdfBuffer = unwrapResultOrThrow(result);
  ```
  El `try/catch` existente (mapea `BoletinError`/`ConstanciaError`; `else throw err`) se **conserva**:
  el `HttpException` del helper NO es `BoletinError` → cae en `else throw err` → filter → 500. ✓

- **`attendance-type.controller`** (`printList`, `:96`) — **NO tiene try/catch** hoy (delega sus
  throws de dominio al filter global). Es el más limpio:
  ```ts
  const result = await this.generatePdfUC.execute({ level, active, currentUser: user });
  const pdfBuffer = unwrapResultOrThrow(result);
  res.set({ ... }); res.send(pdfBuffer);
  ```
  No necesita try/catch: `AttendanceTypeLevelOutOfScopeError` (dominio) y el `HttpException` del
  helper viajan ambos al `AppExceptionFilter`. Se **conserva** (ausencia de) try/catch.

- **`asistencia-reporting.controller`** (2 endpoints, con `try/catch → handleError`):
  ```ts
  const result = await this.generateUC.executeGeneral({ ... });
  const pdfBuffer = unwrapResultOrThrow(result);
  res.set({ ... }); res.send(pdfBuffer);
  ```
  Se **conserva** el `try/catch → handleError`: el `HttpException` del helper no es
  `AsistenciaReportingError` ni `ForbiddenError` → `throw err` → filter → 500. ✓

**Confirmado:** los 3 controllers conservan su manejo de errores no-PDF. El helper solo añade la
materialización del canal Result.

## 4. Orden TDD (RED → GREEN, `pnpm test`, cov ≥ 80%)

Orden que respeta RED-first **y** la dependencia de compilación (los tests importan `PdfError` y la
firma nueva del port; deben existir para que el test compile aunque falle en aserción):

1. **`PdfError`** (PPR-S3) — leaf sin deps, lo importan todos los demás tests.
   RED: test de forma (`code`/`httpStatus`/`cause`) sobre clase inexistente → crear clase → GREEN.
   *(El diseño sugirió "service primero"; se antepone `PdfError` por dependencia de compilación
   del propio test del service. Deviación menor, justificada.)*
2. **Port type** (PPR-S1) — actualizar `pdf.port.ts` a `Promise<Result<Buffer, PdfError>>` y su
   `pdf.port.test.ts` (hoy asVera `Promise<Buffer>` y el stub devuelve `Buffer.from('PDF')` →
   pasa a `ok(Buffer.from('PDF'))`). El cambio de firma rompe la compilación del service → arrastra (3).
3. **Service** (PPR-S2) — RED: mock `page.setContent`/`page.pdf` a rejectar → esperar
   `err(PdfError)` con `code` y `cause`, y que NO lance. Hoy lanza → RED. Aplicar ADR-2 → GREEN.
4. **Use-cases ×4** (PPR-S4/S5) — por cada uno, RED: mock `PDF_PORT` → `err(PdfError)` ⇒ UC
   devuelve `err` sin lanzar; `ok(buffer)` ⇒ `ok(buffer)`. Para `generate-boletin` sumar:
   `ok` ⇒ `pdfStorage.save` llamado con el buffer y retorno `ok(buffer)`; y cache-first ⇒ `ok`.
   Aplicar ADR-4 → GREEN.
5. **Batch (5.º UC)** — RED: mock `singleUC.execute` → `err(PdfError)` ⇒ alumno salteado
   (no appendeado); todos fallan ⇒ `BATCH_ALL_FAILED`; `ok` ⇒ appendeado. Migrar mock del test de
   `throw`/`Buffer` a `err`/`ok`. Aplicar ADR-5 → GREEN.
6. **Helper** (PPR-S6/S7) — RED: `unwrapResultOrThrow(err(pdfError))` lanza `HttpException(500)`;
   `unwrapResultOrThrow(ok(buffer))` devuelve el buffer. Crear helper (ADR-6) → GREEN.
7. **Controllers ×3** (PPR-S8/S9) — RED: mock UC → `err(PdfError)` ⇒ endpoint 500; `ok(buffer)` ⇒
   200 con el buffer, sin throw en application. Cablear el helper (ADR-7) → GREEN.

## 5. Estimación de líneas (código + test)

| Archivo | Prod | Test | Notas |
|---------|-----:|-----:|-------|
| `pdf.error.ts` (nuevo) + test | 12 | 15 | leaf |
| `pdf.port.ts` + `pdf.port.test.ts` | 4 | 8 | firma |
| `pdf-generator.service.ts` + test | 6 | 25 | catch→err, happy→ok |
| `generate-boletin.use-case.ts` + test | 10 | 30 | post-proceso + cache-first |
| `generate-constancia-regular.use-case.ts` + test | 3 | 20 | propagación pura |
| `generate-attendance-types-pdf.use-case.ts` + test | 5 | 20 | render + execute |
| `generate-asistencia-mensual-pdf.use-case.ts` + test | 7 | 25 | 2 entrypoints + render |
| `generate-boletin-batch.use-case.ts` + test **(5.º)** | 6 | 15 | hallazgo ADR-5 |
| `unwrap-result-or-throw.ts` (nuevo) + test | 12 | 15 | helper |
| `reportes.controller.ts` + test | 6 | 20 | 2 endpoints |
| `attendance-type.controller.ts` + test | 3 | 15 | printList |
| `asistencia-reporting.controller.ts` + test | 6 | 20 | 2 endpoints |
| **Total** | **~80** | **~228** | **≈ 308** |

**≈ 308 líneas < 400 → un solo PR, NO dispara `chained-pr`.** Está más cerca del techo que el
proposal (~210), sobre todo por el 5.º use-case (ADR-5) y por el peso real de los tests.

**Si trepa sobre 400** (p.ej. tests más gordos): la partición vertical "limpia" (reportes →
asistencia → attendance-type) **NO es trivial** — ver §6, riesgo de atomicidad del port. En ese caso
se prefiere `size:exception` antes que introducir un adapter transitorio riesgoso.

## 6. Riesgos y supuestos

- **[ALTO] Atomicidad del port = no hay chained-PR limpio.** `PdfPort.generatePdf` es un contrato
  ÚNICO y compartido: al cambiar su firma a `Result`, TODOS los consumidores (4 use-cases + batch +
  3 controllers) rompen la compilación a la vez. No existe estado intermedio compilable donde el
  port devuelva `Result` y un controller trate el retorno como `Buffer`. Por eso una partición
  vertical por área NO es factible sin un **adapter throwaway** (p.ej. mantener `generatePdf:Buffer`
  deprecado + `generatePdfResult` y migrar por PR) que añade ~40 líneas y su propio riesgo.
  **Recomendación:** PR único (~308 líneas lo permiten). Si excede 400, `size:exception` > adapter.
- **[MEDIO] Hallazgo del 5.º use-case (batch).** No estaba en el inventario de la spec/proposal. Su
  test cambia de mock-throw a mock-`err`. Si `apply` lo pasa por alto, el batch appendea Results como
  basura y rompe la política "saltear-y-seguir" en silencio. Mitigado por el test RED del paso 5.
- **[BAJO] `code` del PdfError no viaja en el body** por cómo el `AppExceptionFilter` trata
  `HttpException` (ADR-6). PPR-S8 se cumple con status+message. La opción +2 líneas queda como
  SUGGESTION.
- **[BAJO] Fallo de `getBrowser()`/`newPage()`** (antes del `try` del service) sigue rechazando la
  promesa (no cae en el catch). La spec solo exige traducir `setContent`/`pdf`/launch-en-el-catch;
  el launch dentro de `getBrowser` con su retry queda fuera. Supuesto: aceptable en (ii).
- **Supuesto:** `@educandow/domain` exporta `Result`, `ok`, `err` (verificado en
  `packages/domain/src/index.ts:2-3`). `PdfGeneratorService` es el único implementor del port
  (verificado). Node 20 soporta `Error.cause`, pero se asigna como campo propio para no depender del
  `lib` de tsconfig.

## 7. Trazabilidad diseño → spec

| Requisito | Cubierto por |
|-----------|--------------|
| PPR-R1/S1 | ADR-2 (firma port), §2 |
| PPR-R2/S2 | ADR-2 (service catch→err) |
| PPR-R3/S3 | ADR-1 (`PdfError`) |
| PPR-R4/S4/S5 | ADR-4 + ADR-5 (use-cases + batch) |
| PPR-R5/S6/S7 | ADR-6 (helper) |
| PPR-R6/S8/S9 | ADR-7 (controllers) |
</content>
</invoke>
