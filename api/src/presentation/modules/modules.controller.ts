import {
  Controller, Get, Post, Patch, Delete, Body, Param, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import { CreateModuleSchema, CreateModuleDTO } from './dto/create-module.dto';
import { UpdateModuleSchema, UpdateModuleDTO } from './dto/update-module.dto';
import {
  ListModulesUseCase, CreateModuleUseCase, UpdateModuleUseCase, DeleteModuleUseCase,
} from '../../application/modules/use-cases/modules.use-cases';

@Controller('modules')
@UseGuards(AuthGuard, RolesGuard)
@Roles('ROOT')
export class ModulesController {
  constructor(
    private readonly listUC: ListModulesUseCase,
    private readonly createUC: CreateModuleUseCase,
    private readonly updateUC: UpdateModuleUseCase,
    private readonly deleteUC: DeleteModuleUseCase,
  ) {}

  @Get()
  async list() {
    const data = await this.listUC.execute();
    return { data };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body(new ZodValidationPipe(CreateModuleSchema)) body: CreateModuleDTO) {
    const data = await this.createUC.execute(body);
    return { data };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateModuleSchema)) body: UpdateModuleDTO,
  ) {
    const data = await this.updateUC.execute(id, body);
    if (!data) return { data: null };
    return { data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.deleteUC.execute(id);
    return;
  }
}
