# Proposal: pdf-port

Follow-up de la deuda **ADR-06** del PR #107 (`reporting-module-compartido`).

## Intent

Hoy los 4 use-cases de `application/` importan y tipan la clase concreta
`PdfGeneratorService` (Puppeteer, `infrastructure/reporting/`) directo en su
constructor. Esto viola la regla dura de la arquitectura: **`application/` importa
SOLO `domain/`**. La dependencia apunta hacia adentro→afuera (application → infra),
que es exactamente la flecha prohibida.

Evidencia (verificada en explore):
- `attendance-type/.../generate-attendance-types-pdf.use-case.ts`
- `reportes/generate-constancia-regular.use-case.ts`
- `reportes/generate-boletin.use-case.ts`
- `asistencia-reporting/.../generate-asistencia-mensual-pdf.use-case.ts` (único con `options`)

Los 3 módulos feature además inyectan la **clase** como token DI, no un token estable.

**Verdad después**: `application/` define el contrato (`PdfPort`), `infrastructure/`
lo implementa. Dependencia invertida: la flecha apunta hacia adentro (infra →
application). Es la aplicación literal del Dependency Inversion Principle.

**Éxito**: ningún archivo de `application/` referencia `PdfGeneratorService`; los 4
use-cases dependen de `PdfPort`; los PDF salen byte-idénticos.

**Nivel pedagógico afectado**: `ALL`. `PdfPort` es cross-cutting infraestructural
(lo consumen 3 features distintos, sin entidad de domain propia); su corrección
sostiene la integridad de capas de TODO el reporting, no de un nivel puntual.

## Scope

**In-scope**
- Nuevo `PdfPort` (interface) + `PDF_PORT = Symbol('PDF_PORT')` en
  `api/src/application/shared/ports/pdf.port.ts`.
- Superficie única: `generatePdf(html: string, options?: GeneratePdfOptions): Promise<Buffer>`.
- **Mover** `GeneratePdfOptions` al archivo del port (mismo nombre, sin renombrar);
  infra la importa de vuelta (dirección correcta infra → application).
- `PdfGeneratorService implements PdfPort`.
- 4 use-cases inyectan `@Inject(PDF_PORT): PdfPort`.
- Wiring: `{ provide: PDF_PORT, ... }` en el módulo; 3 módulos feature pasan a `inject: [PDF_PORT]`.

**Out-of-scope**
- `onModuleDestroy` NO va en el port (lifecycle de infra, ligado a `ReportingModule`).
- Migrar a `Result<Buffer, PdfError>` (mantener `Promise<Buffer>`).
- Unificar la convención token Symbol vs string-literal legado (Auth/FileStorage).

## Approach & rationale

Invertir la dependencia via port + token Symbol (siguiendo el patrón nuevo
`MATERIA_PREVIA_REPOSITORY`, no el string-literal legado). Es **refactor puro de
dependencias, sin cambio de comportamiento**: el motor Puppeteer y la salida no se
tocan.

**Verificación de la inversión** (TDD estricto activo): aserción de arquitectura —
un test/grep estático que falle si algún archivo de `application/` importa
`PdfGeneratorService`. Verde = dependencia invertida.

**No-regresión**: los tests de los 4 use-cases ya mockean `{ generatePdf: vi.fn() }`;
la forma del mock NO cambia. La suite existente sigue verde con cambios mínimos
(solo el tipo inyectado pasa a `PdfPort`). `pnpm test`, coverage ≥ 80%.

## Estimación

~90-120 líneas. Muy por debajo de 400 → **un solo PR**, sin chained-pr.

## Follow-up

Migrar `generatePdf` a `Result<Buffer, PdfError>` (alinea con la regla error-handling;
tocaría los 4 call-sites y sus tests) — ticket separado.
