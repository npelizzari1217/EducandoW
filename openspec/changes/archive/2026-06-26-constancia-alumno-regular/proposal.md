# Proposal: Constancia de Alumno Regular

> Base: exploración en `sdd/constancia-alumno-regular/explore` (engram #1471) y `openspec/changes/constancia-alumno-regular/explore.md`. No se re-investiga aquí.

**Nivel pedagógico afectado:** ALL (INICIAL, PRIMARIO, SECUNDARIO, TERCIARIO). Elegibilidad estructural, template agnóstico al nivel.

## Intent
El personal administrativo necesita emitir una **constancia de alumno regular** (imprimir o descargar PDF) desde AlumnosXCursoXCiclo. Hoy no existe; se hace manualmente fuera del sistema. La constancia certifica que un alumno con inscripción activa cursa regularmente, para trámites ante terceros (obra social, transporte, becas).

## Scope

### In Scope
- Botón "Constancia" en `AlumnosCursoCicloPanel` + popup con datos precargados.
- Inputs editables: **destinatario** (texto libre) y **fecha de emisión** (default = hoy).
- Endpoint `POST /v1/reportes/constancia-regular/:axccId` body `{ destinatario, fechaEmision }`.
- Elegibilidad: fila AlumnosXCursoXCiclo activa + `Student.fechaDePase IS NULL`; si no → **422**.
- PDF server-side con `PdfGeneratorService` (Puppeteer) + template nuevo `constancia-regular.hbs`.
- Campo nuevo `province String?` en Institution (master) + migración; constancia muestra localidad + provincia.
- Línea en blanco "Firma y Sello" para firma física.

### Out of Scope (iteraciones futuras)
- Firmante configurable (campos director/secretario en Institution).
- Audit log / traza de constancias emitidas (diseño **stateless**, se genera al vuelo).
- Nro de legajo/matrícula en el certificado (no existe en el modelo, la norma no lo exige).
- Caché en disco del PDF.

## Capabilities

### New Capabilities
- `constancia-regular`: emisión stateless de certificado de alumno regular en PDF (elegibilidad, datos, render, descarga/impresión).

### Modified Capabilities
- None (se agrega `province` a Institution como soporte de datos, sin cambiar requisitos de capacidades existentes).

## Approach
Reutilizar el patrón de boletines: caso de uso en `application/reportes` que mezcla datos master (Institution) + tenant (Student, AlumnosXCursoXCiclo, CourseCycle/Section, AcademicCycle), valida elegibilidad con Result pattern y renderiza `constancia-regular.hbs` vía Puppeteer. Sin persistencia. El front abre un modal, postea body y recibe el blob para imprimir/descargar (patrón `useBoletin`).

## Affected Areas
| Area | Impact | Description |
|------|--------|-------------|
| `api/prisma_master/schema.prisma` + migración | Modified/New | `province String?` en Institution |
| `api/src/application/reportes/generate-constancia-regular.use-case.ts` | New | Validación + ensamblado de datos |
| `api/src/infrastructure/reporting/html-templates/constancia-regular.hbs` | New | Template del certificado |
| `api/src/presentation/reportes/reportes.controller.ts` (+DTO/Zod) | Modified/New | POST endpoint + body schema |
| `web/.../AlumnosCursoCicloPanel.tsx` (+modal +hook) | Modified/New | Botón, popup, descarga |

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Migración master en prod | Low | Campo nullable, sin backfill obligatorio |
| Datos institucionales incompletos (sin provincia/logo) | Med | Render condicional; campos opcionales |

## Rollback Plan
Revertir migración master (`province` nullable, sin datos dependientes), quitar endpoint/use-case/template y el botón del panel. Sin estado persistido que limpiar.

## Success Criteria
- [ ] `pnpm build` y `pnpm test` (≥80% cov) en verde.
- [ ] Alumno elegible → PDF correcto con los 4 grupos de datos.
- [ ] Alumno no elegible (con `fechaDePase`) → 422.
- [ ] Imprimir y descargar funcionan desde el panel.
