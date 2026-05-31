import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { EmailAlreadyExistsError, canManageUser, canViewUser } from '@educandow/domain';
import * as bcrypt from 'bcrypt';
import { filterModuleAccess, type ModuleAccessItem } from '../filter-module-access';

// ── Types ────────────────────────────────────────────────

interface UserRow {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  institutionId: string | null;
  level: number | null;
  modality: number | null;
  active: boolean;
  failedAttempts: number;
  lockedUntil: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  userRoles?: { role: { id: string; name: string; description: string } }[];
  institution?: { id: string; name: string } | null;
  userModules?: { module: { code: string; name: string }; actions: string[] }[];
}

function userToResponse(u: UserRow) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    institutionId: u.institutionId,
    institutionName: u.institution?.name ?? null,
    level: u.level,
    modality: u.modality,
    roles: (u.userRoles ?? []).map((ur) => ur.role.name),
    active: u.active,
    failedAttempts: u.failedAttempts,
    lockedUntil: u.lockedUntil?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
    modules: (u.userModules ?? []).map((um) => ({
      moduleCode: um.module.code,
      moduleName: um.module.name,
      actions: um.actions,
    })),
  };
}

// ── List ──────────────────────────────────────────────────

@Injectable()
export class ListUsersUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(options: {
    creatorRoles: string[];
    institutionId?: string;
    includeInactive?: boolean;
  }) {
    const isRoot = options.creatorRoles.includes('ROOT');
    const client = this.prisma.getMasterClient();

    const where: Record<string, unknown> = { deletedAt: null };
    if (!options.includeInactive) where.active = true;
    if (options.institutionId) where.institutionId = options.institutionId;

    const records: UserRow[] = await client.user.findMany({
      where,
      include: {
        userRoles: { include: { role: true } },
        institution: { select: { id: true, name: true } },
        userModules: { include: { module: { select: { code: true, name: true } } } },
      },
      orderBy: { name: 'asc' },
    });

    // Filtrar por jerarquía de roles en memoria — listado permite ver usuarios del mismo rango
    const filtered = isRoot
      ? records
      : records.filter((u) => {
          const targetRoles = (u.userRoles ?? []).map((ur) => ur.role.name);
          return canViewUser(options.creatorRoles, targetRoles);
        });

    return { data: filtered.map((r) => userToResponse(r)) };
  }
}

// ── Create ────────────────────────────────────────────────

@Injectable()
export class CreateUserUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: {
    email: string;
    password: string;
    name: string;
    institutionId?: string;
    level?: number;
    modality?: number;
    roles?: string[];
    creatorRoles: string[];
    creatorInstitutionId?: string;
    moduleAccess?: ModuleAccessItem[];
    creatorModules?: ModuleAccessItem[];
  }) {
    const client = this.prisma.getMasterClient();
    const isRoot = input.creatorRoles.includes('ROOT');

    // Verificar email único
    const existing = await client.user.findUnique({ where: { email: input.email } });
    if (existing) throw new EmailAlreadyExistsError(input.email);

    // Verificar jerarquía de roles: el creador debe tener jerarquía igual o superior
    // a los roles que está asignando al nuevo usuario
    if (!isRoot && input.roles && input.roles.length > 0) {
      if (!canViewUser(input.creatorRoles, input.roles)) {
        throw new Error(
          'No tenés jerarquía suficiente para crear un usuario con estos roles. ' +
          'Solo podés asignar roles de jerarquía igual o inferior al tuyo.',
        );
      }
    }

    // Forzar institutionId del creador si no es ROOT
    const institutionId = isRoot
      ? (input.institutionId ?? null)
      : (input.creatorInstitutionId ?? null);

    // Hash password
    const passwordHash = await bcrypt.hash(input.password, 10);

    // Crear usuario
    const user = await client.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash,
        institutionId,
        level: input.level ?? null,
        modality: input.modality ?? null,
      },
      include: {
        userRoles: { include: { role: true } },
        institution: { select: { id: true, name: true } },
        userModules: { include: { module: { select: { code: true, name: true } } } },
      },
    });

    // Asignar roles
    if (input.roles && input.roles.length > 0) {
      const roleRecords = await client.role.findMany({
        where: { name: { in: input.roles }, active: true, deletedAt: null },
      });
      if (roleRecords.length > 0) {
        await client.userRole.createMany({
          data: roleRecords.map((r) => ({ userId: user.id, roleId: r.id })),
          skipDuplicates: true,
        });
      }
    }

    // Asignar módulos directos (user_modules)
    if (input.moduleAccess !== undefined) {
      const filtered = isRoot
        ? input.moduleAccess
        : filterModuleAccess(input.moduleAccess, input.creatorModules ?? []);

      if (filtered.length > 0) {
        const modules = await client.module.findMany({
          where: { code: { in: filtered.map((f) => f.moduleCode) }, active: true, deletedAt: null },
        });

        await client.userModule.createMany({
          data: filtered.map((f) => {
            const mod = modules.find((m) => m.code === f.moduleCode);
            return {
              userId: user.id,
              moduleId: mod!.id,
              actions: f.actions,
            };
          }),
        });
      }
    }

    // Refrescar
    const final = await client.user.findUnique({
      where: { id: user.id },
      include: {
        userRoles: { include: { role: true } },
        institution: { select: { id: true, name: true } },
        userModules: { include: { module: { select: { code: true, name: true } } } },
      },
    });

    return { data: userToResponse(final as UserRow) };
  }
}

// ── Update ────────────────────────────────────────────────

@Injectable()
export class UpdateUserUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    id: string,
    input: {
      email?: string;
      name?: string;
      password?: string;
      institutionId?: string | null;
      level?: number | null;
      modality?: number | null;
      roles?: string[];
      active?: boolean;
      moduleAccess?: ModuleAccessItem[];
    },
    creatorRoles: string[],
    creatorInstitutionId?: string,
    creatorModules: ModuleAccessItem[] = [],
  ) {
    const client = this.prisma.getMasterClient();
    const isRoot = creatorRoles.includes('ROOT');

    const existing = await client.user.findUnique({
      where: { id },
      include: {
        userRoles: { include: { role: true } },
        institution: { select: { id: true, name: true } },
        userModules: { include: { module: { select: { code: true, name: true } } } },
      },
    });
    if (!existing) return { data: null };

    // Verificar que un no-ROOT no pueda editar usuarios de otra institución
    if (!isRoot && creatorInstitutionId && existing.institutionId !== creatorInstitutionId) {
      throw new Error(
        'No podés modificar usuarios de otra institución.',
      );
    }

    // Verificar jerarquía contra los roles ACTUALES del objetivo
    const existingRoles = (existing.userRoles ?? []).map((ur) => ur.role.name);
    if (!isRoot && !canManageUser(creatorRoles, existingRoles)) {
      throw new Error(
        'No tenés jerarquía suficiente para modificar este usuario. ' +
        'Solo podés gestionar usuarios con roles de jerarquía inferior al tuyo.',
      );
    }

    // Si se están cambiando los roles, verificar que los nuevos sean iguales o inferiores
    if (!isRoot && input.roles && input.roles.length > 0) {
      if (!canViewUser(creatorRoles, input.roles)) {
        throw new Error(
          'No podés asignar roles de jerarquía superior a la tuya.',
        );
      }
    }

    // Verificar email único si cambia
    if (input.email && input.email !== existing.email) {
      const conflict = await client.user.findUnique({ where: { email: input.email } });
      if (conflict) throw new EmailAlreadyExistsError(input.email);
    }

    // Forzar institutionId del creador si no es ROOT
    const institutionId = isRoot
      ? input.institutionId
      : undefined; // no-ROOT no puede cambiar la institución del usuario editado

    // Actualizar campos
    const data: Record<string, unknown> = {};
    if (input.email !== undefined) data.email = input.email;
    if (input.name !== undefined) data.name = input.name;
    if (input.password !== undefined && input.password.length > 0) {
      data.passwordHash = await bcrypt.hash(input.password, 10);
    }
    if (institutionId !== undefined) data.institutionId = institutionId;
    if (input.level !== undefined) data.level = input.level;
    if (input.modality !== undefined) data.modality = input.modality;
    if (input.active !== undefined) data.active = input.active;

    if (Object.keys(data).length > 0) {
      await client.user.update({ where: { id }, data });
    }

    // Sincronizar roles
    if (input.roles !== undefined) {
      await client.userRole.deleteMany({ where: { userId: id } });
      if (input.roles.length > 0) {
        const roleRecords = await client.role.findMany({
          where: { name: { in: input.roles }, active: true, deletedAt: null },
        });
        if (roleRecords.length > 0) {
          await client.userRole.createMany({
            data: roleRecords.map((r) => ({ userId: id, roleId: r.id })),
            skipDuplicates: true,
          });
        }
      }
    }

    // Sincronizar módulos directos (user_modules)
    if (input.moduleAccess !== undefined) {
      await client.userModule.deleteMany({ where: { userId: id } });

      const filtered = isRoot
        ? input.moduleAccess
        : filterModuleAccess(input.moduleAccess, creatorModules);

      if (filtered.length > 0) {
        const modules = await client.module.findMany({
          where: { code: { in: filtered.map((f) => f.moduleCode) }, active: true, deletedAt: null },
        });

        await client.userModule.createMany({
          data: filtered.map((f) => {
            const mod = modules.find((m) => m.code === f.moduleCode);
            return {
              userId: id,
              moduleId: mod!.id,
              actions: f.actions,
            };
          }),
        });
      }
    }

    // Refrescar
    const updated = await client.user.findUnique({
      where: { id },
      include: {
        userRoles: { include: { role: true } },
        institution: { select: { id: true, name: true } },
        userModules: { include: { module: { select: { code: true, name: true } } } },
      },
    });

    return { data: userToResponse(updated as UserRow) };
  }
}

// ── Delete ────────────────────────────────────────────────

@Injectable()
export class DeleteUserUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(id: string, creatorRoles: string[]): Promise<boolean> {
    const client = this.prisma.getMasterClient();
    const isRoot = creatorRoles.includes('ROOT');

    const existing = await client.user.findUnique({
      where: { id },
      include: { userRoles: { include: { role: true } } },
    });
    if (!existing) return false;

    // Verificar jerarquía contra los roles del objetivo
    const targetRoles = (existing.userRoles ?? []).map((ur) => ur.role.name);
    if (!isRoot && !canManageUser(creatorRoles, targetRoles)) {
      throw new Error(
        'No tenés jerarquía suficiente para eliminar este usuario.',
      );
    }

    await client.user.update({
      where: { id },
      data: { active: false, deletedAt: new Date() },
    });
    return true;
  }
}
