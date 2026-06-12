import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { Ingresante } from '@educandow/domain';
import { resolveAccessScope, Level, LevelType } from '@educandow/domain';
import { AuthGuard, type AuthenticatedUser } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { CurrentUser } from '../../infrastructure/auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import { TenantContext } from '../../infrastructure/auth/tenant.context';
import {
  CreateIngresanteSchema,
  CreateIngresanteDTO,
  UpdateIngresanteStatusSchema,
  UpdateIngresanteStatusDTO,
} from './dto/create-ingresante.dto';
import {
  CreateIngresanteUseCase,
  UpdateIngresanteStatusUseCase,
  ListIngresantesUseCase,
  PromoteIngresanteUseCase,
} from '../../application/ingresante/use-cases/ingresante.use-cases';

@Controller('ingresantes')
@UseGuards(AuthGuard, RolesGuard)
export class IngresanteController {
  constructor(
    private readonly createUC: CreateIngresanteUseCase,
    private readonly updateStatusUC: UpdateIngresanteStatusUseCase,
    private readonly listUC: ListIngresantesUseCase,
    private readonly promoteUC: PromoteIngresanteUseCase,
  ) {}

  @Post()
  @Roles('ROOT', { module: 'ENROLLMENTS', action: 'CREATE' })
  async create(
    @Body(new ZodValidationPipe(CreateIngresanteSchema)) body: CreateIngresanteDTO,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // D3: resolve level by role
    const scope = resolveAccessScope(user);
    if (!scope.allLevels) {
      // Non-ROOT/ADMIN: force level from their first assigned level
      if (!scope.compositeLevels.length) {
        throw new BadRequestException('El usuario no tiene niveles asignados');
      }
      const userLevel = Level.reconstruct(scope.compositeLevels[0] as LevelType);
      body = { ...body, level: userLevel.toString() };
    }

    const result = await this.createUC.execute(body);
    if (result.isErr()) throw result.unwrapErr();
    return { data: toDto(result.unwrap()) };
  }

  @Get()
  @Roles('ROOT', { module: 'ENROLLMENTS', action: 'READ' })
  async list(@Query('status') status?: string) {
    const list = status
      ? await this.listUC.executeByStatus(status)
      : await this.listUC.execute();
    return { data: list.map(toDto) };
  }

  @Patch(':id/status')
  @Roles('ROOT', { module: 'ENROLLMENTS', action: 'UPDATE' })
  async updateStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateIngresanteStatusSchema)) body: UpdateIngresanteStatusDTO,
  ) {
    const result = await this.updateStatusUC.execute({ ingresanteId: id, status: body.status });
    if (result.isErr()) throw result.unwrapErr();
    return { data: toDto(result.unwrap()) };
  }

  @Post(':id/promote')
  @Roles('ROOT', { module: 'STUDENTS', action: 'CREATE' })
  async promote(@Param('id') id: string) {
    const institutionId = TenantContext.getInstitutionId();
    if (!institutionId) throw new BadRequestException('No institution context available');

    const result = await this.promoteUC.execute({ ingresanteId: id, institutionId });
    if (result.isErr()) throw result.unwrapErr();
    return { data: result.unwrap() };
  }
}

function toDto(i: Ingresante) {
  return {
    id: i.id.get(),
    firstName: i.firstName,
    lastName: i.lastName,
    dni: i.dni,
    birthDate: i.birthDate?.toISOString() ?? null,
    address: i.address ?? null,
    phone: i.phone ?? null,
    email: i.email ?? null,
    cycleId: i.cycleId?.get() ?? null,
    level: i.level.toString(),
    modality: i.level.modalityCode,
    status: i.status.value,
  };
}
