import { Injectable } from '@nestjs/common';
import { LevelType } from '@educandow/domain';
import { EvaluacionStrategy, EvaluacionInput, EvaluacionOutput } from './evaluacion.strategy';

/**
 * Evaluación nivel INICIAL — cualitativa, sin notas numéricas.
 * Escala: En proceso / Logrado / Destacado
 */
@Injectable()
export class EvaluacionInicial implements EvaluacionStrategy {
  evaluar(input: EvaluacionInput): EvaluacionOutput {
    const val = input.puntaje;
    let valoracion: string;
    if (val >= 4) valoracion = 'Destacado';
    else if (val >= 3) valoracion = 'Logrado';
    else valoracion = 'En proceso';

    return {
      nota: valoracion,
      valoracion,
      aprobado: val >= 2,
    };
  }

  aplicaA(): LevelType { return LevelType.INICIAL; }
  nombre(): string { return 'Evaluación Cualitativa Inicial'; }
}
