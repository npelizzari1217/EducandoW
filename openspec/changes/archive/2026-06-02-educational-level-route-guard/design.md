# Design: Educational Level Route Guard

## Technical Approach

Mirror the existing `RolesGuard` pattern: `SetMetadata` decorator + `Reflector.getAllAndOverride` guard. Extract base educational level from composite codes via `Math.floor(code / 10)`, compare against `@Levels()` metadata, ROOT bypass, default `true` when no metadata.

## Architecture Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Mirror `RolesGuard` pattern exactly | Consistency — any dev who knows `@Roles()` immediately understands `@Levels()`. Same `SetMetadata`/`Reflector`/`getAllAndOverride` flow. No new concepts. |
| 2 | `Math.floor(composite / 10)` for level extraction | JWT stores composite codes (10=INICIAL, 20=PRIMARIO). `@Levels()` accepts base codes (1-4). Extraction is deterministic and trivially testable. |
| 3 | ROOT bypass | Same as RolesGuard — ROOT has universal access. One `roles.includes('ROOT')` check, no level comparison needed. |
| 4 | Default `true` when no `@Levels()` | Backward compatible — controllers without the decorator (e.g., pedagogy, auth, users) continue working unchanged. |
| 5 | Reject URL-matching approach | Implicit/magic behavior that breaks when routes are refactored. Explicit annotations survive route renames. |

## Data Flow

```
Request → AuthGuard (decode JWT → req.user.levels)
        → RolesGuard (check roles/modules)
        → LevelsGuard (Math.floor(levels)/10 ∩ @Levels() metadata)
        → Controller (business logic)
```

ROOT short-circuits all guards. Guard order: AuthGuard then RolesGuard then LevelsGuard. Each is independent — failure in any one returns 403.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `api/src/infrastructure/auth/decorators/levels.decorator.ts` | **Create** | `@Levels()` decorator: `SetMetadata(LEVELS_KEY, codes)` accepting `EducationalLevelCode` (1-4) |
| `api/src/infrastructure/auth/guards/levels.guard.ts` | **Create** | `LevelsGuard`: `Reflector.getAllAndOverride` + `Math.floor` extraction + ROOT bypass |
| `api/src/application/auth/use-cases/refresh-token.use-case.ts` | **Modify** | Add `levels` + `userLevels` + `institutionId` + `dbName` to JWT payload (lines 48-52) |
| `api/src/presentation/auth/auth.module.ts` | **Modify** | Register `LevelsGuard` as provider, add to exports |
| `api/src/presentation/nivel-inicial/sala.controller.ts` | **Modify** | Add `LevelsGuard` to `@UseGuards`, add `@Levels(EducationalLevelCode.INICIAL)` |
| `api/src/presentation/nivel-inicial/informe-evolutivo.controller.ts` | **Modify** | Same pattern |
| `api/src/presentation/nivel-inicial/planificacion.controller.ts` | **Modify** | Same pattern |
| `api/src/presentation/nivel-primario/grado.controller.ts` | **Modify** | `@Levels(EducationalLevelCode.PRIMARIO)` |
| `api/src/presentation/nivel-primario/calificacion.controller.ts` | **Modify** | Same pattern |
| `api/src/presentation/nivel-secundario/curso.controller.ts` | **Modify** | `@Levels(EducationalLevelCode.SECUNDARIO)` |
| `api/src/presentation/nivel-secundario/mesa-examen.controller.ts` | **Modify** | Same pattern |
| `api/src/presentation/nivel-secundario/regimen-academico.controller.ts` | **Modify** | Same pattern |
| `api/src/presentation/nivel-terciario/carrera.controller.ts` | **Modify** | `@Levels(EducationalLevelCode.TERCIARIO)` |
| `api/src/presentation/nivel-terciario/titulo.controller.ts` | **Modify** | Same pattern |
| `api/src/presentation/nivel-terciario/acta-examen.controller.ts` | **Modify** | Same pattern |
| `api/src/presentation/nivel-terciario/inscripcion-materia.controller.ts` | **Modify** | Same pattern |

## Contracts

### LevelsGuard interface
```typescript
export const LEVELS_KEY = 'levels';
export const Levels = (...codes: EducationalLevelCode[]) => SetMetadata(LEVELS_KEY, codes);

@Injectable()
export class LevelsGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<EducationalLevelCode[]>(
      LEVELS_KEY, [context.getHandler(), context.getClass()]
    );
    if (!required?.length) return true;
    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!user || user.roles?.includes('ROOT')) return !user || true; // ROOT bypass
    const userBases = (user.levels ?? []).map(c => Math.floor(c / 10));
    return required.some(r => userBases.includes(r));
  }
}
```

### RefreshTokenUseCase fix
Current payload (line 48-52): `{ sub, roles, modules }`
Fixed payload: `{ sub, roles, modules, levels, userLevels, institutionId, dbName }`

Levels computed the same way as `LoginUseCase`:
```typescript
const userLevels = user.levels;
const levels = userLevels.map(l => l.level * 10 + l.modality);
```

### Controller annotation pattern
```typescript
import { LevelsGuard } from '../../infrastructure/auth/guards/levels.guard';
import { Levels } from '../../infrastructure/auth/decorators/levels.decorator';
import { EducationalLevelCode } from '@educandow/domain';

@Controller('inicial/salas')
@UseGuards(AuthGuard, RolesGuard, LevelsGuard)
@Roles(...)
@Levels(EducationalLevelCode.INICIAL)
export class SalaController { ... }
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `LevelsGuard.canActivate()` | 6 spec scenarios: matching level, non-matching, multi-level rejection, ROOT bypass, no decorator, empty levels |
| Unit | `RefreshTokenUseCase` | Verify new JWT includes `levels` and `userLevels` after refresh |
| Integration | API endpoint | Verify 403 returned when level mismatch |

## Migration / Rollout

No data migration. No feature flags. Deploy is atomic: guard + annotations + refresh fix in one commit. Rollback: `git revert`.

## Open Questions

None — all design decisions resolved.
