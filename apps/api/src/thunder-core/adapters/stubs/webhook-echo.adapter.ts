import type { AdapterHealth, ThunderAdapter } from '../adapter.types';

/** Placeholder inbound webhook adapter (I/O deferred to PLAT-03). */
export class WebhookEchoAdapterStub implements ThunderAdapter {
  readonly manifest = {
    adapterId: 'webhook.echo',
    version: '0.1.0',
    direction: 'inbound' as const,
    capabilities: [],
    dependencyKey: 'webhook_echo',
    description: 'Stub inbound webhook adapter — no HTTP listener in 01d',
  };

  async health(): Promise<AdapterHealth> {
    return {
      ok: true,
      message: 'webhook.echo stub registered (no ingress yet)',
    };
  }
}
