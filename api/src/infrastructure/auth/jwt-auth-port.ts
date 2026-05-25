import * as jwt from 'jsonwebtoken';
import type { AuthPort } from '../../application/auth/ports/auth-port';

export interface JwtPayload {
  sub: string;
  roles: string[];
  modules?: { moduleCode: string; actions: string[] }[];
  institutionId?: string;
  level?: number;
  dbName?: string | null;
}

export class JwtAuthPort implements AuthPort {
  constructor(
    private readonly secret: string,
    private readonly expiresIn: string,
  ) {}

  sign(payload: JwtPayload): string {
    return jwt.sign(payload as object, this.secret, { expiresIn: this.expiresIn } as jwt.SignOptions);
  }

  verify(token: string): JwtPayload {
    return jwt.verify(token, this.secret) as JwtPayload;
  }
}
