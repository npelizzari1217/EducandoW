# Archive Report: Fix page break en impresiones

## Change Summary

Bug fix en `PremiumPrintReport.tsx` para corregir saltos de página incorrectos en reportes PDF generados con html2pdf.js.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| (bug fix) | None | No spec-level capabilities cambiaron. No hay delta specs que sincronizar. |

## Archive Contents

| Artifact | Status |
|----------|--------|
| proposal.md | ✅ |
| spec.md | ✅ |
| design.md | ✅ |
| tasks.md | ✅ (6/6 tasks complete) |
| apply-plan.md | ✅ |
| verify-report.md | ✅ |

## Files Changed

| File | Action |
|------|--------|
| `web/src/components/reports/PremiumPrintReport.tsx` | Modified |

## Root Cause

1. Reglas CSS `page-break-*` dentro de `@media print` → invisibles para html2canvas (que captura en medio screen)
2. `pagebreak.mode: ['avoid-all', 'css', 'legacy']` → `avoid-all` forzaba al algoritmo a no romper ningún elemento, causando cortes arbitrarios
3. `.ppr-page` con `overflow: hidden` → html2canvas truncaba contenido excedente

## Fix Applied

1. Movidas reglas `page-break-*` / `break-*` al scope global del componente (fuera de @media print)
2. Cambiado `pagebreak.mode` a `['css', 'legacy']`
3. Agregada limpieza de estilos en callback `onclone`: fondo blanco, sin sombra, sin border-radius, `overflow: visible`

## SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived.
