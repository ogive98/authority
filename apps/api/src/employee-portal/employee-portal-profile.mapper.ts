import type { DocumentDto } from '../documents/documents.service';
import type { HrEmployeeDto } from '../hr/hr.service';
import {
  isValidTunisianRibDigits,
  normalizeRibInput,
  parseTunisianRib,
} from '../hr/rib-tn';

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
  /** Own RIB — full compact digits when set (editable on portal). */
  bankAccount: string | null;
  bankAccountFormatted: string | null;
  bankAccountValid: boolean;
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
  const raw = dto.bankAccount?.trim() || null;
  let digits: string | null = null;
  let formatted: string | null = null;
  let valid = false;
  if (raw) {
    const compact = normalizeRibInput(raw);
    if (/^\d{20}$/.test(compact) && isValidTunisianRibDigits(compact)) {
      digits = compact;
      formatted = parseTunisianRib(compact).formatted;
      valid = true;
    } else {
      digits = compact;
      formatted = raw;
      valid = false;
    }
  }

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
    bankAccount: digits,
    bankAccountFormatted: formatted,
    bankAccountValid: valid,
    bankAccountMasked: maskBankAccount(digits ?? raw),
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
