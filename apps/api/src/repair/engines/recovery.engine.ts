import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { SnapshotEngine } from './snapshot.engine';

export type RecoveryPolicy = {
  id: string;
  title: string;
  status: 'ALLOWED' | 'DEFERRED' | 'REJECTED';
  reason: string;
};

/**
 * Recovery plane V0 (D085) — policy surface only.
 * REJECT: GitHub live reinstall, source rewrite, hot binary swap, factory wipe.
 * ALLOWED now: metadata manifest bookmark (not installable restore).
 * DEFERRED: signed release artifact + SOC DB/file backup wizard (hybride).
 */
@Injectable()
export class RecoveryEngine {
  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshots: SnapshotEngine,
  ) {}

  policies(): RecoveryPolicy[] {
    return [
      {
        id: 'meta-manifest',
        title: 'Manifeste de versions (métadonnée)',
        status: 'ALLOWED',
        reason:
          'Enregistre un bookmark local (versions modules / build) — pas un restore installable.',
      },
      {
        id: 'signed-release-reinstall',
        title: 'Réinstall depuis release signée',
        status: 'DEFERRED',
        reason:
          'Artefacts signés + cache hybride offline — wizard humain requis (SOC Recovery).',
      },
      {
        id: 'soc-db-file-backup',
        title: 'Backup DB + fichiers installable',
        status: 'DEFERRED',
        reason:
          'D304 = manifest LOCAL_FS only (restorable:false). Installable SOC backup = D305+.',
      },
      {
        id: 'github-live-reinstall',
        title: 'Fetch GitHub + réécriture code live',
        status: 'REJECTED',
        reason: 'Supply-chain / drift — permanent BLOCKED (REP-CODE-GITHUB-REINSTALL-BLOCKED).',
      },
      {
        id: 'source-rewrite',
        title: 'Réécriture source runtime',
        status: 'REJECTED',
        reason: 'Permanent BLOCKED (REP-SOURCE-REWRITE-BLOCKED).',
      },
      {
        id: 'hot-binary-swap',
        title: 'Hot-swap binaires modules',
        status: 'REJECTED',
        reason: 'Permanent BLOCKED (REP-MODULE-BINARY-REPLACE-BLOCKED).',
      },
      {
        id: 'factory-wipe',
        title: 'Factory / DB wipe',
        status: 'REJECTED',
        reason: 'Permanent BLOCKED via Reset scopes.',
      },
    ];
  }

  async createManifestBookmark(input?: {
    companyId?: string;
    label?: string;
  }) {
    const moduleStates = input?.companyId
      ? await this.prisma.modModuleState.findMany({
          where: { companyId: input.companyId },
          select: { moduleKey: true, status: true },
          orderBy: { moduleKey: 'asc' },
        })
      : [];

    const snap = await this.snapshots.create({
      companyId: input?.companyId,
      label: input?.label ?? `recovery-manifest-${randomUUID().slice(0, 8)}`,
    });

    return {
      id: snap.ref,
      kind: 'metadata-only' as const,
      restorable: false as const,
      createdAt: snap.createdAt,
      label: snap.label,
      companyId: snap.companyId,
      modules: moduleStates,
      note: `${snap.note} Prefer POST /api/v1/backup/backups (D304).`,
      rejectedPaths: this.policies()
        .filter((p) => p.status === 'REJECTED')
        .map((p) => p.id),
    };
  }
}
