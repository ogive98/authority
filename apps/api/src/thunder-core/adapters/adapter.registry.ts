import { Injectable } from '@nestjs/common';
import type {
  AdapterHealth,
  AdapterManifest,
  ThunderAdapter,
} from './adapter.types';

@Injectable()
export class AdapterRegistryService {
  private readonly adapters = new Map<string, ThunderAdapter>();

  register(adapter: ThunderAdapter): void {
    this.adapters.set(adapter.manifest.adapterId, adapter);
  }

  unregister(adapterId: string): void {
    this.adapters.delete(adapterId);
  }

  get(adapterId: string): ThunderAdapter | undefined {
    return this.adapters.get(adapterId);
  }

  list(): AdapterManifest[] {
    return [...this.adapters.values()]
      .map((a) => a.manifest)
      .sort((a, b) => a.adapterId.localeCompare(b.adapterId));
  }

  async healthAll(): Promise<
    Array<{ adapterId: string; health: AdapterHealth }>
  > {
    const out: Array<{ adapterId: string; health: AdapterHealth }> = [];
    for (const adapter of this.adapters.values()) {
      out.push({
        adapterId: adapter.manifest.adapterId,
        health: await adapter.health(),
      });
    }
    return out.sort((a, b) => a.adapterId.localeCompare(b.adapterId));
  }
}
