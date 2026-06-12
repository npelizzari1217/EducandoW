import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { LEVELS_KEY } from '../decorators/levels.decorator';
import type { AuthenticatedRequest } from './auth.guard';

/**
 * Guard that checks if the authenticated user has access to the required
 * educational level(s).
 *
 * The @Levels decorator accepts EducationalLevelCode values (1-4).
 * It maps the user's composite level codes (e.g. 10 = INICIAL + COMUN)
 * back to base levels via Math.floor(code / 10), then checks for
 * overlap with the required levels.
 *
 * ROOT and ADMIN users bypass all level checks (allLevels=true per access model Puerta 2).
 * Controllers without @Levels() are unaffected (guard defaults to true).
 */
@Injectable()
export class LevelsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<number[]>(LEVELS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true; // No @Levels decorator → pass through
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user || user.roles?.includes('ROOT') || user.roles?.includes('ADMIN')) {
      return true; // No user (should not happen at this point) or ROOT/ADMIN bypass (allLevels=true)
    }

    const userLevels = user.levels ?? [];
    if (userLevels.length === 0) {
      return false; // User has no levels assigned
    }

    const userBases = userLevels.map((c) => Math.floor(c / 10));
    return required.some((r) => userBases.includes(r));
  }
}
