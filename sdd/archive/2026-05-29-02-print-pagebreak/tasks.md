# Tasks: Fix page break en impresiones

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~20 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

## Phase 1: Core fix en PremiumPrintReport.tsx

- [x] 1.1 Mover reglas CSS `page-break-*` / `break-*` de dentro de `@media print` al scope global del componente
- [x] 1.2 Cambiar `pagebreak.mode` de `['avoid-all', 'css', 'legacy']` a `['css', 'legacy']`
- [x] 1.3 Agregar limpieza de estilos en callback `onclone` de html2canvas: fondo blanco, sin shadow, sin border-radius, overflow visible
- [x] 1.4 Mantener las reglas `@media print` originales para soporte de `window.print()` (no romper impresión nativa del navegador)

## Phase 2: Verificación visual

- [ ] 2.1 Probar PDF de Módulos del Sistema con 20+ módulos — verificar cortes correctos entre páginas
- [ ] 2.2 Probar PDF de Estudiantes — verificar que tabla larga se divide correctamente
- [ ] 2.3 Probar PDF de Usuarios — verificar saltos de página
- [ ] 2.4 Probar PDF de Planes de Estudio — verificar saltos
- [ ] 2.5 Probar que el preview en pantalla conserva sombras, bordes redondeados y fondo original
- [ ] 2.6 Probar ambos botones: "Imprimir" (abrir en pestaña) y "Descargar PDF"
