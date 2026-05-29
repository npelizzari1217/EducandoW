# Design: Fix page break en impresiones

## Technical Approach

Corrección centralizada en `PremiumPrintReport.tsx` con 3 cambios quirúrgicos:

1. **CSS**: Mover reglas `page-break-*` / `break-*` de `@media print` al scope global del componente
2. **html2pdf config**: Sacar `avoid-all` de `pagebreak.mode`
3. **onclone callback**: Limpiar estilos de pantalla en el DOM clonado

## Architecture Decisions

### Decision: Mover CSS page-break fuera de @media print

**Choice**: Reglas de paginación en CSS global (no condicional por medio)
**Alternatives**: Dejarlas en @media print y confiar en que html2canvas respete el medio print
**Rationale**: html2canvas captura el DOM en medio `screen`, no `print`. Las reglas dentro de `@media print` son invisibles para el motor de captura y por tanto no se aplican al PDF. En pantalla estas reglas no tienen efecto (no hay paginación en scroll), así que moverlas al scope global es seguro.

### Decision: Sacar avoid-all de pagebreak.mode

**Choice**: `mode: ['css', 'legacy']`
**Alternatives**: Mantener `['avoid-all', 'css', 'legacy']`
**Rationale**: `avoid-all` fuerza a html2pdf a no romper NINGÚN elemento. Cuando `.ppr-page` mide más de una página, el algoritmo entra en conflicto (no puede cumplir la regla) y termina haciendo cortes arbitrarios. Sin `avoid-all`, las reglas CSS `page-break-inside: avoid` en `<tr>` son suficientes para controlar los cortes.

### Decision: Limpiar estilos en onclone

**Choice**: Modificar DOM clonado en callback `onclone` de html2canvas
**Alternatives**: Usar clases CSS específicas para print/PDF
**Rationale**: El preview en pantalla debe mantener su apariencia actual (sombras, bordes redondeados, fondo gris). El PDF debe ser plano (fondo blanco, sin sombras, bordes rectos). `onclone` permite transformar el DOM que html2canvas va a capturar sin afectar lo que el usuario ve en pantalla.

## Data Flow

```
Usuario click "Imprimir" / "Descargar PDF"
  → handleDownloadPdf()
    → html2pdf().set(opt).from(element)
      → html2canvas captura #print-report con onclone:
          1. Elimina .ppr-no-print
          2. Limpia fondo/sombras/bordes/overflow
          3. pagebreak CSS rules activas globalmente
      → jsPDF divide en páginas A4 respetando:
          - page-break-inside: avoid en <tr>
          - page-break-after: avoid en header/title
          - page-break-before: avoid en footer
      → output: blob (PDF) → save() o window.open()
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `web/src/components/reports/PremiumPrintReport.tsx` | Modify | CSS rules, pagebreak config, onclone cleanup |

## Interfaces / Contracts

Sin cambios en interfaces. `PrintReportProps` y `PrintBranding` se mantienen igual.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Visual | 5 reportes (Módulos, Estudiantes, Usuarios, Planes, Detalle Plan) | Verificar PDF generado sin cortes incorrectos |
| Visual | Preview en pantalla | Confirmar que sombras/bordes se mantienen |
| Regression | Botón "Imprimir" y "Descargar PDF" en cada reporte | Ambos flujos deben funcionar |

## Migration / Rollout

No migration required. Cambio autónomo en un solo archivo frontend.

## Open Questions

None.
