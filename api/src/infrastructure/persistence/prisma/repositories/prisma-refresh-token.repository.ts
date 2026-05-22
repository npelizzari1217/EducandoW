import { Injectable } from '@nestjs/common';
import type { RefreshTokenRepository, RefreshTokenData } from '@educandow/domain';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, role: string, token: string, expiresAt: Date): Promise<void> {
    await this.prisma.refreshToken.create({
      data: { userId, role, token, expiresAt },
    });
  }

  async findByToken(token: string): Promise<RefreshTokenData | null> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { token },
      select: { userId: true, role: true, expiresAt: true },
    });
    if (!record) return null;
    return { userId: record.userId, role: record.role, expiresAt: record.expiresAt };
  }

  async deleteByToken(token: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { token } });
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }
}
