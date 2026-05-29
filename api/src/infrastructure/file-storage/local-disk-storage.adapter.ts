import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { FileStoragePort, StoredFile } from '../../application/shared/ports/file-storage.port';

@Injectable()
export class LocalDiskStorageAdapter implements FileStoragePort {
  private readonly logger = new Logger(LocalDiskStorageAdapter.name);
  private readonly baseDir: string;

  constructor() {
    this.baseDir = path.resolve(process.cwd(), 'uploads');
  }

  async store(
    entityType: string,
    entityId: string,
    file: { buffer: Buffer; originalName: string; mimeType: string },
  ): Promise<StoredFile> {
    const dir = path.join(this.baseDir, entityType, entityId);
    await fs.mkdir(dir, { recursive: true });

    // Determinar extensión
    const ext = this.inferExtension(file.mimeType, file.originalName);
    const fileName = `logo.${ext}`;
    const filePath = path.join(dir, fileName);

    // Escribir archivo (reemplaza si existe)
    await fs.writeFile(filePath, file.buffer);

    const stat = await fs.stat(filePath);
    const publicPath = `/uploads/${entityType}/${entityId}/${fileName}`;

    this.logger.log(`Logo stored: ${publicPath} (${stat.size} bytes)`);

    return {
      fileName,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: stat.size,
      publicPath,
    };
  }

  async deleteAll(entityType: string, entityId: string): Promise<void> {
    const dir = path.join(this.baseDir, entityType, entityId);
    try {
      await fs.rm(dir, { recursive: true, force: true });
      this.logger.log(`Deleted: ${dir}`);
    } catch {
      // No existe o no se puede borrar — ignorar
    }
  }

  private inferExtension(mimeType: string, originalName: string): string {
    const map: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
    };
    if (map[mimeType]) return map[mimeType];

    // Fallback: extensión del nombre original
    const ext = path.extname(originalName).replace('.', '');
    if (ext && ext.length <= 5) return ext.toLowerCase();

    return 'png';
  }
}
