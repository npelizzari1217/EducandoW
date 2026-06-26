# Design: Constancia de Alumno Regular

## Technical Approach

Clona el patrón boletines (`generate-boletin.use-case.ts` + `PdfGeneratorService` Puppeteer + `.hbs` + `ReportesController`). Use case en `application/reportes` mezcla master (Institution) + tenant (AlumnosXCursoXCiclo, CourseCycle/Section, Student), valida elegibilidad con error tipado (estilo `BoletinError`), arma `DatosConstancia`, compila un template nuevo y renderiza un Buffer PDF. **Sin cache en disco** (a diferencia de boletines): el documento es per-request con inputs variables (`destinatario`, `fechaEmision`), no se reutiliza. Respeta la regla de dependencias Clean Arch: presentation→application→infrastructure; el filtro de elegibilidad y el ensamblado viven en el use case, nunca en el template.

## Architecture Decisions

| Decisión | Elegido | Alternativas rechazadas | Rationale |
|---|---|---|---|
| **Logo en Puppeteer (GAP-4)** | Resolver `Institution.logoUrl` a **base64 data-URI** en el use case (helper infra), pasar `logoDataUri` al template; `<img>` condicional. Falla de carga → omitir logo, nunca bloquear. | `file://` (rutas relativas rotas: `setContent` no tiene base URL en headless); URL pública directa con `waitUntil:'load'` (cuelga/timeout si el host es externo o está offline) | Data-URI es self-contained, determinista y renderiza 100% en Chromium headless sin red ni permisos de FS. Único robusto para `setContent`. |
| **Persistencia PDF** | Stateless, sin `PdfStorageService` | Cache por axccId (boletín) | Inputs variables (destinatario/fecha) ⇒ cache produciría documento incorrecto. Proposal lo declara stateless. |
| **Formato fecha** | Body `fechaEmision` ISO `YYYY-MM-DD`; en PDF formateada **es-AR en texto largo** (ej. «26 de junio de 2026») parseando componentes (no `new Date(iso)`, evita corrimiento TZ). Default hoy en front. | DateTime ISO completo; formateo en front | Contrato simple, sin ambigüedad horaria; formato legal de constancia. |
| **Autorización** | Reusar `@UseGuards(AuthGuard, RolesGuard)` + `@Roles('ROOT', { module: 'REPORTS', action: 'READ' })` | Permiso/módulo nuevo | Misma capacidad de reportes que boletín; sin fricción de perfiles. |
| **Error tipado** | `ConstanciaError(message, code, httpStatus)` (espejo de `BoletinError`); controller mapea por `instanceof` | Excepciones Nest directas | Mantiene el patrón Result/typed-error del codebase y el mapeo HTTP centralizado. |

## Data Flow

    POST /v1/reportes/constancia-regular/:axccId  { destinatario, fechaEmision }
        │  (ZodValidationPipe → DTO)
        ▼
    GenerateConstanciaRegularUseCase.execute(axccId, dto)
        │  axcc = tenant.alumnosXCursoXCiclo.findUnique(axccId)         → null ⇒ 404 AXCC_NOT_FOUND
        │  student = tenant.student.findUnique(axcc.studentId)          → fechaDePase != null ⇒ 422 STUDENT_NOT_ELIGIBLE
        │  cc = tenant.courseCycle.findUnique(axcc.courseCycleId, include:course)  → nivel/grado/division/ciclo
        │  institution = master.institution.findUnique(TenantContext.institutionId) → name/cue/city/province/logo
        │  logoDataUri = resolveLogoDataUri(institution.logoUrl)        (try/catch, opcional)
        ▼
    DatosConstancia → Handlebars(constancia-regular.hbs) → PdfGeneratorService.generatePdf(html) → Buffer
        ▼
    res Content-Type: application/pdf

## File Changes

| File | Action | Description |
|---|---|---|
| `api/prisma_master/schema.prisma` | Modify | `province String? @map("province")` en `Institution` (nullable, sin backfill) |
| `api/prisma_master/migrations/*_add_institution_province/` | Create | Migración master (`pnpm --filter api prisma:migrate:master`) |
| `api/src/application/reportes/generate-constancia-regular.use-case.ts` | Create | Elegibilidad + ensamblado master/tenant + `ConstanciaError` |
| `api/src/application/reportes/templates/constancia.template.ts` | Create | Tipo `DatosConstancia` |
| `api/src/infrastructure/reporting/html-templates/constancia-regular.hbs` | Create | Template A4, 4 grupos, logo condicional, firma/sello |
| `api/src/presentation/reportes/dto/constancia.dto.ts` | Create | `ConstanciaBodySchema` (Zod) + DTO |
| `api/src/presentation/reportes/reportes.controller.ts` | Modify | `@Post('constancia-regular/:axccId')` + mapeo 404/422 |
| `api/src/presentation/reportes/reportes.module.ts` | Modify | Provider `GenerateConstanciaRegularUseCase` (useFactory: PdfGen, Prisma) |
| `web/src/hooks/useConstancia.ts` | Create | `downloadConstancia`/`printConstancia` (POST blob) |
| `web/src/pages/dashboard/components/AlumnosCursoCicloPanel.tsx` | Modify | Botón por fila (solo `!fechaDePase`) + modal form |

## Interfaces / Contracts

```ts
// constancia.dto.ts
export const ConstanciaBodySchema = z.object({
  destinatario: z.string().trim().min(1),
  fechaEmision: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type ConstanciaBodyDto = z.infer<typeof ConstanciaBodySchema>;

// constancia.template.ts
export interface DatosConstancia {
  alumnoApellido: string; alumnoNombre: string; alumnoDni: string;
  institucionNombre: string; cue?: string | null;
  localidad?: string | null; provincia?: string | null; logoDataUri?: string | null;
  nivel: string; grado?: string | null; division?: string | null; cicloLectivo: string;
  destinatario: string; fechaEmisionLarga: string; // es-AR texto largo, ej. "26 de junio de 2026"
}
```

Use case signature: `execute(axccId: string, input: ConstanciaBodyDto): Promise<Buffer>`.

## Testing Strategy (TDD estricto, sin DB)

| Layer | Qué testear | Cómo |
|---|---|---|
| Unit (use case) | 404 axcc inexistente; 422 con `student.fechaDePase`; ensamblado correcto (nivel/grado/localidad/provincia); logo opcional ausente | Mock tenant client + master client (Prisma lazy, sin DB); assert `ConstanciaError.code/httpStatus` y campos de `DatosConstancia` |
| Unit (controller/DTO) | Zod: `destinatario` vacío → 400; `fechaEmision` mal formada → 400; mapeo `ConstanciaError`→404/422; `Content-Type` pdf | Mock use case; `ZodValidationPipe` directo |
| Unit (front) | Botón deshabilitado si `fechaDePase`; submit dispara `downloadConstancia`/`printConstancia`; default fecha = hoy | RTL + mock `apiClient` |

## Migration / Rollout

Migración master aditiva, columna `province` nullable, sin backfill. Rollback: revertir migración (sin datos dependientes) + quitar endpoint/use-case/template/UI. Recordar: schema master separado, comando `prisma:migrate:master` (NO tenant).

## Open Questions

- None — GAP-4 (logo→data-URI) y formato fecha resueltos. Firmante queda Out of Scope (línea "Firma y Sello" en blanco).
