# Proposal: Boletin PDF Generation

## Intent

Enable server-side generation of student report cards (boletines) as PDF documents, with access controlled by the existing `REPORTS` module. Today the four templates (Inicial, Primario, Secundario, Terciario) produce text-only `BoletinResultado` structures with no rendering pipeline—users cannot download or print a formatted report card. WINDEV legacy covered this with `iPrintReport()` for all levels; EducandoW must provide equivalent functionality via an API endpoint.

## Scope

### In Scope
- New `GET /v1/boletines/:studentId` endpoint returning a PDF file (single student)
- New `GET /v1/boletines/curso/:courseId` endpoint for batch PDF (all students in a course)
- PDF rendering service (HTML template → Puppeteer → PDF Buffer)
- HTML report card templates for all four levels, replacing the text-only output
- Data aggregation use case gathering grades, attendance, and student data
- Role-based access via `@Roles('ROOT', { module: 'REPORTS', action: 'READ' })`
- Integration with `ImprimeSN` flag (skip students where printable=false)
- Stored PDF file management via existing `FileStoragePort` (download/re-download)

### Out of Scope
- Client-side PDF generation (`html2pdf.js` in browser)—server-side only
- Email delivery of report cards (separate change)
- Report card for guardians via web app (separate feature)

## Capabilities

### New Capabilities
- `report-cards`: PDF generation of student report cards per educational level, with single-student and batch endpoints, PDF storage, and ImprimeSN flag integration

### Modified Capabilities
- None — existing specs are unaffected; this is net-new functionality

## Approach

Three-layer pipeline per `reporting-documents` skill:
1. **Data Aggregation** (application): `GenerateBoletinUseCase` queries grades, attendance, student/institution data, formats for display, checks `ImprimeSN`
2. **Template + Render** (infrastructure): Handlebars HTML templates per level replace text-only `BoletinSeccion`; Puppeteer renders HTML→PDF
3. **Output + Storage** (infrastructure): PDF stored via `FileStoragePort`, served as downloadable `application/pdf`

Batch mode: sequential per-student generation aggregated into a ZIP or multi-page PDF. No async queue for now (single report card <2s).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `api/src/application/reportes/` | Modified | Add use case, evolve templates to HTML |
| `api/src/infrastructure/` | New | Puppeteer PDF renderer, HTML templates |
| `api/src/presentation/` | New | `BoletinController` with two endpoints |
| `web/` | Unchanged | Client-side PDF deferred |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Puppeteer memory overhead per render | Medium | Single browser instance, page pool reuse |
| Template divergence between levels | Low | Shared base layout `.hbs`, level-specific partials |
| Batch timeout for large courses | Medium | ZIP streaming, 30s timeout per request |

## Rollback Plan

Remove `BoletinController` and `GenerateBoletinUseCase` registration from modules. Drop `infrastructure/templates/boletin/` directory. No DB migrations—fully additive.

## Dependencies

- `puppeteer` npm package (new api dependency)
- `handlebars` npm package for HTML templating (new api dependency)
- Existing `REPORTS` module code and `FileStoragePort` (already in place)

## Success Criteria

- [x] Single student: `GET /v1/boletines/:studentId` returns PDF with grades, attendance, header
- [x] Batch: `GET /v1/boletines/curso/:courseId` returns multi-student PDF or ZIP
- [x] Students with `imprimeSN=false` excluded from batch
- [x] All four levels produce correct, formatted PDFs matching level-specific rules
- [x] Non-ROOT users receive 403; unauthenticated receive 401
