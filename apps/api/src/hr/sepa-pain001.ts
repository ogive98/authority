/**
 * ISO 20022 pain.001.001.03 credit transfer export (D240).
 * Built from frozen HrTransferOrder fields + RIB→IBAN TN.
 * BIC = NOTPROVIDED (no bank directory invent). No auto-send.
 */

import { toTunisianIban } from './rib-tn';

export type SepaCreditTransferInput = {
  msgId: string;
  paymentInfoId: string;
  endToEndId: string;
  createdAtIso: string;
  executionDate: string; // YYYY-MM-DD
  initiatingPartyName: string;
  debtorName: string;
  debtorIban: string;
  debtorCurrency: string;
  creditorName: string;
  creditorIban: string;
  amount: string; // decimal string as-recorded
  currency: string;
  remittance: string;
};

export type SepaExportResult = {
  xml: string;
  filename: string;
  msgId: string;
};

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Amount for InstdAmt — max 2 decimal places (ISO), from as-recorded milli-capable string. */
export function formatSepaAmount(amount: string): string {
  const n = Number(String(amount).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error('SEPA amount must be a positive number.');
  }
  return n.toFixed(2);
}

export function buildPain001Xml(input: SepaCreditTransferInput): string {
  const amt = formatSepaAmount(input.amount);
  const ccy = input.currency.trim().toUpperCase() || 'TND';
  const debtorCcy = input.debtorCurrency.trim().toUpperCase() || ccy;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${xmlEscape(input.msgId)}</MsgId>
      <CreDtTm>${xmlEscape(input.createdAtIso)}</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
      <CtrlSum>${amt}</CtrlSum>
      <InitgPty>
        <Nm>${xmlEscape(input.initiatingPartyName.slice(0, 70))}</Nm>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${xmlEscape(input.paymentInfoId)}</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <BtchBookg>false</BtchBookg>
      <NbOfTxs>1</NbOfTxs>
      <CtrlSum>${amt}</CtrlSum>
      <PmtTpInf>
        <SvcLvl>
          <Cd>NURG</Cd>
        </SvcLvl>
      </PmtTpInf>
      <ReqdExctnDt>${xmlEscape(input.executionDate)}</ReqdExctnDt>
      <Dbtr>
        <Nm>${xmlEscape(input.debtorName.slice(0, 70))}</Nm>
      </Dbtr>
      <DbtrAcct>
        <Id>
          <IBAN>${xmlEscape(input.debtorIban)}</IBAN>
        </Id>
        <Ccy>${xmlEscape(debtorCcy)}</Ccy>
      </DbtrAcct>
      <DbtrAgt>
        <FinInstnId>
          <Othr>
            <Id>NOTPROVIDED</Id>
          </Othr>
        </FinInstnId>
      </DbtrAgt>
      <CdtTrfTxInf>
        <PmtId>
          <EndToEndId>${xmlEscape(input.endToEndId.slice(0, 35))}</EndToEndId>
        </PmtId>
        <Amt>
          <InstdAmt Ccy="${xmlEscape(ccy)}">${amt}</InstdAmt>
        </Amt>
        <CdtrAgt>
          <FinInstnId>
            <Othr>
              <Id>NOTPROVIDED</Id>
            </Othr>
          </FinInstnId>
        </CdtrAgt>
        <Cdtr>
          <Nm>${xmlEscape(input.creditorName.slice(0, 70))}</Nm>
        </Cdtr>
        <CdtrAcct>
          <Id>
            <IBAN>${xmlEscape(input.creditorIban)}</IBAN>
          </Id>
        </CdtrAcct>
        <RmtInf>
          <Ustrd>${xmlEscape(input.remittance.slice(0, 140))}</Ustrd>
        </RmtInf>
      </CdtTrfTxInf>
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>
`;
}

export function buildSepaFromTransferFacts(facts: {
  transferNumber: string;
  companyLegalName: string;
  companyBankRib: string;
  beneficiaryName: string;
  beneficiaryBankAccount: string;
  amount: string;
  currency: string;
  remittance: string;
  now?: Date;
}): SepaExportResult {
  const now = facts.now ?? new Date();
  const createdAtIso = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const executionDate = now.toISOString().slice(0, 10);
  const msgId = `AUTH-${facts.transferNumber}-${now.getTime()}`.slice(0, 35);
  const paymentInfoId = `PMT-${facts.transferNumber}`.slice(0, 35);
  const endToEndId = facts.transferNumber.slice(0, 35);

  const debtorIban = toTunisianIban(facts.companyBankRib);
  const creditorIban = toTunisianIban(facts.beneficiaryBankAccount);

  const xml = buildPain001Xml({
    msgId,
    paymentInfoId,
    endToEndId,
    createdAtIso,
    executionDate,
    initiatingPartyName: facts.companyLegalName,
    debtorName: facts.companyLegalName,
    debtorIban,
    debtorCurrency: facts.currency,
    creditorName: facts.beneficiaryName,
    creditorIban,
    amount: facts.amount,
    currency: facts.currency,
    remittance: facts.remittance,
  });

  return {
    xml,
    filename: `sepa-${facts.transferNumber}.xml`,
    msgId,
  };
}
