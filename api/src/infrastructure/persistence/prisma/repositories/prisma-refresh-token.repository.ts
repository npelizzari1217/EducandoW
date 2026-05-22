import { Injectable } from '@nestjs/common';
import type { RefreshTokenRepository, RefreshTokenData } from '@educandow/domain';
import type { PrismaClient as MasterPrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  private readonly client: MasterPrismaClient;

  constructor(prismaService: PrismaService) {
    this.client = prismaService.getMasterClient();
  }

  async create(userId: string, role: string, token: string, expiresAt: Date): Promise<void> {
    await this.client.refreshToken.create({
      data: { userId, role, token, expiresAt },
    });
  }

  async findByToken(token: string): Promise<RefreshTokenData | null> {
    const record = await this.client.refreshToken.findUnique({
      where: { token },
      select: { userId: true, role: true, expiresAt: true },
    });
    if (!record) return null;
    return { userId: record.userId, role: record.role, expiresAt: record.expiresAt };
  }

  async deleteByToken(token: string): Promise<void> {
    await this.client.refreshToken.deleteMany({ where: { token } });
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await this.client.refreshToken.deleteMany({ where: { userId } });
  }
}
