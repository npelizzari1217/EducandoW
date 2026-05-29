/** Puerto de almacenamiento de archivos — dominio puro, sin dependencias de infraestructura. */
export interface StoredFile {
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  /** Ruta relativa accesible públicamente (ej: /uploads/institutions/uuid/logo.png) */
  publicPath: string;
}

export interface FileStoragePort {
  /**
   * Guarda un archivo y devuelve sus metadatos.
   * Si ya existe un archivo en entityPath, lo REEMPLAZA.
   */
  store(
    entityType: string,
    entityId: string,
    file: { buffer: Buffer; originalName: string; mimeType: string },
  ): Promise<StoredFile>;

  /** Elimina todos los archivos de una entidad */
  deleteAll(entityType: string, entityId: string): Promise<void>;
}
