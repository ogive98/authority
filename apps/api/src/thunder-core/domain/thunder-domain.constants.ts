export const THUNDER_DOMAIN_CONSUMERS = {
  inventoryReserveFromOrder: 'inventory.reserveFromOrder',
  financeOpenItemFromDelivery: 'finance.openItemFromDelivery',
  accountingPostFromFinance: 'accounting.postFromFinance',
} as const;

export const THUNDER_DOMAIN_EVENT_TYPES = {
  salesConfirmed: 'sales.order.confirmed.v1',
  shipmentDelivered: 'delivery.shipment.delivered.v1',
  financeInvoiceIssued: 'finance.invoice.issued.v1',
  financeInvoiceCancelled: 'finance.invoice.cancelled.v1',
  financeCreditNoteIssued: 'finance.credit_note.issued.v1',
  financePaymentAllocated: 'finance.payment.allocated.v1',
  financePaymentReversed: 'finance.payment.reversed.v1',
  financeInstrumentRejected: 'finance.instrument.rejected.v1',
  financeBankFeePosted: 'finance.bank.fee_posted.v1',
  financeApBillPosted: 'finance.ap_bill.posted.v1',
  financeApBillCancelled: 'finance.ap_bill.cancelled.v1',
  financeApPaymentPosted: 'finance.ap_payment.posted.v1',
} as const;
