import { Injectable } from '@nestjs/common';
import { LevelType } from '@educandow/domain';
import { EvaluacionStrategy, EvaluacionInput, EvaluacionOutput } from './evaluacion.strategy';

/**
 * Evaluación nivel TERCIARIO — cuatrimestral, régimen promocional.
 * >= 7 → Promociona
 * >= 4 → Regular (va a final)
 * < 4  → Libre (recursa)
 */
@Injectable()
export class EvaluacionTerciario implements EvaluacionStrategy {
  evaluar(input: EvaluacionInput): EvaluacionOutput {
    const nota = input.puntaje;
    let condicion: string;
    if (nota >= 7) condicion = 'PROMOCION';
    else if (nota >= 4) condicion = 'REGULAR';
    else condicion = 'LIBRE';

    return {
      nota: nota.toFixed(1),
      valoracion: condicion === 'PROMOCION' ? 'Promociona' : condicion === 'REGULAR' ? 'Regulariza' : 'Libre',
      condicion,
      aprobado: nota >= 4,
    };
  }

  aplicaA(): LevelType { return LevelType.TERCIARIO; }
  nombre(): string { return 'Evaluación Terciario (promocional/regular/libre)'; }
}
