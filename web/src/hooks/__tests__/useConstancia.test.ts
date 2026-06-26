/**
 * useConstancia — T-14 + review gaps
 *
 * Cases:
 *   Sc8.3: printConstancia POSTs with body + responseType:blob and opens blob URL in new tab
 *   Sc8.3b: printConstancia revokes the blob URL after 60 s
 *   Sc8.4: downloadConstancia POSTs and triggers anchor download with correct filename
 *   Sc8.4b: downloadConstancia revokes blob URL immediately (timeout 0)
 *   Sc8.5: 422 from printConstancia propagates to caller
 *   Sc8.5b: 422 from downloadConstancia propagates to caller (symmetry)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock apiClient ─────────────────────────────────────────────────────────────
// vi.hoisted is required because vi.mock factory runs before variable declarations.
const { mockPost } = vi.hoisted(() => ({ mockPost: vi.fn() }));

vi.mock('../../api/client', () => ({
  default: { post: mockPost },
}));

// ── Import hook after mocks ────────────────────────────────────────────────────
import { printConstancia, downloadConstancia } from '../useConstancia';

describe('useConstancia', () => {
  const FAKE_BLOB_URL = 'blob:http://localhost/fake-constancia-pdf';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // JSDOM does not implement URL.createObjectURL / revokeObjectURL — stub them
    URL.createObjectURL = vi.fn(() => FAKE_BLOB_URL);
    URL.revokeObjectURL = vi.fn();

    // Stub window.open
    vi.stubGlobal('open', vi.fn(() => null));

    // Default: POST resolves with a Blob
    mockPost.mockResolvedValue({
      data: new Blob(['%PDF-1.4'], { type: 'application/pdf' }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // ── printConstancia ──────────────────────────────────────────────────────────

  it('Sc8.3: POSTs with body + responseType:blob and opens blob URL in a new tab', async () => {
    const body = { destinatario: 'A pedido del interesado', fechaEmision: '2026-06-26' };
    await printConstancia('axcc-42', body);

    expect(mockPost).toHaveBeenCalledWith(
      '/reportes/constancia-regular/axcc-42',
      body,
      { responseType: 'blob' },
    );
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(window.open).toHaveBeenCalledWith(FAKE_BLOB_URL, '_blank');
  });

  it('Sc8.3b: printConstancia revokes blob URL after 60 s (no leak)', async () => {
    const body = { destinatario: 'A pedido', fechaEmision: '2026-06-26' };
    await printConstancia('axcc-42', body);

    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_001);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(FAKE_BLOB_URL);
  });

  // ── downloadConstancia ───────────────────────────────────────────────────────

  it('Sc8.4: POSTs and creates anchor with download="constancia-regular.pdf"', async () => {
    const mockAnchor = { href: '', download: '', click: vi.fn() };
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockReturnValue(mockAnchor as unknown as HTMLAnchorElement);
    const appendChildSpy = vi
      .spyOn(document.body, 'appendChild')
      .mockReturnValue(mockAnchor as unknown as Node);
    const removeChildSpy = vi
      .spyOn(document.body, 'removeChild')
      .mockReturnValue(mockAnchor as unknown as Node);

    const body = { destinatario: 'Para uso interno', fechaEmision: '2026-06-26' };
    await downloadConstancia('axcc-99', body);

    expect(mockPost).toHaveBeenCalledWith(
      '/reportes/constancia-regular/axcc-99',
      body,
      { responseType: 'blob' },
    );
    expect(mockAnchor.href).toBe(FAKE_BLOB_URL);
    expect(mockAnchor.download).toBe('constancia-regular.pdf');
    expect(mockAnchor.click).toHaveBeenCalled();

    // Revoke fires immediately (timeout 0) — advance past it before asserting
    vi.advanceTimersByTime(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(FAKE_BLOB_URL);

    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });

  it('Sc8.4b: downloadConstancia revokes blob URL immediately after click (no leak)', async () => {
    const mockAnchor = { href: '', download: '', click: vi.fn() };
    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as unknown as HTMLAnchorElement);
    vi.spyOn(document.body, 'appendChild').mockReturnValue(mockAnchor as unknown as Node);
    vi.spyOn(document.body, 'removeChild').mockReturnValue(mockAnchor as unknown as Node);

    await downloadConstancia('axcc-99', { destinatario: 'X', fechaEmision: '2026-06-26' });

    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(FAKE_BLOB_URL);
  });

  // ── Error propagation ────────────────────────────────────────────────────────

  it('Sc8.5: 422 from printConstancia propagates to caller without being swallowed', async () => {
    const apiError = Object.assign(new Error('Unprocessable Entity'), {
      response: { status: 422, data: { error: 'STUDENT_NOT_ELIGIBLE' } },
    });
    mockPost.mockRejectedValue(apiError);

    await expect(
      printConstancia('axcc-err', { destinatario: 'X', fechaEmision: '2026-06-26' }),
    ).rejects.toThrow('Unprocessable Entity');
  });

  it('Sc8.5b: 422 from downloadConstancia propagates to caller without being swallowed', async () => {
    const apiError = Object.assign(new Error('Unprocessable Entity'), {
      response: { status: 422, data: { error: 'STUDENT_NOT_ELIGIBLE' } },
    });
    mockPost.mockRejectedValue(apiError);

    await expect(
      downloadConstancia('axcc-err', { destinatario: 'X', fechaEmision: '2026-06-26' }),
    ).rejects.toThrow('Unprocessable Entity');
  });
});
