import { Injectable, Logger } from '@nestjs/common';
import Archiver from 'archiver';
import { Writable } from 'stream';
import { TenantContext } from '../../infrastructure/auth/tenant.context';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { GenerateBoletinUseCase, BoletinError } from './generate-boletin.use-case';

/**
 * GenerateBoletinBatchUseCase — generates report cards for all printable students
 * in a given CourseCycle, returning a ZIP archive.
 *
 * SDD-2 repoint: replaced Enrollment (by cycleId) with AlumnosXCursoXCiclo (by courseCycleId).
 * Zero printable rows → empty ZIP, no error (REQ-PG-4 / Scenario B).
 * If printable rows exist but ALL PDF generations fail → BATCH_ALL_FAILED (422).
 */
@Injectable()
export class GenerateBoletinBatchUseCase {
  private readonly logger = new Logger(GenerateBoletinBatchUseCase.name);

  constructor(
    private readonly singleUC: GenerateBoletinUseCase,
  ) {}

  /**
   * Generates a ZIP buffer containing one PDF per printable student
   * in the given CourseCycle (AlumnosXCursoXCiclo rows with printable=true).
   *
   * @param courseCycleId - CourseCycle.uuid (replaces the old cycleId / AcademicCycle grain)
   */
  async execute(courseCycleId: string): Promise<Buffer> {
    const client = this.tenantClient();

    // Find all printable AlumnosXCursoXCiclo rows for this CourseCycle
    const rows: Array<{
      id: string;
      courseCycleId: string;
      studentId: string;
      printable: boolean;
      student: { id: string; firstName: string; lastName: string };
    }> = await (client as any).alumnosXCursoXCiclo.findMany({
      where: {
        courseCycleId,
        printable: true,
      },
      include: {
        student: true,
      },
      orderBy: [
        { student: { lastName: 'asc' } },
      ],
    });

    // Zero printable rows → return empty ZIP (REQ-PG-4 / Scenario B — no error)
    if (rows.length === 0) {
      this.logger.log(`No printable students in CourseCycle ${courseCycleId} — returning empty ZIP`);
      return this.buildZip([], []);
    }

    this.logger.log(`Generating batch PDFs for ${rows.length} students in CourseCycle ${courseCycleId}`);

    // Generate each PDF and collect into a ZIP
    const archive = Archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    const writable = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        chunks.push(chunk);
        callback();
      },
    });

    archive.pipe(writable);

    let successCount = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        // singleUC.execute now takes alumnosXCursoXCicloId (row.id) — T13 repoint
        const pdfBuffer = await this.singleUC.execute(row.id);
        const studentName = `${row.student.lastName}_${row.student.firstName}`
          .replace(/\s+/g, '_')
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '');
        archive.append(pdfBuffer, { name: `boletin_${studentName}.pdf` });
        successCount++;

        this.logger.log(`[${i + 1}/${rows.length}] PDF generated for ${row.student.lastName}`);
      } catch (err) {
        this.logger.error(
          `Failed to generate PDF for AlumnosXCursoXCiclo ${row.id}: ${(err as Error).message}`,
        );
        // Continue with next student — don't fail the whole batch
      }
    }

    // Guard: if printable rows existed but ALL individual PDFs failed, do not return empty ZIP
    if (successCount === 0) {
      throw new BoletinError(
        'No se pudo generar ningún boletín del lote — todos fallaron',
        'BATCH_ALL_FAILED',
        422,
      );
    }

    // Enganchar los listeners ANTES de finalizar: archiver v7 resuelve finalize()
    // DESPUÉS de que el stream emite 'finish'. Si enganchamos el listener tras el
    // `await finalize()`, el evento ya pasó y la Promise nunca resuelve (request colgada).
    const done = new Promise<Buffer>((resolve, reject) => {
      writable.on('finish', () => resolve(Buffer.concat(chunks)));
      writable.on('error', reject);
      archive.on('error', reject);
    });

    await archive.finalize();
    return done;
  }

  /**
   * Builds an empty ZIP archive synchronously for the zero-rows case.
   */
  private buildZip(_entries: never[], _extra: never[]): Promise<Buffer> {
    const archive = Archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    const writable = new Writable({
      write(chunk: Buffer, _enc, cb) { chunks.push(chunk); cb(); },
    });
    archive.pipe(writable);
    archive.finalize();
    return new Promise<Buffer>((resolve, reject) => {
      writable.on('finish', () => resolve(Buffer.concat(chunks)));
      writable.on('error', reject);
    });
  }

  private tenantClient(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new BoletinError('No tenant context available', 'INTERNAL_ERROR', 500);
    return c;
  }
}
