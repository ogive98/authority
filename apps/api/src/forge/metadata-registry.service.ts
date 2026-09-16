import { HttpStatus, Injectable } from '@nestjs/common';
import {
  FrgMetadataStatus,
  FrgMetadataType,
  Prisma,
} from '@prisma/client';
import { AUDIT_ACTIONS } from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import type { MetadataDefinitionDto } from './contracts';
import {
  FORGE_AUDIT_ENTITY_TYPES,
  FORGE_ERROR_CODES,
  FORGE_EVENT_TYPES,
} from './forge.constants';
import { ForgeException } from './forge.exception';
import { ExtensionLifecycleService } from './extension-lifecycle.service';
import type { ForgeTenantContext } from './tenant-context.util';

export type CreateMetadataInput = {
  key: string;
  type: FrgMetadataType;
  moduleKey: string;
  extensionId?: string;
  schemaJson?: Record<string, unknown>;
};

@Injectable()
export class MetadataRegistryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: ExtensionLifecycleService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  async list(
    ctx: ForgeTenantContext,
  ): Promise<{ items: MetadataDefinitionDto[] }> {
    const rows = await this.prisma.frgMetadataDefinition.findMany({
      where: { companyId: ctx.companyId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return { items: rows.map(serializeMetadata) };
  }

  async get(
    ctx: ForgeTenantContext,
    id: string,
  ): Promise<MetadataDefinitionDto> {
    return serializeMetadata(await this.findScoped(ctx, id));
  }

  /** ACTIVE definitions only — for Soft Glass FeatureMetadata bridge overlays. */
  async listActiveForBridge(
    ctx: ForgeTenantContext,
  ): Promise<{ items: MetadataDefinitionDto[] }> {
    const rows = await this.prisma.frgMetadataDefinition.findMany({
      where: {
        companyId: ctx.companyId,
        deletedAt: null,
        status: FrgMetadataStatus.ACTIVE,
      },
      orderBy: { key: 'asc' },
    });
    return { items: rows.map(serializeMetadata) };
  }

  async coverage(ctx: ForgeTenantContext): Promise<{
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    activeWithCommandId: number;
  }> {
    const rows = await this.prisma.frgMetadataDefinition.findMany({
      where: { companyId: ctx.companyId, deletedAt: null },
      select: { type: true, status: true, schemaJson: true },
    });
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let activeWithCommandId = 0;
    for (const r of rows) {
      byType[r.type] = (byType[r.type] ?? 0) + 1;
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      if (r.status === FrgMetadataStatus.ACTIVE) {
        const schema = (r.schemaJson ?? {}) as Record<string, unknown>;
        if (typeof schema.commandId === 'string' && schema.commandId.trim()) {
          activeWithCommandId += 1;
        }
      }
    }
    return {
      total: rows.length,
      byType,
      byStatus,
      activeWithCommandId,
    };
  }

  async create(
    ctx: ForgeTenantContext,
    input: CreateMetadataInput,
  ): Promise<MetadataDefinitionDto> {
    const key = input.key.trim();
    const moduleKey = input.moduleKey.trim();
    if (!key || !moduleKey) {
      throw new ForgeException(
        FORGE_ERROR_CODES.VALIDATION,
        'Metadata key and moduleKey are required.',
      );
    }
    if (input.extensionId) {
      const ext = await this.prisma.frgExtension.findFirst({
        where: {
          id: input.extensionId,
          companyId: ctx.companyId,
          deletedAt: null,
        },
      });
      if (!ext) {
        throw new ForgeException(
          FORGE_ERROR_CODES.NOT_FOUND,
          'Extension not found for metadata link.',
          HttpStatus.NOT_FOUND,
        );
      }
    }
    const existing = await this.prisma.frgMetadataDefinition.findFirst({
      where: { companyId: ctx.companyId, key, deletedAt: null },
    });
    if (existing) {
      throw new ForgeException(
        FORGE_ERROR_CODES.DUPLICATE_KEY,
        `Metadata key "${key}" already exists for this company.`,
        HttpStatus.CONFLICT,
      );
    }

    const schemaJson = input.schemaJson ?? {};
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.frgMetadataDefinition.create({
        data: {
          companyId: ctx.companyId,
          key,
          type: input.type,
          moduleKey,
          extensionId: input.extensionId ?? null,
          schemaJson: schemaJson as Prisma.InputJsonValue,
          status: FrgMetadataStatus.DRAFT,
        },
      });
      await this.audit.append(tx, {
        companyId: ctx.companyId,
        actorUserId: ctx.userId,
        action: AUDIT_ACTIONS.forgeMetadataCreate,
        entityType: FORGE_AUDIT_ENTITY_TYPES.metadataDefinition,
        entityId: created.id,
        afterJson: {
          key: created.key,
          type: created.type,
          status: created.status,
          moduleKey: created.moduleKey,
        },
      });
      await this.outbox.enqueue(tx, {
        companyId: ctx.companyId,
        aggregateType: FORGE_AUDIT_ENTITY_TYPES.metadataDefinition,
        aggregateId: created.id,
        eventType: FORGE_EVENT_TYPES.METADATA_CREATED,
        payloadJson: {
          metadataId: created.id,
          key: created.key,
          type: created.type,
          status: created.status,
        },
      });
      return created;
    });
    return serializeMetadata(row);
  }

  async transitionStatus(
    ctx: ForgeTenantContext,
    id: string,
    next: FrgMetadataStatus,
  ): Promise<MetadataDefinitionDto> {
    const row = await this.findScoped(ctx, id);
    this.lifecycle.assertMetadataTransition(row.status, next);

    const updated = await this.prisma.$transaction(async (tx) => {
      const nextRow = await tx.frgMetadataDefinition.update({
        where: { id: row.id },
        data: {
          status: next,
          version: { increment: 1 },
        },
      });
      await this.audit.append(tx, {
        companyId: ctx.companyId,
        actorUserId: ctx.userId,
        action: AUDIT_ACTIONS.forgeMetadataStatus,
        entityType: FORGE_AUDIT_ENTITY_TYPES.metadataDefinition,
        entityId: nextRow.id,
        beforeJson: { status: row.status },
        afterJson: { status: nextRow.status },
      });
      await this.outbox.enqueue(tx, {
        companyId: ctx.companyId,
        aggregateType: FORGE_AUDIT_ENTITY_TYPES.metadataDefinition,
        aggregateId: nextRow.id,
        eventType: FORGE_EVENT_TYPES.METADATA_STATUS_CHANGED,
        payloadJson: {
          metadataId: nextRow.id,
          key: nextRow.key,
          from: row.status,
          to: nextRow.status,
        },
      });
      return nextRow;
    });
    return serializeMetadata(updated);
  }

  private async findScoped(ctx: ForgeTenantContext, id: string) {
    const row = await this.prisma.frgMetadataDefinition.findFirst({
      where: { id, companyId: ctx.companyId, deletedAt: null },
    });
    if (!row) {
      throw new ForgeException(
        FORGE_ERROR_CODES.NOT_FOUND,
        'Metadata definition not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return row;
  }
}

function serializeMetadata(row: {
  id: string;
  companyId: string;
  key: string;
  type: FrgMetadataType;
  moduleKey: string;
  extensionId: string | null;
  schemaJson: unknown;
  status: FrgMetadataStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}): MetadataDefinitionDto {
  return {
    id: row.id,
    companyId: row.companyId,
    key: row.key,
    type: row.type,
    moduleKey: row.moduleKey,
    extensionId: row.extensionId,
    schemaJson: (row.schemaJson ?? {}) as Record<string, unknown>,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
