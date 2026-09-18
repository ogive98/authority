import assert from 'node:assert/strict';
import { renderInvoiceHtml } from './invoice-pdf.service';

describe('InvoicePdfService HTML (D315)', () => {
  it('renders product lines and hides zero FODEC/timbre', () => {
    const html = renderInvoiceHtml({
      number: 'INV-2026-0001',
      label: 'Facture SO-1 · SH-1',
      status: 'ISSUED',
      currency: 'TND',
      customerName: 'Fromagerie Demo',
      customerCode: 'C-DEMO',
      issuedAt: '2026-09-18',
      salesOrderId: null,
      shipmentId: null,
      amountHt: '100.000',
      amountTax: '19.000',
      amountFodec: '0.000',
      amountTimbre: '0.000',
      amountTotal: '119.000',
      lines: [
        {
          lineNo: 1,
          description: 'FR-1 — Fromage',
          qty: '10.000',
          unitPriceHt: '10.000',
          amountHt: '100.000',
          amountTax: '19.000',
          amountTtc: '119.000',
        },
      ],
    });
    assert.match(html, /INV-2026-0001/);
    assert.match(html, /FR-1 — Fromage/);
    assert.match(html, /119\.000/);
    assert.doesNotMatch(html, />FODEC</);
    assert.doesNotMatch(html, />Timbre</);
  });

  it('shows FODEC/timbre only when amounts > 0', () => {
    const html = renderInvoiceHtml({
      number: 'INV-2',
      label: null,
      status: 'ISSUED',
      currency: 'TND',
      customerName: 'Client',
      customerCode: null,
      issuedAt: null,
      salesOrderId: null,
      shipmentId: null,
      amountHt: '100.000',
      amountTax: '19.000',
      amountFodec: '1.000',
      amountTimbre: '0.600',
      amountTotal: '120.600',
      lines: [],
    });
    assert.match(html, /FODEC/);
    assert.match(html, /Timbre/);
  });
});
