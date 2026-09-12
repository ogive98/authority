/**
 * HR print merge helpers (D217) — placeholders only; never invent legal clauses.
 * Tunisian CIN = 8 digits when set.
 */

export const TUNISIAN_CIN_RE = /^\d{8}$/;

export function normalizeCinOrNull(
  raw: string | null | undefined,
): string | null {
  if (raw === undefined || raw === null) return null;
  const t = raw.trim();
  if (!t) return null;
  return t;
}

export function assertTunisianCin(raw: string | null | undefined): string | null {
  const t = normalizeCinOrNull(raw);
  if (t === null) return null;
  if (!TUNISIAN_CIN_RE.test(t)) {
    throw new Error('CIN_INVALID');
  }
  return t;
}

export type HrPrintMergeFields = {
  companyName: string;
  vatNumber: string;
  employeeName: string;
  matricule: string;
  cnssNo: string;
  cinNo: string;
  address: string;
  bankName: string;
  bankAgency: string;
  bankAccount: string;
  jobTitle: string;
  department: string;
  contractNumber: string;
  contractType: string;
  startDate: string;
  endDate: string;
  wageRef: string;
  wageBase: string;
  notes: string;
  hiredAt: string;
};

export function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Apply {{placeholders}} — body HTML is trusted company Prefs / catalogue only. */
export function applyPrintPlaceholders(
  template: string,
  m: HrPrintMergeFields,
): string {
  const map: Record<string, string> = { ...m };
  return template.replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (_, key: string) => {
    return map[key] ?? '';
  });
}

/** Structural skeletons — labels + placeholders only; no Code du travail text. */
export const CONTRACT_BODY_SKELETON = `<p>Entre <strong>{{companyName}}</strong> et <strong>{{employeeName}}</strong> (matricule {{matricule}}).</p>
<p>CIN {{cinNo}} · CNSS {{cnssNo}} · Adresse {{address}}</p>
<p>Contrat {{contractType}} n° {{contractNumber}} à compter du {{startDate}} (fin : {{endDate}}).</p>
<p>Rémunération de référence : {{wageRef}} · Base {{wageBase}} TND.</p>`;

export const ATTESTATION_BODY_SKELETON = `<p>La direction de <strong>{{companyName}}</strong> atteste que <strong>{{employeeName}}</strong> (matricule {{matricule}}) exerce au sein de l’entreprise.</p>
<p>CIN {{cinNo}} · CNSS {{cnssNo}} · Poste {{jobTitle}} · Département {{department}}.</p>
<p>Contrat {{contractType}} n° {{contractNumber}} en cours depuis le {{startDate}} · Embauche {{hiredAt}}.</p>
<p>La présente attestation est délivrée pour servir et valoir ce que de droit.</p>`;
