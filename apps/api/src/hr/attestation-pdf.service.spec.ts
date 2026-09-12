import {
  renderAttestationHtml,
  type AttestationPdfModel,
} from './attestation-pdf.service';
import { ATTESTATION_BODY_SKELETON, assertTunisianCin } from './hr-print-merge';
import { HR_BRAND } from './hr-print-layout';

describe('assertTunisianCin', () => {
  it('accepts 8 digits or empty', () => {
    expect(assertTunisianCin('12345678')).toBe('12345678');
    expect(assertTunisianCin('')).toBeNull();
    expect(assertTunisianCin(null)).toBeNull();
  });

  it('rejects non-8-digit', () => {
    expect(() => assertTunisianCin('123')).toThrow('CIN_INVALID');
    expect(() => assertTunisianCin('ABCDEFGH')).toThrow('CIN_INVALID');
  });
});

describe('renderAttestationHtml', () => {
  const base: AttestationPdfModel = {
    companyName: 'Fromagerie Demo',
    vatNumber: '123',
    employeeName: 'Amine',
    matricule: 'E-001',
    cnssNo: 'CNSS1',
    cinNo: '12345678',
    address: 'Tunis',
    bankName: '',
    bankAgency: '',
    bankAccount: '',
    jobTitle: 'Opérateur',
    department: 'Prod',
    contractNumber: 'CTR-2026-0001',
    contractType: 'CDI',
    startDate: '2024-01-15',
    endDate: '',
    wageRef: '',
    wageBase: '',
    notes: '',
    hiredAt: '2024-01-01',
    letterhead: '',
    bodyHtml: '',
    footer: '',
  };

  it('renders brand chrome without inventing legal formula', () => {
    const html = renderAttestationHtml(base);
    expect(html).toContain('Attestation de travail');
    expect(html).toContain('Amine');
    expect(html).toContain(HR_BRAND.legalName);
    expect(html).toContain('Sanhaja');
    expect(html).toMatch(/data:image\/jpeg;base64,/);
    expect(html).not.toContain('Code du travail');
  });

  it('applies skeleton placeholders', () => {
    const html = renderAttestationHtml({
      ...base,
      companyName: HR_BRAND.legalName,
      bodyHtml: ATTESTATION_BODY_SKELETON,
    });
    expect(html).toContain('Opérateur');
    expect(html).toContain('CTR-2026-0001');
    expect(html).toContain(HR_BRAND.legalName);
  });
});
