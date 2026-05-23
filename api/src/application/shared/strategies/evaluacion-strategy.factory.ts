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

  /** Fallback al nivel base (ej: TALLERES_PRIMARIO → PRIMARIO) */
  getStrategy(level: LevelType): EvaluacionStrategy {
    // Direct match
    if (this.strategies.has(level)) return this.strategies.get(level)!;

    // Fallback: base level (strip modality)
    const base = (Math.floor(level / 10) * 10) as LevelType;
    const strategy = this.strategies.get(base);
    if (!strategy) throw new Error(`No hay estrategia de evaluación para nivel: ${LevelType[level] ?? level}`);
    return strategy;
  }
}
