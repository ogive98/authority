import {
  context,
  SpanStatusCode,
  trace,
  type Attributes,
  type Span,
  type Tracer,
} from '@opentelemetry/api';

export const THUNDER_TRACER_NAME = 'authority.thunder';

/** Env gate for optional OTLP/console export (THU-HARD-06). */
export function isThunderOtelEnabled(
  raw: string | undefined = process.env.THUNDER_OTEL_ENABLED,
): boolean {
  if (!raw) {
    return false;
  }
  const v = raw.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

export function getThunderTracer(): Tracer {
  return trace.getTracer(THUNDER_TRACER_NAME);
}

export type ThunderSpanAttributeValue =
  | string
  | number
  | boolean
  | undefined
  | null;

/** Strip undefined/null; never accept nested objects (no secrets/payloads). */
export function toSpanAttributes(
  input: Record<string, ThunderSpanAttributeValue>,
): Attributes {
  const out: Attributes = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) {
      continue;
    }
    out[key] = value;
  }
  return out;
}

export async function withThunderSpan<T>(
  name: string,
  attributes: Record<string, ThunderSpanAttributeValue>,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  const tracer = getThunderTracer();
  return tracer.startActiveSpan(
    name,
    { attributes: toSpanAttributes(attributes) },
    context.active(),
    async (span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Thunder span failed';
        span.setStatus({ code: SpanStatusCode.ERROR, message });
        if (error instanceof Error) {
          span.recordException(error);
        }
        throw error;
      } finally {
        span.end();
      }
    },
  );
}

export function thunderTracingSnapshot(): {
  enabled: boolean;
  tracerName: string;
} {
  return {
    enabled: isThunderOtelEnabled(),
    tracerName: THUNDER_TRACER_NAME,
  };
}
