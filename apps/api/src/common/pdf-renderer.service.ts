import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { Browser } from 'playwright';

/**
 * One shared headless Chromium instance for all PDF rendering (was: one
 * browser launch per document = 300-500MB RAM and 2-4s latency each time).
 * Pages are still per-render; only the browser is pooled. Concurrent
 * renders are capped to bound memory under traffic spikes.
 */
@Injectable()
export class PdfRendererService implements OnModuleDestroy {
  private readonly logger = new Logger(PdfRendererService.name);
  private browser: Browser | null = null;
  private launching: Promise<Browser> | null = null;
  private active = 0;
  private queue: Array<() => void> = [];
  private static readonly MAX_CONCURRENT_PAGES = 3;

  async render(
    html: string,
    margin = { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' },
  ): Promise<Buffer> {
    await this.acquireSlot();
    try {
      const browser = await this.getBrowser();
      const page = await browser.newPage();
      try {
        await page.setContent(html, { waitUntil: 'networkidle' });
        const pdf = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin,
        });
        return Buffer.from(pdf);
      } finally {
        await page.close().catch(() => undefined);
      }
    } finally {
      this.releaseSlot();
    }
  }

  private async acquireSlot(): Promise<void> {
    if (this.active < PdfRendererService.MAX_CONCURRENT_PAGES) {
      this.active += 1;
      return;
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.active += 1;
  }

  private releaseSlot(): void {
    this.active -= 1;
    const next = this.queue.shift();
    if (next) next();
  }

  private async getBrowser() {
    if (this.browser?.isConnected()) return this.browser;
    if (this.launching) return this.launching;
    this.launching = this.launchBrowser().finally(() => {
      this.launching = null;
    });
    return this.launching;
  }

  private async launchBrowser(): Promise<Browser> {
    let playwright: typeof import('playwright');
    try {
      playwright = await import('playwright');
    } catch (error) {
      this.logger.error(
        `playwright import failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error(
        'PDF engine unavailable — playwright is not installed (npm install in apps/api).',
      );
    }
    try {
      const browser = await playwright.chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      // A crashed browser would otherwise stay "connected" in our cache.
      browser.on('disconnected', () => {
        if (this.browser === browser) this.browser = null;
      });
      this.browser = browser;
      this.logger.log('shared chromium browser launched for PDF rendering');
      return browser;
    } catch (error) {
      this.logger.error(
        `chromium launch failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error(
        'Chromium unavailable for PDF — run npx playwright install chromium.',
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.browser?.close().catch(() => undefined);
    this.browser = null;
  }
}
