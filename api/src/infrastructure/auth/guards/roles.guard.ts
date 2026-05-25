import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Guard that checks if the authenticated user has the required role(s)
 * and/or module+action access.
 *
 * The @Roles decorator accepts:
 *   - Role names: @Roles('ADMIN')
 *   - Module+action objects: @Roles({ module: 'GRADES', action: 'CREATE' })
 *   - Mixed: @Roles('ADMIN', { module: 'GRADES', action: 'READ' })
 *
 * When only roles are specified → checks user.roles.
 * When module+action specified → checks user.modules via hasPermission(module, action).
 * Mixed: user must satisfy ALL module+action entries OR have one of the listed roles.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<(string | ModuleActionEntry)[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // No @Roles decorator → public
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.roles || user.roles.length === 0) {
      return false;
    }

    // ROOT has universal access — bypass all checks
    if (user.roles.includes('ROOT')) {
      return true;
    }

    // Separate string roles from ModuleActionEntry objects
    const roleNames: string[] = [];
    const moduleChecks: ModuleActionEntry[] = [];

    for (const entry of requiredRoles) {
      if (typeof entry === 'string') {
        roleNames.push(entry);
      } else if (entry && typeof entry.module === 'string' && typeof entry.action === 'string') {
        moduleChecks.push(entry);
      }
    }

    // Check roles
    const hasRequiredRole = roleNames.length > 0
      ? roleNames.some((role) => user.roles.includes(role))
      : roleNames.length === 0; // no roles required → pass role check

    // Check module+action
    const hasModuleAccess = moduleChecks.length > 0
      ? moduleChecks.every(({ module, action }) => {
          // user object may have a hasPermission method (if User entity was loaded)
          // or modules array (if it's the lightweight AuthenticatedUser from JWT)
          if (typeof user.hasPermission === 'function') {
            return user.hasPermission(module, action);
          }
          if (user.modules) {
            return user.modules.some(
              (m: any) => m.moduleCode === module && m.actions.includes(action),
            );
          }
          return false;
        })
      : moduleChecks.length === 0; // no module checks → pass module check

    // If both roles and module checks are present, user must satisfy at least one role OR all module checks
    if (roleNames.length > 0 && moduleChecks.length > 0) {
      return hasRequiredRole || hasModuleAccess;
    }

    return hasRequiredRole && hasModuleAccess;
  }
}

export interface ModuleActionEntry {
  module: string;
  action: string;
}
