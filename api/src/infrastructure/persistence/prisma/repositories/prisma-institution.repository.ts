import { Injectable } from '@nestjs/common';
import {
  InstitutionRepository, Institution, Id, HexColor, Cue,
  EducationalLevelCode, EducationalModalityCode,
} from '@educandow/domain';
import type {
  PrismaClient as MasterPrismaClient,
  Institution as PrismaInstitution,
  InstitutionLevel as PrismaInstitutionLevel,
} from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { EncryptionService } from '../../../crypto/encryption.service';

interface PrismaInstitutionWithLevels extends PrismaInstitution {
  levels?: PrismaInstitutionLevel[];
}

@Injectable()
export class PrismaInstitutionRepository implements InstitutionRepository {
  private readonly client: MasterPrismaClient;

  constructor(prismaService: PrismaService) {
    this.client = prismaService.getMasterClient();
  }

  // ── Encryption helpers ───────────────────────────────────

  private getEncryptionKey(): Buffer | null {
    const key = process.env.ENCRYPTION_KEY;
    if (!key || Buffer.byteLength(key, 'utf8') !== 32) return null;
    return Buffer.from(key, 'utf8');
  }

  private encryptSmtpPass(plaintext: string | undefined): string | null {
    if (plaintext === undefined || plaintext === null) return null;
    const key = this.getEncryptionKey();
    if (!key) return plaintext;
    return EncryptionService.encrypt(plaintext, key);
  }

  private decryptSmtpPass(ciphertext: string | undefined | null): string | undefined {
    if (ciphertext === undefined || ciphertext === null) return undefined;
    const key = this.getEncryptionKey();
    if (!key) return ciphertext;
    try {
      return EncryptionService.decrypt(ciphertext, key);
    } catch {
      return ciphertext;
    }
  }

  async findById(id: string): Promise<Institution | null> {
    const record = await this.client.institution.findUnique({
      where: { id },
      include: { levels: true },
    });
    return record ? this.toDomain(record) : null;
  }

  async findAll(): Promise<Institution[]> {
    const records = await this.client.institution.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      include: { levels: true },
    });
    return records.map((r) => this.toDomain(r));
  }

  async findByCue(cue: string): Promise<Institution | null> {
    const record = await this.client.institution.findUnique({
      where: { cue },
      include: { levels: true },
    });
    return record ? this.toDomain(record) : null;
  }

  async findByDbName(dbName: string): Promise<Institution | null> {
    const record = await this.client.institution.findUnique({
      where: { dbName },
      include: { levels: true },
    });
    return record ? this.toDomain(record) : null;
  }

  async save(institution: Institution): Promise<void> {
    // Delete existing levels, then recreate
    await this.client.institutionLevel.deleteMany({
      where: { institutionId: institution.id.get() },
    });

    await this.client.institution.upsert({
      where: { id: institution.id.get() },
      create: {
        ...this.toPrismaCreate(institution),
        levels: {
          create: institution.institutionLevels.map((l) => ({
            level: l.level,
            modality: l.modality,
          })),
        },
      },
      update: {
        ...this.toPrismaUpdate(institution),
        levels: {
          deleteMany: {},
          create: institution.institutionLevels.map((l) => ({
            level: l.level,
            modality: l.modality,
          })),
        },
      },
    });
  }

  async update(institution: Institution): Promise<void> {
    // Delete existing levels, then recreate
    await this.client.institutionLevel.deleteMany({
      where: { institutionId: institution.id.get() },
    });

    await this.client.institution.update({
      where: { id: institution.id.get() },
      data: {
        ...this.toPrismaUpdate(institution),
        levels: {
          create: institution.institutionLevels.map((l) => ({
            level: l.level,
            modality: l.modality,
          })),
        },
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.client.institution.delete({ where: { id } }).catch(() => {});
  }

  async softDelete(id: string): Promise<void> {
    await this.client.institution.update({
      where: { id },
      data: { active: false },
    });
  }

  async existsByName(name: string): Promise<boolean> {
    const found = await this.client.institution.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
    return !!found;
  }

  // ── Mappers ─────────────────────────────────────────────

  private toDomain(record: PrismaInstitutionWithLevels): Institution {
    return Institution.reconstruct({
      id: Id.reconstruct(record.id),
      name: record.name,
      cue: record.cue ? Cue.reconstruct(record.cue) : undefined,
      ministryReg: record.ministryReg ?? undefined,
      address: record.address ?? undefined,
      city: record.city ?? undefined,
      postalCode: record.postalCode ?? undefined,
      country: record.country ?? undefined,
      phone: record.phone ?? undefined,
      website: record.website ?? undefined,
      contactEmail: record.contactEmail ?? undefined,
      logoUrl: record.logoUrl ?? undefined,
      headerColor: record.headerColor ? HexColor.reconstruct(record.headerColor) : undefined,
      headerTextColor: record.headerTextColor ? HexColor.reconstruct(record.headerTextColor) : undefined,
      bodyTextColor: record.bodyTextColor ? HexColor.reconstruct(record.bodyTextColor) : undefined,
      smtpHost: record.smtpHost ?? undefined,
      smtpUser: record.smtpUser ?? undefined,
      smtpPass: this.decryptSmtpPass(record.smtpPass),
      smtpEncryption: record.smtpEncryption ?? undefined,
      smtpPort: record.smtpPort ?? undefined,
      sendEmail: record.sendEmail,
      sendMessages: record.sendMessages,
      socketHost: record.socketHost ?? undefined,
      socketPort: record.socketPort ?? undefined,
      active: record.active,
      deletedAt: record.deletedAt ?? undefined,
      dbName: record.dbName,
      institutionLevels: (record.levels ?? []).map((l: PrismaInstitutionLevel) => ({
        level: l.level as EducationalLevelCode,
        modality: l.modality as EducationalModalityCode,
      })),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  private toPrismaCreate(institution: Institution) {
    return {
      id: institution.id.get(),
      name: institution.name,
      cue: institution.cue?.get(),
      ministryReg: institution.ministryReg,
      address: institution.address,
      city: institution.city,
      postalCode: institution.postalCode,
      country: institution.country,
      phone: institution.phone,
      website: institution.website,
      contactEmail: institution.contactEmail,
      logoUrl: institution.logoUrl,
      headerColor: institution.headerColor?.get(),
      headerTextColor: institution.headerTextColor?.get(),
      bodyTextColor: institution.bodyTextColor?.get(),
      smtpHost: institution.smtpHost,
      smtpUser: institution.smtpUser,
      smtpPass: this.encryptSmtpPass(institution.smtpPass),
      smtpEncryption: institution.smtpEncryption,
      smtpPort: institution.smtpPort,
      sendEmail: institution.sendEmail,
      sendMessages: institution.sendMessages,
      socketHost: institution.socketHost,
      socketPort: institution.socketPort,
      active: institution.active ?? true,
      dbName: institution.dbName ?? `educandow_${institution.id.get()}`,
    };
  }

  private toPrismaUpdate(institution: Institution) {
    return {
      name: institution.name,
      cue: institution.cue?.get(),
      ministryReg: institution.ministryReg,
      address: institution.address,
      city: institution.city,
      postalCode: institution.postalCode,
      country: institution.country,
      phone: institution.phone,
      website: institution.website,
      contactEmail: institution.contactEmail,
      logoUrl: institution.logoUrl,
      headerColor: institution.headerColor?.get(),
      headerTextColor: institution.headerTextColor?.get(),
      bodyTextColor: institution.bodyTextColor?.get(),
      smtpHost: institution.smtpHost,
      smtpUser: institution.smtpUser,
      smtpPass: this.encryptSmtpPass(institution.smtpPass),
      smtpEncryption: institution.smtpEncryption,
      smtpPort: institution.smtpPort,
      sendEmail: institution.sendEmail,
      sendMessages: institution.sendMessages,
      socketHost: institution.socketHost,
      socketPort: institution.socketPort,
      active: institution.active ?? true,
      dbName: institution.dbName ?? `educandow_${institution.id.get()}`,
    };
  }
}
