import {
  buildPain001Xml,
  buildSepaFromTransferFacts,
  formatSepaAmount,
} from './sepa-pain001';
import { isValidTunisianIban, toTunisianIban } from './rib-tn';

describe('sepa-pain001 (D240)', () => {
  const amen = '07040005810111129653';

  it('formats amount to 2 decimals', () => {
    expect(formatSepaAmount('1234.500')).toBe('1234.50');
    expect(formatSepaAmount('10')).toBe('10.00');
  });

  it('builds pain.001 with TN IBANs and NOTPROVIDED BIC', () => {
    const debtorIban = toTunisianIban(amen);
    const creditorIban = toTunisianIban(amen);
    expect(isValidTunisianIban(debtorIban)).toBe(true);

    const xml = buildPain001Xml({
      msgId: 'MSG-1',
      paymentInfoId: 'PMT-1',
      endToEndId: 'TO-2026-0001',
      createdAtIso: '2026-09-14T08:00:00Z',
      executionDate: '2026-09-14',
      initiatingPartyName: 'Fattorie Covelli',
      debtorName: 'Fattorie Covelli',
      debtorIban,
      debtorCurrency: 'TND',
      creditorName: 'Amine Ben Ali',
      creditorIban,
      amount: '1500.000',
      currency: 'TND',
      remittance: 'Salaire TO-2026-0001',
    });

    expect(xml).toContain('pain.001.001.03');
    expect(xml).toContain(`<IBAN>${debtorIban}</IBAN>`);
    expect(xml).toContain(`<IBAN>${creditorIban}</IBAN>`);
    expect(xml).toContain('NOTPROVIDED');
    expect(xml).toContain('<InstdAmt Ccy="TND">1500.00</InstdAmt>');
    expect(xml).toContain('<Cd>NURG</Cd>');
    expect(xml).not.toContain('<BIC>');
  });

  it('buildSepaFromTransferFacts returns downloadable filename', () => {
    const r = buildSepaFromTransferFacts({
      transferNumber: 'TO-2026-0001',
      companyLegalName: 'Fattorie Covelli SARL',
      companyBankRib: amen,
      beneficiaryName: 'Amine Ben Ali',
      beneficiaryBankAccount: amen,
      amount: '900.250',
      currency: 'TND',
      remittance: 'Salaire TO-2026-0001',
      now: new Date('2026-09-14T08:00:00.000Z'),
    });
    expect(r.filename).toBe('sepa-TO-2026-0001.xml');
    expect(r.xml).toContain('900.25');
    expect(r.msgId.length).toBeLessThanOrEqual(35);
  });
});
