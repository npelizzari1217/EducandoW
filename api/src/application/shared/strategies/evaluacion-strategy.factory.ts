import { Injectable } from '@nestjs/common';
import { LevelType } from '@educandow/domain';
import { EvaluacionStrategy } from './evaluacion.strategy';
import { EvaluacionInicial } from './evaluacion-inicial.strategy';
import { EvaluacionPrimario } from './evaluacion-primario.strategy';
import { EvaluacionSecundario } from './evaluacion-secundario.strategy';
import { EvaluacionTerciario } from './evaluacion-terciario.strategy';

@Injectable()
export class EvaluacionStrategyFactory {
  private strategies: Map<LevelType, EvaluacionStrategy>;

  constructor(
    inicial: EvaluacionInicial,
    primario: EvaluacionPrimario,
    secundario: EvaluacionSecundario,
    terciario: EvaluacionTerciario,
  ) {
    this.strategies = new Map([
      [LevelType.INICIAL, inicial],
      [LevelType.PRIMARIO, primario],
      [LevelType.SECUNDARIO, secundario],
      [LevelType.TERCIARIO, terciario],
    ]);
  }

  getStrategy(level: LevelType): EvaluacionStrategy {
    const strategy = this.strategies.get(level);
    if (!strategy) throw new Error(`No hay estrategia de evaluación para nivel: ${level}`);
    return strategy;
  }
}
