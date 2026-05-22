import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@educandow/domain';

export const ROLES_KEY = 'roles';

/**
 * Decorator to specify which roles can access a route.
 *
 * Usage:
 *   @Roles('ADMIN')
 *   @Roles('ADMIN', 'MANAGER')
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
