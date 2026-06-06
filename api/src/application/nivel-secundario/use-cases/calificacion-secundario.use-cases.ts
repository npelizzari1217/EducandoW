import { Injectable } from '@nestjs/common';
import {
  CalificacionSecundario,
  CalificacionSecundarioRepository,
  PendingExamDetail,
  Result,
  ok,
  err,
  ValidationError,
  NotFoundError,
  TurnoExamen,
} from '@educandow/domain';

export interface RegistrarNotaSuplementariaInput {
  calificacionId: string;
  turno: string;
  nota: number;
}

export interface ConsultarAlumnosExamenInput {
  turno: string;
  academicYear: string;
}

@Injectable()
export class RegistrarNotaSuplementariaUseCase {
  constructor(private readonly repo: CalificacionSecundarioRepository) {}

  async execute(
    input: RegistrarNotaSuplementariaInput,
  ): Promise<Result<CalificacionSecundario, ValidationError | NotFoundError>> {
    const turno = TurnoExamen.create(input.turno);
    if (!turno) {
      return err(
        new ValidationError(
          `Turno inválido: "${input.turno}". Valores válidos: DICIEMBRE, FEBRERO`,
        ),
      );
    }

    const calificacion = await this.repo.findById(input.calificacionId);
    if (!calificacion) {
      return err(new NotFoundError('CalificacionSecundario', input.calificacionId));
    }

    const result = calificacion.registrarNotaSuplementaria(
      turno.get(),
      input.nota,
    );
    if (result.isErr()) return err(result.unwrapErr());

    await this.repo.save(calificacion);
    return ok(calificacion);
  }
}

@Injectable()
export class ConsultarAlumnosExamenUseCase {
  constructor(private readonly repo: CalificacionSecundarioRepository) {}

  async execute(
    input: ConsultarAlumnosExamenInput,
  ): Promise<Result<PendingExamDetail[], ValidationError>> {
    const turno = TurnoExamen.create(input.turno);
    if (!turno) {
      return err(
        new ValidationError(
          `Turno inválido: "${input.turno}". Valores válidos: DICIEMBRE, FEBRERO`,
        ),
      );
    }

    if (!input.academicYear || input.academicYear.trim().length === 0) {
      return err(
        new ValidationError('El año académico es requerido'),
      );
    }

    const results = await this.repo.findPendingExamsWithDetails(
      turno.get(),
      input.academicYear,
    );
    return ok(results);
  }
}

@Injectable()
export class CalcularDefinitivaUseCase {
  constructor(private readonly repo: CalificacionSecundarioRepository) {}

  async execute(
    calificacionId: string,
  ): Promise<
    Result<{ definitiva: number | null; calificacion: CalificacionSecundario }, NotFoundError>
  > {
    const calificacion = await this.repo.findById(calificacionId);
    if (!calificacion) {
      return err(new NotFoundError('CalificacionSecundario', calificacionId));
    }

    const definitiva = calificacion.calcularDefinitiva();

    return ok({ definitiva, calificacion });
  }
}
