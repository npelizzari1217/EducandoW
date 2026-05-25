import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@educandow/domain';

export const ROLES_KEY = 'roles';

/**
 * Specifies which roles or module+action pairs can access a route.
 *
 * Accepts role names, module+action objects, or both:
 *   @Roles('ADMIN')
 *   @Roles('ADMIN', 'MANAGER')
 *   @Roles({ module: 'GRADES', action: 'CREATE' })
 *   @Roles('TEACHER', { module: 'GRADES', action: 'READ' })
 */
export type RolesParam = UserRole | ModuleActionDecoratorEntry;

export interface ModuleActionDecoratorEntry {
  module: string;
  action: string;
}

export const Roles = (...roles: RolesParam[]) => SetMetadata(ROLES_KEY, roles);
