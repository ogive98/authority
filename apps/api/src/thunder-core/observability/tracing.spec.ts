import {
  isThunderOtelEnabled,
  toSpanAttributes,
  withThunderSpan,
} from './tracing';

describe('thunder tracing helpers', () => {
  const prev = process.env.THUNDER_OTEL_ENABLED;

  afterEach(() => {
    if (prev === undefined) {
      delete process.env.THUNDER_OTEL_ENABLED;
    } else {
      process.env.THUNDER_OTEL_ENABLED = prev;
    }
  });

  it('parses OTEL enabled flag', () => {
    expect(isThunderOtelEnabled(undefined)).toBe(false);
    expect(isThunderOtelEnabled('true')).toBe(true);
    expect(isThunderOtelEnabled('1')).toBe(true);
    expect(isThunderOtelEnabled('off')).toBe(false);
  });

  it('drops nullish span attributes', () => {
    expect(
      toSpanAttributes({
        a: 'x',
        b: undefined,
        c: null,
        d: 1,
      }),
    ).toEqual({ a: 'x', d: 1 });
  });

  it('runs work inside a span (noop provider by default)', async () => {
    const value = await withThunderSpan(
      'thunder.test.span',
      { 'thunder.job_type': 'thunder.hello.v1' },
      async () => 42,
    );
    expect(value).toBe(42);
  });

  it('rethrows and records errors', async () => {
    await expect(
      withThunderSpan('thunder.test.fail', {}, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });
});
