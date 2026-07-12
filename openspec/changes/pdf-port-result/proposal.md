# Proposal: pdf-port-result — Result end-to-end en el área PDF

## Intent
**Problema / regla violada:** `PdfPort.generatePdf` devuelve `Promise<Buffer>` y **lanza** ante fallo. Los 4 use-cases consumen el port sin `try/catch` y propagan el throw. Eso viola la regla del proyecto: **nunca `throw` en `application`; usar `Result<T,E>` para fallas esperadas**. Hoy la falla de PDF sube como excepción cruda hasta el `AppExceptionFilter`.

**Verdad después:** el **path de PDF** cumple Result end-to-end: port → `Promise<Result<Buffer, PdfError>>`, los 4 use-cases devuelven `Result<Buffer, PdfError>`, y los 3 controllers materializan ese Result a HTTP. La falla de infra de PDF deja de ser excepción no controlada en `application`.

**Nivel pedagógico:** `ALL`. El PDF es transversal (boletín de todos los niveles, constancia, asistencia, tipos de asistencia); NO introduce lógica por nivel.

## Scope
**In:** `pdf.port.ts` (firma), `pdf-generator.service.ts` (catch → `err(PdfError)`), nuevo `application/shared/errors/pdf.error.ts`, 4 use-cases (propagan Result de PDF), helper Result→HTTP en presentation + 3 controllers, ~8 tests que mockean el port.
**Out:** convertir a Result los errores ad-hoc NO-PDF (`BoletinError`, `ConstanciaError`, `AsistenciaReportingError`, etc.); crear base `ApplicationError`; clasificar causas de fallo en infra (hoy hay un solo catch genérico).

## Sub-decisión resuelta: (i) full-Result vs (ii) solo path PDF
**Recomendación: (ii) — el use-case devuelve `Result<Buffer, PdfError>` solo para el error de PDF; sus otros errores siguen por throw.**

- **(ii)** ~210 líneas. Blast radius acotado: port + service + 4 use-cases (propagan el Result) + helper + 3 controllers + ~8 tests. No regresa nada; los throws ad-hoc ya existían.
- **(i)** ~500–600 líneas. Obliga a convertir 3–6 throws por use-case a `err()`, reescribir sus tests (assert throw → assert err) y **decidir antes** una base `ApplicationError` que HOY NO EXISTE (hallazgo del explore). Conflaría dos objetivos: "PDF como Result" y "migrar todo el error-model de application".

La inconsistencia de dos mecanismos en un use-case es **preexistente y reconocida**; cerrarla es un change aparte (`app-error-model`) que primero necesita la base `ApplicationError`. Hacer (i) ahora sería ceremonia sub-horneada.

## Helper Result→HTTP
Un `AppExceptionFilter` NO sirve: opera sobre **excepciones lanzadas**, y un Result es un **valor devuelto** que nunca llega al filtro. Enfoque elegido: **nuevo helper de presentation** `unwrapResultOrThrow(result)` en `presentation/shared/` que, ante `err(PdfError)`, lanza `HttpException(500)` (mapeando `PdfError.httpStatus`), y ante `ok(buffer)` devuelve el buffer. Presentation SÍ puede lanzar (la regla no-throw es de domain/application); así reusamos el pipeline `HttpException → filter`.

## PdfError
`class PdfError extends Error` con `code = 'PDF_GENERATION_FAILED'`, `httpStatus = 500`, `cause?: unknown`. Un solo tipo (infra tiene catch genérico, no clasifica). Vive en `application/` — renderizar PDF no es regla de `packages/domain`.

## Estrategia de test (TDD estricto, `pnpm test`, cov ≥ 80%)
1. **service** (red first): al rechazar `page.setContent`/`page.pdf`, devuelve `err(PdfError{code:PDF_GENERATION_FAILED})`, NO lanza.
2. **4 use-cases:** `err(PdfError)` del port → devuelven `err(PdfError)` (propagación sin throw); `ok(buffer)` → `ok(buffer)`.
3. **controllers:** use-case `err(PdfError)` → endpoint responde **HTTP 500** con body mapeado; `ok` → 200 con el PDF. Prueba que el error fluye como Result hasta el borde HTTP sin throw en application.
4. **helper:** `unwrapResultOrThrow(err)` lanza `HttpException(500)`; `(ok)` devuelve buffer.

## Estimación y chained-PR
~**210 líneas** (código + tests). **< 400 → NO dispara chained-pr**; un solo PR alcanza. Si con los ~8 tests trepa sobre 400, se parte por área consumidora (reportes → asistencia → attendance-type) en slices apilados. Rollback: revertir firma del port y helper; los throws ad-hoc quedan intactos.
