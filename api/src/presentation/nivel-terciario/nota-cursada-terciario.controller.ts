import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { EducationalLevelCode } from '@educandow/domain';
import type { NotaCursadaTerciario, InscripcionMateria } from '@educandow/domain';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { LevelsGuard } from '../../infrastructure/auth/guards/levels.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { Levels } from '../../infrastructure/auth/decorators/levels.decorator';
import { CurrentUser } from '../../infrastructure/auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../../infrastructure/auth/guards/auth.guard';
import {
  CreateNotaCursadaSlotUC,
  UpdateNotaCursadaSlotUC,
  ListNotaCursadaSlotsUC,
  ConfirmarNotaCursadaUC,
  ListInscripcionesDocenteUC,
} from '../../application/nivel-terciario/use-cases/nota-cursada-terciario.use-cases';
import { RegistrarPromocionalUC } from '../../application/nivel-terciario/use-cases/acta-examen.use-cases';

// ── Zod Schemas ────────────────────────────────────────────────────────────────

export const CreateSlotSchema = z.object({
  slot: z.enum(['PARCIAL_1', 'PARCIAL_2', 'RECUPERATORIO_PARCIAL_1', 'RECUPERATORIO_PARCIAL_2', 'TP']),
  nota: z.number().min(0).max(10).nullable().optional(),
  condicion: z.enum(['APROBADO', 'DESAPROBADO', 'AUSENTE']),
  fecha: z.string().optional().nullable(),
});
export type CreateSlotDTO = z.infer<typeof CreateSlotSchema>;

export const UpdateSlotSchema = z.object({
  nota: z.number().min(0).max(10).optional(),
  condicion: z.enum(['APROBADO', 'DESAPROBADO', 'AUSENTE']).optional(),
  fecha: z.string().optional().nullable(),
});
export type UpdateSlotDTO = z.infer<typeof UpdateSlotSchema>;

export const ConfirmarNotaCursadaSchema = z.object({
  condicion: z.enum(['REGULAR', 'PROMOCIONAL', 'LIBRE']),  // [SUPUESTO] PROMOCIONAL included
  notaCursada: z.number().min(0).max(10).optional(),
});
export type ConfirmarNotaCursadaDTO = z.infer<typeof ConfirmarNotaCursadaSchema>;

export const RegistrarNotaFinalSchema = z.object({
  studentId: z.string().min(1),
  nota: z.number().min(0).max(10),
  condicion: z.enum(['APROBADO', 'DESAPROBADO', 'AUSENTE']),
  intento: z.number().int().min(1).max(3),
});
export type RegistrarNotaFinalDTO = z.infer<typeof RegistrarNotaFinalSchema>;

export const RegistrarPromocionalSchema = z.object({
  notaFinal: z.number().min(0).max(10),
});
export type RegistrarPromocionalDTO = z.infer<typeof RegistrarPromocionalSchema>;

export const ListInscripcionesQuerySchema = z.object({
  materiaCarreraId: z.string().min(1),
  anioAcademico: z.string().min(4),
});
export type ListInscripcionesQueryDTO = z.infer<typeof ListInscripcionesQuerySchema>;

// ── Controller ─────────────────────────────────────────────────────────────────

@Controller('terciario/cursada')
@UseGuards(AuthGuard, RolesGuard, LevelsGuard)
@Levels(EducationalLevelCode.TERCIARIO)
export class NotaCursadaTerciarioController {
  constructor(
    private readonly createSlotUC: CreateNotaCursadaSlotUC,
    private readonly updateSlotUC: UpdateNotaCursadaSlotUC,
    private readonly listSlotsUC: ListNotaCursadaSlotsUC,
    private readonly confirmarUC: ConfirmarNotaCursadaUC,
    private readonly promocionalUC: RegistrarPromocionalUC,
    private readonly listInscripcionesUC: ListInscripcionesDocenteUC,
  ) {}

  @Post(':inscripcionMateriaId/slots')
  @Roles('ROOT', { module: 'GRADES', action: 'CREATE' })
  async createSlot(
    @CurrentUser() user: AuthenticatedUser,
    @Param('inscripcionMateriaId') inscripcionMateriaId: string,
    @Body(new ZodValidationPipe(CreateSlotSchema)) body: CreateSlotDTO,
  ) {
    const result = await this.createSlotUC.execute(
      user.userId,
      user.roles,
      inscripcionMateriaId,
      {
        slot: body.slot,
        nota: body.nota ?? undefined,
        condicion: body.condicion,
        fecha: body.fecha ?? undefined,
      },
    );
    if (result.isErr()) throw result.unwrapErr();
    return { data: this.mapNota(result.unwrap()) };
  }

  @Patch(':inscripcionMateriaId/slots/:slot')
  @Roles('ROOT', { module: 'GRADES', action: 'UPDATE' })
  async updateSlot(
    @CurrentUser() user: AuthenticatedUser,
    @Param('inscripcionMateriaId') inscripcionMateriaId: string,
    @Param('slot') slot: string,
    @Body(new ZodValidationPipe(UpdateSlotSchema)) body: UpdateSlotDTO,
  ) {
    const result = await this.updateSlotUC.execute(
      user.userId,
      user.roles,
      inscripcionMateriaId,
      slot,
      {
        nota: body.nota,
        condicion: body.condicion,
        fecha: body.fecha ?? undefined,
      },
    );
    if (result.isErr()) throw result.unwrapErr();
    return { data: this.mapNota(result.unwrap()) };
  }

  @Get(':inscripcionMateriaId/slots')
  @Roles('ROOT', { module: 'GRADES', action: 'READ' })
  async listSlots(@Param('inscripcionMateriaId') inscripcionMateriaId: string) {
    const items = await this.listSlotsUC.execute(inscripcionMateriaId);
    return { data: items.map((i) => this.mapNota(i)) };
  }

  @Patch(':inscripcionMateriaId/confirmar')
  @Roles('ROOT', { module: 'GRADES', action: 'UPDATE' })
  async confirmar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('inscripcionMateriaId') inscripcionMateriaId: string,
    @Body(new ZodValidationPipe(ConfirmarNotaCursadaSchema)) body: ConfirmarNotaCursadaDTO,
  ) {
    const result = await this.confirmarUC.execute(
      user.userId,
      user.roles,
      inscripcionMateriaId,
      body,
    );
    if (result.isErr()) throw result.unwrapErr();
    return { data: { message: 'Cursada confirmada' } };
  }

  @Post(':inscripcionMateriaId/promocionar')
  @Roles('ROOT', { module: 'GRADES', action: 'UPDATE' })
  async promocionar(  // [SUPUESTO]
    @Param('inscripcionMateriaId') inscripcionMateriaId: string,
    @Body(new ZodValidationPipe(RegistrarPromocionalSchema)) body: RegistrarPromocionalDTO,
  ) {
    const result = await this.promocionalUC.execute(inscripcionMateriaId, body);
    if (result.isErr()) throw result.unwrapErr();
    return { data: { message: 'Promocional registrada' } };
  }

  /** GET /terciario/cursada/inscripciones — scoped read for docentes (SPEC-7.1) */
  @Get('inscripciones')
  @Roles('ROOT', { module: 'GRADES', action: 'READ' })
  async listInscripciones(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(ListInscripcionesQuerySchema)) query: ListInscripcionesQueryDTO,
  ) {
    const result = await this.listInscripcionesUC.execute(
      user.userId,
      user.roles,
      query.materiaCarreraId,
      query.anioAcademico,
    );
    if (result.isErr()) throw result.unwrapErr();
    return { data: result.unwrap().map((i) => this.mapInscripcion(i)) };
  }

  private mapNota(nota: NotaCursadaTerciario) {
    return {
      id: nota.id.get(),
      inscripcionMateriaId: nota.inscripcionMateriaId,
      slot: nota.slot.get(),
      nota: nota.nota,
      condicion: nota.condicion.get(),
      fecha: nota.fecha,
      creadoAt: nota.creadoAt.toISOString(),
      actualizadoAt: nota.actualizadoAt.toISOString(),
    };
  }

  private mapInscripcion(i: InscripcionMateria) {
    return {
      id: i.id.get(),
      studentId: i.studentId,
      materiaCarreraId: i.materiaCarreraId,
      anioAcademico: i.anioAcademico,
      estado: i.estado.get(),
    };
  }
}
