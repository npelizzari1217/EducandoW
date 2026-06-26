/**
 * Resolves an institution logo URL to a base64 data-URI string.
 *
 * Used by the constancia use case to embed logos in Puppeteer-rendered PDFs.
 * Puppeteer's headless mode cannot load external URLs via <img src="url"> in
 * setContent() calls (no base URL context, network may be offline). Converting
 * to a self-contained data-URI solves this reliably.
 *
 * Contract:
 *   - Any falsy input (null, undefined, '') → null immediately (no fetch).
 *   - Any network/HTTP error, non-2xx status, or timeout → null (never throws).
 *   - Success → "data:<mime>;base64,<b64>" string.
 *   - Default mime when Content-Type is absent: "image/png".
 *   - Timeout: 5 seconds via AbortController.
 */
export async function resolveLogoDataUri(
  url: string | null | undefined,
): Promise<string | null> {
  if (!url) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5_000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) return null;

    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const mime = res.headers.get('content-type') || 'image/png';

    return `data:${mime};base64,${base64}`;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}
