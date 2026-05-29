# Proposal: Fix page break en impresiones del sistema

## Intent

Los reportes imprimibles (Módulos, Estudiantes, Usuarios, Planes de Estudio) generan saltos de página incorrectos cuando el contenido excede una hoja A4. El bug es sistémico: afecta a todos los reportes que usan `PremiumPrintReport` + `html2pdf.js`.

## Scope

### In Scope
- Mover reglas CSS `page-break-*` fuera de `@media print` para que `html2canvas` las interprete
- Cambiar `pagebreak.mode` de `['avoid-all', 'css', 'legacy']` a `['css', 'legacy']`
- Limpiar estilos de pantalla (background, shadow, border-radius, overflow) en el DOM clonado vía `onclone`
- Verificar visualmente los reportes: Módulos, Estudiantes, Usuarios, Planes de Estudio

### Out of Scope
- Migrar a `window.print()` nativo (eliminaría descarga directa de PDF)
- Refactor de la estructura DOM de `PremiumPrintReport`

## Capabilities

### New Capabilities
None — bug fix, no nueva capacidad.

### Modified Capabilities
None — no cambia comportamiento a nivel de spec.

## Approach

**Corrección centralizada en `PremiumPrintReport.tsx`** (archivo único):

1. **CSS**: Mover `.ppr-header`, `.ppr-table`, `.ppr-table tr`, `.ppr-footer` de `@media print` a estilos globales del componente. Agregar variante `break-inside` para compatibilidad moderna.
2. **html2pdf config**: Cambiar `pagebreak.mode` a `['css', 'legacy']`.
3. **onclone callback**: Limpiar el DOM clonado: fondo blanco, sin sombra, sin border-radius, `overflow: visible`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `web/src/components/reports/PremiumPrintReport.tsx` | Modified | CSS + config html2pdf + onclone |
| `web/src/components/reports/ModulePrintView.tsx` | Indirect | Se beneficia del fix |
| `web/src/components/reports/StudentPrintView.tsx` | Indirect | Se beneficia del fix |
| `web/src/components/reports/UserPrintView.tsx` | Indirect | Se beneficia del fix |
| `web/src/components/reports/StudyPlanPrintView.tsx` | Indirect | Se beneficia del fix |
| `web/src/components/reports/StudyPlanDetailPrintView.tsx` | Indirect | Se beneficia del fix |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `page-break-*` no soportado en navegadores antiguos | Low | Usar ambas propiedades: `page-break-inside` + `break-inside` |
| Logo no cargado antes de captura html2canvas | Low | `useCORS: true` ya está configurado |

## Rollback Plan

Revertir `PremiumPrintReport.tsx` a su versión anterior con `git checkout` y regenerar bundle.

## Dependencies

Ninguna. El fix es autónomo en un solo archivo.

## Success Criteria

- [ ] Reporte de Módulos con 20+ entradas genera PDF sin cortes incorrectos
- [ ] Encabezado de tabla se repite en cada página
- [ ] Footer legal aparece solo al final
- [ ] Preview en pantalla conserva sombras/bordes redondeados
- [ ] Los 5 reportes existentes funcionan sin regresión visual
