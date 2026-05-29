# Design: Institution Print Config Fields

## Decision
Add `bodyColor`, `footerColor`, `footerTextColor` as optional `HexColor` value objects to the Institution entity, following the exact pattern of existing color fields.

## Rationale
- **Consistency**: The 3 existing color fields (`headerColor`, `headerTextColor`, `bodyTextColor`) already establish the pattern — new fields MUST follow it exactly
- **Simplicity**: No new types, no new validation — reuse `HexColor` value object and `hexColorField` Zod schema
- **Backward compatibility**: All fields optional, no breaking changes to existing API consumers

## Files Changed

| File | Change | Lines |
|------|--------|-------|
| `api/prisma/schema_master.prisma` | Add 3 columns after `bodyTextColor` | +3 |
| `packages/domain/src/institution/entities/institution.ts` | Props + getters + create() pass-through | +9 |
| `packages/domain/src/institution/__tests__/entities/institution-25fields.test.ts` | Update test name + assertions | ~5 |
| `api/src/presentation/institution/dto/create-institution-full.dto.ts` | Add 3 hexField entries | +3 |
| `api/src/application/institution/use-cases/institution.use-cases.ts` | Interfaces + parseo en create/update | +30 |
| `api/src/presentation/institution/institution.controller.ts` | toResponse() add 3 fields | +3 |
| `api/src/infrastructure/persistence/prisma/repositories/prisma-institution.repository.ts` | toDomain + toPrismaCreate/Update | +9 |
| `api/prisma/migrations/` | Auto-generated migration | +1 dir |

## Data Flow
```
HTTP PATCH /institutions/:id { body_color: "#e2e8f0", ... }
  → ZodValidationPipe → UpdateInstitutionDTO (snake_case)
  → UpdateInstitutionUseCase → HexColor.create("#e2e8f0") → HexColor value object
  → Institution.reconstruct({ ..., bodyColor: hexColor })
  → PrismaInstitutionRepository.update() → toPrismaUpdate() → { bodyColor: "#e2e8f0" }
  → DB column body_color = "#e2e8f0"

HTTP GET /institutions/:id
  → PrismaInstitutionRepository.findById() → toDomain() → Institution
  → toResponse() → { body_color: "#e2e8f0", ... }
```

## Dependency Rules
- Domain layer: no new imports needed, `HexColor` already imported
- Application layer: no new imports needed
- Infrastructure: no new imports needed
- All layers already have the patterns in place for color fields
