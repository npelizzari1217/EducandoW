import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EducationalLevelCode, CalificacionSecundario } from '@educandow/domain';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { LevelsGuard } from '../../infrastructure/auth/guards/levels.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { Levels } from '../../infrastructure/auth/decorators/levels.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import {
  RegistrarSuplementariaSchema,
  RegistrarSuplementariaDTO,
} from './dto/registrar-suplementaria.dto';
import {
  ConsultarAlumnosExamenSchema,
  ConsultarAlumnosExamenDTO,
} from './dto/consultar-alumnos-examen.dto';
import {
  RegistrarNotaSuplementariaUseCase,
  ConsultarAlumnosExamenUseCase,
  CalcularDefinitivaUseCase,
} from '../../application/nivel-secundario/use-cases/calificacion-secundario.use-cases';

@Controller('secundario')
@UseGuards(AuthGuard, RolesGuard, LevelsGuard)
@Levels(EducationalLevelCode.SECUNDARIO)
export class CalificacionSecundarioController {
  constructor(
    private readonly registrarUC: RegistrarNotaSuplementariaUseCase,
    private readonly consultarUC: ConsultarAlumnosExamenUseCase,
    private readonly definitivaUC: CalcularDefinitivaUseCase,
  ) {}

  @Patch('calificaciones/:id/suplementaria')
  @Roles('ROOT', { module: 'GRADES', action: 'UPDATE' })
  async registrarSuplementaria(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RegistrarSuplementariaSchema))
    body: RegistrarSuplementariaDTO,
  ) {
    const result = await this.registrarUC.execute({
      calificacionId: id,
      turno: body.turno,
      nota: body.nota,
    });
    if (result.isErr()) throw result.unwrapErr();
    return { data: toDto(result.unwrap()) };
  }

  @Get('alumnos-examen')
  @Roles('ROOT', { module: 'GRADES', action: 'READ' })
  async consultarAlumnosExamen(
    @Query(new ZodValidationPipe(ConsultarAlumnosExamenSchema))
    query: ConsultarAlumnosExamenDTO,
  ) {
    const result = await this.consultarUC.execute(query);
    if (result.isErr()) throw result.unwrapErr();
    return { data: result.unwrap().map(toDto) };
  }

  @Post('calificaciones/:id/definitiva')
  @Roles('ROOT', { module: 'GRADES', action: 'READ' })
  async calcularDefinitiva(@Param('id') id: string) {
    const result = await this.definitivaUC.execute(id);
    if (result.isErr()) throw result.unwrapErr();
    const { definitiva, calificacion } = result.unwrap();
    return {
      data: {
        ...toDto(calificacion),
        definitiva,
      },
    };
  }
}

function toDto(calificacion: CalificacionSecundario) {
  return {
    id: calificacion.id.get(),
    studentId: calificacion.studentId,
    cursoId: calificacion.cursoId,
    subjectId: calificacion.subjectId,
    trimestre: calificacion.trimestre.value,
    nota: calificacion.nota,
    condicion: calificacion.condicion.get(),
    notaDiciembre: calificacion.notaDiciembre,
    notaFebrero: calificacion.notaFebrero,
    definitiva: calificacion.calcularDefinitiva(),
  };
}
