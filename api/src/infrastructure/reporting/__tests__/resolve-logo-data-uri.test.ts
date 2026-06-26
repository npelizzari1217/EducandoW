import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveLogoDataUri } from '../resolve-logo-data-uri';

// ── Mock global fetch ────────────────────────────────────────────────────────

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeOkResponse(body: ArrayBuffer, contentType: string) {
  return {
    ok: true,
    status: 200,
    headers: {
      get: (name: string) => (name === 'content-type' ? contentType : null),
    },
    arrayBuffer: vi.fn().mockResolvedValue(body),
  };
}

function makeErrorResponse(status = 404) {
  return {
    ok: false,
    status,
    headers: { get: vi.fn().mockReturnValue(null) },
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('resolveLogoDataUri', () => {
  // ── Null / undefined guard ──────────────────────────────────────────────────

  it('returns null for null input', async () => {
    const result = await resolveLogoDataUri(null);
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns null for undefined input', async () => {
    const result = await resolveLogoDataUri(undefined);
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns null for empty string', async () => {
    const result = await resolveLogoDataUri('');
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // ── Happy path: 200 with PNG ────────────────────────────────────────────────

  it('returns data:image/png;base64,... for a valid 200 PNG response', async () => {
    // Use Uint8Array.from() to get a proper isolated ArrayBuffer (avoids Node.js pool issue)
    const srcBuf = Buffer.from('fake-png-bytes');
    const body = new Uint8Array(srcBuf).buffer;
    mockFetch.mockResolvedValue(makeOkResponse(body, 'image/png'));

    const result = await resolveLogoDataUri('https://example.com/logo.png');

    expect(result).not.toBeNull();
    expect(result).toMatch(/^data:image\/png;base64,/);
    const base64Part = result!.replace('data:image/png;base64,', '');
    expect(Buffer.from(base64Part, 'base64').toString()).toBe('fake-png-bytes');
  });

  // ── Happy path: 200 with JPEG ───────────────────────────────────────────────

  it('returns data:image/jpeg;base64,... for a valid 200 JPEG response', async () => {
    const body = new Uint8Array(Buffer.from('fake-jpg-bytes')).buffer;
    mockFetch.mockResolvedValue(makeOkResponse(body, 'image/jpeg'));

    const result = await resolveLogoDataUri('https://example.com/logo.jpg');

    expect(result).toMatch(/^data:image\/jpeg;base64,/);
  });

  // ── 404 → null ─────────────────────────────────────────────────────────────

  it('returns null when response is not ok (404)', async () => {
    mockFetch.mockResolvedValue(makeErrorResponse(404));

    const result = await resolveLogoDataUri('https://example.com/missing.png');
    expect(result).toBeNull();
  });

  // ── 500 → null ─────────────────────────────────────────────────────────────

  it('returns null when response is not ok (500)', async () => {
    mockFetch.mockResolvedValue(makeErrorResponse(500));

    const result = await resolveLogoDataUri('https://example.com/logo.png');
    expect(result).toBeNull();
  });

  // ── Network error → null ────────────────────────────────────────────────────

  it('returns null on network error (fetch throws)', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await resolveLogoDataUri('https://example.com/logo.png');
    expect(result).toBeNull();
  });

  // ── AbortController timeout → null ─────────────────────────────────────────

  it('returns null on AbortError (timeout)', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    mockFetch.mockRejectedValue(abortError);

    const result = await resolveLogoDataUri('https://example.com/logo.png');
    expect(result).toBeNull();
  });

  // ── Uses AbortController with signal ───────────────────────────────────────

  it('passes an AbortSignal to fetch', async () => {
    mockFetch.mockResolvedValue(makeOkResponse(new ArrayBuffer(0), 'image/png'));

    await resolveLogoDataUri('https://example.com/logo.png');

    const [, fetchOptions] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(fetchOptions?.signal).toBeDefined();
    expect(fetchOptions?.signal).toBeInstanceOf(AbortSignal);
  });

  // ── Content-Type fallback: no content-type header → image/png ──────────────

  it('defaults mime to image/png when Content-Type header is absent', async () => {
    const body = Buffer.from('bytes').buffer;
    const response = {
      ok: true,
      status: 200,
      headers: { get: () => null },
      arrayBuffer: vi.fn().mockResolvedValue(body),
    };
    mockFetch.mockResolvedValue(response);

    const result = await resolveLogoDataUri('https://example.com/logo');
    expect(result).toMatch(/^data:image\/png;base64,/);
  });

  // ── Fix 4: arrayBuffer() error → null (slow/aborted body) ──────────────────
  // fetch() resolves (headers ok) but body download fails. clearTimeout must NOT
  // be called before arrayBuffer() so the AbortController can still fire on timeout.

  it('[fix-4] returns null when arrayBuffer() throws an AbortError (body abort)', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'image/png' },
      arrayBuffer: vi.fn().mockRejectedValue(abortError),
    });

    const result = await resolveLogoDataUri('https://example.com/logo.png');
    expect(result).toBeNull();
  });

  it('[fix-4] returns null when arrayBuffer() throws a generic error (body truncated)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'image/png' },
      arrayBuffer: vi.fn().mockRejectedValue(new Error('connection reset by peer')),
    });

    const result = await resolveLogoDataUri('https://example.com/logo.png');
    expect(result).toBeNull();
  });

  // ── Timeout: the setTimeout callback fires and aborts the fetch ────────────
  // Covers the `() => controller.abort()` branch that was never triggered in
  // previous tests (which threw AbortError directly instead of via the timer).

  it('[timeout] calls controller.abort() and returns null when fetch hangs for more than 5 s', async () => {
    vi.useFakeTimers();

    // Mock fetch to return a promise that hangs until the AbortSignal fires,
    // then rejects with AbortError — matching real fetch behaviour on abort.
    mockFetch.mockImplementation((_url: string, opts: RequestInit) => {
      const signal = opts?.signal as AbortSignal;
      return new Promise<never>((_resolve, reject) => {
        const doAbort = () => {
          const err = Object.assign(new Error('The operation was aborted'), {
            name: 'AbortError',
          });
          reject(err);
        };
        if (signal?.aborted) {
          doAbort();
        } else {
          signal?.addEventListener('abort', doAbort);
        }
      });
    });

    const resultPromise = resolveLogoDataUri('https://example.com/slow-logo.png');

    // Advance fake clock past the 5-second timeout; advanceTimersByTimeAsync
    // flushes both timers and the microtask/promise queue between ticks.
    await vi.advanceTimersByTimeAsync(5_001);

    const result = await resultPromise;
    expect(result).toBeNull();
    // fetch was called once (with a signal)
    expect(mockFetch).toHaveBeenCalledOnce();
    const [, fetchOpts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(fetchOpts?.signal).toBeInstanceOf(AbortSignal);
    expect((fetchOpts.signal as AbortSignal).aborted).toBe(true);
  });
});
