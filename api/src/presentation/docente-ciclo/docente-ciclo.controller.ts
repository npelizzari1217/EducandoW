import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import {
  ListDocentesXCicloQuerySchema,
  type ListDocentesXCicloQueryDto,
} from './dto/docente-x-ciclo.dto';
import { ListDocentesXCicloUseCase } from '../../application/docente-ciclo/list-docentes-x-ciclo.use-case';

/**
 * GET /docentes-x-ciclo?cycleId=
 * Lists all DocenteXCiclo records for a cycle, enriched with User persona
 * (DC-R2, DC-S4: persona comes from master User, not from DocenteXCiclo).
 */
@Controller('docentes-x-ciclo')
@UseGuards(AuthGuard, RolesGuard)
export class DocenteCicloController {
  constructor(private readonly listUC: ListDocentesXCicloUseCase) {}

  @Get()
  @Roles('ROOT', { module: 'TEACHERS', action: 'READ' })
  async list(
    @Query(new ZodValidationPipe(ListDocentesXCicloQuerySchema))
    query: ListDocentesXCicloQueryDto,
  ) {
    const items = await this.listUC.execute(query.cycleId);
    return { data: items };
  }
}
