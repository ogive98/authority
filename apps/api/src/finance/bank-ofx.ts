/**
 * Bank statement OFX 1.x SGML parser (D193).
 * Maps STMTTRN → signed TND lines; FITID required for dedup.
 */

export type ParsedBankOfxLine = {
  lineDate: string;
  amount: number;
  fitId: string;
  reference?: string;
  counterparty?: string;
  memo?: string;
  row: number;
};

export type BankOfxParseResult = {
  dialect: 'OFX1';
  lines: ParsedBankOfxLine[];
  errors: { row: number; message: string }[];
};

const TRN_RE = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;

export function parseBankStatementOfx(raw: string): BankOfxParseResult {
  const text = raw.replace(/^\uFEFF/, '').trim();
  const errors: { row: number; message: string }[] = [];
  const lines: ParsedBankOfxLine[] = [];
  if (!text) {
    return {
      dialect: 'OFX1',
      lines: [],
      errors: [{ row: 0, message: 'Empty OFX.' }],
    };
  }
  if (!/<OFX[\s>]/i.test(text) && !/<STMTTRN[\s>]/i.test(text)) {
    return {
      dialect: 'OFX1',
      lines: [],
      errors: [
        {
          row: 0,
          message: 'Not an OFX statement (missing <OFX> / <STMTTRN>).',
        },
      ],
    };
  }

  let match: RegExpExecArray | null;
  let row = 0;
  const seenFit = new Set<string>();
  while ((match = TRN_RE.exec(text)) !== null) {
    row += 1;
    const block = match[1] ?? '';
    const fitId = tag(block, 'FITID')?.trim() ?? '';
    if (!fitId) {
      errors.push({ row, message: 'Missing FITID.' });
      continue;
    }
    if (seenFit.has(fitId)) {
      errors.push({ row, message: `Duplicate FITID in file: ${fitId}` });
      continue;
    }
    seenFit.add(fitId);

    const dt = tag(block, 'DTPOSTED')?.trim() ?? '';
    const lineDate = normalizeOfxDate(dt);
    if (!lineDate) {
      errors.push({ row, message: `Invalid DTPOSTED: ${dt || '(empty)'}` });
      continue;
    }

    const amtRaw = tag(block, 'TRNAMT')?.trim() ?? '';
    const amount = normalizeOfxAmount(amtRaw);
    if (amount === null || amount === 0 || !Number.isFinite(amount)) {
      errors.push({
        row,
        message: `Invalid non-zero TRNAMT: ${amtRaw || '(empty)'}`,
      });
      continue;
    }

    const name = tag(block, 'NAME')?.trim() || undefined;
    const memo = tag(block, 'MEMO')?.trim() || undefined;
    const checknum = tag(block, 'CHECKNUM')?.trim();
    const refnum = tag(block, 'REFNUM')?.trim();
    const reference = checknum || refnum || fitId;

    lines.push({
      row,
      lineDate,
      amount,
      fitId,
      reference,
      counterparty: name,
      memo,
    });
  }

  if (lines.length === 0 && errors.length === 0) {
    errors.push({ row: 0, message: 'No <STMTTRN> transactions found.' });
  }

  return { dialect: 'OFX1', lines, errors };
}

function tag(block: string, name: string): string | null {
  const re = new RegExp(`<${name}>([^<]*)`, 'i');
  const m = re.exec(block);
  return m ? m[1]!.trim() : null;
}

/** YYYYMMDD or YYYYMMDDHHMMSS[.xxx] → YYYY-MM-DD */
function normalizeOfxDate(raw: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(raw.trim());
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function normalizeOfxAmount(raw: string): number | null {
  const s = raw.replace(/\s/g, '').replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
