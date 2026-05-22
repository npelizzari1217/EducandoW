import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Guard that checks if the authenticated user has the required role(s).
 *
 * Usage (must be after AuthGuard):
 *   @UseGuards(AuthGuard, RolesGuard)
 *   @Roles('ADMIN')
 *   async createInstitution() { ... }
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // No @Roles decorator → public
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.role) {
      return false;
    }

    // ROOT has universal access — bypass all role checks
    if (user.role === 'ROOT') {
      return true;
    }

    return requiredRoles.includes(user.role);
  }
}
