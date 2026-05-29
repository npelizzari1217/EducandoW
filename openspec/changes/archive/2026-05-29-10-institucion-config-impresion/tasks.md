# Tasks: Institution Print Config Fields

## Phase 1: Domain
- [ ] **1.1** Agregar `bodyColor?: HexColor`, `footerColor?: HexColor`, `footerTextColor?: HexColor` a `InstitutionProps` en `packages/domain/src/institution/entities/institution.ts`
- [ ] **1.2** Agregar getters: `get bodyColor()`, `get footerColor()`, `get footerTextColor()`
- [ ] **1.3** Pasar los 3 campos en `static create()` y `static reconstruct()`
- [ ] **1.4** Actualizar test `institution-25fields.test.ts` (renombrar a 28fields y verificar nuevos getters)

## Phase 2: Application
- [ ] **2.1** Agregar `body_color?: string`, `footer_color?: string`, `footer_text_color?: string` a `CreateInstitutionInput` y `UpdateInstitutionInput`
- [ ] **2.2** Agregar parseo de hex color en `CreateInstitutionUseCase.execute()` para los 3 campos nuevos
- [ ] **2.3** Agregar parseo de hex color en `UpdateInstitutionUseCase.execute()` para los 3 campos nuevos
- [ ] **2.4** Pasar los 3 campos a `Institution.create()` y `Institution.reconstruct()`

## Phase 3: Presentation
- [ ] **3.1** Agregar `body_color: hexColorField`, `footer_color: hexColorField`, `footer_text_color: hexColorField` a `InstitutionFullBaseSchema` en `create-institution-full.dto.ts`
- [ ] **3.2** Agregar los 3 campos a `toResponse()` en `institution.controller.ts`

## Phase 4: Infrastructure
- [ ] **4.1** Agregar `bodyColor`, `footerColor`, `footerTextColor` al schema Prisma en `schema_master.prisma`
- [ ] **4.2** Agregar mapeo en `toDomain()` del repository Prisma
- [ ] **4.3** Agregar mapeo en `toPrismaCreate()` y `toPrismaUpdate()`
- [ ] **4.4** Generar y ejecutar migration: `pnpm --filter api prisma migrate dev --name add_institution_print_colors`

## Phase 5: Verify
- [ ] **5.1** Ejecutar `pnpm build` — debe compilar sin errores
- [ ] **5.2** Ejecutar `pnpm test` — todos los tests deben pasar
- [ ] **5.3** Verificar que migration se aplicó correctamente
