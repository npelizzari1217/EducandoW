import { Injectable } from '@nestjs/common';
import { LevelType } from '@educandow/domain';
import { EvaluacionStrategy, EvaluacionInput, EvaluacionOutput } from './evaluacion.strategy';

/**
 * Evaluación nivel SECUNDARIO — numérica 1-10 + régimen de previas.
 * Aprobación: nota >= 6 (regular), < 6 va a mesa de examen.
 */
@Injectable()
export class EvaluacionSecundario implements EvaluacionStrategy {
  evaluar(input: EvaluacionInput): EvaluacionOutput {
    const nota = input.puntaje;
    const aprobado = nota >= 6;

    return {
      nota: nota.toFixed(1),
      valoracion: aprobado ? 'Aprobado' : 'Previas',
      condicion: aprobado ? 'REGULAR' : 'PREVIAS',
      aprobado,
    };
  }

  aplicaA(): LevelType { return LevelType.SECUNDARIO; }
  nombre(): string { return 'Evaluación Secundario (1-10 + previas)'; }
}
