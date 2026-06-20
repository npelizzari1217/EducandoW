import { Injectable, Logger } from '@nestjs/common';
import { TenantContext } from '../../infrastructure/auth/tenant.context';
import { PdfStorageService } from '../../infrastructure/reporting/pdf-storage.service';

/**
 * BoletinInvalidationService — invalidates cached PDF boletines when
 * grade or attendance data changes for a student.
 *
 * SDD-2 repoint: replaced enrollment.findMany (by studentId + active) with
 * alumnosXCursoXCiclo.findMany (by studentId). Cache keys are now axcc.id.
 * Best-effort semantics preserved: a failure here must not break the grade save.
 */
@Injectable()
export class BoletinInvalidationService {
  private readonly logger = new Logger(BoletinInvalidationService.name);

  constructor(private readonly pdfStorage: PdfStorageService) {}

  /**
   * Invalidates all stored PDF boletines for the given student.
   * Silently no-ops if no PDFs exist or tenant context is unavailable.
   */
  async invalidateForStudent(studentId: string): Promise<void> {
    const client = TenantContext.getClient();
    if (!client) {
      this.logger.warn('No tenant context — skipping boletin invalidation');
      return;
    }

    try {
      // SDD-2: read from AlumnosXCursoXCiclo (not Enrollment). No active filter needed —
      // if the row exists, the student is in that CourseCycle.
      const rows = await (client as any).alumnosXCursoXCiclo.findMany({
        where: { studentId },
        select: { id: true },
      });

      for (const row of rows) {
        await this.pdfStorage.delete(row.id);
      }

      if (rows.length > 0) {
        this.logger.log(
          `Invalidated ${rows.length} PDF boletín(es) for student ${studentId}`,
        );
      }
    } catch (err) {
      // Invalidation is best-effort: a failure here must not break the grade save
      this.logger.error(
        `Failed to invalidate PDFs for student ${studentId}: ${(err as Error).message}`,
      );
    }
  }
}
