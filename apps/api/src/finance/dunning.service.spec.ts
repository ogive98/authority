import { Prisma } from '@prisma/client';
import {
  buildBody,
  buildMailtoHref,
  buildSubject,
  buildWaMeHref,
} from './dunning.service';

describe('dunning FR template (D190)', () => {
  const ctx = {
    openItem: {
      number: 'AR-2026-0001',
      label: 'Livraison fromage',
      amountOpen: new Prisma.Decimal('120.500'),
      currency: 'TND',
      dueDate: new Date('2026-08-01T00:00:00.000Z'),
    },
    customerName: 'Fromagerie Atlas',
    daysPastDue: 15,
  };

  it('builds subject without inventing fees', () => {
    expect(buildSubject(ctx)).toBe(
      'Relance — créance AR-2026-0001 — 120.500 TND',
    );
  });

  it('builds body with as-recorded amount', () => {
    const body = buildBody(ctx);
    expect(body).toContain('120.500 TND');
    expect(body).toContain('J+15');
    expect(body).toContain('Aucun frais ni pénalité');
  });

  it('builds mailto and wa.me hrefs', () => {
    const subject = buildSubject(ctx);
    const body = buildBody(ctx);
    expect(buildMailtoHref('a@b.tn', subject, body)).toContain(
      'mailto:a@b.tn?subject=',
    );
    expect(buildWaMeHref('+216 12 345 678', body)).toMatch(
      /^https:\/\/wa\.me\/21612345678\?text=/,
    );
  });
});
