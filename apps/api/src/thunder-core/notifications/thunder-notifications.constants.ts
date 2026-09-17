/** D290 — Thunder HOW: materialize AUTHORITY in-app inbox via NotificationsService.sync. */
export const THUNDER_NOTIFICATIONS_CONSUMER_ID = 'notifications.materialize';

export const THUNDER_NOTIFICATIONS_EVENT_TYPES = {
  portalPaymentDeclarationSubmitted:
    'portals.payment_declaration.submitted.v1',
  financeOpenItemCreated: 'finance.open_item.created.v1',
  financePromiseStatus: 'finance.promise.status.v1',
  salesWaInboxDraftCreated: 'sales.wa_inbox.draft_created.v1',
  salesOrderConfirmed: 'sales.order.confirmed.v1',
  taxTejPackPrepared: 'tax.tej.pack_prepared.v1',
  taxWithholdingCreated: 'tax.withholding.created.v1',
  automationRunCreated: 'automation.run.created.v1',
} as const;
