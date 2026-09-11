import { parseBankStatementOfx } from './bank-ofx';

const SAMPLE = `
OFXHEADER:100
DATA:OFXSGML
VERSION:102

<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260901120000
<TRNAMT>150.000
<FITID>FIT-001
<NAME>Client A
<MEMO>Virement
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260902
<TRNAMT>-5.250
<FITID>FIT-002
<NAME>FRAIS
<MEMO>Frais bancaires
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
`;

describe('parseBankStatementOfx', () => {
  it('parses STMTTRN with FITID and signed amounts', () => {
    const res = parseBankStatementOfx(SAMPLE);
    expect(res.errors).toEqual([]);
    expect(res.lines).toHaveLength(2);
    expect(res.lines[0]).toMatchObject({
      lineDate: '2026-09-01',
      amount: 150,
      fitId: 'FIT-001',
      counterparty: 'Client A',
    });
    expect(res.lines[1]).toMatchObject({
      lineDate: '2026-09-02',
      amount: -5.25,
      fitId: 'FIT-002',
      memo: 'Frais bancaires',
    });
  });

  it('rejects missing FITID', () => {
    const res = parseBankStatementOfx(`
<OFX><STMTTRN>
<DTPOSTED>20260901
<TRNAMT>-1.000
</STMTTRN></OFX>`);
    expect(res.lines).toHaveLength(0);
    expect(res.errors[0]?.message).toMatch(/FITID/i);
  });

  it('flags duplicate FITID in same file', () => {
    const res = parseBankStatementOfx(`
<OFX>
<STMTTRN><DTPOSTED>20260901<TRNAMT>1.000<FITID>X</STMTTRN>
<STMTTRN><DTPOSTED>20260902<TRNAMT>2.000<FITID>X</STMTTRN>
</OFX>`);
    expect(res.lines).toHaveLength(1);
    expect(res.errors.some((e) => /Duplicate FITID/i.test(e.message))).toBe(
      true,
    );
  });
});
