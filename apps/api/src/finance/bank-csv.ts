/**
 * Bank statement CSV parser (D191).
 * Columns: date,amount,reference,counterparty,memo
 * Sign: + credit (in) / − debit (out). No OFX.
 */

export type ParsedBankCsvLine = {
  lineDate: string;
  amount: number;
  reference?: string;
  counterparty?: string;
  memo?: string;
  row: number;
};

export type BankCsvParseResult = {
  delimiter: ',' | ';';
  lines: ParsedBankCsvLine[];
  errors: { row: number; message: string }[];
};

const HEADER_ALIASES: Record<string, keyof Omit<ParsedBankCsvLine, 'row'>> = {
  date: 'lineDate',
  linedate: 'lineDate',
  amount: 'amount',
  montant: 'amount',
  reference: 'reference',
  ref: 'reference',
  counterparty: 'counterparty',
  contrepartie: 'counterparty',
  memo: 'memo',
  memoire: 'memo',
  note: 'memo',
  libelle: 'memo',
};

export function detectCsvDelimiter(headerLine: string): ',' | ';' {
  const semis = (headerLine.match(/;/g) ?? []).length;
  const commas = (headerLine.match(/,/g) ?? []).length;
  return semis > commas ? ';' : ',';
}

export function parseBankStatementCsv(raw: string): BankCsvParseResult {
  const text = raw.replace(/^\uFEFF/, '').trim();
  const errors: { row: number; message: string }[] = [];
  const lines: ParsedBankCsvLine[] = [];
  if (!text) {
    return { delimiter: ',', lines: [], errors: [{ row: 0, message: 'Empty CSV.' }] };
  }
  const rows = splitCsvRows(text);
  if (rows.length === 0) {
    return { delimiter: ',', lines: [], errors: [{ row: 0, message: 'Empty CSV.' }] };
  }
  const delimiter = detectCsvDelimiter(rows[0]!);
  const headerCells = splitCsvLine(rows[0]!, delimiter).map((c) =>
    normalizeHeader(c),
  );
  const colIndex = new Map<keyof Omit<ParsedBankCsvLine, 'row'>, number>();
  headerCells.forEach((h, i) => {
    const key = HEADER_ALIASES[h];
    if (key) colIndex.set(key, i);
  });
  if (!colIndex.has('lineDate') || !colIndex.has('amount')) {
    return {
      delimiter,
      lines: [],
      errors: [
        {
          row: 1,
          message:
            'Header must include date and amount (montant). Optional: reference, counterparty, memo.',
        },
      ],
    };
  }

  for (let r = 1; r < rows.length; r++) {
    const rowNum = r + 1;
    const cells = splitCsvLine(rows[r]!, delimiter);
    if (cells.every((c) => !c.trim())) continue;
    const dateRaw = cells[colIndex.get('lineDate')!] ?? '';
    const amountRaw = cells[colIndex.get('amount')!] ?? '';
    const lineDate = normalizeDate(dateRaw.trim());
    if (!lineDate) {
      errors.push({ row: rowNum, message: `Invalid date: ${dateRaw}` });
      continue;
    }
    const amount = normalizeAmount(amountRaw.trim(), delimiter);
    if (amount === null || amount === 0 || !Number.isFinite(amount)) {
      errors.push({
        row: rowNum,
        message: `Invalid non-zero amount: ${amountRaw}`,
      });
      continue;
    }
    const getOpt = (key: 'reference' | 'counterparty' | 'memo') => {
      const idx = colIndex.get(key);
      if (idx === undefined) return undefined;
      const v = cells[idx]?.trim();
      return v || undefined;
    };
    lines.push({
      row: rowNum,
      lineDate,
      amount,
      reference: getOpt('reference'),
      counterparty: getOpt('counterparty'),
      memo: getOpt('memo'),
    });
  }

  return { delimiter, lines, errors };
}

function normalizeHeader(cell: string): string {
  return cell
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]/g, '');
}

/** Accept YYYY-MM-DD or DD/MM/YYYY. */
function normalizeDate(raw: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (m) {
    const d = m[1]!.padStart(2, '0');
    const mo = m[2]!.padStart(2, '0');
    const y = m[3]!;
    return `${y}-${mo}-${d}`;
  }
  return null;
}

function normalizeAmount(raw: string, delimiter: ',' | ';'): number | null {
  let s = raw.replace(/\s/g, '');
  if (!s) return null;
  // European: 1.234,56 when semicolon CSV; or 1234,56
  if (delimiter === ';') {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    // Comma CSV: prefer dot decimal; if only comma, treat as decimal
    if (s.includes(',') && !s.includes('.')) {
      s = s.replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function splitCsvRows(text: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.length) out.push(cur);
  return out;
}

function splitCsvLine(line: string, delimiter: ',' | ';'): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}
