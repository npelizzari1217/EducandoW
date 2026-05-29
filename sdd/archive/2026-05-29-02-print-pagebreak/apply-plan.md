# Apply Plan: Fix page break en impresiones

## Execution Order

1. **Modificar** `web/src/components/reports/PremiumPrintReport.tsx`:
   - a) Mover reglas CSS page-break de @media print a scope global
   - b) Cambiar pagebreak.mode a ['css', 'legacy']
   - c) Agregar limpieza en onclone

2. **Verificar** que el build no se rompe:
   - `pnpm lint` en web
   - `pnpm build` en web

3. **Verificación visual** manual de los 5 reportes

## Risk Assessment

- **Riesgo**: Bajo. Cambio en 1 archivo, ~20 líneas, sin cambios en lógica de negocio.
- **Rollback**: `git checkout -- web/src/components/reports/PremiumPrintReport.tsx`

## Contracts

- Sin cambios en interfaces, tipos, APIs ni contratos
- Sin migraciones de DB
- Sin cambios en infraestructura

## Verification

- `pnpm lint` debe pasar sin errores
- `pnpm build` debe compilar exitosamente
- Preview en pantalla debe mantener apariencia visual actual
