import {
  detectCsvDelimiter,
  parseBankStatementCsv,
} from './bank-csv';

describe('parseBankStatementCsv (D191)', () => {
  it('parses comma CSV with +/− amounts', () => {
    const csv = [
      'date,amount,reference,counterparty,memo',
      '2026-09-01,150.000,VIR-1,Client A,ok',
      '2026-09-02,-5.250,FRAIS,,Frais bancaires',
    ].join('\n');
    const res = parseBankStatementCsv(csv);
    expect(res.delimiter).toBe(',');
    expect(res.errors).toHaveLength(0);
    expect(res.lines).toHaveLength(2);
    expect(res.lines[0]!.amount).toBe(150);
    expect(res.lines[1]!.amount).toBe(-5.25);
    expect(res.lines[1]!.memo).toBe('Frais bancaires');
  });

  it('parses semicolon European amounts and DD/MM/YYYY', () => {
    const csv = [
      'date;montant;reference;contrepartie;memo',
      '01/09/2026;1.234,500;VIR;;',
    ].join('\n');
    expect(detectCsvDelimiter(csv.split('\n')[0]!)).toBe(';');
    const res = parseBankStatementCsv(csv);
    expect(res.errors).toHaveLength(0);
    expect(res.lines[0]!.lineDate).toBe('2026-09-01');
    expect(res.lines[0]!.amount).toBe(1234.5);
  });

  it('reports missing header columns', () => {
    const res = parseBankStatementCsv('foo,bar\n1,2');
    expect(res.lines).toHaveLength(0);
    expect(res.errors[0]!.message).toMatch(/date and amount/i);
  });
});
