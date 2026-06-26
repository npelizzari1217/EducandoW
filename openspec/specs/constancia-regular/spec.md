# Constancia de Alumno Regular — Specification

## Purpose

Server-side PDF generation of a "Constancia de Alumno Regular" certificate for any enrolled
student with an active academic enrollment (`AlumnosXCursoXCiclo`) and no exit date set
(`Student.fechaDePase IS NULL`). The document is rendered on demand — stateless, no disk
cache — and can be printed or downloaded from `AlumnosCursoCicloPanel`. Access is controlled
by the existing `REPORTS` module (`REPORTS:READ`).

Applies to all pedagogical levels: INICIAL, PRIMARIO, SECUNDARIO, TERCIARIO.

> Added: constancia-alumno-regular · 2026-06-26
> PRs merged: #76 (backend — schema + application), #79 (infra + presentation), #80 (frontend)

---

## Requirements

### Requirement: Master Schema — Institution.province

The `Institution` model in the master Prisma schema MUST include an optional `province` field
of type `String?` (nullable). A migration MUST be generated for the master database.
Existing Institution rows without `province` remain valid; no backfill is required.

> Migration: `20260626120000_add_institution_province`

#### Scenario: Provincia nullable por default

- GIVEN an existing Institution record without `province`
- THEN the field value SHALL be `null`; no other fields are affected

#### Scenario: Provincia guardada

- GIVEN an Institution updated with `province = "Buenos Aires"`
- THEN the field value SHALL be `"Buenos Aires"` and retrievable from the master DB

---

### Requirement: Endpoint — POST /v1/reportes/constancia-regular/:axccId

The API MUST expose a new route `POST /v1/reportes/constancia-regular/:axccId` inside
the existing `ReportesController`. The route MUST apply:
- `@UseGuards(AuthGuard, RolesGuard)` at the controller level (already inherited)
- `@Roles('ROOT', { module: 'REPORTS', action: 'READ' })` on the new handler

No new permission, module, or role is introduced.

#### Scenario: Acceso sin token

- GIVEN a request with no bearer token
- WHEN `POST /v1/reportes/constancia-regular/:axccId` is called
- THEN the response SHALL be `401 Unauthorized`

#### Scenario: Acceso con token sin permiso REPORTS:READ

- GIVEN a valid token whose user lacks `{ module: 'REPORTS', action: 'READ' }` and is not ROOT
- WHEN `POST /v1/reportes/constancia-regular/:axccId` is called
- THEN the response SHALL be `403 Forbidden`

---

### Requirement: Request Body Validation

The POST body MUST be validated with a Zod schema (`ConstanciaBodySchema`) before the
use-case is invoked.

Body schema:
```
{
  destinatario: string  // required, min length 1 (trimmed)
  fechaEmision: string  // required, format YYYY-MM-DD (ISO date)
}
```

A `fechaEmision` value that does not match `YYYY-MM-DD` MUST be rejected.
An empty or whitespace-only `destinatario` MUST be rejected.

#### Scenario: Body válido

- GIVEN body `{ "destinatario": "A pedido del interesado", "fechaEmision": "2026-06-26" }`
- WHEN the endpoint is called by an authorized user
- THEN the use-case SHALL execute; no 400 is returned at validation stage

#### Scenario: destinatario ausente

- GIVEN body without `destinatario`
- THEN the response SHALL be `400 Bad Request` with a Zod validation error

#### Scenario: destinatario vacío

- GIVEN body `{ "destinatario": "", "fechaEmision": "2026-06-26" }`
- THEN the response SHALL be `400 Bad Request` (min-length violation)

#### Scenario: fechaEmision inválida

- GIVEN body `{ "destinatario": "...", "fechaEmision": "26/06/2026" }`
- THEN the response SHALL be `400 Bad Request` (format violation)

#### Scenario: fechaEmision ausente

- GIVEN body without `fechaEmision`
- THEN the response SHALL be `400 Bad Request`

---

### Requirement: Elegibilidad

The use-case MUST verify eligibility before generating the PDF. Eligibility requires:
1. A row with the given `axccId` exists in `AlumnosXCursoXCiclo` (tenant DB).
2. The associated `Student.fechaDePase` IS NULL.

#### Scenario: axccId inexistente → 404

- GIVEN an `axccId` that does not exist in the tenant's `AlumnosXCursoXCiclo` table
- WHEN the use-case executes
- THEN the response SHALL be `404 Not Found` with error code `AXCC_NOT_FOUND`

#### Scenario: Alumno elegible → PDF generado

- GIVEN an `axccId` whose corresponding `Student.fechaDePase IS NULL`
- WHEN the use-case executes
- THEN a PDF buffer SHALL be returned; no error is raised

#### Scenario: Alumno egresado → 422

- GIVEN an `axccId` whose corresponding `Student.fechaDePase` is a non-null date
- WHEN the use-case executes
- THEN the response SHALL be `422 Unprocessable Entity` with error code `STUDENT_NOT_ELIGIBLE`
  and a human-readable message indicating the student has an exit date set

---

### Requirement: Datos del Certificado

The generated PDF MUST include exactly four data groups. All MUST fields are required for
PDF generation; SHOULD fields are rendered when data is present and silently omitted when absent.

#### Group A — Institución
- A1. Institution name MUST appear.
- A2. Institution logo SHOULD appear if `Institution.logo_url` is non-null and non-empty.
  Logo is resolved to a base64 data-URI in the use-case (helper: `resolveLogoDataUri`); failure
  to fetch the logo MUST be handled gracefully (omit logo, never block generation).
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
- C4. The phrase "alumno regular" (e.g. "cursa como alumno/a regular") MUST appear verbatim.

#### Group D — Validación
- D1. `fechaEmision` formatted in `es-AR` locale (e.g. "26 de junio de 2026") MUST appear.
  Parsing uses integer component split on `"-"` — NOT `new Date(iso)` — to avoid TZ shift.
- D2. `destinatario` text MUST appear.
- D3. A blank signature/stamp area labeled "Firma y Sello" MUST appear.

#### Scenario: Todos los datos presentes

- GIVEN an eligible student, an institution with logo, CUE, city, and province
- WHEN the PDF is generated
- THEN all fields from Groups A–D SHALL be visible in the rendered document

#### Scenario: Datos institucionales parciales (logo ausente)

- GIVEN `Institution.logo_url IS NULL`
- WHEN the PDF is generated
- THEN the logo section SHALL be omitted; the rest of the certificate MUST render correctly

#### Scenario: Datos institucionales parciales (CUE y provincia ausentes)

- GIVEN `Institution.cue IS NULL` and `Institution.province IS NULL`
- WHEN the PDF is generated
- THEN both fields SHALL be omitted; the rest of the certificate MUST render correctly

#### Scenario: Datos institucionales completamente mínimos

- GIVEN only `Institution.name` is set (all other optional institutional fields are null)
- WHEN the PDF is generated
- THEN only the institution name SHALL appear in Group A; the PDF MUST still render without error

#### Scenario: fechaEmision formateado en es-AR

- GIVEN `fechaEmision = "2026-06-26"`
- WHEN the PDF is generated
- THEN the document SHALL display the date as "26 de junio de 2026" (es-AR long format)

---

### Requirement: Salida HTTP

#### Scenario: Respuesta exitosa

- GIVEN a valid, eligible request
- WHEN the endpoint returns
- THEN:
  - HTTP status MUST be `200 OK`
  - `Content-Type` MUST be `application/pdf`
  - `Content-Disposition` MUST be `inline; filename="constancia-regular-{axccId}.pdf"`
  - Response body MUST be a valid PDF binary buffer

#### Scenario: Stateless — sin persistencia

- GIVEN any successful PDF generation
- THEN no file MUST be written to disk, no DB record MUST be created, and no cache entry
  MUST be stored; the operation is fully stateless

---

### Requirement: Multitenant Isolation

The use-case MUST respect TenantContext:

- Institution data (name, logo_url, cue, city, province) MUST be fetched from the **master**
  Prisma client using the institution ID resolved from TenantContext.
- Student, AlumnosXCursoXCiclo, CourseCycle, CourseSection, and AcademicCycle data
  MUST be fetched from the **tenant** Prisma client identified by TenantContext.
- The master client MUST NOT be used to query tenant entities and vice-versa.

#### Scenario: Aislamiento master/tenant

- GIVEN a request from Tenant A
- WHEN the use-case fetches institution data
- THEN it MUST use the master client with the institution ID tied to Tenant A,
  and MUST NOT access any other tenant's data

---

### Requirement: Front-End Integration

The `AlumnosCursoCicloPanel` component MUST expose a "Constancia" button per enrollment
row. The button is only active for enrollments where `Student.fechaDePase` is null.

#### Scenario: Botón "Constancia" visible

- GIVEN the user is viewing an `AlumnosCursoCicloPanel` for any enrollment
- THEN a "Constancia" button MUST be visible (same role-based UI guard as other PDF actions)

#### Scenario: Modal con inputs precargados

- GIVEN the user clicks "Constancia"
- THEN a modal MUST open containing:
  - A `destinatario` text input, prefilled with
    "A pedido del interesado y para ser presentado ante quien corresponda" (editable)
  - A `fechaEmision` date input, defaulting to today's date in the user's browser

#### Scenario: Imprimir (abrir en pestaña)

- GIVEN the modal is confirmed
- WHEN the user selects "Imprimir"
- THEN the front MUST POST to `/v1/reportes/constancia-regular/:axccId`, receive the PDF blob,
  create an object URL, and open it in a new browser tab

#### Scenario: Descargar

- GIVEN the modal is confirmed
- WHEN the user selects "Descargar"
- THEN the front MUST POST to `/v1/reportes/constancia-regular/:axccId`, receive the PDF blob,
  and trigger a file download with filename `constancia-regular.pdf`

#### Scenario: Error de elegibilidad mostrado en UI

- GIVEN the server returns `422 STUDENT_NOT_ELIGIBLE`
- THEN the front MUST display a user-readable error message; it MUST NOT crash or silently fail

---

## Edge Cases

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

## Out of Scope

- Firmante configurable (signatoryName / signatoryTitle on Institution)
- Audit log of constancias emitted
- Nro de legajo / matrícula on the certificate
- Disk caching of generated PDFs
