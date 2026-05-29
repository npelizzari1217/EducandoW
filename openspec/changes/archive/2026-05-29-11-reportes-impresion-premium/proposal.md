# Proposal: Reportes de Impresión Premium con Branding Dinámico

## Intent
Crear un sistema de reportes imprimibles y exportables a PDF para Módulos, Usuarios, Estudiantes y Planes de Estudio. Cada reporte usa la configuración de branding de la institución (logo, colores de cabecera, cuerpo y pie) para generar documentos con acabado corporativo premium.

## Scope

### In Scope
- Componente `PremiumPrintReport` parametrizable con branding dinámico desde `institutions`
- Vista de impresión para Módulos del Sistema
- Vista de impresión para Usuarios
- Vista de impresión para Estudiantes
- Vista de impresión para Planes de Estudio
- Botones "Imprimir" y "Descargar PDF" en las 4 páginas
- CSS `@page` con A4, márgenes, contadores de página, headers y footers dinámicos
- Soporte para `window.print()` con `@media print` para ocultar UI de navegación

### Out of Scope
- Renderizado server-side de PDF (Puppeteer)
- Almacenamiento de PDFs generados
- Cola de trabajos asíncrona

## Capabilities

### New Capabilities
- `print-reports`: Sistema de reportes imprimibles con branding institucional dinámico

## Approach
Crear componente `PremiumPrintReport` que actúa como template parametrizable. Recibe `PrintBranding` (extraído de `InstitutionConfig`) + datos específicos del reporte. Renderiza con CSS inline para compatibilidad con impresión y usa `@page` para layout A4 con headers/footers.

Cada página del dashboard tendrá un toggle `showPrint` que reemplaza la vista normal con el reporte de impresión. Botones "Imprimir" y "PDF" en el `PremiumHeader`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `web/src/context/institution-context.tsx` | Modified | +3 campos de color |
| `web/src/components/reports/PremiumPrintReport.tsx` | New | Componente base de reportes |
| `web/src/components/reports/ModulePrintView.tsx` | New | Reporte de módulos |
| `web/src/components/reports/UserPrintView.tsx` | New | Reporte de usuarios |
| `web/src/components/reports/StudentPrintView.tsx` | New | Reporte de estudiantes |
| `web/src/components/reports/StudyPlanPrintView.tsx` | New | Reporte de planes |
| `web/src/pages/dashboard/modules.tsx` | Modified | +botones +print view |
| `web/src/pages/dashboard/users.tsx` | Modified | +botones +print view |
| `web/src/pages/dashboard/students.tsx` | Modified | +botones +print view |
| `web/src/pages/dashboard/study-plans.tsx` | Modified | +botones +print view |

## Success Criteria
- [ ] Build compila sin errores
- [ ] Tests pasan
- [ ] Cada página muestra botones Imprimir + PDF
- [ ] Al clickear, se muestra vista previa de impresión con branding institucional
- [ ] CSS `@media print` funciona correctamente
