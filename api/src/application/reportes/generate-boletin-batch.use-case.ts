import { Injectable, Logger } from '@nestjs/common';
import Archiver from 'archiver';
import { Writable } from 'stream';
import { TenantContext } from '../../infrastructure/auth/tenant.context';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { GenerateBoletinUseCase, BoletinError } from './generate-boletin.use-case';

/**
 * GenerateBoletinBatchUseCase — generates report cards for all printable students
 * in a given academic cycle, returning a ZIP archive.
 *
 * Students where enrollment.printable = false are silently excluded.
 * If no printable students are found, throws a 422 error.
 * If ALL per-student PDF generations fail, throws a 422 error instead of
 * returning an empty ZIP with HTTP 200.
 */
@Injectable()
export class GenerateBoletinBatchUseCase {
  private readonly logger = new Logger(GenerateBoletinBatchUseCase.name);

  constructor(
    private readonly singleUC: GenerateBoletinUseCase,
  ) {}

  /**
   * Generates a ZIP buffer containing one PDF per printable student
   * enrolled in the given cycle.
   */
  async execute(cycleId: string): Promise<Buffer> {
    const client = this.tenantClient();

    // Find all printable enrollments in this cycle
    const enrollments = await client.enrollment.findMany({
      where: {
        cycleId,
        printable: true,
        active: true,
      },
      include: {
        student: true,
      },
      orderBy: [
        { grade: 'asc' },
        { division: 'asc' },
        { student: { lastName: 'asc' } },
      ],
    });

    if (enrollments.length === 0) {
      throw new BoletinError(
        'No hay alumnos imprimibles en este ciclo',
        'NO_PRINTABLE_STUDENTS',
        422,
      );
    }

    this.logger.log(`Generating batch PDFs for ${enrollments.length} students in cycle ${cycleId}`);

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
    for (let i = 0; i < enrollments.length; i++) {
      const enrollment = enrollments[i];
      try {
        const pdfBuffer = await this.singleUC.execute(enrollment.id);
        const studentName = `${enrollment.student.lastName}_${enrollment.student.firstName}`
          .replace(/\s+/g, '_')
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '');
        archive.append(pdfBuffer, { name: `boletin_${studentName}.pdf` });
        successCount++;

        this.logger.log(`[${i + 1}/${enrollments.length}] PDF generated for ${enrollment.student.lastName}`);
      } catch (err) {
        this.logger.error(
          `Failed to generate PDF for enrollment ${enrollment.id}: ${(err as Error).message}`,
        );
        // Continue with next student — don't fail the whole batch
      }
    }

    // Guard: if ALL individual PDFs failed, do not return a meaningless empty ZIP
    if (successCount === 0) {
      throw new BoletinError(
        'No se pudo generar ningún boletín del lote — todos fallaron',
        'BATCH_ALL_FAILED',
        422,
      );
    }

    await archive.finalize();

    // Wait for the archive to finish writing
    return new Promise<Buffer>((resolve, reject) => {
      writable.on('finish', () => {
        resolve(Buffer.concat(chunks));
      });
      writable.on('error', reject);
    });
  }

  private tenantClient(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new BoletinError('No tenant context available', 'INTERNAL_ERROR', 500);
    return c;
  }
}
