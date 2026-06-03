import {
  Controller, Get, Post, Patch, Delete, Body, Param, Req, HttpCode, HttpStatus, UseGuards,
  UseInterceptors, UploadedFile, Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { AuthenticatedRequest } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import { CreateInstitutionSchema, CreateInstitutionDTO } from './dto/create-institution.dto';
import type { CreateInstitutionInput } from '../../application/institution/use-cases/institution.use-cases';
import { UpdateInstitutionSchema, UpdateInstitutionDTO } from './dto/update-institution.dto';
import {
  CreateInstitutionUseCase, ListInstitutionsUseCase, GetInstitutionUseCase,
  DeleteInstitutionUseCase, GetMeUseCase, UpdateInstitutionUseCase,
  PrintInstitutionUseCase,
} from '../../application/institution/use-cases/institution.use-cases';
import type { Institution } from '@educandow/domain';
import type { FileStoragePort } from '../../application/shared/ports/file-storage.port';
import { LocalDiskStorageAdapter } from '../../infrastructure/file-storage/local-disk-storage.adapter';

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
    body_color: inst.bodyColor?.get() ?? null,
    footer_color: inst.footerColor?.get() ?? null,
    footer_text_color: inst.footerTextColor?.get() ?? null,
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
    institution_levels: inst.institutionLevels.map((il) => ({
      level: il.level,
      modality: il.modality,
    })),
    created_at: inst.createdAt?.toISOString() ?? null,
    updated_at: inst.updatedAt?.toISOString() ?? null,
  };
}

@Controller('institutions')
@UseGuards(AuthGuard, RolesGuard)
export class InstitutionController {
  private readonly fileStorage: FileStoragePort;

  constructor(
    private readonly createUC: CreateInstitutionUseCase,
    private readonly listUC: ListInstitutionsUseCase,
    private readonly getUC: GetInstitutionUseCase,
    private readonly deleteUC: DeleteInstitutionUseCase,
    private readonly getMeUC: GetMeUseCase,
    private readonly updateUC: UpdateInstitutionUseCase,
    private readonly printUC: PrintInstitutionUseCase,
  ) {
    this.fileStorage = new LocalDiskStorageAdapter();
  }

  @Post()
  @Roles('ROOT', { module: 'INSTITUTIONS', action: 'CREATE' })
  async create(@Body(new ZodValidationPipe(CreateInstitutionSchema)) body: CreateInstitutionDTO) {
    const result = await this.createUC.execute(body as unknown as CreateInstitutionInput);
    if (result.isErr()) throw result.unwrapErr();
    const output = result.unwrap();
    return {
      data: {
        ...toResponse(output.institution),
        admin: output.admin ?? undefined,
      },
    };
  }

  @Get('me')
  async me(@Req() req: Request) {
    const user = (req as AuthenticatedRequest).user;
    const institutionId = user?.institutionId ?? null;
    if (!institutionId) {
      return { data: null, reason: 'no_institution' };
    }
    const result = await this.getMeUC.execute(institutionId);
    if (result.isErr()) throw result.unwrapErr();
    return { data: toResponse(result.unwrap()) };
  }

  @Get()
  @Roles('ROOT', { module: 'INSTITUTIONS', action: 'READ' })
  async list(
    @Req() req: Request,
    @Query('active') active?: string,
  ) {
    const user = (req as AuthenticatedRequest).user;
    const isRoot = user?.roles?.includes('ROOT');
    const tenantId = isRoot ? undefined : user?.institutionId ?? undefined;

    // Parse active query param: "true" → true, "false" → false, undefined → undefined
    let activeFilter: boolean | undefined;
    if (active === 'true') activeFilter = true;
    else if (active === 'false') activeFilter = false;

    const institutions = await this.listUC.execute(tenantId, activeFilter);
    return { data: institutions.map((i) => toResponse(i)) };
  }

  @Get(':id')
  @Roles('ROOT', { module: 'INSTITUTIONS', action: 'READ' })
  async get(@Param('id') id: string) {
    const inst = await this.getUC.execute(id);
    if (!inst) return { data: null };
    return { data: toResponse(inst) };
  }

  @Get(':id/levels')
  @Roles('ROOT', { module: 'INSTITUTIONS', action: 'READ' })
  async getLevels(@Param('id') id: string) {
    const inst = await this.getUC.execute(id);
    if (!inst) return { data: [] };
    const currentYear = new Date().getFullYear().toString();
    return { data: inst.levels.map((l) => ({ level: l.toString(), active: true, academicYear: currentYear })) };
  }

  @Get(':id/print')
  @Roles('ROOT', { module: 'INSTITUTIONS', action: 'PRINT' })
  async print(@Param('id') id: string) {
    const result = await this.printUC.execute(id);
    if (result.isErr()) throw result.unwrapErr();
    const data = result.unwrap();
    return { data };
  }

  @Patch(':id')
  @Roles('ROOT', { module: 'INSTITUTIONS', action: 'UPDATE' })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateInstitutionSchema)) body: UpdateInstitutionDTO,
    @Req() req: Request,
  ) {
    const user = (req as AuthenticatedRequest).user;
    const caller = {
      institutionId: user?.institutionId ?? undefined,
      isRoot: user?.roles?.includes('ROOT') ?? false,
    };
    const result = await this.updateUC.execute(id, body, caller);
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

  @Post(':id/logo')
  @Roles('ROOT', { module: 'INSTITUTIONS', action: 'UPDATE' })
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (_req, file, cb) => {
      const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
      if (allowed.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Solo se permiten imágenes PNG, JPG, WebP o SVG'), false);
      }
    },
  }))
  async uploadLogo(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new Error('No se recibió ningún archivo');

    // Verificar que la institución existe
    const inst = await this.getUC.execute(id);
    if (!inst) throw new Error('Institución no encontrada');

    // Guardar archivo — reemplaza si ya existe
    const stored = await this.fileStorage.store('institutions', id, {
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
    });

    // Actualizar logoUrl en la DB
    const result = await this.updateUC.execute(id, { logo_url: stored.publicPath });
    if (result.isErr()) throw result.unwrapErr();

    return { data: stored };
  }
}
