import apiClient from '../api/client';

/**
 * Downloads a report card PDF for a single student enrollment.
 * Fetches via API client (which injects the auth token), creates a blob URL,
 * and opens it in a new browser tab for viewing/printing.
 */
export async function downloadBoletin(enrollmentId: string): Promise<void> {
  const res = await apiClient.get(`/reportes/boletin/${enrollmentId}`, {
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
 */
export async function downloadBoletinBatch(cycleId: string): Promise<void> {
  const res = await apiClient.get(`/reportes/boletin/curso/${cycleId}`, {
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
