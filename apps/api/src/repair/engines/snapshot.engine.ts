import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

export interface SnapshotRecord {
  ref: string;
  companyId?: string;
  label?: string;
  createdAt: string;
}

@Injectable()
export class SnapshotEngine {
  private readonly snapshots: SnapshotRecord[] = [];

  async create(input?: {
    companyId?: string;
    label?: string;
  }): Promise<SnapshotRecord> {
    const record: SnapshotRecord = {
      ref: randomUUID(),
      companyId: input?.companyId,
      label: input?.label ?? 'repair-snapshot',
      createdAt: new Date().toISOString(),
    };
    this.snapshots.unshift(record);
    return record;
  }

  list(limit = 50): SnapshotRecord[] {
    return this.snapshots.slice(0, limit);
  }

  get(ref: string): SnapshotRecord | undefined {
    return this.snapshots.find((s) => s.ref === ref);
  }
}
