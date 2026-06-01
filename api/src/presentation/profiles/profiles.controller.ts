import {
  Controller, Get, Post, Patch, Delete, Put, Body, Param, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import { CreateProfileSchema, CreateProfileDTO } from './dto/create-profile.dto';
import { UpdateProfileSchema, UpdateProfileDTO } from './dto/update-profile.dto';
import { UpdatePermissionsSchema, UpdatePermissionsDTO } from './dto/update-permissions.dto';
import {
  ListProfilesUseCase,
  GetProfileUseCase,
  CreateProfileUseCase,
  UpdateProfileUseCase,
  DeleteProfileUseCase,
  GetProfilePermissionsUseCase,
  UpsertPermissionsUseCase,
} from '../../application/profiles/use-cases/profiles.use-cases';

@Controller('profiles')
@UseGuards(AuthGuard, RolesGuard)
export class ProfilesController {
  constructor(
    private readonly listUC: ListProfilesUseCase,
    private readonly getUC: GetProfileUseCase,
    private readonly createUC: CreateProfileUseCase,
    private readonly updateUC: UpdateProfileUseCase,
    private readonly deleteUC: DeleteProfileUseCase,
    private readonly getPermissionsUC: GetProfilePermissionsUseCase,
    private readonly upsertPermissionsUC: UpsertPermissionsUseCase,
  ) {}

  @Get()
  @Roles('ROOT', { module: 'USERS', action: 'READ' })
  async list() {
    return this.listUC.execute();
  }

  @Get(':id')
  @Roles('ROOT', { module: 'USERS', action: 'READ' })
  async get(@Param('id') id: string) {
    return this.getUC.execute(id);
  }

  @Post()
  @Roles('ROOT', { module: 'USERS', action: 'CREATE' })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body(new ZodValidationPipe(CreateProfileSchema)) body: CreateProfileDTO) {
    return this.createUC.execute(body.name);
  }

  @Patch(':id')
  @Roles('ROOT', { module: 'USERS', action: 'UPDATE' })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateProfileSchema)) body: UpdateProfileDTO,
  ) {
    return this.updateUC.execute(id, body.name!);
  }

  @Delete(':id')
  @Roles('ROOT', { module: 'USERS', action: 'DELETE' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.deleteUC.execute(id);
    return;
  }

  @Get(':id/permissions')
  @Roles('ROOT', { module: 'USERS', action: 'READ' })
  async getPermissions(@Param('id') id: string) {
    return this.getPermissionsUC.execute(id);
  }

  @Put(':id/permissions')
  @Roles('ROOT', { module: 'USERS', action: 'UPDATE' })
  async updatePermissions(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdatePermissionsSchema)) body: UpdatePermissionsDTO,
  ) {
    return this.upsertPermissionsUC.execute(id, body.permissions);
  }
}
