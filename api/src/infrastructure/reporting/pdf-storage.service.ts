import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * PdfStorageService — stores generated PDFs on local disk.
 *
 * Files are saved to api/uploads/boletines/{enrollmentId}.pdf
 * The uploads directory is already served as static assets by main.ts.
 */
@Injectable()
export class PdfStorageService {
  private readonly logger = new Logger(PdfStorageService.name);
  private readonly baseDir: string;

  constructor() {
    this.baseDir = path.resolve(process.cwd(), 'uploads', 'boletines');
  }

  /**
   * Saves a PDF buffer to disk.
   * @returns The public URL path accessible via the static assets server.
   */
  async save(enrollmentId: string, pdfBuffer: Buffer): Promise<string> {
    await fs.mkdir(this.baseDir, { recursive: true });

    const fileName = `${enrollmentId}.pdf`;
    const filePath = path.join(this.baseDir, fileName);

    await fs.writeFile(filePath, pdfBuffer);
    const stat = await fs.stat(filePath);

    const publicPath = `/uploads/boletines/${fileName}`;
    this.logger.log(`PDF stored: ${publicPath} (${stat.size} bytes)`);

    return publicPath;
  }

  /** Returns the full path of a previously stored PDF, or null if not found. */
  async getPath(enrollmentId: string): Promise<string | null> {
    const filePath = path.join(this.baseDir, `${enrollmentId}.pdf`);
    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      return null;
    }
  }

  /** Deletes a stored PDF. No-op if the file doesn't exist. */
  async delete(enrollmentId: string): Promise<void> {
    const filePath = path.join(this.baseDir, `${enrollmentId}.pdf`);
    try {
      await fs.unlink(filePath);
      this.logger.log(`PDF deleted: ${enrollmentId}.pdf`);
    } catch {
      // file doesn't exist, nothing to do
    }
  }
}
