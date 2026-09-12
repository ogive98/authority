import type { DocumentDto } from '../documents/documents.service';
import type { HrEmployeeDto } from '../hr/hr.service';

/** Portal-safe employee profile — no wage / tax internals / Identity secrets. */
export type PortalEmployeeProfile = {
  employeeId: string;
  companyId: string;
  matricule: string;
  displayName: string;
  status: string;
  department: string | null;
  jobTitle: string | null;
  siteName: string | null;
  email: string | null;
  cinNo: string | null;
  address: string | null;
  bankName: string | null;
  bankAgency: string | null;
  /** Masked IBAN/RIB — last 4 only when long enough. */
  bankAccountMasked: string | null;
  hiredAt: string | null;
  photoDocumentId: string | null;
  hasAttestationPdf: boolean;
};

export type PortalDocument = {
  id: string;
  number: string;
  title: string;
  mime: string;
  size: string;
  kindCode: string | null;
  kindName: string | null;
  createdAt: string;
};

export type PortalDashboard = {
  pendingAbsences: number;
  approvedAbsences: number;
  documentCount: number;
  lastBulletin: {
    id: string;
    number: string;
    periodYm: string;
    netPay: string;
    currency: string;
  } | null;
};

export function toPortalProfile(dto: HrEmployeeDto): PortalEmployeeProfile {
  return {
    employeeId: dto.id,
    companyId: dto.companyId,
    matricule: dto.matricule,
    displayName: dto.displayName,
    status: dto.status,
    department: dto.department,
    jobTitle: dto.jobTitle,
    siteName: dto.site?.code ?? null,
    email: dto.email,
    cinNo: dto.cinNo,
    address: dto.address,
    bankName: dto.bankName,
    bankAgency: dto.bankAgency,
    bankAccountMasked: maskBankAccount(dto.bankAccount),
    hiredAt: dto.hiredAt,
    photoDocumentId: dto.photoDocumentId,
    hasAttestationPdf: Boolean(dto.attestationPdfDocumentId),
  };
}

export function toPortalDocument(doc: DocumentDto): PortalDocument {
  return {
    id: doc.id,
    number: doc.number,
    title: doc.title,
    mime: doc.mime,
    size: doc.size,
    kindCode: doc.hrDocKind?.code ?? null,
    kindName: doc.hrDocKind?.name ?? null,
    createdAt: doc.createdAt,
  };
}

function maskBankAccount(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.length <= 4) return '••••';
  return `••••${trimmed.slice(-4)}`;
}
