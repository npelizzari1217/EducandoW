import { Injectable } from '@nestjs/common';
import type { RefreshTokenRepository } from '@educandow/domain';

@Injectable()
export class LogoutUseCase {
  constructor(private readonly refreshTokenRepo: RefreshTokenRepository) {}

  async execute(token: string): Promise<void> {
    if (token) {
      await this.refreshTokenRepo.deleteByToken(token);
    }
  }
}
