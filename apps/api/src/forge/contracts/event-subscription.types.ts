/** Event contract — integrates with AUTHORITY Outbox / Thunder (Phase 1: types only). */

export type ExtensionEventDeclaration = {
  eventType: string;
  description?: string;
  schemaVersion?: string;
};

export type EventSubscription = {
  id: string;
  extensionId: string;
  eventType: string;
  handlerKey: string;
  active: boolean;
};
