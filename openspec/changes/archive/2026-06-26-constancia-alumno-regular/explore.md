# SDD Explore — constancia-alumno-regular

## Executive Summary

La infra de PDF ya existe y es completamente reutilizable (Puppeteer + Handlebars, igual que boletines). Todos los datos del alumno y del ciclo lectivo están disponibles en los schemas tenant actuales. En Institution (master) faltan dos campos: `province` y cualquier campo de autoridad firmante. La feature tiene un effort bajo. Se recomienda server-side PDF via el `PdfGeneratorService` existente.

Decisión de producto ya tomada: **elegibilidad = inscripción activa en el ciclo (AlumnosXCursoXCiclo) + `Student.fechaDePase IS NULL`**.

---

## 1. Infraestructura PDF existente — qué se reutiliza

### PdfGeneratorService
`api/src/infrastructure/reporting/pdf-generator.service.ts:17`

```ts
async generatePdf(html: string): Promise<Buffer>
```

Puppeteer headless, A4, márgenes 15/12mm. Acepta cualquier HTML string. Singleton con browser compartido. Completamente reutilizable — solo hay que pasarle el HTML renderizado del template de constancia.

### Handlebars templates
`api/src/infrastructure/reporting/html-templates/boletin-primario.hbs` (patrón a seguir)

Patron: `fs.readFileSync(filePath) → Handlebars.compile(source) → template(datos)`. Se agrega `constancia-regular.hbs` al mismo directorio. La resolución de path ya tiene fallbacks para dev/prod (`candidateDirs` en `generate-boletin.use-case.ts:77-83`).

### Endpoint pattern
`api/src/presentation/reportes/reportes.controller.ts:24-48`

```
GET /v1/reportes/boletin/:alumnosXCursoXCicloId → res.send(pdfBuffer) con Content-Type: application/pdf
```

Patrón idéntico para la constancia: un endpoint nuevo en el mismo controller o en un controller propio dentro de `ReportesModule`.

### Multitenant data mix
`api/src/application/reportes/generate-boletin.use-case.ts:165-169`

```ts
const institutionId = TenantContext.getInstitutionId();
const institution = await this.prisma.getMasterClient().institution.findUnique({ ... });
```

Institution de master DB + Student/CourseCycle de tenant DB — patrón ya resuelto.

### PdfStorageService
`api/src/infrastructure/reporting/pdf-storage.service.ts`

El disco-cache existe pero **NO se debe usar** para constancias — son documentos stateless con campos dinámicos (destinatario, fechaEmision). Se genera fresco en cada request.

### Modal frontend
`web/src/components/ui/modal.tsx` — `<Modal open title onClose size="md">`. Reusable con cualquier children.

### PDF download/print frontend
`web/src/hooks/useBoletin.ts:9-17`

```ts
const blobUrl = URL.createObjectURL(res.data);
window.open(blobUrl, '_blank');          // → nueva pestaña para imprimir
```
O con anchor click para descarga. Exactamente el patrón a reutilizar — agregar `downloadConstancia(axccId, params)`.

---

## 2. Punto de integración frontend

`web/src/pages/dashboard/components/AlumnosCursoCicloPanel.tsx:354-455`

La lista de alumnos asignados ya existe. Cada fila tiene un `alumno.id` (bridge-row) y `alumno.fechaDePase`. El botón "Constancia" va en la sección de action buttons por fila (misma zona que "Pase", "Asignar materias", "Quitar").

Condición de habilitación: `!alumno.fechaDePase` (alumno activo sin egreso).

Flujo:
1. Click "Constancia" → abre `Modal size="md"` con form
2. Form: `destinatario` (textarea, default legal) + `fechaEmision` (date, default hoy)
3. Confirmar → `POST /v1/reportes/constancia-regular/:axccId` body `{ destinatario, fechaEmision }` → blob PDF → `window.open(blobUrl, '_blank')`

---

## 3. Datos requeridos — disponibilidad

| # | Campo | Fuente | Estado |
|---|-------|--------|--------|
| 1 | Nombre institución | `Institution.name` (master) | ✅ Disponible |
| 2 | Logo / membrete | `Institution.logo_url` (master) | ✅ Campo existe (`String?`) — nunca renderizado en HBS aún |
| 3 | CUE | `Institution.cue` (master, `String?`) | ✅ Disponible (nullable) |
| 4 | Reg. Ministerial adicional | `Institution.ministryReg` (master, `String?`) | ✅ Disponible (opcional) |
| 5 | Localidad | `Institution.city` (master, `String?`) | ✅ Disponible (nullable) |
| 6 | **Provincia** | `Institution.province` | ❌ **FALTA** — campo no existe en schema master |
| 7 | Apellido(s) alumno | `Student.lastName` (tenant) | ✅ Disponible |
| 8 | Nombre(s) alumno | `Student.firstName` (tenant) | ✅ Disponible |
| 9 | DNI | `Student.dni` (tenant, `String`, unique) | ✅ Disponible (tipo hardcodeado "DNI") |
| 10 | Nro legajo / matrícula | — | ❌ **FALTA** — no existe en `Student` |
| 11 | Nivel pedagógico | `CourseCycle.level` → string (tenant) | ✅ Disponible (levelDecade × 10 → INICIAL/PRIMARIO/etc) |
| 12 | Grado / año y división | `CourseSection.grade` + `CourseSection.division` (tenant) | ✅ Disponible (nullable each) |
| 13 | Ciclo lectivo | `CourseSection.academicYear` (tenant) | ✅ Disponible |
| 14 | Frase "alumno regular" | Hardcodeada en template | ✅ N/A |
| 15 | Fecha emisión | Parámetro de usuario (default = hoy) | ✅ Input |
| 16 | Destinatario | Parámetro de usuario (default legal) | ✅ Input |
| 17 | Autoridad firmante (nombre + cargo) | — | ❌ **FALTA** — ningún campo de firmante en Institution |
| 18 | Imagen de firma / sello | — | ❌ **FALTA** — ningún campo de signatureUrl en Institution |

**Disponibles: 13/18. Faltantes: 5 (province, legajo, firmante nombre, firmante cargo, firma imagen).**

---

## 4. Elegibilidad — confirmación

`api/prisma_tenant/schema.prisma:40` — `Student.fechaDePase DateTime? @db.Timestamptz(6)`

Regla: alumno es **regular** cuando:
- Existe fila `AlumnosXCursoXCiclo` con ese `courseCycleId + studentId` (inscripción activa en el ciclo)
- `Student.fechaDePase IS NULL` (sin egreso registrado)

El check de `fechaDePase` requiere un join Student al buscar el axcc para la constancia. En el use case: `student.fechaDePase !== null → throw ConstanciaError('STUDENT_NOT_ACTIVE', 422)`.

---

## 5. Gaps y decisiones abiertas para el proposal

### GAP-1: `Institution.province` (CRÍTICO)
El campo `province` no existe en el schema master. La constancia necesita localidad + provincia para el encabezado institucional.
- **A (recomendado)**: Agregar `province String?` a Institution + migración master.
- **B**: Usar `Institution.address` como campo libre — parsing frágil.
- **C**: Omitir provincia — solo localidad.

### GAP-2: Nro legajo / matrícula (BAJO IMPACTO)
No existe en `Student`.
- **A (recomendado)**: Omitir — la norma argentina no lo exige en constancias básicas.
- **B**: Agregar `legajoNumber String?` al schema tenant.

### GAP-3: Firmante / autoridad (DECISIÓN DE PRODUCTO)
No hay campos de director/secretario en Institution.
- **A (recomendado MVP)**: Línea en blanco "Firma y Sello" — el sello físico se aplica al imprimir.
- **B**: Agregar `signatoryName String?` + `signatoryTitle String?` a Institution.
- **C**: Usar el `DIRECTOR`/`SECRETARIO` de `AsignacionCursoXCiclo` (rol por course-cycle) — no es institution-wide.

### GAP-4: Logo en HBS templates
`Institution.logo_url` existe (change `logo-upload`) pero ningún template HBS lo renderiza aún. Evaluar si la URL del logo es accesible por Puppeteer en contexto headless (URL relativa vs pública).

### GAP-5: Registro de constancias emitidas
La constancia es stateless. Open question: ¿audit log (quién emitió, cuándo, para qué alumno)?

### GAP-6: Endpoint — GET vs POST
Recomiendo **POST** con body para evitar URL-encoding del destinatario (texto libre largo).

---

## 6. Comparación de enfoques

| Enfoque | Pros | Contras | Esfuerzo |
|---------|------|---------|---------|
| **A. Server-side Puppeteer + HBS** (recomendado) | Patrón idéntico a boletines; infra 100% reutilizable; logo server-side trivial; control total del layout A4 | Latencia Puppeteer ~300-500ms (ya aceptada); browser singleton | BAJO |
| B. Client-side react-pdf / jsPDF | Sin round-trip | Nueva dependencia; logo requiere data-URI; aumenta bundle | MEDIO |
| C. `window.print()` sobre modal | Sin deps nuevas; cero backend | Layout frágil; no genera archivo PDF limpio | BAJO (calidad inferior) |

**Recomendación: Enfoque A.**

---

## 7. Niveles pedagógicos afectados

**ALL — INICIAL, PRIMARIO, SECUNDARIO, TERCIARIO.** Elegibilidad estructural (`AlumnosXCursoXCiclo` + `fechaDePase IS NULL`), independiente del nivel. Template HBS único y level-agnostic (mostrar el nivel es display-only).

---

## 8. Archivos clave a crear/modificar (para proposal)

| Acción | Archivo | Nota |
|--------|---------|------|
| NEW | `api/src/application/reportes/generate-constancia.use-case.ts` | Use case, misma capa que generate-boletin |
| NEW | `api/src/infrastructure/reporting/html-templates/constancia-regular.hbs` | Template Handlebars A4 |
| MOD | `api/src/presentation/reportes/reportes.controller.ts` | Nuevo endpoint POST /constancia-regular/:axccId |
| MOD | `api/src/presentation/reportes/reportes.module.ts` | Registrar nuevo use case |
| MOD | `api/prisma_master/schema.prisma` | Agregar `province String?` (si GAP-1 = opción A) |
| NEW | `web/src/hooks/useConstancia.ts` | downloadConstancia() — misma forma que useBoletin.ts |
| MOD | `web/src/pages/dashboard/components/AlumnosCursoCicloPanel.tsx` | Botón + Modal constancia |
| NEW | Tests: use case + controller + frontend component | TDD: tests primero |

---

## Status

- `status: done`
- `next_recommended: sdd-propose`
- Niveles afectados: ALL
- Engram: `sdd/constancia-alumno-regular/explore` (guardado)
