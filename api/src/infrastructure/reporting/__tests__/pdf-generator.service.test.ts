import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock puppeteer ───────────────────────────────────────────────────────────
// PdfGeneratorService keeps a single shared Browser instance (lazy-launched on
// first newPage() call). We mock puppeteer.launch() to return a fake Browser
// whose newPage() returns a fake Page recording the options passed to page.pdf().

const mockPagePdf = vi.fn().mockResolvedValue(Buffer.from('PDF'));
const mockPageSetContent = vi.fn().mockResolvedValue(undefined);
const mockPageClose = vi.fn().mockResolvedValue(undefined);

const mockPage = {
  setContent: mockPageSetContent,
  pdf: mockPagePdf,
  close: mockPageClose,
};

const mockBrowser = {
  newPage: vi.fn().mockResolvedValue(mockPage),
  close: vi.fn().mockResolvedValue(undefined),
};

const mockLaunch = vi.fn().mockResolvedValue(mockBrowser);

vi.mock('puppeteer', () => ({
  default: {
    launch: (...args: unknown[]) => mockLaunch(...args),
  },
}));

// Import after the mock so the module picks up the mocked puppeteer.
import { PdfGeneratorService } from '../pdf-generator.service';

describe('PdfGeneratorService', () => {
  let service: PdfGeneratorService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLaunch.mockResolvedValue(mockBrowser);
    mockBrowser.newPage.mockResolvedValue(mockPage);
    mockPagePdf.mockResolvedValue(Buffer.from('PDF'));
    service = new PdfGeneratorService();
  });

  // ── Regression guard: no options → unchanged portrait A4 defaults ──────────

  it('generatePdf(html) with no options calls page.pdf with unchanged portrait A4 defaults', async () => {
    await service.generatePdf('<html></html>');

    expect(mockPagePdf).toHaveBeenCalledOnce();
    const [callArgs] = mockPagePdf.mock.calls[0] as [Record<string, unknown>];
    expect(callArgs).toMatchObject({
      format: 'A4',
      landscape: false,
      margin: { top: '15mm', bottom: '15mm', left: '12mm', right: '12mm' },
      printBackground: true,
      preferCSSPageSize: false,
      displayHeaderFooter: false,
    });
  });

  // ── Landscape option ────────────────────────────────────────────────────────

  it('generatePdf(html, { landscape: true }) passes landscape: true to page.pdf', async () => {
    await service.generatePdf('<html></html>', { landscape: true });

    expect(mockPagePdf).toHaveBeenCalledOnce();
    const [callArgs] = mockPagePdf.mock.calls[0] as [Record<string, unknown>];
    expect(callArgs).toMatchObject({ format: 'A4', landscape: true });
  });

  it('generatePdf(html, { landscape: false }) explicitly keeps portrait', async () => {
    await service.generatePdf('<html></html>', { landscape: false });

    const [callArgs] = mockPagePdf.mock.calls[0] as [Record<string, unknown>];
    expect(callArgs).toMatchObject({ landscape: false });
  });

  // ── Margin override ─────────────────────────────────────────────────────────

  it('generatePdf(html, { margin }) overrides only the provided margin keys, others keep default', async () => {
    await service.generatePdf('<html></html>', { margin: { top: '5mm', left: '5mm' } });

    const [callArgs] = mockPagePdf.mock.calls[0] as [Record<string, unknown>];
    expect(callArgs.margin).toEqual({
      top: '5mm',
      left: '5mm',
      bottom: '15mm',
      right: '12mm',
    });
  });

  it('generatePdf(html, { landscape: true, margin }) combines both overrides', async () => {
    await service.generatePdf('<html></html>', {
      landscape: true,
      margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' },
    });

    const [callArgs] = mockPagePdf.mock.calls[0] as [Record<string, unknown>];
    expect(callArgs).toMatchObject({
      format: 'A4',
      landscape: true,
      margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' },
    });
  });
});
