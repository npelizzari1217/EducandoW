import { Injectable } from '@nestjs/common';
import {
  User,
  UserRepository,
  Email,
  Id,
  EducationalLevelCode,
  EducationalModalityCode,
  Result,
  ok,
  err,
} from '@educandow/domain';
import type { PrismaClient as MasterPrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma.service';

interface UserModuleRow {
  module: { id: string; code: string; name: string; active: boolean; deletedAt: Date | null };
  actions: string[];
}

interface UserRoleRow {
  role: {
    id: string;
    name: string;
    description: string;
    active: boolean;
    deletedAt: Date | null;
    roleModules?: { module: { id: string; code: string; name: string; active: boolean; deletedAt: Date | null }; actions: string[] }[];
  };
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  institutionId: string | null;
  level: number | null;
  modality: number | null;
  failedAttempts: number;
  lockedUntil: Date | null;
  active: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  userRoles?: UserRoleRow[];
  userModules?: UserModuleRow[];
}

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
    const record = await this.client.user.findUnique({
      where: { email },
      include: this.userInclude,
    });
    if (!record) return null;

    return this.toDomain(record);
  }

  async findById(id: string): Promise<User | null> {
    const record = await this.client.user.findUnique({
      where: { id },
      include: this.userInclude,
    });
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
          passwordHash: user.passwordHash,
          institutionId: user.institutionId ?? null,
          level: user.level ?? null,
          modality: user.modality ?? null,
          failedAttempts: user.failedAttempts,
          lockedUntil: user.lockedUntil ?? null,
          active: user.active,
          deletedAt: user.deletedAt ?? null,
        },
        create: {
          id: user.id.get(),
          email: user.email.get(),
          name: user.name,
          passwordHash: user.passwordHash,
          institutionId: user.institutionId ?? null,
          level: user.level ?? null,
          modality: user.modality ?? null,
          failedAttempts: user.failedAttempts,
          lockedUntil: user.lockedUntil ?? null,
          active: user.active,
          deletedAt: user.deletedAt ?? null,
        },
        include: this.userInclude,
      });

      return ok(this.toDomain(record));
    } catch (error) {
      return err(error instanceof Error ? error : new Error('Failed to save user'));
    }
  }

  private get userInclude() {
    return {
      userRoles: {
        include: {
          role: {
            include: {
              roleModules: {
                include: { module: true },
              },
            },
          },
        },
      },
      userModules: {
        include: { module: true },
      },
    };
  }

  private toDomain(record: UserRow): User {
    const roles: string[] = [];
    const moduleMap = new Map<string, Set<string>>();

    // Load modules from role → roleModules
    if (record.userRoles) {
      for (const ur of record.userRoles) {
        if (ur.role && ur.role.active && !ur.role.deletedAt) {
          roles.push(ur.role.name);
          if (ur.role.roleModules) {
            for (const rm of ur.role.roleModules) {
              if (rm.module && rm.module.active && !rm.module.deletedAt) {
                const moduleCode = rm.module.code;
                if (!moduleMap.has(moduleCode)) {
                  moduleMap.set(moduleCode, new Set());
                }
                for (const action of rm.actions ?? []) {
                  moduleMap.get(moduleCode)!.add(action);
                }
              }
            }
          }
        }
      }
    }

    // User-level overrides: merge and override
    if (record.userModules) {
      for (const um of record.userModules) {
        if (um.module && um.module.active && !um.module.deletedAt) {
          const moduleCode = um.module.code;
          // User modules override role modules completely for that module
          moduleMap.set(moduleCode, new Set());
          for (const action of um.actions ?? []) {
            moduleMap.get(moduleCode)!.add(action);
          }
        }
      }
    }

    // Remove modules with no actions
    for (const [code, actions] of moduleMap) {
      if (actions.size === 0) {
        moduleMap.delete(code);
      }
    }

    const modules = [...moduleMap.entries()].map(([moduleCode, actions]) => ({
      moduleCode,
      actions: [...actions],
    }));

    return User.reconstruct({
      id: Id.reconstruct(record.id),
      email: Email.reconstruct(record.email),
      name: record.name,
      passwordHash: record.passwordHash,
      roles,
      modules,
      institutionId: record.institutionId ?? undefined,
      level: record.level != null ? (record.level as EducationalLevelCode) : undefined,
      modality: record.modality != null ? (record.modality as EducationalModalityCode) : undefined,
      failedAttempts: record.failedAttempts ?? 0,
      lockedUntil: record.lockedUntil ?? undefined,
      active: record.active ?? true,
      deletedAt: record.deletedAt ?? undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
