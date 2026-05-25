import { Injectable } from '@nestjs/common';
import { ok, err, Result } from '@educandow/domain';
import type { RefreshTokenRepository } from '@educandow/domain';
import type { UserRepository } from '@educandow/domain';
import type { AuthPort } from '../ports/auth-port';
import { InvalidCredentialsError } from '@educandow/domain';
import crypto from 'crypto';

export interface RefreshTokenResult {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class RefreshTokenUseCase {
  constructor(
    private readonly refreshTokenRepo: RefreshTokenRepository,
    private readonly userRepo: UserRepository,
    private readonly jwtAuthPort: AuthPort,
  ) {}

  async execute(token: string): Promise<Result<RefreshTokenResult, InvalidCredentialsError>> {
    const stored = await this.refreshTokenRepo.findByToken(token);

    if (!stored) {
      return err(new InvalidCredentialsError());
    }

    if (new Date() > stored.expiresAt) {
      await this.refreshTokenRepo.deleteByToken(token);
      return err(new InvalidCredentialsError());
    }

    // Load user to get current roles + modules for the new JWT
    const user = await this.userRepo.findById(stored.userId);
    if (!user) {
      await this.refreshTokenRepo.deleteByToken(token);
      return err(new InvalidCredentialsError());
    }

    // Rotation: delete old token, issue new pair
    await this.refreshTokenRepo.deleteByToken(token);

    const newRefreshToken = crypto.randomUUID();
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.refreshTokenRepo.create(stored.userId, newRefreshToken, refreshExpiresAt);

    const accessToken = this.jwtAuthPort.sign({
      sub: stored.userId,
      roles: user.roles,
      modules: user.modules,
    });

    return ok({ accessToken, refreshToken: newRefreshToken });
  }
}
