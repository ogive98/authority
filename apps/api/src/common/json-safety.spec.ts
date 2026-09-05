import {
  assertJsonPayloadSize,
  measureJsonBytes,
  PayloadTooLargeError,
  resolveMaxPayloadBytes,
  resolveOutboxMaxPublishAttempts,
  scrubSecrets,
} from './json-safety';

describe('json-safety', () => {
  it('measures utf8 json bytes', () => {
    expect(measureJsonBytes({ a: 1 })).toBeGreaterThan(0);
  });

  it('throws when payload exceeds max', () => {
    const max = 32;
    expect(() => assertJsonPayloadSize({ big: 'x'.repeat(100) }, max)).toThrow(
      PayloadTooLargeError,
    );
  });

  it('scrubs sensitive keys deeply', () => {
    const scrubbed = scrubSecrets({
      user: 'karim',
      password: 'secret',
      nested: { apiKey: 'abc', ok: true },
      list: [{ token: 't', n: 1 }],
    });
    expect(scrubbed).toEqual({
      user: 'karim',
      password: '[REDACTED]',
      nested: { apiKey: '[REDACTED]', ok: true },
      list: [{ token: '[REDACTED]', n: 1 }],
    });
  });

  it('resolves defaults', () => {
    expect(resolveMaxPayloadBytes(undefined)).toBe(256 * 1024);
    expect(resolveOutboxMaxPublishAttempts(undefined)).toBe(5);
  });
});
