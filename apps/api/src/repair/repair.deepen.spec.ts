import {
  expandDomainTags,
  DOMAIN_TAG_ALIASES,
} from './checkers/checker.types';
import {
  REPAIR_REDIS_ALLOWLIST_EXACT,
  REPAIR_REDIS_ALLOWLIST_PREFIXES,
} from './repair.constants';
import { RepairRegistryService } from './engines/registry.service';

describe('Repair deepen helpers (D081)', () => {
  it('expands L0/L1 domain aliases for checker matching', () => {
    const tags = expandDomainTags(['L0', 'L1']);
    expect(tags.has('l0')).toBe(true);
    expect(tags.has('runtime')).toBe(true);
    expect(tags.has('kernel')).toBe(true);
    expect(tags.has('outbox')).toBe(true);
  });

  it('domain aliases cover all axis B levels', () => {
    expect(DOMAIN_TAG_ALIASES.l2).toContain('module');
    expect(DOMAIN_TAG_ALIASES.l3).toContain('data');
    expect(DOMAIN_TAG_ALIASES.l5).toContain('licence');
  });

  it('redis allowlist never includes flush or wildcards', () => {
    expect(REPAIR_REDIS_ALLOWLIST_EXACT).toContain(
      'authority:license:verified',
    );
    for (const p of REPAIR_REDIS_ALLOWLIST_PREFIXES) {
      expect(p.startsWith('authority:')).toBe(true);
      expect(p.includes('*')).toBe(false);
      expect(p.toLowerCase()).not.toContain('flush');
      expect(p.toLowerCase()).not.toContain('bull');
    }
  });

  it('registry exposes L2–L4 levels with distinct checkers', () => {
    const registry = new RepairRegistryService();
    const l1 = registry.requireScanLevel('L1').includesCheckers;
    const l2 = registry.requireScanLevel('L2').includesCheckers;
    const l4 = registry.requireScanLevel('L4').includesCheckers;
    expect(l2.length).toBeGreaterThan(l1.length);
    expect(l4.length).toBeGreaterThan(l2.length);
    expect(l4).toEqual(
      expect.arrayContaining(['permission-catalog', 'license-cache-readonly']),
    );
  });
});
