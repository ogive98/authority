import {
  matchedMilestones,
  normalizeRemindDays,
} from './collection-schedule.resolver';

describe('collection schedule helpers', () => {
  it('normalizes remind days', () => {
    expect(normalizeRemindDays([7, 1, 7, '15', -1, 'x'])).toEqual([1, 7, 15]);
    expect(normalizeRemindDays(null)).toEqual([]);
  });

  it('matches milestones by max days past due', () => {
    expect(matchedMilestones([1, 7, 15, 30], 10)).toEqual([1, 7]);
    expect(matchedMilestones([1, 7, 15, 30], 0)).toEqual([]);
    expect(matchedMilestones([], 20)).toEqual([]);
  });
});
