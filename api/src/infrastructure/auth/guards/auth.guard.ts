import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthPort } from '../jwt-auth-port';

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
      (request as any).user = {
        userId: payload.sub,
        role: payload.role,
        institutionId: payload.institutionId,
        level: payload.level,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
