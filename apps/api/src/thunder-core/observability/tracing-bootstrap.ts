import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  NodeTracerProvider,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-node';
import { isThunderOtelEnabled, THUNDER_TRACER_NAME } from './tracing';

let provider: NodeTracerProvider | null = null;

/**
 * Optional OTel export bootstrap (THU-HARD-06).
 * Default: no-op tracer (hooks still create spans via @opentelemetry/api).
 * Enable with THUNDER_OTEL_ENABLED=true (+ optional OTEL_EXPORTER_OTLP_ENDPOINT).
 */
export async function startThunderTracing(): Promise<void> {
  if (!isThunderOtelEnabled()) {
    return;
  }
  if (provider) {
    return;
  }

  if (process.env.THUNDER_OTEL_DIAG === 'true') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
  }

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  const spanProcessors = endpoint
    ? [
        new BatchSpanProcessor(
          new OTLPTraceExporter({
            url: endpoint.endsWith('/v1/traces')
              ? endpoint
              : `${endpoint.replace(/\/$/, '')}/v1/traces`,
          }),
        ),
      ]
    : [new SimpleSpanProcessor(new ConsoleSpanExporter())];

  const next = new NodeTracerProvider({ spanProcessors });
  next.register();
  provider = next;
}

export async function stopThunderTracing(): Promise<void> {
  if (!provider) {
    return;
  }
  const current = provider;
  provider = null;
  await current.shutdown();
}

export function thunderTracingProviderRegistered(): boolean {
  return provider != null;
}

/** For diagnostics / tests. */
export function thunderTracingServiceName(): string {
  return THUNDER_TRACER_NAME;
}
