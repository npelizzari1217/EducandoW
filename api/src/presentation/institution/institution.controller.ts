import {
  Controller, Get, Post, Delete, Body, Param, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import { CreateInstitutionSchema, CreateInstitutionDTO } from './dto/create-institution.dto';
import {
  CreateInstitutionUseCase, ListInstitutionsUseCase, GetInstitutionUseCase, DeleteInstitutionUseCase,
} from '../../application/institution/use-cases/institution.use-cases';

@Controller('institutions')
@UseGuards(AuthGuard, RolesGuard)
export class InstitutionController {
  constructor(
    private readonly createUC: CreateInstitutionUseCase,
    private readonly listUC: ListInstitutionsUseCase,
    private readonly getUC: GetInstitutionUseCase,
    private readonly deleteUC: DeleteInstitutionUseCase,
  ) {}

  @Post()
  @Roles('ADMIN')
  async create(@Body(new ZodValidationPipe(CreateInstitutionSchema)) body: CreateInstitutionDTO) {
    const result = await this.createUC.execute(body);
    if (result.isErr()) throw result.unwrapErr();
    return { data: { id: result.unwrap().id.get(), name: result.unwrap().name } };
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'TEACHER')
  async list() {
    const institutions = await this.listUC.execute();
    return { data: institutions.map((i: { id: { get(): string }; name: string; levels: { toString(): string }[] }) => ({ id: i.id.get(), name: i.name, levels: i.levels.map((l: { toString(): string }) => l.toString()) })) };
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'TEACHER')
  async get(@Param('id') id: string) {
    const inst = await this.getUC.execute(id);
    if (!inst) return { data: null };
    return { data: { id: inst.id.get(), name: inst.name, address: inst.address, phone: inst.phone, email: inst.email, levels: inst.levels.map((l: { toString(): string }) => l.toString()) } };
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.deleteUC.execute(id);
  }
}
