import { Controller, Get } from '@nestjs/common';
import { LEVEL_CATALOG } from '@educandow/domain';
import type { LevelCatalogEntry } from '@educandow/domain';

/**
 * Catálogo público de niveles y modalidades.
 *
 * GET /v1/levels → devuelve los 12 niveles del sistema con todos sus metadatos.
 * El frontend usa este endpoint para poblar combos desplegables y mostrar
 * etiquetas legibles a partir de los códigos numéricos.
 */
@Controller('levels')
export class CatalogController {
  @Get()
  getLevels(): { data: LevelCatalogEntry[] } {
    return { data: LEVEL_CATALOG };
  }
}
