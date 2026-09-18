import assert from 'node:assert/strict';
import { renderQuoteHtml } from './quote-pdf.service';

describe('QuotePdfService HTML (D318)', () => {
  it('renders lines, discount, and total', () => {
    const html = renderQuoteHtml({
      number: 'DEV-2026-0001',
      status: 'SENT',
      currency: 'TND',
      customerName: 'Fromagerie Demo',
      customerCode: 'C-DEMO',
      validUntil: '2026-10-01',
      notes: 'Livraison frigo',
      amountTotal: '90.000',
      lines: [
        {
          lineNo: 1,
          description: 'FR-1 — Fromage',
          qty: '10.000',
          unitPrice: '10.000',
          discountPct: '10.00',
          lineTotal: '90.000',
        },
      ],
    });
    assert.match(html, /DEV-2026-0001/);
    assert.match(html, /FR-1 — Fromage/);
    assert.match(html, /90\.000/);
    assert.match(html, /Remise %/);
    assert.match(html, /Livraison frigo/);
  });

  it('omits empty notes block', () => {
    const html = renderQuoteHtml({
      number: 'DEV-2',
      status: 'DRAFT',
      currency: 'TND',
      customerName: 'Client',
      customerCode: null,
      validUntil: null,
      notes: null,
      amountTotal: '0.000',
      lines: [],
    });
    assert.doesNotMatch(html, /<strong>Notes<\/strong>/);
  });
});
