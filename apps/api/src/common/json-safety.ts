/** Shared JSON safety helpers (THU-HARD-05). No Nest imports. */

const DEFAULT_MAX_PAYLOAD_BYTES = 256 * 1024;

const SENSITIVE_KEY =
  /^(password|passwd|secret|token|access[_-]?token|refresh[_-]?token|authorization|api[_-]?key|apikey|private[_-]?key|client[_-]?secret|totp|otp|cnss|ssn|nib|rib|cookie|set-cookie)$/i;

export function resolveMaxPayloadBytes(
  raw: string | undefined = process.env.THUNDER_PAYLOAD_MAX_BYTES,
): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1024) {
    return DEFAULT_MAX_PAYLOAD_BYTES;
  }
  return Math.trunc(parsed);
}

export function measureJsonBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value ?? null), 'utf8');
}

export class PayloadTooLargeError extends Error {
  readonly code = 'THUNDER.PAYLOAD_TOO_LARGE';
  readonly bytes: number;
  readonly maxBytes: number;

  constructor(bytes: number, maxBytes: number) {
    super(`Payload exceeds max size (${bytes} > ${maxBytes} bytes)`);
    this.name = 'PayloadTooLargeError';
    this.bytes = bytes;
    this.maxBytes = maxBytes;
  }
}

export function assertJsonPayloadSize(
  value: unknown,
  maxBytes = resolveMaxPayloadBytes(),
): void {
  const bytes = measureJsonBytes(value);
  if (bytes > maxBytes) {
    throw new PayloadTooLargeError(bytes, maxBytes);
  }
}

/** Deep-clone JSON-like values and redact sensitive keys. */
export function scrubSecrets<T>(value: T): T {
  return scrubValue(value) as T;
}

function scrubValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => scrubValue(item));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(
      value as Record<string, unknown>,
    )) {
      out[key] = SENSITIVE_KEY.test(key) ? '[REDACTED]' : scrubValue(child);
    }
    return out;
  }
  return value;
}

export function resolveOutboxMaxPublishAttempts(
  raw: string | undefined = process.env.THUNDER_OUTBOX_MAX_PUBLISH_ATTEMPTS,
): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 5;
  }
  return Math.min(50, Math.trunc(parsed));
}
