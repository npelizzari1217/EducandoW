import apiClient from '../api/client';

/**
 * Downloads a report card PDF for a single student.
 * SDD-2 R16: keyed on AlumnosXCursoXCiclo.id (alumnosXCursoXCicloId) instead of enrollment.id.
 * Fetches via API client (which injects the auth token), creates a blob URL,
 * and opens it in a new browser tab for viewing/printing.
 */
export async function downloadBoletin(alumnosXCursoXCicloId: string): Promise<void> {
  const res = await apiClient.get(`/reportes/boletin/${alumnosXCursoXCicloId}`, {
    responseType: 'blob',
  });
  const blobUrl = URL.createObjectURL(res.data);
  window.open(blobUrl, '_blank');
  // Clean up the blob URL after a delay to allow the new tab to load
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
}

/**
 * Downloads a ZIP archive with report cards for all printable students
 * in a course cycle. Creates a temporary download link and triggers it.
 * SDD-2 ADR-2: batch is scoped by CourseCycle (courseCycleId), not AcademicCycle.
 */
export async function downloadBoletinBatch(courseCycleId: string): Promise<void> {
  const res = await apiClient.get(`/reportes/boletin/curso/${courseCycleId}`, {
    responseType: 'blob',
  });
  const blobUrl = URL.createObjectURL(res.data);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = 'boletines.zip';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
}
