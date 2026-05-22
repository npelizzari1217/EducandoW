import { Injectable } from '@nestjs/common';
import {
  ok, err, Result, ValidationError, NotFoundError, InstitutionRepository,
  Institution, Level, LevelType, HexColor, Cue, SmtpConfig, Id,
} from '@educandow/domain';

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
  smtp_host?: string;
  smtp_user?: string;
  smtp_pass?: string;
  smtp_encryption?: string;
  smtp_port?: number;
  send_email?: boolean;
  send_messages?: boolean;
  socket_host?: string;
  socket_port?: number;
  levels: string[];
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
  smtp_host?: string;
  smtp_user?: string;
  smtp_pass?: string;
  smtp_encryption?: string;
  smtp_port?: number;
  send_email?: boolean;
  send_messages?: boolean;
  socket_host?: string;
  socket_port?: number;
  levels?: string[];
}

@Injectable()
export class CreateInstitutionUseCase {
  constructor(private readonly repo: InstitutionRepository) {}

  async execute(input: CreateInstitutionInput): Promise<Result<Institution, ValidationError>> {
    const alreadyExists = await this.repo.existsByName(input.name);
    if (alreadyExists) return err(new ValidationError('Ya existe una institución con ese nombre'));

    if (!input.levels || input.levels.length === 0) {
      return err(new ValidationError('Debe especificar al menos un nivel educativo'));
    }

    // Check CUE uniqueness
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
        encryption: input.smtp_encryption as any,
        port: input.smtp_port,
      });
      if (smtpResult.isErr()) return err(smtpResult.unwrapErr());
    }

    const levels = input.levels.map((l) => Level.reconstruct(l as LevelType));

    // Parse optional HexColor fields
    const headerColor = input.header_color
      ? HexColor.create(input.header_color) as { unwrap(): HexColor } | { isErr(): boolean; unwrapErr(): ValidationError }
      : undefined;
    if (headerColor && 'isErr' in headerColor && headerColor.isErr())
      return err(headerColor.unwrapErr());

    const headerTextColor = input.header_text_color
      ? HexColor.create(input.header_text_color) as { unwrap(): HexColor } | { isErr(): boolean; unwrapErr(): ValidationError }
      : undefined;
    if (headerTextColor && 'isErr' in headerTextColor && headerTextColor.isErr())
      return err(headerTextColor.unwrapErr());

    const bodyTextColor = input.body_text_color
      ? HexColor.create(input.body_text_color) as { unwrap(): HexColor } | { isErr(): boolean; unwrapErr(): ValidationError }
      : undefined;
    if (bodyTextColor && 'isErr' in bodyTextColor && bodyTextColor.isErr())
      return err(bodyTextColor.unwrapErr());

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
      smtpHost: input.smtp_host,
      smtpUser: input.smtp_user,
      smtpPass: input.smtp_pass,
      smtpEncryption: input.smtp_encryption,
      smtpPort: input.smtp_port,
      sendEmail: input.send_email,
      sendMessages: input.send_messages,
      socketHost: input.socket_host,
      socketPort: input.socket_port,
      levels,
    });

    await this.repo.save(institution);
    return ok(institution);
  }
}

@Injectable()
export class ListInstitutionsUseCase {
  constructor(private readonly repo: InstitutionRepository) {}

  async execute(): Promise<Institution[]> {
    return this.repo.findAll();
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

@Injectable()
export class UpdateInstitutionUseCase {
  constructor(private readonly repo: InstitutionRepository) {}

  async execute(id: string, input: UpdateInstitutionInput): Promise<Result<Institution, ValidationError | NotFoundError>> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      return err(new NotFoundError('Institution', id));
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
        encryption: (input.smtp_encryption ?? existing.smtpEncryption) as any,
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

    // Parse levels if provided
    let levels = existing.levels;
    if (input.levels !== undefined) {
      if (!input.levels || input.levels.length === 0) {
        return err(new ValidationError('Debe especificar al menos un nivel educativo'));
      }
      levels = input.levels.map((l: string) => Level.reconstruct(l as LevelType));
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
      smtpHost: input.smtp_host !== undefined ? input.smtp_host : existing.smtpHost,
      smtpUser: input.smtp_user !== undefined ? input.smtp_user : existing.smtpUser,
      smtpPass: input.smtp_pass !== undefined ? input.smtp_pass : existing.smtpPass,
      smtpEncryption: input.smtp_encryption !== undefined ? input.smtp_encryption : existing.smtpEncryption,
      smtpPort: input.smtp_port !== undefined ? input.smtp_port : existing.smtpPort,
      sendEmail: input.send_email !== undefined ? input.send_email : existing.sendEmail,
      sendMessages: input.send_messages !== undefined ? input.send_messages : existing.sendMessages,
      socketHost: input.socket_host !== undefined ? input.socket_host : existing.socketHost,
      socketPort: input.socket_port !== undefined ? input.socket_port : existing.socketPort,
      active: existing.active,
      dbName: existing.dbName,
      levels,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    });

    await this.repo.update(updated);
    return ok(updated);
  }
}
