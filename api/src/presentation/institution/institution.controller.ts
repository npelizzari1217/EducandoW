import {
  Controller, Get, Post, Patch, Delete, Body, Param, Req, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import { CreateInstitutionSchema, CreateInstitutionDTO } from './dto/create-institution.dto';
import { UpdateInstitutionSchema, UpdateInstitutionDTO } from './dto/update-institution.dto';
import {
  CreateInstitutionUseCase, ListInstitutionsUseCase, GetInstitutionUseCase,
  DeleteInstitutionUseCase, GetMeUseCase, UpdateInstitutionUseCase,
} from '../../application/institution/use-cases/institution.use-cases';
import type { Institution } from '@educandow/domain';

function toResponse(inst: Institution) {
  return {
    id: inst.id.get(),
    name: inst.name,
    cue: inst.cue?.get() ?? null,
    ministry_reg: inst.ministryReg ?? null,
    address: inst.address ?? null,
    city: inst.city ?? null,
    postal_code: inst.postalCode ?? null,
    country: inst.country ?? null,
    phone: inst.phone ?? null,
    website: inst.website ?? null,
    contact_email: inst.contactEmail ?? null,
    logo_url: inst.logoUrl ?? null,
    header_color: inst.headerColor?.get() ?? null,
    header_text_color: inst.headerTextColor?.get() ?? null,
    body_text_color: inst.bodyTextColor?.get() ?? null,
    smtp_host: inst.smtpHost ?? null,
    smtp_user: inst.smtpUser ?? null,
    smtp_encryption: inst.smtpEncryption ?? null,
    smtp_port: inst.smtpPort ?? null,
    send_email: inst.sendEmail ?? false,
    send_messages: inst.sendMessages ?? false,
    socket_host: inst.socketHost ?? null,
    socket_port: inst.socketPort ?? null,
    active: inst.active ?? true,
    db_name: inst.dbName ?? null,
    levels: inst.levels.map((l) => l.toCode()),
    created_at: inst.createdAt?.toISOString() ?? null,
    updated_at: inst.updatedAt?.toISOString() ?? null,
  };
}

@Controller('institutions')
@UseGuards(AuthGuard, RolesGuard)
export class InstitutionController {
  constructor(
    private readonly createUC: CreateInstitutionUseCase,
    private readonly listUC: ListInstitutionsUseCase,
    private readonly getUC: GetInstitutionUseCase,
    private readonly deleteUC: DeleteInstitutionUseCase,
    private readonly getMeUC: GetMeUseCase,
    private readonly updateUC: UpdateInstitutionUseCase,
  ) {}

  @Post()
  @Roles('ROOT')
  async create(@Body(new ZodValidationPipe(CreateInstitutionSchema)) body: CreateInstitutionDTO) {
    const result = await this.createUC.execute(body);
    if (result.isErr()) throw result.unwrapErr();
    return { data: toResponse(result.unwrap()) };
  }

  @Get('me')
  async me(@Req() req: Request) {
    const user = (req as any).user;
    const institutionId = user?.institutionId ?? null;
    const result = await this.getMeUC.execute(institutionId);
    if (result.isErr()) throw result.unwrapErr();
    return { data: toResponse(result.unwrap()) };
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'TEACHER')
  async list() {
    const institutions = await this.listUC.execute();
    return { data: institutions.map((i) => toResponse(i)) };
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'TEACHER')
  async get(@Param('id') id: string) {
    const inst = await this.getUC.execute(id);
    if (!inst) return { data: null };
    return { data: toResponse(inst) };
  }

  @Get(':id/levels')
  @Roles('ADMIN', 'MANAGER', 'TEACHER')
  async getLevels(@Param('id') id: string) {
    const inst = await this.getUC.execute(id);
    if (!inst) return { data: [] };
    const currentYear = new Date().getFullYear().toString();
    return { data: inst.levels.map((l) => ({ level: l.toString(), active: true, academicYear: currentYear })) };
  }

  @Patch(':id')
  @Roles('ROOT')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateInstitutionSchema)) body: UpdateInstitutionDTO,
  ) {
    const result = await this.updateUC.execute(id, body);
    if (result.isErr()) throw result.unwrapErr();
    return { data: toResponse(result.unwrap()) };
  }

  @Delete(':id')
  @Roles('ROOT')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    const result = await this.deleteUC.execute(id);
    if (result.isErr()) throw result.unwrapErr();
    return;
  }
}
