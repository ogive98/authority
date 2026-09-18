import {
  COMPANY_ONLY_SETTING_KEYS,
  EXPERTISE_CATALOG,
  KERNEL_SETTING_KEYS,
  SECRET_SETTING_KEYS,
  SETTING_ENUM_VALUES,
} from '../../settings/settings.constants';
import type {
  IndexedConfiguration,
  IndexRiskLevel,
} from './authority-index.types';
import { canonicalConfigurationId } from './canonical-ids';

function riskFor(
  key: string,
  source: IndexedConfiguration['source'],
): IndexRiskLevel {
  if (source === 'expertise') {
    return 'critical';
  }
  if (source === 'secret') {
    return 'high';
  }
  if (
    key.startsWith('tax.') ||
    key.startsWith('hr.cnss') ||
    key.startsWith('hr.irpp') ||
    key.startsWith('hr.tfp') ||
    key.startsWith('hr.foprolos') ||
    key.startsWith('accounting.')
  ) {
    return 'critical';
  }
  if (key.startsWith('ops.') || key.startsWith('identity.') || key.startsWith('backup.')) {
    return key.includes('restore') ? 'critical' : 'high';
  }
  if (key.startsWith('ui.')) {
    return 'low';
  }
  return 'medium';
}

function pushUnique(
  out: Map<string, IndexedConfiguration>,
  item: IndexedConfiguration,
): void {
  const existing = out.get(item.key);
  if (!existing) {
    out.set(item.key, item);
    return;
  }
  const rank: Record<IndexedConfiguration['source'], number> = {
    secret: 4,
    expertise: 3,
    company: 2,
    kernel: 1,
  };
  if (rank[item.source] > rank[existing.source]) {
    out.set(item.key, item);
  }
}

/** Static configuration discovery — keys and risk only, never values. */
export function listConfigurationCatalog(): IndexedConfiguration[] {
  const byKey = new Map<string, IndexedConfiguration>();

  for (const key of KERNEL_SETTING_KEYS) {
    pushUnique(byKey, {
      key,
      canonicalId: canonicalConfigurationId(key),
      source: 'kernel',
      valueType: 'enum',
      scope: 'user',
      risk: riskFor(key, 'kernel'),
      allowedValues: [...SETTING_ENUM_VALUES[key]],
      secret: false,
      ai: { discoverable: true, configurable: true },
    });
  }

  for (const key of SECRET_SETTING_KEYS) {
    pushUnique(byKey, {
      key,
      canonicalId: canonicalConfigurationId(key),
      source: 'secret',
      valueType: 'secret',
      scope: 'company',
      risk: riskFor(key, 'secret'),
      allowedValues: null,
      secret: true,
      ai: { discoverable: true, configurable: false },
    });
  }

  for (const key of COMPANY_ONLY_SETTING_KEYS) {
    const secret = (SECRET_SETTING_KEYS as readonly string[]).includes(key);
    pushUnique(byKey, {
      key,
      canonicalId: canonicalConfigurationId(key),
      source: secret ? 'secret' : 'company',
      valueType: secret ? 'secret' : 'json',
      scope: 'company',
      risk: riskFor(key, secret ? 'secret' : 'company'),
      allowedValues: null,
      secret,
      ai: { discoverable: true, configurable: !secret },
    });
  }

  for (const slot of EXPERTISE_CATALOG) {
    pushUnique(byKey, {
      key: slot.key,
      canonicalId: canonicalConfigurationId(slot.key),
      source: 'expertise',
      valueType: 'expertise_slot',
      scope: 'company',
      risk: riskFor(slot.key, 'expertise'),
      allowedValues: null,
      secret: false,
      ai: { discoverable: true, configurable: true },
    });
  }

  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
}
