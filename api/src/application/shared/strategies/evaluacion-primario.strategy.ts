import { Injectable } from '@nestjs/common';
import { LevelType } from '@educandow/domain';
import { EvaluacionStrategy, EvaluacionInput, EvaluacionOutput } from './evaluacion.strategy';

/**
 * Evaluación nivel PRIMARIO — numérica 1-10 + conceptual.
 * Aprobación: nota >= 6
 */
@Injectable()
export class EvaluacionPrimario implements EvaluacionStrategy {
  evaluar(input: EvaluacionInput): EvaluacionOutput {
    const nota = input.puntaje;
    let valoracion: string;
    if (nota >= 9) valoracion = 'Excelente';
    else if (nota >= 7) valoracion = 'Muy Bueno';
    else if (nota >= 6) valoracion = 'Bueno';
    else if (nota >= 4) valoracion = 'Regular';
    else valoracion = 'Insuficiente';

    return {
      nota: nota.toFixed(1),
      valoracion,
      aprobado: nota >= 6,
    };
  }

  aplicaA(): LevelType { return LevelType.PRIMARIO; }
  nombre(): string { return 'Evaluación Numérica Primario (1-10)'; }
}
