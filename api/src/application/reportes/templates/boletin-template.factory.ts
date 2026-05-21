import { LevelType } from '@educandow/domain';
import type { BoletínTemplate, BoletinResultado, DatosBoletin } from './boletin.template';
import { BoletínInicial } from './boletin-inicial.template';
import { BoletínPrimario } from './boletin-primario.template';
import { BoletínSecundario } from './boletin-secundario.template';
import { BoletínTerciario } from './boletin-terciario.template';

/**
 * Factory: elige el template de boletín según el nivel pedagógico.
 * Mismo pattern que EvaluacionStrategyFactory.
 */
export class BoletínTemplateFactory {
  private static templates: Record<LevelType, BoletínTemplate> = {
    [LevelType.INICIAL]: new BoletínInicial(),
    [LevelType.PRIMARIO]: new BoletínPrimario(),
    [LevelType.SECUNDARIO]: new BoletínSecundario(),
    [LevelType.TERCIARIO]: new BoletínTerciario(),
  };

  static getTemplate(level: LevelType): BoletínTemplate {
    const template = BoletínTemplateFactory.templates[level];
    if (!template) throw new Error(`No hay template de boletín para nivel: ${level}`);
    return template;
  }

  static generarBoletin(level: LevelType, datos: DatosBoletin): BoletinResultado {
    return this.getTemplate(level).generar(datos);
  }
}
