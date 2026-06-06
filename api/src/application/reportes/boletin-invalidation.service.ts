import { Injectable, Logger } from '@nestjs/common';
import { TenantContext } from '../../infrastructure/auth/tenant.context';
import { PdfStorageService } from '../../infrastructure/reporting/pdf-storage.service';

/**
 * BoletinInvalidationService — invalidates cached PDF boletines when
 * grade or attendance data changes for a student.
 *
 * Per spec (line 143–148): "A stored PDF MUST be invalidated and regenerated
 * whenever grade or attendance data changes."
 *
 * Strategy: find all active enrollments for the student and delete their PDFs.
 * This is safe because re-generation is triggered on the next GET request.
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
      const enrollments = await client.enrollment.findMany({
        where: { studentId, active: true },
        select: { id: true },
      });

      for (const enrollment of enrollments) {
        await this.pdfStorage.delete(enrollment.id);
      }

      if (enrollments.length > 0) {
        this.logger.log(
          `Invalidated ${enrollments.length} PDF boletín(es) for student ${studentId}`,
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
