import { parseOpsModesHeader, sampleEntriesForPatch } from './patch-entry-sample';

describe('patch-entry-sample D208', () => {
  it('parses ops modes header', () => {
    expect(parseOpsModesHeader('patch, ghost')).toEqual({
      patch: true,
      ghost: true,
      spectre: false,
    });
    expect(parseOpsModesHeader(undefined).patch).toBe(false);
  });

  it('samples by large_moves fixture amounts — not a legal rate', () => {
    const entries = [
      { id: 'a', entryDate: '2026-01-01', lines: [{ debit: '10', credit: '0' }] },
      { id: 'b', entryDate: '2026-02-01', lines: [{ debit: '900', credit: '0' }] },
      { id: 'c', entryDate: '2026-03-01', lines: [{ debit: '50', credit: '0' }] },
    ];
    const out = sampleEntriesForPatch(entries, {
      intensity: 40,
      rules: ['large_moves'],
    });
    expect(out.items).toHaveLength(2);
    expect(out.items[0]?.id).toBe('b');
    expect(out.patchSample.applied).toBe(true);
    expect(out.patchSample.total).toBe(3);
  });

  it('does not sample at 100%', () => {
    const entries = [{ id: 'a', entryDate: '2026-01-01', lines: [] }];
    const out = sampleEntriesForPatch(entries, { intensity: 100, rules: ['by_date'] });
    expect(out.items).toHaveLength(1);
    expect(out.patchSample.applied).toBe(false);
  });
});
