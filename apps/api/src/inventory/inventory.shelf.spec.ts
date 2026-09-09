import {
  computeDlcIso,
  computeProductionDateIso,
  dailyLotCode,
  shouldRunDailyGen,
  tunisClock,
} from './inventory.shelf';

describe('inventory.shelf', () => {
  it('computes DLC as packDate + shelfLifeDays', () => {
    expect(computeDlcIso('2026-09-09', 7)).toBe('2026-09-16');
    expect(computeDlcIso('2026-09-09', 30)).toBe('2026-10-09');
    expect(computeDlcIso('2026-09-09', 60)).toBe('2026-11-08');
  });

  it('computes production date as packDate − offset', () => {
    expect(computeProductionDateIso('2026-09-09', null)).toBe('2026-09-09');
    expect(computeProductionDateIso('2026-09-09', 0)).toBe('2026-09-09');
    expect(computeProductionDateIso('2026-09-09', 30)).toBe('2026-08-10');
  });

  it('rejects invalid shelf life', () => {
    expect(() => computeDlcIso('2026-09-09', 0)).toThrow(/positive/);
  });

  it('builds daily lot code sku+date', () => {
    expect(dailyLotCode('BRIE-250', '2026-09-09')).toBe('BRIE-250-20260909');
  });

  it('shouldRunDailyGen fires once per Tunis day at configured hour', () => {
    expect(
      shouldRunDailyGen({ date: '2026-09-09', hour: 0 }, 0, null),
    ).toBe(true);
    expect(
      shouldRunDailyGen({ date: '2026-09-09', hour: 0 }, 0, '2026-09-09'),
    ).toBe(false);
    expect(
      shouldRunDailyGen({ date: '2026-09-09', hour: 5 }, 0, null),
    ).toBe(false);
  });

  it('tunisClock returns YYYY-MM-DD and hour', () => {
    const clock = tunisClock(new Date('2026-09-09T00:30:00.000Z'));
    expect(clock.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(clock.hour).toBeGreaterThanOrEqual(0);
    expect(clock.hour).toBeLessThanOrEqual(23);
  });
});
