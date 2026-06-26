import apiClient from '../api/client';

type ConstanciaBody = {
  destinatario: string;
  fechaEmision: string;
};

/**
 * Opens a Constancia de Alumno Regular PDF in a new browser tab.
 *
 * Uses POST (not GET) because the request carries a body with variable inputs
 * (destinatario, fechaEmision). This differs from the boletín flow, which is a
 * stateless GET keyed only on axccId.
 *
 * REQ-8 Sc8.3
 */
export async function printConstancia(
  axccId: string,
  body: ConstanciaBody,
): Promise<void> {
  const res = await apiClient.post(`/reportes/constancia-regular/${axccId}`, body, {
    responseType: 'blob',
  });
  const blobUrl = URL.createObjectURL(res.data as Blob);
  window.open(blobUrl, '_blank');
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

/**
 * Downloads a Constancia de Alumno Regular PDF as a file attachment.
 *
 * REQ-8 Sc8.4
 */
export async function downloadConstancia(
  axccId: string,
  body: ConstanciaBody,
): Promise<void> {
  const res = await apiClient.post(`/reportes/constancia-regular/${axccId}`, body, {
    responseType: 'blob',
  });
  const blobUrl = URL.createObjectURL(res.data as Blob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = 'constancia-regular.pdf';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}
