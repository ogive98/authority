import { renderMinimalLegalHtml } from './bulletin-pdf.service';

describe('bulletin PDF HTML (D202)', () => {
  it('renders abatement lines in minimal legal layout', () => {
    const html = renderMinimalLegalHtml({
      number: 'BUL-2026-09-0001',
      periodYm: '2026-09',
      employeeName: 'Ada',
      matricule: 'E-1',
      contractNumber: 'CTR-1',
      wageBase: '2000.000',
      cnssEmployeeAmount: '100.000',
      cnssEmployerAmount: '200.000',
      irppMonthly: '50.000',
      netPay: '1850.000',
      currency: 'TND',
      annualTaxableBeforeAbat: '22800.000',
      abatChefAnnual: '1000.000',
      abatEnfantAnnual: '500.000',
      abatTotalAnnual: '1500.000',
      taxChefDeFamille: true,
      taxEnfantCount: 1,
    });
    expect(html).toContain('Abattement chef de famille');
    expect(html).toContain('1850.000');
    expect(html).not.toContain('Soft Glass');
  });
});
