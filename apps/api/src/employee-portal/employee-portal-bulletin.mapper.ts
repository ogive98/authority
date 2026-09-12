import type { BulletinDto } from '../hr/bulletin.service';

/** Employee-facing bulletin — no company/snapshot internals. */
export type PortalBulletinDto = {
  id: string;
  number: string;
  periodYm: string;
  employeeId: string;
  contractId: string;
  wageBase: string;
  cnssEmployeeAmount: string;
  cnssEmployerAmount: string;
  irppMonthly: string;
  netPay: string;
  currency: string;
  pdfDocumentId: string | null;
  employeeName: string | null;
  matricule: string | null;
  contractNumber: string | null;
  annualTaxableBeforeAbat: string | null;
  abatChefAnnual: string | null;
  abatEnfantAnnual: string | null;
  abatTotalAnnual: string | null;
  taxChefDeFamille: boolean | null;
  taxEnfantCount: number | null;
  createdAt: string;
};

export function toPortalBulletin(b: BulletinDto): PortalBulletinDto {
  return {
    id: b.id,
    number: b.number,
    periodYm: b.periodYm,
    employeeId: b.employeeId,
    contractId: b.contractId,
    wageBase: b.wageBase,
    cnssEmployeeAmount: b.cnssEmployeeAmount,
    cnssEmployerAmount: b.cnssEmployerAmount,
    irppMonthly: b.irppMonthly,
    netPay: b.netPay,
    currency: b.currency,
    pdfDocumentId: b.pdfDocumentId,
    employeeName: b.employeeName,
    matricule: b.matricule,
    contractNumber: b.contractNumber,
    annualTaxableBeforeAbat: b.annualTaxableBeforeAbat,
    abatChefAnnual: b.abatChefAnnual,
    abatEnfantAnnual: b.abatEnfantAnnual,
    abatTotalAnnual: b.abatTotalAnnual,
    taxChefDeFamille: b.taxChefDeFamille,
    taxEnfantCount: b.taxEnfantCount,
    createdAt: b.createdAt,
  };
}
