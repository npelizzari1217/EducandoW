import { Injectable } from '@nestjs/common';
import {
  ok, err, Result, ValidationError, NotFoundError, ForbiddenError,
  InstitutionRepository,
  Institution, Level, HexColor, Cue, SmtpConfig,
  EducationalLevelCode, EducationalModalityCode,
} from '@educandow/domain';
import type { SmtpEncryption } from '@educandow/domain';
import type { PostgresAdminService } from '../../../infrastructure/persistence/postgres-admin.service';
import { CreateInstitutionAdminUseCase } from './create-institution-admin.use-case';

export interface InstitutionLevelInput {
  level: string;
  modality?: string;
}

export interface CreateInstitutionInput {
  name: string;
  cue?: string;
  ministry_reg?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  phone?: string;
  website?: string;
  contact_email?: string;
  logo_url?: string;
  header_color?: string;
  header_text_color?: string;
  body_text_color?: string;
  body_color?: string;
  footer_color?: string;
  footer_text_color?: string;
  smtp_host?: string;
  smtp_user?: string;
  smtp_pass?: string;
  smtp_encryption?: string;
  smtp_port?: number;
  send_email?: boolean;
  send_messages?: boolean;
  socket_host?: string;
  socket_port?: number;
  admin_email?: string;
  institution_levels?: InstitutionLevelInput[];
  // Legacy — still accepted for backward compat
  levels?: string[];
}

export interface CreateInstitutionOutput {
  institution: Institution;
  admin?: {
    email: string;
    password: string;
  };
}

export interface UpdateInstitutionInput {
  name?: string;
  cue?: string;
  ministry_reg?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  phone?: string;
  website?: string;
  contact_email?: string;
  logo_url?: string;
  header_color?: string;
  header_text_color?: string;
  body_text_color?: string;
  body_color?: string;
  footer_color?: string;
  footer_text_color?: string;
  smtp_host?: string;
  smtp_user?: string;
  smtp_pass?: string;
  smtp_encryption?: string;
  smtp_port?: number;
  send_email?: boolean;
  send_messages?: boolean;
  socket_host?: string;
  socket_port?: number;
  active?: boolean;
  institution_levels?: InstitutionLevelInput[];
  // Legacy
  levels?: string[];
}

function parseLevelName(name: string): Level | null {
  const r = Level.create(name);
  return r.isOk() ? r.unwrap() : null;
}

@Injectable()
export class CreateInstitutionUseCase {
  constructor(
    private readonly repo: InstitutionRepository,
    private readonly adminService: PostgresAdminService,
    private readonly adminUseCase: CreateInstitutionAdminUseCase,
  ) {}

  async execute(input: CreateInstitutionInput): Promise<Result<CreateInstitutionOutput, ValidationError>> {
    // ── Step 0: Validation ────────────────────────────────
    const alreadyExists = await this.repo.existsByName(input.name);
    if (alreadyExists) return err(new ValidationError('Ya existe una institución con ese nombre'));

    // Parse levels from new format (institution_levels) or legacy (levels strings)
    const institutionLevels = parseInstitutionLevels(input);
    if (institutionLevels.length === 0) {
      return err(new ValidationError('Debe especificar al menos un nivel educativo'));
    }

    // Check CUE uniqueness (BEFORE any DB work)
    if (input.cue) {
      const existingByCue = await this.repo.findByCue(input.cue);
      if (existingByCue) {
        return err(new ValidationError('Ya existe una institución con ese CUE'));
      }
    }

    // Validate SMTP config if any SMTP field is provided
    if (input.smtp_host || input.smtp_user || input.smtp_encryption || input.smtp_port !== undefined) {
      const smtpResult = SmtpConfig.create({
        host: input.smtp_host,
        user: input.smtp_user,
        pass: input.smtp_pass,
        encryption: input.smtp_encryption as SmtpEncryption,
        port: input.smtp_port,
      });
      if (smtpResult.isErr()) return err(smtpResult.unwrapErr());
    }

    // Parse optional HexColor fields
    const headerColor = input.header_color ? HexColor.create(input.header_color) : undefined;
    if (headerColor?.isErr()) return err(headerColor.unwrapErr());
    const headerTextColor = input.header_text_color ? HexColor.create(input.header_text_color) : undefined;
    if (headerTextColor?.isErr()) return err(headerTextColor.unwrapErr());
    const bodyTextColor = input.body_text_color ? HexColor.create(input.body_text_color) : undefined;
    if (bodyTextColor?.isErr()) return err(bodyTextColor.unwrapErr());
    const bodyColor = input.body_color ? HexColor.create(input.body_color) : undefined;
    if (bodyColor?.isErr()) return err(bodyColor.unwrapErr());
    const footerColor = input.footer_color ? HexColor.create(input.footer_color) : undefined;
    if (footerColor?.isErr()) return err(footerColor.unwrapErr());
    const footerTextColor = input.footer_text_color ? HexColor.create(input.footer_text_color) : undefined;
    if (footerTextColor?.isErr()) return err(footerTextColor.unwrapErr());

    // Parse optional Cue
    const cue = input.cue
      ? Cue.create(input.cue) as { unwrap(): Cue } | { isErr(): boolean; unwrapErr(): ValidationError }
      : undefined;
    if (cue && 'isErr' in cue && cue.isErr())
      return err(cue.unwrapErr());

    const institution = Institution.create({
      name: input.name,
      cue: cue ? (cue as { unwrap(): Cue }).unwrap() : undefined,
      ministryReg: input.ministry_reg,
      address: input.address,
      city: input.city,
      postalCode: input.postal_code,
      country: input.country,
      phone: input.phone,
      website: input.website,
      contactEmail: input.contact_email || undefined,
      logoUrl: input.logo_url,
      headerColor: headerColor ? (headerColor as { unwrap(): HexColor }).unwrap() : undefined,
      headerTextColor: headerTextColor ? (headerTextColor as { unwrap(): HexColor }).unwrap() : undefined,
      bodyTextColor: bodyTextColor ? (bodyTextColor as { unwrap(): HexColor }).unwrap() : undefined,
      bodyColor: bodyColor ? (bodyColor as { unwrap(): HexColor }).unwrap() : undefined,
      footerColor: footerColor ? (footerColor as { unwrap(): HexColor }).unwrap() : undefined,
      footerTextColor: footerTextColor ? (footerTextColor as { unwrap(): HexColor }).unwrap() : undefined,
      smtpHost: input.smtp_host,
      smtpUser: input.smtp_user,
      smtpPass: input.smtp_pass,
      smtpEncryption: input.smtp_encryption,
      smtpPort: input.smtp_port,
      sendEmail: input.send_email,
      sendMessages: input.send_messages,
      socketHost: input.socket_host,
      socketPort: input.socket_port,
      institutionLevels,
    });

    const instId = institution.id.get();
    const dbName = institution.dbName ?? `educandow_${instId}`;

    // ── Step 1: Save master record ──────────────────────
    let masterSaved = false;
    let dbCreated = false;
    const dbNameActual = dbName;

    try {
      await this.repo.save(institution);
      masterSaved = true;

      // ── Step 2: Create tenant database ────────────────
      await this.adminService.createDatabase(dbNameActual);
      dbCreated = true;

      // ── Step 3: Run tenant migrations ─────────────────
      await this.adminService.runTenantMigrations(dbNameActual);

      // ── Step 4: Create admin user (if email provided) ─
      let adminResult: { email: string; password: string } | undefined;
      if (input.admin_email) {
        adminResult = await this.adminUseCase.execute({
          adminEmail: input.admin_email,
          dbName: dbNameActual,
          institutionId: instId,
        });
      }

      return ok({
        institution,
        admin: adminResult,
      });
    } catch (error: unknown) {
      const caughtErr = error as { message?: string };
      // ── Rollback ──────────────────────────────────────
      // Step 3 rollback: drop tenant DB
      if (dbCreated) {
        await this.adminService.dropDatabase(dbNameActual).catch(() => {});
      }
      // Step 2 rollback: delete master record
      if (masterSaved) {
        await this.repo.delete(instId).catch(() => {});
      }
      // Admin user is in master DB, deleted alongside institution record

      return err(new ValidationError(
        `Error al crear la institución: ${caughtErr?.message ?? 'Error desconocido'}`,
      ));
    }
  }
}

@Injectable()
export class ListInstitutionsUseCase {
  constructor(private readonly repo: InstitutionRepository) {}

  async execute(tenantId?: string, active?: boolean): Promise<Institution[]> {
    const all = await this.repo.findAll(active);
    if (tenantId) {
      return all.filter((inst) => inst.id.get() === tenantId);
    }
    return all;
  }
}

@Injectable()
export class GetInstitutionUseCase {
  constructor(private readonly repo: InstitutionRepository) {}

  async execute(id: string): Promise<Institution | null> {
    return this.repo.findById(id);
  }
}

@Injectable()
export class DeleteInstitutionUseCase {
  constructor(private readonly repo: InstitutionRepository) {}

  async execute(id: string): Promise<Result<void, NotFoundError>> {
    const existing = await this.repo.findById(id);
    if (!existing) return err(new NotFoundError('Institution', id));
    await this.repo.softDelete(id);
    return ok(undefined);
  }
}

@Injectable()
export class GetMeUseCase {
  constructor(private readonly repo: InstitutionRepository) {}

  async execute(institutionId: string | null | undefined): Promise<Result<Institution, NotFoundError>> {
    if (!institutionId) {
      return err(new NotFoundError('Institution', 'null'));
    }
    const institution = await this.repo.findById(institutionId);
    if (!institution) {
      return err(new NotFoundError('Institution', institutionId));
    }
    return ok(institution);
  }
}

export interface PrintData {
  id: string;
  name: string;
  active: boolean;
  db_name: string | null;
  printed_at: Date;
  printed_by: string;
}

@Injectable()
export class PrintInstitutionUseCase {
  constructor(private readonly repo: InstitutionRepository) {}

  async execute(id: string): Promise<Result<PrintData, NotFoundError>> {
    const institution = await this.repo.findById(id);
    if (!institution) {
      return err(new NotFoundError('Institution', id));
    }
    return ok({
      id: institution.id.get(),
      name: institution.name,
      active: institution.active ?? true,
      db_name: institution.dbName ?? null,
      printed_at: new Date(),
      printed_by: 'system',
    });
  }
}

@Injectable()
export class UpdateInstitutionUseCase {
  constructor(private readonly repo: InstitutionRepository) {}

  async execute(
    id: string,
    input: UpdateInstitutionInput,
    caller?: { institutionId?: string; isRoot: boolean },
  ): Promise<Result<Institution, ValidationError | NotFoundError | ForbiddenError>> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      return err(new NotFoundError('Institution', id));
    }

    // Authorization: admin can only edit own institution
    if (caller && !caller.isRoot && caller.institutionId !== id) {
      return err(new ForbiddenError('No tenés permiso para modificar esta institución'));
    }

    // Authorization: only ROOT can change active
    if (caller && !caller.isRoot && input.active !== undefined) {
      return err(new ForbiddenError('Solo ROOT puede activar o desactivar una institución'));
    }

    // Authorization: ADMIN cannot change cue
    if (caller && !caller.isRoot && input.cue !== undefined) {
      return err(new ForbiddenError('Solo ROOT puede modificar el CUE de una institución'));
    }

    // Check CUE uniqueness if being changed
    if (input.cue !== undefined && input.cue !== existing.cue?.get()) {
      if (input.cue) {
        const conflict = await this.repo.findByCue(input.cue);
        if (conflict && conflict.id.get() !== id) {
          return err(new ValidationError('Ya existe una institución con ese CUE'));
        }
      }
    }

    // Validate SMTP config if any SMTP field is provided
    const hasSmtpChanges = input.smtp_host !== undefined || input.smtp_user !== undefined ||
      input.smtp_encryption !== undefined || input.smtp_port !== undefined;
    if (hasSmtpChanges) {
      const smtpResult = SmtpConfig.create({
        host: input.smtp_host ?? existing.smtpHost,
        user: input.smtp_user ?? existing.smtpUser,
        pass: input.smtp_pass ?? existing.smtpPass,
        encryption: (input.smtp_encryption ?? existing.smtpEncryption) as SmtpEncryption,
        port: input.smtp_port ?? existing.smtpPort,
      });
      if (smtpResult.isErr()) return err(smtpResult.unwrapErr());
    }

    // Parse optional HexColor fields
    let headerColor = existing.headerColor;
    if (input.header_color !== undefined) {
      const result = HexColor.create(input.header_color);
      if (result.isErr()) return err(result.unwrapErr());
      headerColor = result.unwrap();
    }

    let headerTextColor = existing.headerTextColor;
    if (input.header_text_color !== undefined) {
      const result = HexColor.create(input.header_text_color);
      if (result.isErr()) return err(result.unwrapErr());
      headerTextColor = result.unwrap();
    }

    let bodyTextColor = existing.bodyTextColor;
    if (input.body_text_color !== undefined) {
      const result = HexColor.create(input.body_text_color);
      if (result.isErr()) return err(result.unwrapErr());
      bodyTextColor = result.unwrap();
    }

    let bodyColor = existing.bodyColor;
    if (input.body_color !== undefined) {
      const result = HexColor.create(input.body_color);
      if (result.isErr()) return err(result.unwrapErr());
      bodyColor = result.unwrap();
    }

    let footerColor = existing.footerColor;
    if (input.footer_color !== undefined) {
      const result = HexColor.create(input.footer_color);
      if (result.isErr()) return err(result.unwrapErr());
      footerColor = result.unwrap();
    }

    let footerTextColor = existing.footerTextColor;
    if (input.footer_text_color !== undefined) {
      const result = HexColor.create(input.footer_text_color);
      if (result.isErr()) return err(result.unwrapErr());
      footerTextColor = result.unwrap();
    }

    // Parse optional Cue
    let cue = existing.cue;
    if (input.cue !== undefined) {
      if (input.cue === '' || input.cue === null) {
        cue = undefined;
      } else {
        const result = Cue.create(input.cue);
        if (result.isErr()) return err(result.unwrapErr());
        cue = result.unwrap();
      }
    }

    // Parse levels from new format or legacy
    let institutionLevels = existing.institutionLevels;
    if (input.institution_levels !== undefined || input.levels !== undefined) {
      const parsed = parseInstitutionLevels(input);
      if (parsed.length === 0) {
        return err(new ValidationError('Debe especificar al menos un nivel educativo'));
      }
      institutionLevels = parsed;
    }

    // Reconstruct with merged properties
    const updated = Institution.reconstruct({
      id: existing.id,
      name: input.name ?? existing.name,
      cue: cue,
      ministryReg: input.ministry_reg !== undefined ? input.ministry_reg : existing.ministryReg,
      address: input.address !== undefined ? input.address : existing.address,
      city: input.city !== undefined ? input.city : existing.city,
      postalCode: input.postal_code !== undefined ? input.postal_code : existing.postalCode,
      country: input.country !== undefined ? input.country : existing.country,
      phone: input.phone !== undefined ? input.phone : existing.phone,
      website: input.website !== undefined ? input.website : existing.website,
      contactEmail: input.contact_email !== undefined ? input.contact_email : existing.contactEmail,
      logoUrl: input.logo_url !== undefined ? input.logo_url : existing.logoUrl,
      headerColor,
      headerTextColor,
      bodyTextColor,
      bodyColor,
      footerColor,
      footerTextColor,
      smtpHost: input.smtp_host !== undefined ? input.smtp_host : existing.smtpHost,
      smtpUser: input.smtp_user !== undefined ? input.smtp_user : existing.smtpUser,
      smtpPass: input.smtp_pass !== undefined ? input.smtp_pass : existing.smtpPass,
      smtpEncryption: input.smtp_encryption !== undefined ? input.smtp_encryption : existing.smtpEncryption,
      smtpPort: input.smtp_port !== undefined ? input.smtp_port : existing.smtpPort,
      sendEmail: input.send_email !== undefined ? input.send_email : existing.sendEmail,
      sendMessages: input.send_messages !== undefined ? input.send_messages : existing.sendMessages,
      socketHost: input.socket_host !== undefined ? input.socket_host : existing.socketHost,
      socketPort: input.socket_port !== undefined ? input.socket_port : existing.socketPort,
      active: input.active !== undefined ? input.active : existing.active,
      dbName: existing.dbName,
      institutionLevels,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    });

    await this.repo.update(updated);
    return ok(updated);
  }
}

// ── Helpers ────────────────────────────────────────────────

function parseInstitutionLevels(
  input: CreateInstitutionInput | UpdateInstitutionInput,
): { level: EducationalLevelCode; modality: EducationalModalityCode }[] {
  // New format: institution_levels: [{level, modality?}]
  if (input.institution_levels && input.institution_levels.length > 0) {
    return input.institution_levels.map((il) => {
      const lvl = parseLevelCode(il.level);
      const mod = parseModalityCode(il.modality ?? 'COMUN');
      return { level: lvl, modality: mod };
    });
  }

  // Legacy format: levels: ["INICIAL", "PRIMARIO"]
  if (input.levels && input.levels.length > 0) {
    return input.levels.map((name) => {
      const parsed = parseLevelName(name);
      if (!parsed) {
        throw new ValidationError(`Invalid level name: "${name}"`);
      }
      return { level: parsed.levelCode, modality: parsed.modalityCode };
    });
  }

  return [];
}

function parseLevelCode(value: string): EducationalLevelCode {
  const n = parseInt(value, 10);
  if (!isNaN(n) && n >= 1 && n <= 9) return n as EducationalLevelCode;
  // Try name
  const upper = value.toUpperCase().trim();
  const codes: Record<string, EducationalLevelCode> = {
    INICIAL: EducationalLevelCode.INICIAL,
    PRIMARIO: EducationalLevelCode.PRIMARIO,
    SECUNDARIO: EducationalLevelCode.SECUNDARIO,
    TERCIARIO: EducationalLevelCode.TERCIARIO,
    ADMINISTRACION: EducationalLevelCode.ADMINISTRACION,
  };
  if (codes[upper]) return codes[upper];
  throw new ValidationError(`Invalid level code: "${value}"`);
}

function parseModalityCode(value: string): EducationalModalityCode {
  const n = parseInt(value, 10);
  if (!isNaN(n) && n >= 0 && n <= 9) return n as EducationalModalityCode;
  const upper = value.toUpperCase().trim();
  const codes: Record<string, EducationalModalityCode> = {
    COMUN: EducationalModalityCode.COMUN,
    TALLERES: EducationalModalityCode.TALLERES,
    BILINGÜISMO: EducationalModalityCode.BILINGÜISMO,
    TODOS: EducationalModalityCode.TODOS,
  };
  if (codes[upper]) return codes[upper];
  return EducationalModalityCode.COMUN;
}
