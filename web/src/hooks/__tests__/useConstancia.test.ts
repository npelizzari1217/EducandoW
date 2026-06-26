/**
 * useConstancia — T-14 (TDD RED)
 * Tests written BEFORE the hook exists.
 *
 * Cases:
 *   Sc8.3: printConstancia POSTs with body + responseType:blob and opens blob URL in new tab
 *   Sc8.4: downloadConstancia POSTs and triggers anchor download with correct filename
 *   Sc8.5: 422 error propagates to caller without being swallowed
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

  it('POSTs with body + responseType:blob and opens blob URL in a new tab (REQ-8 Sc8.3)', async () => {
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

  // ── downloadConstancia ───────────────────────────────────────────────────────

  it('POSTs and creates anchor with download="constancia-regular.pdf" (REQ-8 Sc8.4)', async () => {
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

    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });

  // ── Error propagation ────────────────────────────────────────────────────────

  it('422 error from apiClient propagates without being swallowed (REQ-8 Sc8.5)', async () => {
    const apiError = Object.assign(new Error('Unprocessable Entity'), {
      response: { status: 422, data: { error: 'STUDENT_NOT_ELIGIBLE' } },
    });
    mockPost.mockRejectedValue(apiError);

    await expect(
      printConstancia('axcc-err', { destinatario: 'X', fechaEmision: '2026-06-26' }),
    ).rejects.toThrow('Unprocessable Entity');
  });
});
