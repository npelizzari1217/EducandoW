# Spec: constancia-regular (delta)

**Change:** constancia-alumno-regular
**Capability added:** `constancia-regular`
**Nivel pedagógico afectado:** ALL (INICIAL, PRIMARIO, SECUNDARIO, TERCIARIO)
**Base proposal:** `openspec/changes/constancia-alumno-regular/proposal.md`

---

## ADDED Requirements

### REQ-1 — Master Schema Delta: Institution.province

The Institution model in the master Prisma schema MUST gain an optional `province` field
of type `String?` (nullable). A migration MUST be generated for the master database.

Existing Institution rows without `province` MUST remain valid; no backfill is required.

#### Scenario 1.1 — Provincia nullable por default
- **Given** an existing Institution record without `province`
- **Then** the field value SHALL be `null`; no other fields are affected

#### Scenario 1.2 — Provincia guardada
- **Given** an Institution updated with `province = "Buenos Aires"`
- **Then** the field value SHALL be `"Buenos Aires"` and retrievable from the master DB

---

### REQ-2 — Endpoint: POST /v1/reportes/constancia-regular/:axccId

The API MUST expose a new route `POST /v1/reportes/constancia-regular/:axccId` inside
the existing `ReportesController`.

The route MUST apply the **same guards and role requirement** as the existing boletín
endpoints — specifically:
- `@UseGuards(AuthGuard, RolesGuard)` at the controller level (already inherited)
- `@Roles('ROOT', { module: 'REPORTS', action: 'READ' })` on the new handler

No new permission, module, or role MUST be introduced.

#### Scenario 2.1 — Acceso sin token
- **Given** a request with no bearer token
- **When** `POST /v1/reportes/constancia-regular/:axccId` is called
- **Then** the response SHALL be `401 Unauthorized`

#### Scenario 2.2 — Acceso con token sin permiso REPORTS:READ
- **Given** a valid token whose user lacks `{ module: 'REPORTS', action: 'READ' }` and is not ROOT
- **When** `POST /v1/reportes/constancia-regular/:axccId` is called
- **Then** the response SHALL be `403 Forbidden`

---

### REQ-3 — Request Body Validation

The POST body MUST be validated with a Zod schema before the use-case is invoked.

Body schema (TypeScript reference):
```
{
  destinatario: string  // required, min length 1
  fechaEmision: string  // required, format YYYY-MM-DD (ISO date)
}
```

A `fechaEmision` value that does not match the pattern `YYYY-MM-DD` MUST be rejected.
An empty or whitespace-only `destinatario` MUST be rejected.

#### Scenario 3.1 — Body válido
- **Given** body `{ "destinatario": "A pedido del interesado", "fechaEmision": "2026-06-26" }`
- **When** the endpoint is called by an authorized user
- **Then** the use-case SHALL execute; no 400 is returned at validation stage

#### Scenario 3.2 — destinatario ausente
- **Given** body `{ "fechaEmision": "2026-06-26" }` (destinatario missing)
- **When** the endpoint is called
- **Then** the response SHALL be `400 Bad Request` with a Zod validation error

#### Scenario 3.3 — destinatario vacío
- **Given** body `{ "destinatario": "", "fechaEmision": "2026-06-26" }`
- **When** the endpoint is called
- **Then** the response SHALL be `400 Bad Request` (min-length violation)

#### Scenario 3.4 — fechaEmision inválida
- **Given** body `{ "destinatario": "...", "fechaEmision": "26/06/2026" }`
- **When** the endpoint is called
- **Then** the response SHALL be `400 Bad Request` (format violation)

#### Scenario 3.5 — fechaEmision ausente
- **Given** body `{ "destinatario": "..." }` (fechaEmision missing)
- **When** the endpoint is called
- **Then** the response SHALL be `400 Bad Request`

---

### REQ-4 — Elegibilidad

The use-case MUST verify eligibility before generating the PDF.
Eligibility requires BOTH conditions to be true:
1. A row with the given `axccId` exists in `AlumnosXCursoXCiclo` (tenant DB).
2. The associated `Student.fechaDePase` IS NULL.

#### Scenario 4.1 — axccId inexistente → 404
- **Given** an `axccId` that does not exist in the tenant's `AlumnosXCursoXCiclo` table
- **When** the use-case executes
- **Then** the response SHALL be `404 Not Found` with error code `AXCC_NOT_FOUND`

#### Scenario 4.2 — Alumno elegible → PDF generado
- **Given** an `axccId` whose corresponding `Student.fechaDePase IS NULL`
- **When** the use-case executes
- **Then** a PDF buffer SHALL be returned; no error is raised

#### Scenario 4.3 — Alumno egresado → 422
- **Given** an `axccId` whose corresponding `Student.fechaDePase` is a non-null date
- **When** the use-case executes
- **Then** the response SHALL be `422 Unprocessable Entity` with error code `STUDENT_NOT_ELIGIBLE`
  and a human-readable message indicating the student has an exit date set

---

### REQ-5 — Datos del Certificado

The generated PDF MUST include exactly four data groups. All MUST fields within each group
are required for PDF generation; SHOULD fields are rendered when data is present and
silently omitted when absent.

#### Group A — Institución
- A1. Institution name MUST appear.
- A2. Institution logo SHOULD appear if `Institution.logo_url` is non-null and non-empty.
- A3. CUE SHOULD appear if `Institution.cue` is non-null and non-empty.
- A4. Localidad SHOULD appear if `Institution.city` is non-null and non-empty.
- A5. Provincia SHOULD appear if `Institution.province` is non-null and non-empty.

#### Group B — Alumno
- B1. Student last name(s) (`Student.lastName`) MUST appear.
- B2. Student first name(s) (`Student.firstName`) MUST appear.
- B3. Student DNI (`Student.dni`) MUST appear.

#### Group C — Académico
- C1. Pedagogical level (from `CourseCycle.level`) MUST appear.
- C2. Grade/year and division (from the linked `CourseSection`) MUST appear.
- C3. Academic cycle name (from `AcademicCycle`) MUST appear.
- C4. The phrase **"alumno regular"** (or equivalent, e.g. "cursa como alumno/a regular")
  MUST appear verbatim in the certificate body.

#### Group D — Validación
- D1. `fechaEmision` formatted in `es-AR` locale (e.g. "26 de junio de 2026") MUST appear.
- D2. `destinatario` text MUST appear.
- D3. A blank signature/stamp area labeled "Firma y Sello" MUST appear.

#### Scenario 5.1 — Todos los datos presentes
- **Given** an eligible student, an institution with logo, CUE, city, and province
- **When** the PDF is generated
- **Then** all fields from Groups A–D SHALL be visible in the rendered document

#### Scenario 5.2 — Datos institucionales parciales (logo ausente)
- **Given** `Institution.logo_url IS NULL`
- **When** the PDF is generated
- **Then** the logo section SHALL be omitted; the rest of the certificate MUST render correctly

#### Scenario 5.3 — Datos institucionales parciales (CUE y provincia ausentes)
- **Given** `Institution.cue IS NULL` and `Institution.province IS NULL`
- **When** the PDF is generated
- **Then** both fields SHALL be omitted; the rest of the certificate MUST render correctly

#### Scenario 5.4 — Datos institucionales completamente mínimos
- **Given** only `Institution.name` is set (all other optional institutional fields are null)
- **When** the PDF is generated
- **Then** only the institution name SHALL appear in Group A; the PDF MUST still render without error

#### Scenario 5.5 — fechaEmision formateado en es-AR
- **Given** `fechaEmision = "2026-06-26"`
- **When** the PDF is generated
- **Then** the document SHALL display the date as "26 de junio de 2026" (or equivalent es-AR long format)

---

### REQ-6 — Salida HTTP

#### Scenario 6.1 — Respuesta exitosa
- **Given** a valid, eligible request
- **When** the endpoint returns
- **Then**:
  - HTTP status MUST be `200 OK`
  - `Content-Type` MUST be `application/pdf`
  - `Content-Disposition` MUST be set (e.g. `inline; filename="constancia-regular-{axccId}.pdf"`)
    so the browser can both display (print) and offer download
  - Response body MUST be a valid PDF binary buffer

#### Scenario 6.2 — Stateless: sin persistencia
- **Given** any successful PDF generation
- **Then** no file MUST be written to disk, no DB record MUST be created, and no cache entry
  MUST be stored; the operation is fully stateless

---

### REQ-7 — Multitenant

The use-case MUST respect TenantContext:

- Institution data (name, logo_url, cue, city, province) MUST be fetched from the **master**
  Prisma client using the institution ID resolved from TenantContext.
- Student, AlumnosXCursoXCiclo, CourseCycle, CourseSection, and AcademicCycle data
  MUST be fetched from the **tenant** Prisma client identified by TenantContext.
- The master client MUST NOT be used to query tenant entities and vice-versa.

#### Scenario 7.1 — Aislamiento master/tenant
- **Given** a request from Tenant A
- **When** the use-case fetches institution data
- **Then** it MUST use the master client with the institution ID tied to Tenant A,
  and MUST NOT access any other tenant's data

---

### REQ-8 — Front-End Integration

#### Scenario 8.1 — Botón "Constancia" visible
- **Given** the user is viewing an `AlumnosCursoCicloPanel` for any enrollment
- **Then** a "Constancia" button MUST be visible (subject to the same role-based UI guard
  applied to other PDF actions in the panel, if any)

#### Scenario 8.2 — Modal con inputs precargados
- **Given** the user clicks "Constancia"
- **Then** a modal MUST open containing:
  - A `destinatario` text input, prefilled with "A pedido del interesado y para ser presentado ante quien corresponda" (editable)
  - A `fechaEmision` date input, defaulting to today's date in the user's browser

#### Scenario 8.3 — Imprimir (abrir en pestaña)
- **Given** the modal is confirmed
- **When** the user selects "Imprimir"
- **Then** the front MUST POST to `/v1/reportes/constancia-regular/:axccId`, receive the PDF blob,
  create an object URL, and open it in a new browser tab

#### Scenario 8.4 — Descargar
- **Given** the modal is confirmed
- **When** the user selects "Descargar"
- **Then** the front MUST POST to `/v1/reportes/constancia-regular/:axccId`, receive the PDF blob,
  and trigger a file download with a meaningful filename (e.g. `constancia-regular.pdf`)

#### Scenario 8.5 — Error de elegibilidad mostrado en UI
- **Given** the server returns `422 STUDENT_NOT_ELIGIBLE`
- **Then** the front MUST display a user-readable error message; it MUST NOT crash or silently fail

---

## UNCHANGED Requirements

All existing `reportes` capabilities (boletin single, boletin batch) remain unchanged.
Their authorization rules, route patterns, and response formats are unaffected by this change.

---

## Edge Cases Summary

| Edge Case | Expected Behavior |
|-----------|------------------|
| `axccId` not a valid UUID | 400 (Zod parse failure on param or use-case input validation) |
| `axccId` valid UUID but not found | 404 `AXCC_NOT_FOUND` |
| `Student.fechaDePase` not null (egresado) | 422 `STUDENT_NOT_ELIGIBLE` |
| `destinatario` empty string | 400 (Zod min-length) |
| `fechaEmision` wrong format | 400 (Zod regex/date) |
| Institution has no logo, no CUE, no province, no city | PDF renders with only name; no crash |
| Institution has all optional fields | All rendered in Group A |

---

## Out of Scope (confirmed not specced here)

- Firmante configurable (signatoryName / signatoryTitle on Institution)
- Audit log of constancias emitted
- Nro de legajo / matrícula on the certificate
- Disk caching of generated PDFs
