export type IntentEntityKind = 'supplier' | 'customer' | 'employee' | 'contact';

export type IntentActionId =
  | 'transfer'
  | 'ap_payment'
  | 'ar_payment'
  | 'expense'
  | 'journal'
  | 'open_entity';

export type IntentActionDef = {
  id: IntentActionId;
  icon: string;
  title: string;
  module: string;
  route: string;
  entityKinds: IntentEntityKind[];
};

/** Soft Glass navigation map — no CREATE_TRANSFER · no ledger */
export const INTENT_ACTION_MAP: IntentActionDef[] = [
  {
    id: 'transfer',
    icon: '⇄',
    title: 'Virement',
    module: 'finance',
    route: '/finance/banking',
    entityKinds: ['supplier', 'customer', 'employee'],
  },
  {
    id: 'ap_payment',
    icon: '◉',
    title: 'Paiement fournisseur',
    module: 'finance',
    route: '/finance/ap-bills',
    entityKinds: ['supplier'],
  },
  {
    id: 'ar_payment',
    icon: '◇',
    title: 'Encaissement client',
    module: 'finance',
    route: '/finance/payments',
    entityKinds: ['customer'],
  },
  {
    id: 'expense',
    icon: '$',
    title: 'Dépense',
    module: 'finance',
    route: '/finance/banking',
    entityKinds: ['supplier', 'contact'],
  },
  {
    id: 'journal',
    icon: '▣',
    title: 'Écriture comptable',
    module: 'accounting',
    route: '/accounting',
    entityKinds: ['supplier', 'customer'],
  },
  {
    id: 'open_entity',
    icon: '○',
    title: 'Ouvrir la fiche',
    module: 'master_data',
    route: '/suppliers',
    entityKinds: ['supplier', 'customer', 'employee', 'contact'],
  },
];

export function routeForIntentAction(
  actionId: IntentActionId,
  kind: IntentEntityKind | undefined,
  entityId?: string,
  opts?: { amount?: number | null; label?: string | null },
): string {
  const isUuid = (id?: string) => !!id && /^[0-9a-f-]{36}$/i.test(id);

  if (actionId === 'open_entity') {
    if (kind === 'customer') {
      return isUuid(entityId) ? `/customers/${entityId}` : '/customers';
    }
    if (kind === 'employee') return '/hr';
    return isUuid(entityId) ? `/suppliers/${entityId}` : '/suppliers';
  }

  if (actionId === 'ap_payment') {
    const qs = new URLSearchParams();
    qs.set('source', 'authority_x');
    qs.set('create', '1');
    if (isUuid(entityId)) qs.set('supplierId', entityId!);
    if (opts?.amount != null) qs.set('amount', String(opts.amount));
    if (opts?.label) qs.set('vendorName', opts.label);
    return `/finance/ap-bills?${qs.toString()}`;
  }

  if (actionId === 'ar_payment') {
    const qs = new URLSearchParams();
    qs.set('source', 'authority_x');
    qs.set('create', '1');
    if (isUuid(entityId)) qs.set('customerId', entityId!);
    if (opts?.amount != null) qs.set('amount', String(opts.amount));
    if (opts?.label) qs.set('customerName', opts.label);
    return `/finance/payments?${qs.toString()}`;
  }

  if (actionId === 'transfer') {
    return '/finance/banking?source=authority_x&note=treasury_pending';
  }

  const def = INTENT_ACTION_MAP.find((a) => a.id === actionId);
  return def?.route ?? '/';
}

export function buildPrefill(input: {
  actionId: IntentActionId;
  entityId?: string;
  entityKind?: IntentEntityKind;
  amount: number | null;
  currency: string | null;
  personToken: string | null;
}): Record<string, string> {
  const out: Record<string, string> = {};
  if (input.entityId) out.entityId = input.entityId;
  if (input.entityKind) out.entityKind = input.entityKind;
  if (input.amount != null) out.amount = String(input.amount);
  if (input.currency) out.currency = input.currency;
  if (input.personToken) out.personToken = input.personToken;
  out.actionId = input.actionId;
  out.source = 'authority_x';
  return out;
}
