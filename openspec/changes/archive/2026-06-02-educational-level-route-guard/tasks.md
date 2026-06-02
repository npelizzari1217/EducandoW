# Tasks: Educational Level Route Guard

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~200 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Full change: guard infra + registration + refresh fix + 12 controllers + tests | PR 1 | ~200 lines, all tests included, atomic deploy |

## Phase 1: Guard Infrastructure (2 new files, infrastructure)

- [x] 1.1 Create `api/src/infrastructure/auth/decorators/levels.decorator.ts` — `LEVELS_KEY='levels'`, `@Levels(...codes: EducationalLevelCode[])` via `SetMetadata`, mirror `roles.decorator.ts`
- [x] 1.2 Create `api/src/infrastructure/auth/guards/levels.guard.ts` — `Reflector.getAllAndOverride`, `Math.floor(c/10)`, ROOT bypass, default `true`

## Phase 2: Register and Export (1 file, presentation)

- [x] 2.1 Register `LevelsGuard` in `api/src/presentation/auth/auth.module.ts` — add import, provider entry (below `RolesGuard`), and export entry

## Phase 3: Fix Refresh Token Bug (1 file, application)

- [x] 3.1 Fix `api/src/application/auth/use-cases/refresh-token.use-case.ts` — add `institutionId`, `levels`, `userLevels`, `dbName` to `jwtAuthPort.sign()` payload (mirror `LoginUseCase` lines 70-81); compute `levels = userLevels.map(l => l.level * 10 + l.modality)`

## Phase 4: Annotate Controllers (12 files, presentation)

### Nivel Inicial
- [x] 4.1 `api/src/presentation/nivel-inicial/sala.controller.ts` — `@Levels(EducationalLevelCode.INICIAL)`, add `LevelsGuard` to `@UseGuards`
- [x] 4.2 `api/src/presentation/nivel-inicial/informe-evolutivo.controller.ts` — same pattern
- [x] 4.3 `api/src/presentation/nivel-inicial/planificacion.controller.ts` — same pattern

### Nivel Primario
- [x] 4.4 `api/src/presentation/nivel-primario/grado.controller.ts` — `@Levels(EducationalLevelCode.PRIMARIO)`
- [x] 4.5 `api/src/presentation/nivel-primario/calificacion.controller.ts` — same pattern

### Nivel Secundario
- [x] 4.6 `api/src/presentation/nivel-secundario/curso.controller.ts` — `@Levels(EducationalLevelCode.SECUNDARIO)`
- [x] 4.7 `api/src/presentation/nivel-secundario/mesa-examen.controller.ts` — same pattern
- [x] 4.8 `api/src/presentation/nivel-secundario/regimen-academico.controller.ts` — same pattern

### Nivel Terciario
- [x] 4.9 `api/src/presentation/nivel-terciario/carrera.controller.ts` — `@Levels(EducationalLevelCode.TERCIARIO)`
- [x] 4.10 `api/src/presentation/nivel-terciario/titulo.controller.ts` — same pattern
- [x] 4.11 `api/src/presentation/nivel-terciario/acta-examen.controller.ts` — same pattern
- [x] 4.12 `api/src/presentation/nivel-terciario/inscripcion-materia.controller.ts` — same pattern

## Phase 5: Tests (2 files, infrastructure + application)

- [x] 5.1 Create `api/src/infrastructure/auth/guards/__tests__/levels.guard.test.ts` — cover 6 spec scenarios: matching level passes, non-matching rejected (403), multi-level mismatch rejected, ROOT bypass, no decorator passes through, empty levels rejected
- [x] 5.2 Create `api/src/application/auth/use-cases/__tests__/refresh-token.use-case.test.ts` — verify refreshed JWT includes `levels` and `userLevels` matching login tokens
