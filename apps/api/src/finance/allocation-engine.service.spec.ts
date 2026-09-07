import { FinAllocationPolicy } from '@prisma/client';
import { AllocationEngineService } from './allocation-engine.service';

describe('AllocationEngineService', () => {
  const engine = new AllocationEngineService();
  const base = [
    {
      id: 'a',
      number: 'FIN-1',
      amountOpen: 100,
      dueDate: new Date('2026-01-01'),
      createdAt: new Date('2026-01-01'),
    },
    {
      id: 'b',
      number: 'FIN-2',
      amountOpen: 50,
      dueDate: new Date('2026-02-01'),
      createdAt: new Date('2026-02-01'),
    },
    {
      id: 'c',
      number: 'FIN-3',
      amountOpen: 30,
      dueDate: new Date('2025-12-01'),
      createdAt: new Date('2025-12-01'),
    },
  ];

  it('A OLDEST_FIRST allocates due-date ascending', () => {
    const plan = engine.simulate({
      policy: FinAllocationPolicy.OLDEST_FIRST,
      customerId: 'cust',
      paymentAmount: 80,
      openItems: base,
    });
    expect(plan.lines.map((l) => l.openItemId)).toEqual(['c', 'a']);
    expect(plan.lines[0]!.amount).toBe(30);
    expect(plan.lines[1]!.amount).toBe(50);
    expect(plan.remainder).toBe(0);
  });

  it('E LARGEST_FIRST prefers biggest open', () => {
    const plan = engine.simulate({
      policy: FinAllocationPolicy.LARGEST_FIRST,
      customerId: 'cust',
      paymentAmount: 120,
      openItems: base,
    });
    expect(plan.lines[0]!.openItemId).toBe('a');
    expect(plan.lines[0]!.amount).toBe(100);
    expect(plan.remainder).toBe(0);
  });

  it('C PROPORTIONAL splits across open items', () => {
    const plan = engine.simulate({
      policy: FinAllocationPolicy.PROPORTIONAL,
      customerId: 'cust',
      paymentAmount: 90,
      openItems: base,
    });
    const sum = plan.lines.reduce((s, l) => s + l.amount, 0);
    expect(sum).toBeCloseTo(90, 3);
    expect(plan.remainder).toBe(0);
  });

  it('G MANUAL uses provided lines only', () => {
    const plan = engine.simulate({
      policy: FinAllocationPolicy.MANUAL,
      customerId: 'cust',
      paymentAmount: 40,
      openItems: base,
      manualLines: [{ openItemId: 'b', amount: 40 }],
    });
    expect(plan.lines).toHaveLength(1);
    expect(plan.lines[0]!.openItemId).toBe('b');
    expect(plan.lines[0]!.amount).toBe(40);
  });
});
