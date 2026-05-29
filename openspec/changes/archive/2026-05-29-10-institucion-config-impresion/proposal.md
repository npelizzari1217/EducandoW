# Proposal: Configuración de Impresión por Institución

## Intent
Agregar 3 campos de color a la tabla `institutions` para completar la configuración visual de impresiones: color de fondo del cuerpo, color de fondo del pie y color de letra del pie. Actualmente existen `headerColor`, `headerTextColor` y `bodyTextColor` pero faltan `bodyColor`, `footerColor` y `footerTextColor`.

## Scope

### In Scope
- Agregar `bodyColor`, `footerColor`, `footerTextColor` al schema Prisma master
- Extender la entidad `Institution` en domain con los 3 nuevos campos `HexColor?`
- Exponer los campos en el DTO Zod, use case, controller y repository
- Migration de DB para las 3 columnas nuevas
- Actualizar tests existentes

### Out of Scope
- Implementación del renderizado de impresiones (usa los campos, no los define)
- Cambios en el frontend de configuración institucional

## Capabilities

### Modified Capabilities
- `institution-settings`: 3 nuevos campos de color opcionales en el modelo Institution

## Approach
Seguir el patrón exacto de los campos de color existentes (`headerColor`, `headerTextColor`, `bodyTextColor`):
- Tipo `HexColor?` en domain
- Validación con regex hex `#[0-9a-fA-F]{6}` en DTO
- Mapeo `record.field ? HexColor.reconstruct(record.field) : undefined` en repository
- Naming: snake_case en API (`body_color`, `footer_color`, `footer_text_color`), camelCase en domain

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `api/prisma/schema_master.prisma` | Modified | 3 nuevas columnas String? |
| `packages/domain/.../institution.ts` | Modified | Props, getters, create |
| `api/.../create-institution-full.dto.ts` | Modified | 3 nuevos campos hexColorField |
| `api/.../institution.use-cases.ts` | Modified | Inputs, parseo, create/update |
| `api/.../institution.controller.ts` | Modified | toResponse() |
| `api/.../prisma-institution.repository.ts` | Modified | toDomain, toPrismaCreate, toPrismaUpdate |
| `packages/domain/.../institution-25fields.test.ts` | Modified | Ajustar assertions |
| DB migration | New | ALTER TABLE institutions ADD 3 columns |

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Migration falla en prod | Low | Columnas nullable, sin impacto en datos existentes |

## Rollback Plan
Ejecutar `ALTER TABLE institutions DROP COLUMN body_color, DROP COLUMN footer_color, DROP COLUMN footer_text_color;`

## Dependencies
- Ninguna

## Success Criteria
- [ ] `pnpm build` compila sin errores
- [ ] `pnpm test` pasa con los 3 nuevos campos cubiertos
- [ ] Migration se ejecuta correctamente
