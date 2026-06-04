import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RANK_KEY } from '../decorators/rank.decorator';
import type { AuthenticatedRequest } from './auth.guard';
import { getHighestRoleRank } from '@educandow/domain';

@Injectable()
export class RankGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRank = this.reflector.get<number>(RANK_KEY, context.getHandler());
    if (!requiredRank) {
      return true; // No @Rank decorator, pass through
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user || !user.roles || user.roles.length === 0) {
      return false;
    }

    // ROOT bypasses rank checks
    if (user.roles.includes('ROOT')) {
      return true;
    }

    const userRank = getHighestRoleRank(user.roles);
    return userRank >= requiredRank;
  }
}
