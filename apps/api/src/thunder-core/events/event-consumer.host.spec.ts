import { EventConsumerHost } from './event-consumer.host';

describe('EventConsumerHost parallel poll', () => {
  const prevEvents = process.env.THUNDER_EVENTS_ENABLED;
  const prevRedis = process.env.REDIS_URL;
  const prevParallel = process.env.THUNDER_CONSUMER_PARALLEL;

  afterEach(() => {
    if (prevEvents === undefined) delete process.env.THUNDER_EVENTS_ENABLED;
    else process.env.THUNDER_EVENTS_ENABLED = prevEvents;
    if (prevRedis === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = prevRedis;
    if (prevParallel === undefined) delete process.env.THUNDER_CONSUMER_PARALLEL;
    else process.env.THUNDER_CONSUMER_PARALLEL = prevParallel;
  });

  it('polls consumer groups in parallel chunks', async () => {
    process.env.THUNDER_EVENTS_ENABLED = 'true';
    process.env.THUNDER_CONSUMER_PARALLEL = '2';
    process.env.REDIS_URL = 'redis://localhost:6379';

    const xreadgroup = jest.fn().mockResolvedValue(null);
    const registry = {
      list: jest.fn().mockReturnValue([
        { consumerId: 'a' },
        { consumerId: 'b' },
        { consumerId: 'c' },
      ]),
      get: jest.fn().mockReturnValue({
        consumerId: 'x',
        handler: jest.fn(),
        consumes: ['*'],
      }),
    };
    const redis = {
      createBullConnection: jest.fn().mockReturnValue({
        xgroup: jest.fn().mockResolvedValue('OK'),
        xreadgroup,
        disconnect: jest.fn(),
      }),
    };
    const processed = {
      isProcessed: jest.fn(),
      markProcessed: jest.fn(),
    };

    const host = new EventConsumerHost(
      redis as never,
      registry as never,
      processed as never,
    );

    const handled = await host.pollOnce();
    expect(handled).toBe(0);
    expect(registry.list).toHaveBeenCalled();
    // parallel=2 → chunk [a,b] then [c] → 3 xreadgroup calls
    expect(xreadgroup).toHaveBeenCalledTimes(3);
  });
});
