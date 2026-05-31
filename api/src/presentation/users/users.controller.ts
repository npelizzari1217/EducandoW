import {
  Controller, Get, Post, Patch, Delete, Body, Param, Req, Query, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { AuthenticatedRequest } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import { CreateUserSchema, CreateUserDTO } from './dto/create-user.dto';
import { UpdateUserSchema, UpdateUserDTO } from './dto/update-user.dto';
import {
  ListUsersUseCase, CreateUserUseCase, UpdateUserUseCase, DeleteUserUseCase,
} from '../../application/users/use-cases/users.use-cases';

@Controller('users')
@UseGuards(AuthGuard, RolesGuard)
export class UsersController {
  constructor(
    private readonly listUC: ListUsersUseCase,
    private readonly createUC: CreateUserUseCase,
    private readonly updateUC: UpdateUserUseCase,
    private readonly deleteUC: DeleteUserUseCase,
  ) {}

  private getUser(req: Request) {
    return (req as AuthenticatedRequest).user;
  }

  /** Extrae los roles del usuario autenticado desde el request. */
  private getCreatorRoles(req: Request): string[] {
    return this.getUser(req)?.roles ?? [];
  }

  /** Extrae el institutionId del usuario autenticado. */
  private getCreatorInstitutionId(req: Request): string | undefined {
    return this.getUser(req)?.institutionId ?? undefined;
  }

  /** Extrae los módulos del usuario autenticado desde el JWT. */
  private getCreatorModules(req: Request): { moduleCode: string; actions: string[] }[] {
    return this.getUser(req)?.modules ?? [];
  }

  @Get()
  @Roles('ROOT', { module: 'USERS', action: 'READ' })
  async list(
    @Req() req: Request,
    @Query('institutionId') institutionId?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.listUC.execute({
      creatorRoles: this.getCreatorRoles(req),
      institutionId,
      includeInactive: includeInactive === 'true',
    });
  }

  @Post()
  @Roles('ROOT', { module: 'USERS', action: 'CREATE' })
  async create(
    @Req() req: Request,
    @Body(new ZodValidationPipe(CreateUserSchema)) body: CreateUserDTO,
  ) {
    const roles = body.roles ?? (body.role ? [body.role] : undefined);

    return this.createUC.execute({
      email: body.email,
      password: body.password,
      name: body.name,
      institutionId: body.institutionId,
      level: body.level,
      modality: body.modality,
      roles,
      creatorRoles: this.getCreatorRoles(req),
      creatorInstitutionId: this.getCreatorInstitutionId(req),
      moduleAccess: body.moduleAccess,
      creatorModules: this.getCreatorModules(req),
    });
  }

  @Patch(':id')
  @Roles('ROOT', { module: 'USERS', action: 'UPDATE' })
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateUserSchema)) body: UpdateUserDTO,
  ) {
    return this.updateUC.execute(id, body, this.getCreatorRoles(req), this.getCreatorInstitutionId(req), this.getCreatorModules(req));
  }

  @Delete(':id')
  @Roles('ROOT', { module: 'USERS', action: 'DELETE' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Req() req: Request, @Param('id') id: string) {
    await this.deleteUC.execute(id, this.getCreatorRoles(req));
    return;
  }
}
