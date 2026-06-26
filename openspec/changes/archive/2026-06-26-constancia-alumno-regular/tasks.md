# Tasks: constancia-alumno-regular

**Change:** constancia-alumno-regular
**TDD mode:** Strict (test first — `pnpm test`, coverage ≥ 80%)
**Delivery:** 3 chained PRs (each ≤ 400 lines)
**Total estimated lines:** ~880

---

## Review Workload Forecast

| Metric | Value |
|--------|-------|
| Estimated changed lines | ~880 |
| 400-line budget risk | HIGH (2.2× budget) |
| Chained PRs recommended | YES — 3 PRs |
| PR #1 (Schema + Application) | ~305 lines |
| PR #2 (Infra + Presentation) | ~325 lines |
| PR #3 (Frontend) | ~250 lines |
| Decision needed before apply | YES — confirm chained vs single-pr/exception-ok |

---

## Dependency Graph

```
T-01 → T-02 ─┬─ T-03 ─┐
              │  T-04 ──┼─ T-05 ─┬─ T-11 → T-12 → T-13 ─┬─ T-18
              │  T-06 → T-07 ─┘  │                        │
              │  T-08 ─────────────┘                      │
              └─ T-09 → T-10 ─────────────────────────────┤
                                                           │
              T-14 → T-15 → T-16 → T-17 ─────────────────┘
```

Note: T-03/T-06/T-08/T-09/T-14 can be written independently of each other (parallel RED phase within a batch).

---

## PR #1 — Schema + Application Layer (~305 lines)

### T-01 — [schema] Add `province` to Institution model
- **File:** `api/prisma_master/schema.prisma`
- **Action:** Add `province  String?  @map("province")` after the `city` field in `Institution`
- **Estimated lines:** ~5
- **Depends on:** nothing (first task)
- **Satisfies:** REQ-1

### T-02 — [migration] Generate master migration + regenerate client
- **Action:** Run `pnpm --filter api prisma:migrate:master --name add_institution_province` then `pnpm --filter api prisma:generate`
- **Creates:** `api/prisma_master/migrations/*_add_institution_province/migration.sql`
- **Estimated lines:** ~15 (generated migration SQL)
- **Depends on:** T-01 (sequential)
- **Satisfies:** REQ-1

### T-03 — [test RED] Use case unit tests
- **File:** `api/src/application/reportes/__tests__/generate-constancia-regular.use-case.test.ts` (CREATE)
- **Action:** Write Vitest tests, no DB. Mock `TenantContext`, `PrismaService` (getMasterClient/getTenantClient), `PdfGeneratorService`.
- **Cases to cover:**
  - axcc not found → throws `ConstanciaError` with `code=AXCC_NOT_FOUND`, `httpStatus=404` (REQ-4 Sc4.1)
  - `student.fechaDePase != null` → throws `ConstanciaError` with `code=STUDENT_NOT_ELIGIBLE`, `httpStatus=422` (REQ-4 Sc4.3)
  - happy path → calls `pdfGenerator.generatePdf` and returns Buffer (REQ-4 Sc4.2)
  - assembled `DatosConstancia` has: `alumnoApellido`, `alumnoNombre`, `alumnoDni`, `institucionNombre`, `nivel`, `cicloLectivo`, `destinatario`, `fechaEmisionLarga` (REQ-5)
  - `logoDataUri` is null when `institution.logoUrl` is null (REQ-5 Sc5.2)
  - `provincia` is null when `institution.province` is null (REQ-5 Sc5.3)
  - `fechaEmisionLarga` for input "2026-06-26" → "26 de junio de 2026" (REQ-5 Sc5.5)
  - No master client used for tenant queries and vice versa (REQ-7)
- **Estimated lines:** ~120
- **Depends on:** T-02 (Prisma client types available); can run parallel with T-04/T-06/T-09
- **Satisfies:** REQ-4, REQ-5, REQ-7

### T-04 — [types] `DatosConstancia` interface + `ConstanciaError` class
- **File:** `api/src/application/reportes/templates/constancia.template.ts` (CREATE)
- **Action:** Define and export `DatosConstancia` interface (all fields per design contract). Define `ConstanciaError extends Error` with `code: string` and `httpStatus: number` — can live here or at top of use-case file, matching `BoletinError` pattern.
- **Estimated lines:** ~35
- **Depends on:** T-02 (parallel with T-03/T-06/T-09)
- **Satisfies:** REQ-4, REQ-5

### T-05 — [use case] `GenerateConstanciaRegularUseCase`
- **File:** `api/src/application/reportes/generate-constancia-regular.use-case.ts` (CREATE)
- **Action:** `@Injectable()` class. Constructor: `(private pdfGenerator: PdfGeneratorService, private prisma: PrismaService)`. `execute(axccId: string, input: ConstanciaBodyDto): Promise<Buffer>` flow:
  1. `tenant.alumnosXCursoXCiclo.findUnique(axccId)` → null → throw `ConstanciaError(404, AXCC_NOT_FOUND)`
  2. `tenant.student.findUnique(axcc.studentId)` → `fechaDePase != null` → throw `ConstanciaError(422, STUDENT_NOT_ELIGIBLE)`
  3. `tenant.courseCycle.findUnique(axcc.courseCycleId, { include: { course: true, courseSection: true, academicCycle: true } })`
  4. `master.institution.findUnique(TenantContext.getInstitutionId())`
  5. `await resolveLogoDataUri(institution.logoUrl)` (import from infra helper)
  6. Parse `input.fechaEmision` ("YYYY-MM-DD") into es-AR long date string by splitting on "-" (avoid TZ shift — no `new Date(iso)`)
  7. Assemble `DatosConstancia`, compile Handlebars template `constancia-regular.hbs`
  8. `return this.pdfGenerator.generatePdf(html)`
- **Estimated lines:** ~130
- **Depends on:** T-03 (tests must be RED first), T-04 (types), T-07 (helper — can use inline stub initially), T-08 (template path needed)
- **Satisfies:** REQ-4, REQ-5, REQ-6, REQ-7

---

## PR #2 — Infrastructure + Presentation Layer (~325 lines)

### T-06 — [test RED] `resolveLogoDataUri` helper tests
- **File:** `api/src/infrastructure/reporting/__tests__/resolve-logo-data-uri.test.ts` (CREATE)
- **Action:** Vitest unit tests. Mock `fetch` (global) or the HTTP client used.
- **Cases:**
  - valid URL + 200 response → returns `data:image/png;base64,...` string
  - network error (fetch throws) → returns `null` without throwing
  - HTTP 404 response → returns `null`
  - timeout exceeded → returns `null`
  - `null` input → returns `null` immediately (no fetch called)
  - `undefined` input → returns `null` immediately
- **Estimated lines:** ~40
- **Depends on:** T-02 (can run parallel with T-03, T-04, T-09)
- **Satisfies:** REQ-5/A2

### T-07 — [helper] `resolveLogoDataUri`
- **File:** `api/src/infrastructure/reporting/resolve-logo-data-uri.ts` (CREATE)
- **Action:** `export async function resolveLogoDataUri(url: string | null | undefined): Promise<string | null>`. Guard: if falsy return null. Try: `AbortController` with 5s timeout, `fetch(url, { signal })`, check `res.ok`, `arrayBuffer()`, `Buffer.from(ab).toString('base64')`, detect mime from `Content-Type` header (default `image/png`), return `data:${mime};base64,${b64}`. Catch: return null.
- **Estimated lines:** ~30
- **Depends on:** T-06 (RED; sequential)
- **Satisfies:** REQ-5/A2

### T-08 — [template] `constancia-regular.hbs`
- **File:** `api/src/infrastructure/reporting/html-templates/constancia-regular.hbs` (CREATE)
- **Action:** A4 HTML page with inline CSS (mirror boletin structure). Four sections:
  - **Group A — Institución:** `{{#if logoDataUri}}<img src="{{logoDataUri}}" ...>{{/if}}`, `<h2>{{institucionNombre}}</h2>`, `{{#if cue}}<p>CUE: {{cue}}</p>{{/if}}`, `{{#if localidad}}<p>Localidad: {{localidad}}</p>{{/if}}`, `{{#if provincia}}<p>Provincia: {{provincia}}</p>{{/if}}`
  - **Group B — Alumno:** apellido en mayúsculas, nombre, DNI
  - **Group C — Académico:** nivel, `{{#if grado}}{{grado}}°{{/if}} {{#if division}}Div. {{division}}{{/if}}`, cicloLectivo, verbatim "cursa como alumno/a regular en esta institución"
  - **Group D — Validación:** fechaEmisionLarga, destinatario paragraph, blank Firma y Sello area with label
- **Estimated lines:** ~80
- **Depends on:** T-04 (field names); can run parallel with T-06/T-07/T-09
- **Satisfies:** REQ-5, REQ-6 (C4 verbatim)

### T-09 — [test RED] Zod DTO schema tests
- **File:** `api/src/presentation/reportes/__tests__/constancia-dto.test.ts` (CREATE)
- **Action:** Parse `ConstanciaBodySchema` directly (no HTTP). Vitest.
- **Cases:**
  - `{ destinatario: "A pedido", fechaEmision: "2026-06-26" }` → success (REQ-3 Sc3.1)
  - `{ fechaEmision: "2026-06-26" }` (missing destinatario) → failure (REQ-3 Sc3.2)
  - `{ destinatario: "", fechaEmision: "2026-06-26" }` → failure min-length (REQ-3 Sc3.3)
  - `{ destinatario: "   ", fechaEmision: "2026-06-26" }` → failure (trim+min1)
  - `{ destinatario: "A pedido", fechaEmision: "26/06/2026" }` → failure regex (REQ-3 Sc3.4)
  - `{ destinatario: "A pedido" }` (missing fechaEmision) → failure (REQ-3 Sc3.5)
- **Estimated lines:** ~40
- **Depends on:** T-02 (can run parallel with T-03/T-06/T-08)
- **Satisfies:** REQ-3

### T-10 — [DTO] `ConstanciaBodySchema` + type
- **File:** `api/src/presentation/reportes/dto/constancia.dto.ts` (CREATE)
- **Action:** `export const ConstanciaBodySchema = z.object({ destinatario: z.string().trim().min(1), fechaEmision: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }); export type ConstanciaBodyDto = z.infer<typeof ConstanciaBodySchema>;`
- **Estimated lines:** ~15
- **Depends on:** T-09 (RED; sequential)
- **Satisfies:** REQ-3

### T-11 — [test RED] Controller handler tests
- **File:** `api/src/presentation/reportes/__tests__/constancia-controller.test.ts` (CREATE)
- **Action:** Mock `GenerateConstanciaRegularUseCase` and build Express res mock (status/set/send/json spies).
- **Cases:**
  - `ConstanciaError(httpStatus=404)` thrown by use case → `res.status(404).json({ statusCode: 404, error: 'AXCC_NOT_FOUND', ... })`
  - `ConstanciaError(httpStatus=422)` → `res.status(422).json({ statusCode: 422, error: 'STUDENT_NOT_ELIGIBLE', ... })`
  - happy path → `res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': ... })` + `res.send(buffer)`
  - non-ConstanciaError → re-throws (not swallowed)
- **Estimated lines:** ~60
- **Depends on:** T-05 (use case class importable), T-10 (DTO type)
- **Satisfies:** REQ-2, REQ-6

### T-12 — [controller handler] Add POST endpoint to `ReportesController`
- **File:** `api/src/presentation/reportes/reportes.controller.ts` (MODIFY)
- **Action:** Add `Post, Body` to NestJS imports. Add handler:
  ```
  @Post('constancia-regular/:axccId')
  @Roles('ROOT', { module: 'REPORTS', action: 'READ' })
  async getConstanciaRegular(
    @Param('axccId') axccId: string,
    @Body(new ZodValidationPipe(ConstanciaBodySchema)) dto: ConstanciaBodyDto,
    @Res() res: Response,
  )
  ```
  Try: call `this.constanciaUC.execute(axccId, dto)`, set `Content-Type: application/pdf`, `Content-Disposition: inline; filename="constancia-regular-{axccId}.pdf"`, `Content-Length`, `res.send(pdfBuffer)`. Catch `ConstanciaError` → `res.status(err.httpStatus).json({...})`. Other errors → rethrow.
- **Estimated lines:** ~40
- **Depends on:** T-11 (RED), T-10 (DTO), T-05 (use case)
- **Satisfies:** REQ-2, REQ-3, REQ-6

### T-13 — [module] Register `GenerateConstanciaRegularUseCase` in `ReportesModule`
- **File:** `api/src/presentation/reportes/reportes.module.ts` (MODIFY)
- **Action:** Add `GenerateConstanciaRegularUseCase` to providers using `useFactory: (pdfGen, prisma) => new GenerateConstanciaRegularUseCase(pdfGen, prisma)`, inject `[PdfGeneratorService, PrismaService]`. Add `constanciaUC: GenerateConstanciaRegularUseCase` to controller constructor and inject it.
- **Estimated lines:** ~20
- **Depends on:** T-12 (sequential)
- **Satisfies:** REQ-2

---

## PR #3 — Frontend (~250 lines)

### T-14 — [test RED] `useConstancia` hook tests
- **File:** `web/src/hooks/__tests__/useConstancia.test.ts` (CREATE)
- **Action:** Vitest. Mock `apiClient.post` (returns `{ data: Blob }`) and browser APIs (`URL.createObjectURL`, `window.open`, `document.createElement`).
- **Cases:**
  - `printConstancia(axccId, body)` → calls `apiClient.post('/reportes/constancia-regular/{axccId}', body, { responseType: 'blob' })`, calls `window.open(blobUrl, '_blank')` (REQ-8 Sc8.3)
  - `downloadConstancia(axccId, body)` → calls POST, creates anchor element, sets `anchor.download = 'constancia-regular.pdf'`, calls `anchor.click()` (REQ-8 Sc8.4)
  - 422 error thrown by apiClient → propagates to caller without swallowing (REQ-8 Sc8.5)
- **Estimated lines:** ~60
- **Depends on:** T-13 (API deployed/merged; sequential PR boundary); can start writing RED test file before T-13 merges if endpoint contract is locked
- **Satisfies:** REQ-8

### T-15 — [hook] `useConstancia.ts`
- **File:** `web/src/hooks/useConstancia.ts` (CREATE)
- **Action:** 
  - `export async function printConstancia(axccId: string, body: { destinatario: string; fechaEmision: string }): Promise<void>` — POST to `/reportes/constancia-regular/${axccId}` with body and `responseType: 'blob'`, `URL.createObjectURL(res.data)`, `window.open(blobUrl, '_blank')`, `setTimeout(revoke, 60000)`.
  - `export async function downloadConstancia(axccId: string, body: { destinatario: string; fechaEmision: string }): Promise<void>` — same POST, create anchor, `anchor.href = blobUrl`, `anchor.download = 'constancia-regular.pdf'`, append, click, remove, revoke after delay.
- **Estimated lines:** ~40
- **Depends on:** T-14 (RED; sequential)
- **Satisfies:** REQ-8/Sc8.3, Sc8.4

### T-16 — [test additions] Constancia cases in panel test file
- **File:** `web/src/pages/dashboard/__tests__/alumnos-curso-ciclo-panel.test.tsx` (MODIFY — add describe block)
- **Action:** Add mock for `../../../hooks/useConstancia` (`printConstancia`, `downloadConstancia` as vi.fn()). Add describe `"Constancia per-row button"` with cases:
  - W-C1: "Constancia" button visible in each row
  - W-C2: button is `disabled` when row has `fechaDePase` set
  - W-C3: clicking button opens modal; modal shows textarea with default text and date input defaulting to today (YYYY-MM-DD)
  - W-C4: clicking "Imprimir" in modal calls `printConstancia(rowId, { destinatario, fechaEmision })`
  - W-C5: clicking "Descargar" calls `downloadConstancia(rowId, { destinatario, fechaEmision })`
  - W-C6: `printConstancia` throws → toast with error message shown in panel
- **Estimated lines:** ~80
- **Depends on:** T-15 (hook importable)
- **Satisfies:** REQ-8/Sc8.1–Sc8.5

### T-17 — [component] Constancia button + modal in `AlumnosCursoCicloPanel`
- **File:** `web/src/pages/dashboard/components/AlumnosCursoCicloPanel.tsx` (MODIFY)
- **Action:** Import `printConstancia`, `downloadConstancia` from `../../../hooks/useConstancia`. Add state: `constanciaTarget: AlumnoCursoCicloItem | null`, `constanciaDestinatario: string` (default `"A pedido del interesado y para ser presentado ante quien corresponda"`), `constanciaFecha: string` (default today `new Date().toISOString().slice(0, 10)`). Add "Constancia" `<Button>` per row, disabled when `!!row.fechaDePase`. Add `<Modal>` for constancia: textarea for destinatario, date input for fechaEmision, "Imprimir" button calls `printConstancia` in try/catch → toast, "Descargar" button calls `downloadConstancia`. Close modal on success.
- **Estimated lines:** ~70
- **Depends on:** T-16 (RED; sequential)
- **Satisfies:** REQ-8/Sc8.1–Sc8.5

---

## Cierre

### T-18 — [verify] Build + test green
- **Action:** Run `pnpm build` then `pnpm test` from monorepo root. Confirm: all new test files pass, coverage ≥ 80% on new files (`generate-constancia-regular.use-case.ts`, `resolve-logo-data-uri.ts`, `constancia.dto.ts`, `reportes.controller.ts` new handler, `useConstancia.ts`). Fix any TypeScript errors.
- **Depends on:** all tasks (end-gate)
- **Satisfies:** all REQs (integration signal)

---

## Execution Order (by PR batch)

### Batch sequence within PR #1
1. T-01 (schema edit)
2. T-02 (migrate + generate) — sequential after T-01
3. T-03, T-04 in parallel (both are RED/types, no inter-dependency)
4. T-05 (use case GREEN — depends on T-03 RED, T-04, and stubs for T-07/T-08)

### Batch sequence within PR #2
1. T-06, T-08, T-09 in parallel (RED tests + template)
2. T-07, T-10 in parallel (GREEN helpers/DTO)
3. T-11 (controller test RED — depends on T-05 + T-10)
4. T-12 (controller GREEN)
5. T-13 (module — last, depends on T-12)

### Batch sequence within PR #3
1. T-14 (hook test RED)
2. T-15 (hook GREEN)
3. T-16 (panel test additions)
4. T-17 (panel component GREEN)
5. T-18 (full build + test pass)

---

## Task Summary Table

| ID | Type | File | Lines | Deps | PR | REQ |
|----|------|------|-------|------|----|-----|
| T-01 | schema | `api/prisma_master/schema.prisma` | 5 | — | 1 | REQ-1 |
| T-02 | migration | `api/prisma_master/migrations/*/migration.sql` | 15 | T-01 | 1 | REQ-1 |
| T-03 | test RED | `api/src/application/reportes/__tests__/generate-constancia-regular.use-case.test.ts` | 120 | T-02 | 1 | REQ-4,5,7 |
| T-04 | types | `api/src/application/reportes/templates/constancia.template.ts` | 35 | T-02 | 1 | REQ-4,5 |
| T-05 | use case | `api/src/application/reportes/generate-constancia-regular.use-case.ts` | 130 | T-03,T-04 | 1 | REQ-4,5,6,7 |
| T-06 | test RED | `api/src/infrastructure/reporting/__tests__/resolve-logo-data-uri.test.ts` | 40 | T-02 | 2 | REQ-5/A2 |
| T-07 | helper | `api/src/infrastructure/reporting/resolve-logo-data-uri.ts` | 30 | T-06 | 2 | REQ-5/A2 |
| T-08 | template | `api/src/infrastructure/reporting/html-templates/constancia-regular.hbs` | 80 | T-04 | 2 | REQ-5 |
| T-09 | test RED | `api/src/presentation/reportes/__tests__/constancia-dto.test.ts` | 40 | T-02 | 2 | REQ-3 |
| T-10 | DTO | `api/src/presentation/reportes/dto/constancia.dto.ts` | 15 | T-09 | 2 | REQ-3 |
| T-11 | test RED | `api/src/presentation/reportes/__tests__/constancia-controller.test.ts` | 60 | T-05,T-10 | 2 | REQ-2,6 |
| T-12 | controller | `api/src/presentation/reportes/reportes.controller.ts` | 40 | T-11,T-10,T-05 | 2 | REQ-2,3,6 |
| T-13 | module | `api/src/presentation/reportes/reportes.module.ts` | 20 | T-12 | 2 | REQ-2 |
| T-14 | test RED | `web/src/hooks/__tests__/useConstancia.test.ts` | 60 | T-13 | 3 | REQ-8 |
| T-15 | hook | `web/src/hooks/useConstancia.ts` | 40 | T-14 | 3 | REQ-8 |
| T-16 | test add | `web/src/pages/dashboard/__tests__/alumnos-curso-ciclo-panel.test.tsx` | 80 | T-15 | 3 | REQ-8 |
| T-17 | component | `web/src/pages/dashboard/components/AlumnosCursoCicloPanel.tsx` | 70 | T-16,T-15 | 3 | REQ-8 |
| T-18 | verify | (run commands) | 0 | all | 3 | all |
