export type AdapterDirection = 'inbound' | 'outbound' | 'bidirectional';

export type AdapterManifest = {
  adapterId: string;
  version: string;
  direction: AdapterDirection;
  /** Capability keys this adapter may exercise (declare only in 01d). */
  capabilities: string[];
  /** Circuit-breaker dependency key (wired in PLAT-03). */
  dependencyKey: string;
  secretRef?: string;
  description?: string;
};

export type AdapterHealth = {
  ok: boolean;
  message?: string;
  details?: Record<string, unknown>;
};

/**
 * Thunder adapter contract — interfaces only in THU-PLAT-01d.
 * Inbound/outbound I/O deferred to THU-PLAT-03 (webhooks).
 */
export interface ThunderAdapter {
  readonly manifest: AdapterManifest;
  health(): Promise<AdapterHealth>;
}

export interface InboundAdapter extends ThunderAdapter {
  readonly direction: 'inbound' | 'bidirectional';
}

export interface OutboundAdapter extends ThunderAdapter {
  readonly direction: 'outbound' | 'bidirectional';
}
