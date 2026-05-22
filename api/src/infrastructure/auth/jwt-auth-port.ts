import * as jwt from 'jsonwebtoken';

export interface JwtPayload {
  sub: string;
  role: string;
  institutionId?: string;
  level?: string;
}

export class JwtAuthPort {
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
