# Spec (delta) — PDF Port (Inversión de Dependencia, ADR-06)

- **Change name:** `pdf-port`
- **Store:** hybrid (engram `sdd/pdf-port/spec` + este archivo)
- **Basado en:** `openspec/changes/pdf-port/proposal.md` (ADR-06 follow-up del PR #107, `reporting-module-compartido`)
- **Convención:** Given/When/Then + RFC 2119 (MUST/MUST NOT/SHOULD/MAY). Cada escenario es verificable de forma aislada, apto para derivar un test directamente (TDD estricto activo).
- **Nivel pedagógico afectado:** `ALL`. `PdfPort` es cross-cutting infraestructural (consumido por 3 features distintos, sin entidad de domain propia); su corrección sostiene la integridad de capas de TODO el reporting.
- **Capability:** EXTIENDE `reporting-infrastructure` (creada por el PR #107, `openspec/specs/reporting-infrastructure/spec.md`, requisitos `RPI-R1..R6`). Este change NO modifica ni deroga ningún `RPI-*`; agrega el contrato de inversión de dependencia sobre el mismo módulo compartido. IDs nuevos de este change: `PDP-R*` / `PDP-S*`.
- **Cross-references:** `openspec/specs/reporting-infrastructure/spec.md` (RPI-R1, invariante de instancia única del provider — PDP-R5 depende de ella); `asistencia-reporting/spec.md`, `report-cards/spec.md`, `attendance-types/spec.md` (consumidores del port, sin cambio de contenido de PDF).

## Fuera de alcance de esta spec (explícito)

- `Result<Buffer, PdfError>` — `generatePdf` sigue devolviendo `Promise<Buffer>` (puede rechazar). Ticket separado.
- `onModuleDestroy` en el port — lifecycle de infra ligado a `ReportingModule`, no forma parte del contrato de `PdfPort`.
- Unificar la convención de tokens legada (`AuthPort`/`FileStoragePort` string-literal) — deuda separada, no forma parte de este change.

---

## PDP-R1 — Existe el contrato `PdfPort`

`api/src/application/shared/ports/pdf.port.ts` MUST exportar una interface `PdfPort` con el método `generatePdf(html: string, options?: GeneratePdfOptions): Promise<Buffer>`, y una constante `PDF_PORT = Symbol('PDF_PORT')` en el mismo archivo. `GeneratePdfOptions` MUST estar definida en este archivo (movida desde infra, no en infra).

### PDP-S1 — El port define la superficie única

- GIVEN el archivo `api/src/application/shared/ports/pdf.port.ts`
- WHEN se inspecciona su contenido exportado
- THEN MUST exportar la interface `PdfPort` con la firma `generatePdf(html: string, options?: GeneratePdfOptions): Promise<Buffer>`
- AND MUST exportar `PDF_PORT: symbol`
- AND MUST exportar el tipo `GeneratePdfOptions`

---

## PDP-R2 — Inversión de dependencia: `application/` no conoce infra (requisito central)

Ningún archivo bajo `api/src/application/` MUST importar la clase concreta `PdfGeneratorService` ni ningún path bajo `infrastructure/reporting/pdf-generator.service`. La única referencia permitida desde `application/` al motor de PDF es el contrato `PdfPort` / token `PDF_PORT`.

### PDP-S2 — Aserción estática: cero imports de infra desde application

- GIVEN el árbol de código bajo `api/src/application/`
- WHEN se busca (grep/test de arquitectura) la cadena `PdfGeneratorService` o el path `infrastructure/reporting/pdf-generator.service` en sentencias de import
- THEN el resultado MUST ser cero coincidencias

---

## PDP-R3 — Los 4 use-cases dependen del port, no de la clase

`GenerateAttendanceTypesPdfUseCase`, `GenerateConstanciaRegularUseCase`, `GenerateBoletinUseCase` y `GenerateAsistenciaMensualPdfUseCase` MUST inyectar `PdfPort` vía `@Inject(PDF_PORT)` en su constructor. Ninguno MUST tipar el parámetro como `PdfGeneratorService`.

### PDP-S3 — Los 4 use-cases resuelven `PdfPort` por token

- GIVEN los 4 use-cases instanciados vía `TestingModule` con un provider `{ provide: PDF_PORT, useValue: { generatePdf: vi.fn() } }`
- WHEN se construye cada use-case
- THEN cada uno MUST resolver su dependencia de generación de PDF a través de `PDF_PORT`, sin requerir ningún provider registrado bajo la clase `PdfGeneratorService`

---

## PDP-R4 — Infra implementa el port sin invertir la fuga de tipos

`PdfGeneratorService` MUST declarar `implements PdfPort`. Su firma pública de `generatePdf` MUST coincidir exactamente con la del port. `PdfGeneratorService` MUST importar `GeneratePdfOptions` desde `pdf.port.ts` (dirección infra → application), y MUST NOT seguir exportando su propia definición de `GeneratePdfOptions`.

### PDP-S4 — La clase de infra satisface el contrato del port

- GIVEN la declaración de clase `PdfGeneratorService`
- WHEN se inspecciona su firma (`implements`) y su import de `GeneratePdfOptions`
- THEN MUST declarar `implements PdfPort`
- AND MUST importar `GeneratePdfOptions` desde `application/shared/ports/pdf.port.ts`
- AND la firma de `generatePdf` MUST ser estructuralmente idéntica a la de `PdfPort['generatePdf']`

---

## PDP-R5 — Una sola instancia preservada (protege RPI-R1 del PR #107)

El wiring de `PDF_PORT` MUST resolver a la MISMA instancia singleton de `PdfGeneratorService` que gestiona el ciclo de vida del `Browser` de Puppeteer — MUST NOT crear una segunda instancia. El provider de `PDF_PORT` MUST usar `useExisting: PdfGeneratorService` (o equivalente que preserve la referencia), no `useClass`.

### PDP-S5 — `PDF_PORT` y `PdfGeneratorService` resuelven a la misma referencia

- GIVEN un `TestingModule` que registra `ReportingModule` y expone tanto `PdfGeneratorService` como `PDF_PORT`
- WHEN se resuelven ambos desde el mismo contexto de módulo (`moduleRef.get(PdfGeneratorService)` y `moduleRef.get(PDF_PORT)`)
- THEN las dos referencias obtenidas MUST ser estrictamente iguales (`===`)

---

## PDP-R6 — Sin regresión de comportamiento

Los 4 use-cases MUST seguir produciendo el mismo PDF (mismo Buffer resultante para la misma entrada) tras el cambio. Los tests existentes que mockean la dependencia como `{ generatePdf: vi.fn() }` MUST seguir pasando sin cambiar la forma del mock — solo el tipo/token inyectado cambia.

### PDP-S6 — Los 4 use-cases producen el mismo PDF con el mismo mock

- GIVEN cada uno de los 4 use-cases con un mock `{ generatePdf: vi.fn().mockResolvedValue(Buffer.from('PDF')) }` provisto bajo `PDF_PORT`
- WHEN se ejecuta cada use-case con datos válidos (igual que antes del cambio)
- THEN cada uno MUST devolver el mismo `Buffer` que el mock resuelve, sin cambios de comportamiento observable
- AND la suite de tests existente MUST seguir en verde sin modificar la forma de los mocks

---

## Trazabilidad requisito → escenario

| Requisito | Escenarios |
|-----------|-----------|
| PDP-R1 | PDP-S1 |
| PDP-R2 | PDP-S2 |
| PDP-R3 | PDP-S3 |
| PDP-R4 | PDP-S4 |
| PDP-R5 | PDP-S5 |
| PDP-R6 | PDP-S6 |
