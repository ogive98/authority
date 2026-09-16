import { HttpStatus, Injectable } from '@nestjs/common';
import { FrgExtensionStatus, Prisma } from '@prisma/client';
import { AUDIT_ACTIONS } from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import type { ExtensionManifestBody } from './contracts';
import {
  FORGE_AUDIT_ENTITY_TYPES,
  FORGE_ERROR_CODES,
  FORGE_EVENT_TYPES,
} from './forge.constants';
import { ForgeException } from './forge.exception';
import { ExtensionLifecycleService } from './extension-lifecycle.service';
import type { ForgeTenantContext } from './tenant-context.util';

export type ExtensionDto = {
  id: string;
  companyId: string;
  key: string;
  name: string;
  description: string | null;
  manifestVersion: string;
  status: FrgExtensionStatus;
  tenantScope: string;
  manifest: ExtensionManifestBody;
  dependencies: string[];
  compatibleCoreVersion: string | null;
  createdByUserId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type RegisterExtensionInput = {
  key: string;
  name: string;
  description?: string;
  manifestVersion: string;
  manifest?: ExtensionManifestBody;
  dependencies?: string[];
  compatibleCoreVersion?: string;
};

@Injectable()
export class ExtensionRegistryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: ExtensionLifecycleService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  async list(ctx: ForgeTenantContext): Promise<{ items: ExtensionDto[] }> {
    const rows = await this.prisma.frgExtension.findMany({
      where: { companyId: ctx.companyId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return { items: rows.map(serializeExtension) };
  }

  async get(ctx: ForgeTenantContext, id: string): Promise<ExtensionDto> {
    const row = await this.findScoped(ctx, id);
    return serializeExtension(row);
  }

  async register(
    ctx: ForgeTenantContext,
    input: RegisterExtensionInput,
  ): Promise<ExtensionDto> {
    const key = input.key.trim();
    if (!key) {
      throw new ForgeException(
        FORGE_ERROR_CODES.VALIDATION,
        'Extension key is required.',
      );
    }
    const existing = await this.prisma.frgExtension.findFirst({
      where: { companyId: ctx.companyId, key, deletedAt: null },
    });
    if (existing) {
      throw new ForgeException(
        FORGE_ERROR_CODES.DUPLICATE_KEY,
        `Extension key "${key}" already exists for this company.`,
        HttpStatus.CONFLICT,
      );
    }

    const manifest: ExtensionManifestBody = {
      key,
      name: input.name,
      description: input.description,
      version: input.manifestVersion,
      tenantScope: 'company',
      dependencies: input.dependencies ?? [],
      compatibleCoreVersion: input.compatibleCoreVersion,
      ...input.manifest,
    };

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.frgExtension.create({
        data: {
          companyId: ctx.companyId,
          key,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          manifestVersion: input.manifestVersion.trim(),
          status: FrgExtensionStatus.DRAFT,
          tenantScope: 'company',
          manifestJson: manifest as unknown as Prisma.InputJsonValue,
          dependenciesJson: (input.dependencies ?? []) as Prisma.InputJsonValue,
          compatibleCoreVersion: input.compatibleCoreVersion?.trim() || null,
          createdByUserId: ctx.userId ?? null,
        },
      });
      await this.audit.append(tx, {
        companyId: ctx.companyId,
        actorUserId: ctx.userId,
        action: AUDIT_ACTIONS.forgeExtensionCreate,
        entityType: FORGE_AUDIT_ENTITY_TYPES.extension,
        entityId: created.id,
        afterJson: {
          key: created.key,
          status: created.status,
          manifestVersion: created.manifestVersion,
        },
      });
      await this.outbox.enqueue(tx, {
        companyId: ctx.companyId,
        aggregateType: FORGE_AUDIT_ENTITY_TYPES.extension,
        aggregateId: created.id,
        eventType: FORGE_EVENT_TYPES.EXTENSION_CREATED,
        payloadJson: {
          extensionId: created.id,
          key: created.key,
          status: created.status,
        },
      });
      return created;
    });
    return serializeExtension(row);
  }

  /**
   * Lifecycle transition. APPROVED / ACTIVE require forge.approve at API layer.
   * forge.write transitions cannot jump to those statuses.
   */
  async transitionStatus(
    ctx: ForgeTenantContext,
    id: string,
    next: FrgExtensionStatus,
    opts?: { allowApproveActivate?: boolean },
  ): Promise<ExtensionDto> {
    const row = await this.findScoped(ctx, id);
    this.lifecycle.assertExtensionTransition(row.status, next);

    if (
      (next === FrgExtensionStatus.APPROVED ||
        next === FrgExtensionStatus.ACTIVE) &&
      !opts?.allowApproveActivate
    ) {
      throw new ForgeException(
        FORGE_ERROR_CODES.INVALID_TRANSITION,
        'APPROVED / ACTIVE require forge.approve permission endpoint.',
        HttpStatus.FORBIDDEN,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const nextRow = await tx.frgExtension.update({
        where: { id: row.id },
        data: {
          status: next,
          version: { increment: 1 },
        },
      });
      await this.audit.append(tx, {
        companyId: ctx.companyId,
        actorUserId: ctx.userId,
        action: AUDIT_ACTIONS.forgeExtensionStatus,
        entityType: FORGE_AUDIT_ENTITY_TYPES.extension,
        entityId: nextRow.id,
        beforeJson: { status: row.status },
        afterJson: { status: nextRow.status },
      });
      await this.outbox.enqueue(tx, {
        companyId: ctx.companyId,
        aggregateType: FORGE_AUDIT_ENTITY_TYPES.extension,
        aggregateId: nextRow.id,
        eventType: FORGE_EVENT_TYPES.EXTENSION_STATUS_CHANGED,
        payloadJson: {
          extensionId: nextRow.id,
          key: nextRow.key,
          from: row.status,
          to: nextRow.status,
        },
      });
      return nextRow;
    });
    return serializeExtension(updated);
  }

  private async findScoped(ctx: ForgeTenantContext, id: string) {
    const row = await this.prisma.frgExtension.findFirst({
      where: { id, companyId: ctx.companyId, deletedAt: null },
    });
    if (!row) {
      throw new ForgeException(
        FORGE_ERROR_CODES.NOT_FOUND,
        'Extension not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return row;
  }
}

function serializeExtension(row: {
  id: string;
  companyId: string;
  key: string;
  name: string;
  description: string | null;
  manifestVersion: string;
  status: FrgExtensionStatus;
  tenantScope: string;
  manifestJson: unknown;
  dependenciesJson: unknown;
  compatibleCoreVersion: string | null;
  createdByUserId: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}): ExtensionDto {
  return {
    id: row.id,
    companyId: row.companyId,
    key: row.key,
    name: row.name,
    description: row.description,
    manifestVersion: row.manifestVersion,
    status: row.status,
    tenantScope: row.tenantScope,
    manifest: (row.manifestJson ?? {}) as ExtensionManifestBody,
    dependencies: Array.isArray(row.dependenciesJson)
      ? (row.dependenciesJson as string[])
      : [],
    compatibleCoreVersion: row.compatibleCoreVersion,
    createdByUserId: row.createdByUserId,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
