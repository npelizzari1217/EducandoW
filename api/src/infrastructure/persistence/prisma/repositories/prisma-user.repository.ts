import { Injectable } from '@nestjs/common';
import {
  User,
  UserRepository,
  Email,
  Id,
  Result,
  ok,
  err,
} from '@educandow/domain';
import type { PrismaClient as MasterPrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  private readonly client: MasterPrismaClient;

  constructor(prismaService: PrismaService) {
    this.client = prismaService.getMasterClient();
  }

  async existsByEmail(email: Email): Promise<boolean> {
    const user = await this.client.user.findUnique({ where: { email: email.get() } });
    return !!user;
  }

  async findByEmail(email: string): Promise<User | null> {
    const record = await this.client.user.findUnique({ where: { email } });
    if (!record) return null;

    return this.toDomain(record);
  }

  async findById(id: string): Promise<User | null> {
    const record = await this.client.user.findUnique({ where: { id } });
    if (!record) return null;

    return this.toDomain(record);
  }

  async save(user: User): Promise<Result<User, Error>> {
    try {
      const record = await this.client.user.upsert({
        where: { id: user.id.get() },
        update: {
          email: user.email.get(),
          name: user.name,
          password: user.hashedPassword,
          role: user.role,
          institutionId: user.institutionId ?? null,
          level: user.level ?? null,
        },
        create: {
          id: user.id.get(),
          email: user.email.get(),
          name: user.name,
          password: user.hashedPassword,
          role: user.role,
          institutionId: user.institutionId ?? null,
          level: user.level ?? null,
        },
      });

      return ok(this.toDomain(record));
    } catch (error) {
      return err(error instanceof Error ? error : new Error('Failed to save user'));
    }
  }

  private toDomain(record: any): User {
    return User.reconstruct({
      id: Id.reconstruct(record.id),
      email: Email.reconstruct(record.email),
      name: record.name,
      hashedPassword: record.password,
      role: record.role,
      institutionId: record.institutionId ?? undefined,
      level: record.level ?? undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
