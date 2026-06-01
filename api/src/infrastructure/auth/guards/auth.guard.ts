import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthPort } from '../jwt-auth-port';

export interface AuthenticatedUser {
  userId: string;
  roles: string[];
  modules?: { moduleCode: string; actions: string[] }[];
  institutionId?: string;
  levels?: number[];
  userLevels?: { level: number; modality: number }[];
  dbName?: string | null;
  hasPermission?: (module: string, action: string) => boolean;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwtAuth: JwtAuthPort) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.split(' ')[1];

    try {
      const payload = this.jwtAuth.verify(token);
      (request as AuthenticatedRequest).user = {
        userId: payload.sub,
        roles: payload.roles,
        modules: payload.modules ?? [],
        institutionId: payload.institutionId,
        levels: payload.levels,
        userLevels: payload.userLevels,
        dbName: payload.dbName ?? null,
      } satisfies AuthenticatedUser;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
