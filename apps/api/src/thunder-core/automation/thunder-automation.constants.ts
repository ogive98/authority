/** D289 — event → ASSISTED suggest (no mutation). */
export const THUNDER_AUTOMATION_CONSUMER_ID = 'automation.suggestFromEvent';

export const THUNDER_AUTOMATION_EVENT_TYPES = {
  portalPaymentDeclarationSubmitted:
    'portals.payment_declaration.submitted.v1',
  financeOpenItemCreated: 'finance.open_item.created.v1',
  salesWaInboxDraftCreated: 'sales.wa_inbox.draft_created.v1',
  taxTejPackPrepared: 'tax.tej.pack_prepared.v1',
  salesOrderConfirmed: 'sales.order.confirmed.v1',
} as const;
