import {
  renderContractHtml,
  type ContractPdfModel,
} from './contract-pdf.service';
import { CONTRACT_BODY_SKELETON } from './hr-print-merge';
import { HR_BRAND } from './hr-print-layout';

describe('renderContractHtml', () => {
  const base: ContractPdfModel = {
    companyName: 'Fromagerie Demo',
    vatNumber: '123',
    employeeName: 'Amine',
    matricule: 'E-001',
    cnssNo: 'CNSS1',
    cinNo: '12345678',
    address: 'Tunis',
    bankName: 'BIAT',
    bankAgency: 'Centre',
    bankAccount: '12 345',
    jobTitle: 'Opérateur',
    department: 'Prod',
    contractNumber: 'CTR-2026-0001',
    contractType: 'CDI',
    startDate: '2024-01-15',
    endDate: '',
    wageRef: 'grille A',
    wageBase: '1200.000',
    notes: '',
    hiredAt: '2024-01-01',
    letterhead: '',
    bodyHtml: '',
    footer: '',
  };

  it('renders brand chrome with logo and coords', () => {
    const html = renderContractHtml(base);
    expect(html).toContain('CTR-2026-0001');
    expect(html).toContain('Amine');
    expect(html).toContain(HR_BRAND.legalName);
    expect(html).toContain(HR_BRAND.taxId);
    expect(html).toContain('fattoriecovelligroup@gmail.com');
    expect(html).toMatch(/data:image\/jpeg;base64,/);
    expect(html).not.toContain('Code du travail');
  });

  it('applies placeholders in human body', () => {
    const html = renderContractHtml({
      ...base,
      bodyHtml: '<p>Bonjour {{employeeName}} — {{cinNo}} — {{contractType}}</p>',
    });
    expect(html).toContain('Bonjour Amine — 12345678 — CDI');
  });

  it('renders structural skeleton placeholders', () => {
    const html = renderContractHtml({
      ...base,
      companyName: HR_BRAND.legalName,
      bodyHtml: CONTRACT_BODY_SKELETON,
    });
    expect(html).toContain(HR_BRAND.legalName);
    expect(html).toContain('BIAT');
    expect(html).not.toContain('Code du travail');
  });
});
