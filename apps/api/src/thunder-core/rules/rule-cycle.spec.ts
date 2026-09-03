import {
  assertActionsWhitelisted,
  detectRuleCycles,
  matchesEventPattern,
} from './rule-cycle';

describe('rule cycle detection', () => {
  it('matches prefix patterns', () => {
    expect(matchesEventPattern('sales.*', 'sales.order.confirmed.v1')).toBe(
      true,
    );
    expect(matchesEventPattern('sales.order.confirmed.v1', 'sales.other')).toBe(
      false,
    );
  });

  it('detects A→B→A cycles via emitsEventType', () => {
    const cycle = detectRuleCycles([
      {
        enabled: true,
        eventPattern: 'event.a.v1',
        actions: [
          {
            type: 'enqueue_job',
            jobType: 'thunder.hello.v1',
            queue: 'ops',
            emitsEventType: 'event.b.v1',
          },
        ],
      },
      {
        enabled: true,
        eventPattern: 'event.b.v1',
        actions: [
          {
            type: 'enqueue_job',
            jobType: 'thunder.hello.v1',
            queue: 'ops',
            emitsEventType: 'event.a.v1',
          },
        ],
      },
    ]);
    expect(cycle).not.toBeNull();
  });

  it('allows acyclic graphs', () => {
    expect(
      detectRuleCycles([
        {
          enabled: true,
          eventPattern: 'event.a.v1',
          actions: [
            {
              type: 'enqueue_job',
              jobType: 'thunder.hello.v1',
              queue: 'ops',
              emitsEventType: 'event.b.v1',
            },
          ],
        },
        {
          enabled: true,
          eventPattern: 'event.b.v1',
          actions: [{ type: 'notify', templateId: 't1', channel: 'ui' }],
        },
      ]),
    ).toBeNull();
  });

  it('rejects non-whitelist actions', () => {
    expect(() =>
      assertActionsWhitelisted([{ type: 'call_module_command' } as never]),
    ).toThrow(/not allowed/);
  });
});
