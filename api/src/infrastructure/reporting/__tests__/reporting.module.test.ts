/**
 * reporting-module-compartido (issue #101) — RPI-S1..S5.
 *
 * Verifies that `ReportingModule` exports a single shared `PdfGeneratorService`
 * instance to any module that imports it (RPI-R1/R2/R3), using stub consumer
 * modules instead of the three real feature modules (design.md ADR-02 — avoids
 * dragging AuthModule/PrismaService/repos into a DI-semantics test).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';

// ── Mock puppeteer ───────────────────────────────────────────────────────────
// Same pattern as pdf-generator.service.test.ts: mock puppeteer.launch() to
// return a fake Browser whose newPage() returns a fake Page.

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
import { ReportingModule } from '../reporting.module';
import { PdfGeneratorService } from '../pdf-generator.service';
import { PDF_PORT } from '../../../application/shared/ports/pdf.port';

// ── Stub consumer modules (design.md ADR-02, opción ii) ─────────────────────
// Replicate EXACTLY what a real feature module does: import ReportingModule,
// without registering its own copy of PdfGeneratorService and without
// dragging AuthModule/PrismaService/repos.

@Module({
  imports: [ReportingModule],
  providers: [{ provide: 'A_PDF', useExisting: PdfGeneratorService }],
  exports: ['A_PDF'],
})
class ConsumerAModule {}

@Module({
  imports: [ReportingModule],
  providers: [{ provide: 'B_PDF', useExisting: PdfGeneratorService }],
  exports: ['B_PDF'],
})
class ConsumerBModule {}

describe('ReportingModule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLaunch.mockResolvedValue(mockBrowser);
    mockBrowser.newPage.mockResolvedValue(mockPage);
    mockPagePdf.mockResolvedValue(Buffer.from('PDF'));
  });

  // ── RPI-S1 ───────────────────────────────────────────────────────────────

  it('resolves the same PdfGeneratorService reference from two modules that import ReportingModule', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConsumerAModule, ConsumerBModule],
    }).compile();

    expect(moduleRef.get('A_PDF')).toBe(moduleRef.get('B_PDF'));
  });

  // ── RPI-S2 ───────────────────────────────────────────────────────────────

  it('does not launch a browser at bootstrap, before any generatePdf call', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConsumerAModule, ConsumerBModule],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    expect(mockLaunch).not.toHaveBeenCalled();

    await app.close();
  });

  // ── RPI-S3 ───────────────────────────────────────────────────────────────

  it('reuses the same browser across 3 sequential generatePdf calls (launch called once)', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConsumerAModule, ConsumerBModule],
    }).compile();
    const svc = moduleRef.get(PdfGeneratorService);

    await svc.generatePdf('<html></html>');
    await svc.generatePdf('<html></html>');
    await svc.generatePdf('<html></html>');

    expect(mockLaunch).toHaveBeenCalledTimes(1);
  });

  // ── RPI-S4 ───────────────────────────────────────────────────────────────

  it('closes the browser exactly once when the app shuts down after a generatePdf call', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConsumerAModule, ConsumerBModule],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    const svc = moduleRef.get(PdfGeneratorService);

    await svc.generatePdf('<html></html>');
    await app.close();

    expect(mockBrowser.close).toHaveBeenCalledTimes(1);
  });

  // ── RPI-S5 ───────────────────────────────────────────────────────────────

  it('does not close any browser when an isolated instance that never generated a PDF is shut down', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ReportingModule],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    await app.close();

    expect(mockBrowser.close).not.toHaveBeenCalled();
  });

  // ── PDP-S5 ───────────────────────────────────────────────────────────────

  it('resolves PDF_PORT and PdfGeneratorService to the same instance (PDP-S5)', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ReportingModule],
    }).compile();

    expect(moduleRef.get(PDF_PORT)).toBe(moduleRef.get(PdfGeneratorService));
  });
});
