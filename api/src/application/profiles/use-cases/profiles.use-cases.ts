import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

// ── Types ────────────────────────────────────────────────

export interface ProfilePermissionRow {
  module: { code: string };
  canRead: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canPrint: boolean;
}

export interface ModuleAccessItem {
  moduleCode: string;
  actions: string[];
}

// ── profileToModuleAccess ────────────────────────────────

/**
 * Converts ProfileModulePermission rows (booleans) into ModuleAccessItem[]
 * (String[] actions). Rows where ALL booleans are false are excluded.
 */
export function profileToModuleAccess(
  permissions: ProfilePermissionRow[],
): ModuleAccessItem[] {
  const ACTION_MAP: Record<string, string[]> = {
    canRead: ['READ'],
    canCreate: ['CREATE'],
    canEdit: ['UPDATE'],
    canDelete: ['DELETE'],
    canPrint: ['PRINT'],
  };

  return permissions
    .filter((p) => Object.keys(ACTION_MAP).some((k) => (p as any)[k]))
    .map((p) => ({
      moduleCode: p.module.code,
      actions: Object.entries(ACTION_MAP)
        .filter(([k]) => (p as any)[k])
        .flatMap(([, v]) => v),
    }));
}

// ── List ─────────────────────────────────────────────────

@Injectable()
export class ListProfilesUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute() {
    const client = this.prisma.getMasterClient();
    const records = await client.profile.findMany({
      where: { active: true },
      include: { _count: { select: { permissions: true } } },
      orderBy: { name: 'asc' },
    });
    return { data: records };
  }
}

// ── Get ──────────────────────────────────────────────────

@Injectable()
export class GetProfileUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(id: string) {
    const client = this.prisma.getMasterClient();
    const record = await client.profile.findUnique({
      where: { id },
      include: {
        permissions: {
          include: { module: { select: { id: true, code: true, name: true } } },
        },
      },
    });
    if (!record) return { data: null };
    return { data: record };
  }
}

// ── Create ───────────────────────────────────────────────

@Injectable()
export class CreateProfileUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(name: string) {
    const client = this.prisma.getMasterClient();
    const record = await client.profile.create({
      data: { name },
    });
    return { data: record };
  }
}

// ── Update ───────────────────────────────────────────────

@Injectable()
export class UpdateProfileUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(id: string, name: string) {
    const client = this.prisma.getMasterClient();
    const record = await client.profile.update({
      where: { id },
      data: { name },
    });
    return { data: record };
  }
}

// ── Delete ───────────────────────────────────────────────

@Injectable()
export class DeleteProfileUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(id: string): Promise<boolean> {
    const client = this.prisma.getMasterClient();
    const existing = await client.profile.findUnique({ where: { id } });
    if (!existing) return false;

    await client.profile.update({
      where: { id },
      data: { active: false, deletedAt: new Date() },
    });
    return true;
  }
}

// ── Get Permissions ──────────────────────────────────────

@Injectable()
export class GetProfilePermissionsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(profileId: string) {
    const client = this.prisma.getMasterClient();

    // Fetch ALL active modules
    const allModules = await client.module.findMany({
      where: { active: true, deletedAt: null },
      orderBy: { name: 'asc' },
    });

    // Fetch existing permissions for this profile
    const existingPermissions = await client.profileModulePermission.findMany({
      where: { profileId },
    });

    // Build map of moduleId → permission
    const permMap = new Map(existingPermissions.map((p) => [p.moduleId, p]));

    // Build result: for every module, return booleans (default false)
    const permissions = allModules.map((mod) => {
      const perm = permMap.get(mod.id);
      return {
        moduleId: mod.id,
        moduleCode: mod.code,
        moduleName: mod.name,
        canRead: perm?.canRead ?? false,
        canCreate: perm?.canCreate ?? false,
        canEdit: perm?.canEdit ?? false,
        canDelete: perm?.canDelete ?? false,
        canPrint: perm?.canPrint ?? false,
      };
    });

    return { data: permissions };
  }
}

// ── Update Permissions ───────────────────────────────────

@Injectable()
export class UpsertPermissionsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    profileId: string,
    permissions: {
      moduleId: string;
      canRead: boolean;
      canCreate: boolean;
      canEdit: boolean;
      canDelete: boolean;
      canPrint: boolean;
    }[],
  ) {
    const client = this.prisma.getMasterClient();

    await client.$transaction(async (tx) => {
      // Delete all existing permissions for this profile
      await tx.profileModulePermission.deleteMany({
        where: { profileId },
      });

      // Create new permissions (only for rows with at least one true boolean)
      const toCreate = permissions.filter(
        (p) => p.canRead || p.canCreate || p.canEdit || p.canDelete || p.canPrint,
      );

      if (toCreate.length > 0) {
        await tx.profileModulePermission.createMany({
          data: toCreate.map((p) => ({
            profileId,
            moduleId: p.moduleId,
            canRead: p.canRead,
            canCreate: p.canCreate,
            canEdit: p.canEdit,
            canDelete: p.canDelete,
            canPrint: p.canPrint,
          })),
        });
      }
    });

    return { success: true };
  }
}
