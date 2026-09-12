/**
 * Shared HR print chrome (D217+) — modern letterhead for contrat + attestation.
 * Brand block provided by company (logo + coordinates); no invented legal clauses.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  applyPrintPlaceholders,
  escHtml,
  type HrPrintMergeFields,
} from './hr-print-merge';

export const HR_BRAND = {
  legalName: 'FATTORIE COVELLI GROUP sarl',
  address: '3ᵉ ét. Golden Towers B 3-5, 1082 Centre Urbain Nord',
  taxId: '1327082/N/A/M000',
  phones: '+216 26 723 243 · 23 201 056',
  factory: 'Usine : Sanhaja KM 8, route de Bizerte',
  website: 'www.fattoriecovelli.it',
  email: 'fattoriecovelligroup@gmail.com',
  tagline: 'La Vera Mozzarella',
} as const;

let cachedLogoDataUri: string | null | undefined;

export function loadHrBrandLogoDataUri(): string | null {
  if (cachedLogoDataUri !== undefined) return cachedLogoDataUri;
  const candidates = [
    path.join(__dirname, '..', '..', 'assets', 'hr', 'fattorie-covelli-logo.jpg'),
    path.join(process.cwd(), 'assets', 'hr', 'fattorie-covelli-logo.jpg'),
    path.join(process.cwd(), 'apps', 'api', 'assets', 'hr', 'fattorie-covelli-logo.jpg'),
  ];
  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        const buf = fs.readFileSync(file);
        cachedLogoDataUri = `data:image/jpeg;base64,${buf.toString('base64')}`;
        return cachedLogoDataUri;
      }
    } catch {
      /* try next */
    }
  }
  cachedLogoDataUri = null;
  return null;
}

export type HrPrintDocKindLabel = 'contract' | 'attestation';

export type HrFactualRow = { label: string; value: string; mono?: boolean };

export function renderHrPrintDocument(opts: {
  kind: HrPrintDocKindLabel;
  title: string;
  subtitle?: string;
  fields: HrPrintMergeFields;
  rows: HrFactualRow[];
  bodyHtml: string;
  emptyBodyNote: string;
}): string {
  const logo = loadHrBrandLogoDataUri();
  const logoHtml = logo
    ? `<img class="logo" src="${logo}" alt="Fattorie Covelli" />`
    : `<div class="logo-fallback"><strong>FATTORIE COVELLI</strong><span>La Vera Mozzarella</span></div>`;

  const body = opts.bodyHtml.trim()
    ? `<section class="body">${formatBodyHtml(opts.bodyHtml, opts.fields)}</section>`
    : `<p class="muted">${opts.emptyBodyNote}</p>`;

  const rowsHtml = opts.rows
    .map(
      (r) =>
        `<div class="kv"><span class="k">${escHtml(r.label)}</span><span class="v${r.mono ? ' n' : ''}">${escHtml(r.value || '—')}</span></div>`,
    )
    .join('');

  const docLabel =
    opts.kind === 'contract' ? 'Contrat de travail' : 'Attestation de travail';

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"/>
<title>${escHtml(opts.title)}</title>
<style>
  @page { margin: 14mm 16mm 18mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    font-size: 10.5pt;
    color: #1a2332;
    line-height: 1.5;
    background: #fff;
  }
  .sheet { max-width: 100%; }
  .brand {
    display: flex;
    align-items: flex-start;
    gap: 18px;
    padding-bottom: 14px;
    margin-bottom: 18px;
    border-bottom: 2px solid #0d9488;
  }
  .logo {
    width: 118px;
    height: auto;
    object-fit: contain;
    flex-shrink: 0;
  }
  .logo-fallback {
    width: 118px;
    padding: 8px;
    background: #f0f7f6;
    border-radius: 8px;
    text-align: center;
    font-size: 8pt;
  }
  .logo-fallback strong { display: block; font-size: 9pt; letter-spacing: .02em; }
  .logo-fallback span { color: #5b6b7c; font-style: italic; }
  .brand-meta { flex: 1; min-width: 0; }
  .brand-name {
    margin: 0 0 2px;
    font-size: 13pt;
    font-weight: 700;
    letter-spacing: .01em;
    color: #0a1628;
  }
  .brand-tag {
    margin: 0 0 8px;
    font-size: 9pt;
    color: #0d9488;
    font-weight: 600;
  }
  .brand-lines {
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 8.5pt;
    color: #4a5568;
    line-height: 1.45;
  }
  .doc-kicker {
    margin: 0 0 4px;
    font-size: 8pt;
    font-weight: 600;
    letter-spacing: .12em;
    text-transform: uppercase;
    color: #0d9488;
  }
  h1 {
    margin: 0 0 6px;
    font-size: 18pt;
    font-weight: 700;
    color: #0a1628;
    letter-spacing: -.01em;
  }
  .subtitle {
    margin: 0 0 16px;
    font-size: 9.5pt;
    color: #5b6b7c;
  }
  .card {
    background: #f7fafc;
    border-radius: 10px;
    padding: 14px 16px;
    margin: 0 0 16px;
  }
  .kv {
    display: flex;
    gap: 12px;
    padding: 5px 0;
  }
  .kv + .kv { border-top: 1px solid #e8eef4; }
  .k {
    flex: 0 0 32%;
    color: #64748b;
    font-size: 9pt;
    font-weight: 600;
  }
  .v { flex: 1; color: #1a2332; }
  .n {
    font-variant-numeric: tabular-nums;
    font-family: "Cascadia Mono", "Segoe UI Mono", ui-monospace, monospace;
  }
  .body {
    margin: 0 0 20px;
    white-space: pre-wrap;
    font-size: 10.5pt;
  }
  .body p { margin: 0 0 .65em; }
  .muted { color: #94a3b8; font-size: 9pt; }
  .sign {
    display: flex;
    justify-content: space-between;
    gap: 24px;
    margin: 28px 0 12px;
  }
  .sign-box {
    flex: 1;
    min-height: 72px;
    padding-top: 8px;
  }
  .sign-label {
    font-size: 8.5pt;
    font-weight: 600;
    color: #64748b;
    margin-bottom: 40px;
  }
  .sign-line {
    border-top: 1px solid #cbd5e1;
    padding-top: 6px;
    font-size: 8pt;
    color: #94a3b8;
  }
  footer.foot {
    margin-top: 24px;
    padding-top: 12px;
    border-top: 1px solid #e2e8f0;
    font-size: 8pt;
    color: #64748b;
    text-align: center;
    line-height: 1.5;
  }
  footer.foot a { color: #0d9488; text-decoration: none; }
</style></head><body>
<div class="sheet">
  <header class="brand">
    ${logoHtml}
    <div class="brand-meta">
      <p class="brand-name">${escHtml(HR_BRAND.legalName)}</p>
      <p class="brand-tag">${escHtml(HR_BRAND.tagline)}</p>
      <ul class="brand-lines">
        <li>${escHtml(HR_BRAND.address)}</li>
        <li>MF ${escHtml(HR_BRAND.taxId)} · Tél. ${escHtml(HR_BRAND.phones)}</li>
        <li>${escHtml(HR_BRAND.factory)}</li>
        <li>${escHtml(HR_BRAND.website)} · ${escHtml(HR_BRAND.email)}</li>
      </ul>
    </div>
  </header>

  <p class="doc-kicker">${escHtml(docLabel)}</p>
  <h1>${escHtml(opts.title)}</h1>
  ${opts.subtitle ? `<p class="subtitle">${escHtml(opts.subtitle)}</p>` : ''}

  <div class="card">${rowsHtml}</div>
  ${body}

  <div class="sign">
    <div class="sign-box">
      <div class="sign-label">L’employeur</div>
      <div class="sign-line">Signature &amp; cachet</div>
    </div>
    <div class="sign-box">
      <div class="sign-label">Le salarié</div>
      <div class="sign-line">Signature</div>
    </div>
  </div>

  <footer class="foot">
    ${escHtml(HR_BRAND.legalName)} · ${escHtml(HR_BRAND.address)}<br/>
    Tél. ${escHtml(HR_BRAND.phones)} · ${escHtml(HR_BRAND.email)} · ${escHtml(HR_BRAND.website)}
  </footer>
</div>
</body></html>`;
}

function formatBodyHtml(raw: string, fields: HrPrintMergeFields): string {
  const applied = applyPrintPlaceholders(raw, fields).trim();
  // Already HTML fragment from Prefs/skeleton
  if (/<[a-z][\s\S]*>/i.test(applied)) return applied;
  return escHtml(applied).replace(/\n/g, '<br/>');
}
