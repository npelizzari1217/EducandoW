import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import puppeteer, { Browser, Page } from 'puppeteer';

/**
 * PdfGeneratorService — renders HTML to PDF via Puppeteer.
 *
 * Maintains a single shared Browser instance to avoid startup cost per request.
 * Suitable for single-instance deployments. For horizontal scaling, consider
 * a browser pool or external rendering service.
 */
@Injectable()
export class PdfGeneratorService implements OnModuleDestroy {
  private readonly logger = new Logger(PdfGeneratorService.name);
  private browserPromise: Promise<Browser> | null = null;

  /** Renders the given HTML string to a PDF Buffer. */
  async generatePdf(html: string): Promise<Buffer> {
    const page = await this.newPage();
    try {
      await page.setContent(html, {
        waitUntil: 'load',
        timeout: 15_000,
      });

      const pdf = await page.pdf({
        format: 'A4',
        margin: { top: '15mm', bottom: '15mm', left: '12mm', right: '12mm' },
        printBackground: true,
        preferCSSPageSize: false,
        displayHeaderFooter: false,
      });

      return Buffer.from(pdf);
    } catch (err) {
      this.logger.error(`PDF generation failed: ${(err as Error).message}`);
      throw err;
    } finally {
      await page.close();
    }
  }

  // ── Browser lifecycle ──────────────────────────────────────

  private async getBrowser(): Promise<Browser> {
    if (!this.browserPromise) {
      this.browserPromise = puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });
      this.logger.log('Puppeteer browser launched');
    }
    try {
      return await this.browserPromise;
    } catch {
      // If launch failed, retry once
      this.logger.warn('Browser launch failed, retrying...');
      this.browserPromise = puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
      return this.browserPromise;
    }
  }

  private async newPage(): Promise<Page> {
    const browser = await this.getBrowser();
    return browser.newPage();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.browserPromise) {
      try {
        const browser = await this.browserPromise;
        await browser.close();
        this.logger.log('Puppeteer browser closed');
      } catch {
        // ignore
      }
      this.browserPromise = null;
    }
  }
}
