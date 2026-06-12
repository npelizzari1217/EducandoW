import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { EmailAlreadyExistsError, canManageUser, canViewUser, type UserLevelEntry, type InstitutionLevelEntry, Result, ok, err, ValidationError, EducationalLevelCode, EducationalModalityCode } from '@educandow/domain';
import * as bcrypt from 'bcrypt';
import { filterModuleAccess, type ModuleAccessItem } from '../filter-module-access';
import { profileToModuleAccess, type ProfilePermissionRow } from '../../profiles/use-cases/profiles.use-cases';

// ── Types ────────────────────────────────────────────────

interface UserRow {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  institutionId: string | null;
  active: boolean;
  failedAttempts: number;
  lockedUntil: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  userRoles?: { role: { id: string; name: string; description: string } }[];
  institution?: { id: string; name: string } | null;
  userModules?: { module: { code: string; name: string }; actions: string[] }[];
  userLevels?: { level: number; modality: number }[];
  // Persona fields (Fase 1 — UP-R1)
  firstName?: string | null;
  lastName?: string | null;
  dni?: string | null;
  title?: string | null;
  phone?: string | null;
}

export function userToResponse(u: UserRow) {
  const userLevels = (u.userLevels ?? []).map((ul) => ({
    level: ul.level,
    modality: ul.modality,
  }));
  const levels = userLevels.map((ul) => ul.level * 10 + ul.modality);

  return {
    id: u.id,
    email: u.email,
    name: u.name,
    institutionId: u.institutionId,
    institutionName: u.institution?.name ?? null,
    roles: (u.userRoles ?? []).map((ur) => ur.role.name),
    active: u.active,
    failedAttempts: u.failedAttempts,
    lockedUntil: u.lockedUntil?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
    levels,
    userLevels,
    modules: (u.userModules ?? []).map((um) => ({
      moduleCode: um.module.code,
      moduleName: um.module.name,
      actions: um.actions,
    })),
    // Persona fields (UP-R1, UP-R3) — sourced exclusively from User (master DB).
    // After the backfill script (backfill-user-persona.ts) runs, User is the
    // authoritative source. Teacher.firstName/lastName/dni/title/phone are
    // legacy-read-only and MUST NOT take precedence over User values (UP-S6).
    firstName: u.firstName ?? null,
    lastName: u.lastName ?? null,
    dni: u.dni ?? null,
    title: u.title ?? null,
    phone: u.phone ?? null,
  };
}

// ── validateLevelsSubset ──────────────────────────────────

/**
 * Validates that every user level entry exists in the institution's level set.
 * Returns Ok(undefined) if all user levels are a subset, or Err with the list
 * of invalid entries.
 *
 * ROOT users should bypass this validation at the call site — this function
 * is purely about institution-level membership.
 */
export function validateLevelsSubset(
  userLevels: UserLevelEntry[],
  institutionLevels: InstitutionLevelEntry[],
): Result<void, ValidationError> {
  const institutionSet = new Set(
    institutionLevels.map((l) => `${l.level}:${l.modality}`),
  );

  const invalid: string[] = [];
  for (const ul of userLevels) {
    if (!institutionSet.has(`${ul.level}:${ul.modality}`)) {
      invalid.push(`${ul.level}:${ul.modality}`);
    }
  }

  if (invalid.length > 0) {
    return err(new ValidationError(`Levels not in institution: ${invalid.join(', ')}`));
  }

  return ok(undefined);
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
        userLevels: true,
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
    roles?: string[];
    creatorRoles: string[];
    creatorInstitutionId?: string;
    moduleAccess?: ModuleAccessItem[];
    creatorModules?: ModuleAccessItem[];
    levels?: { level: number; modality: number }[];
    profileId?: string;
    // Persona fields (Fase 1 — UP-R1)
    firstName?: string;
    lastName?: string;
    dni?: string;
    title?: string;
    phone?: string;
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

    // Validar levels contra institution_levels (ROOT bypass)
    if (!isRoot && input.levels && input.levels.length > 0 && institutionId) {
      const institution = await client.institution.findUnique({
        where: { id: institutionId },
        include: { levels: true },
      });
      if (institution?.levels) {
        const validationResult = validateLevelsSubset(
          input.levels.map((l) => ({
            level: l.level as EducationalLevelCode,
            modality: l.modality as EducationalModalityCode,
          })),
          institution.levels.map((il) => ({
            level: il.level as EducationalLevelCode,
            modality: il.modality as EducationalModalityCode,
          })),
        );
        if (validationResult.isErr()) {
          throw validationResult.unwrapErr();
        }
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(input.password, 10);

    // Construir data para crear usuario
    const createData: Record<string, unknown> = {
      email: input.email,
      name: input.name,
      passwordHash,
      institutionId,
    };

    // Persona fields (UP-R1) — only set if provided
    if (input.firstName !== undefined) createData.firstName = input.firstName;
    if (input.lastName !== undefined) createData.lastName = input.lastName;
    if (input.dni !== undefined) createData.dni = input.dni;
    if (input.title !== undefined) createData.title = input.title;
    if (input.phone !== undefined) createData.phone = input.phone;

    // Include profileId if provided
    if (input.profileId) {
      createData.profileId = input.profileId;
    }

    // Nested userLevels create — mirrors institution repository pattern
    if (input.levels !== undefined) {
      createData.userLevels = {
        create: input.levels.map((l) => ({ level: l.level, modality: l.modality })),
      };
    }

    // Crear usuario
    const user = await client.user.create({
      data: createData as unknown as Prisma.UserCreateInput,
      include: {
        userRoles: { include: { role: true } },
        institution: { select: { id: true, name: true } },
        userModules: { include: { module: { select: { code: true, name: true } } } },
        userLevels: true,
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

    // Asignar módulos desde perfil (profileId)
    if (input.profileId) {
      const profilePerms = await client.profileModulePermission.findMany({
        where: { profileId: input.profileId },
        include: { module: { select: { code: true } } },
      });

      if (profilePerms.length > 0) {
        const profileAccess = profileToModuleAccess(profilePerms as unknown as ProfilePermissionRow[]);
        const filtered = isRoot
          ? profileAccess
          : filterModuleAccess(profileAccess, input.creatorModules ?? []);

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
    }

    // Asignar módulos directos (user_modules) — manual override
    if (input.moduleAccess !== undefined) {
      // If profile modules were created, delete them first (manual overrides)
      if (input.profileId) {
        await client.userModule.deleteMany({ where: { userId: user.id } });
      }
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
        userLevels: true,
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
      roles?: string[];
      active?: boolean;
      moduleAccess?: ModuleAccessItem[];
      levels?: { level: number; modality: number }[];
      profileId?: string | null;
      // Persona fields (Fase 1 — UP-R1)
      firstName?: string | null;
      lastName?: string | null;
      dni?: string | null;
      title?: string | null;
      phone?: string | null;
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
        userLevels: true,
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
    if (input.active !== undefined) data.active = input.active;
    if (input.profileId !== undefined) data.profileId = input.profileId;

    // Persona fields (UP-R1) — allow explicit null to clear
    if (input.firstName !== undefined) data.firstName = input.firstName;
    if (input.lastName !== undefined) data.lastName = input.lastName;
    if (input.dni !== undefined) data.dni = input.dni;
    if (input.title !== undefined) data.title = input.title;
    if (input.phone !== undefined) data.phone = input.phone;

    // Handle levels: present → replace, absent → don't touch, empty → clear
    if (input.levels !== undefined) {
      // Validate against institution levels (ROOT bypass)
      if (!isRoot && input.levels.length > 0 && existing.institutionId) {
        const institution = await client.institution.findUnique({
          where: { id: existing.institutionId },
          include: { levels: true },
        });
        if (institution?.levels) {
          const validationResult = validateLevelsSubset(
            input.levels.map((l) => ({
              level: l.level as EducationalLevelCode,
              modality: l.modality as EducationalModalityCode,
            })),
            institution.levels.map((il) => ({
              level: il.level as EducationalLevelCode,
              modality: il.modality as EducationalModalityCode,
            })),
          );
          if (validationResult.isErr()) {
            throw validationResult.unwrapErr();
          }
        }
      }

      if (input.levels.length > 0) {
        // Replace: deleteMany + create
        data.userLevels = {
          deleteMany: {},
          create: input.levels.map((l) => ({ level: l.level, modality: l.modality })),
        };
      } else {
        // Clear: deleteMany only
        data.userLevels = {
          deleteMany: {},
        };
      }
    }

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

    // Sincronizar módulos desde perfil (profileId)
    if (input.profileId !== undefined) {
      // Clear existing user modules when profile changes
      await client.userModule.deleteMany({ where: { userId: id } });

      if (input.profileId) {
        const profilePerms = await client.profileModulePermission.findMany({
          where: { profileId: input.profileId },
          include: { module: { select: { code: true } } },
        });

        if (profilePerms.length > 0) {
        const profileAccess = profileToModuleAccess(profilePerms as unknown as ProfilePermissionRow[]);
          const filtered = isRoot
            ? profileAccess
            : filterModuleAccess(profileAccess, creatorModules);

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
      }
    }

    // Sincronizar módulos directos (user_modules)
    if (input.moduleAccess !== undefined) {
      // If profile modules were created, delete them first (manual overrides)
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
        userLevels: true,
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
