import { LevelType } from '@educandow/domain';

export interface EvaluacionInput {
  alumnoId: string;
  materiaId: string;
  periodo: string;
  puntaje: number;
  observaciones?: string;
}

export interface EvaluacionOutput {
  nota: string;
  valoracion: string;
  condicion?: string;
  aprobado: boolean;
}

export interface EvaluacionStrategy {
  /** Evalúa un input según las reglas del nivel pedagógico */
  evaluar(input: EvaluacionInput): EvaluacionOutput;

  /** Nivel al que aplica esta estrategia */
  aplicaA(): LevelType;

  /** Nombre descriptivo de la estrategia */
  nombre(): string;
}
