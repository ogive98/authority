import { HttpStatus, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { REPAIR_ERROR_CODES } from '../repair.constants';
import { RepairException } from '../repair.exception';

export type SnapshotKind = 'metadata-only';

export interface SnapshotRecord {
  ref: string;
  kind: SnapshotKind;
  companyId?: string;
  label?: string;
  createdAt: string;
  /** Explicit: cannot restore files/DB from this record. */
  restorable: false;
  note: string;
}

/**
 * Metadata bookmarks only — NOT a SOC backup / restore point (D085).
 * Restore APIs throw permanently.
 */
@Injectable()
export class SnapshotEngine {
  private readonly snapshots: SnapshotRecord[] = [];

  async create(input?: {
    companyId?: string;
    label?: string;
  }): Promise<SnapshotRecord> {
    const record: SnapshotRecord = {
      ref: randomUUID(),
      kind: 'metadata-only',
      companyId: input?.companyId,
      label: input?.label ?? 'repair-snapshot-meta',
      createdAt: new Date().toISOString(),
      restorable: false,
      note: 'Metadata bookmark only — not an installable backup. SOC Recovery deferred.',
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

  /** Permanently refused — prevents false restore confidence. */
  restore(_ref: string): never {
    throw new RepairException(
      REPAIR_ERROR_CODES.EXECUTION_BLOCKED,
      'Snapshot restore is BLOCKED: metadata-only bookmarks cannot reinstall code or DB. Use future SOC Recovery with signed artifacts.',
      HttpStatus.FORBIDDEN,
    );
  }
}
