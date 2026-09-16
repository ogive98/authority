import { HttpStatus, Injectable } from '@nestjs/common';
import { FrgFeatureRequestStatus, Prisma } from '@prisma/client';
import { AUDIT_ACTIONS } from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateFeatureRequestInput, FeatureRequestDto } from './contracts';
import {
  FORGE_AUDIT_ENTITY_TYPES,
  FORGE_ERROR_CODES,
  FORGE_EVENT_TYPES,
} from './forge.constants';
import { ForgeException } from './forge.exception';
import { ExtensionLifecycleService } from './extension-lifecycle.service';
import type { ForgeTenantContext } from './tenant-context.util';

@Injectable()
export class FeatureRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: ExtensionLifecycleService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  async list(ctx: ForgeTenantContext): Promise<{ items: FeatureRequestDto[] }> {
    const rows = await this.prisma.frgFeatureRequest.findMany({
      where: { companyId: ctx.companyId, deletedAt: null },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
    return { items: rows.map(serializeFeatureRequest) };
  }

  async get(ctx: ForgeTenantContext, id: string): Promise<FeatureRequestDto> {
    const row = await this.findScoped(ctx, id);
    return serializeFeatureRequest(row);
  }

  async create(
    ctx: ForgeTenantContext,
    input: CreateFeatureRequestInput,
  ): Promise<FeatureRequestDto> {
    const title = input.title.trim();
    if (!title) {
      throw new ForgeException(
        FORGE_ERROR_CODES.VALIDATION,
        'Title is required.',
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
          'Linked extension not found.',
          HttpStatus.NOT_FOUND,
        );
      }
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.frgFeatureRequest.create({
        data: {
          companyId: ctx.companyId,
          title,
          description: input.description?.trim() || null,
          status: FrgFeatureRequestStatus.RECEIVED,
          priority: input.priority ?? 0,
          source: input.source ?? 'manual',
          requestedByUserId: ctx.userId ?? null,
          affectedModulesJson: (input.affectedModules ??
            []) as Prisma.InputJsonValue,
          extensionId: input.extensionId ?? null,
        },
      });
      await this.audit.append(tx, {
        companyId: ctx.companyId,
        actorUserId: ctx.userId,
        action: AUDIT_ACTIONS.forgeFeatureRequestCreate,
        entityType: FORGE_AUDIT_ENTITY_TYPES.featureRequest,
        entityId: created.id,
        afterJson: { title: created.title, status: created.status },
      });
      await this.outbox.enqueue(tx, {
        companyId: ctx.companyId,
        aggregateType: FORGE_AUDIT_ENTITY_TYPES.featureRequest,
        aggregateId: created.id,
        eventType: FORGE_EVENT_TYPES.FEATURE_REQUEST_CREATED,
        payloadJson: {
          featureRequestId: created.id,
          title: created.title,
          status: created.status,
        },
      });
      return created;
    });
    return serializeFeatureRequest(row);
  }

  async transitionStatus(
    ctx: ForgeTenantContext,
    id: string,
    next: FrgFeatureRequestStatus,
  ): Promise<FeatureRequestDto> {
    const row = await this.findScoped(ctx, id);
    this.lifecycle.assertFeatureRequestTransition(row.status, next);
    const updated = await this.prisma.$transaction(async (tx) => {
      const nextRow = await tx.frgFeatureRequest.update({
        where: { id: row.id },
        data: {
          status: next,
          version: { increment: 1 },
        },
      });
      await this.audit.append(tx, {
        companyId: ctx.companyId,
        actorUserId: ctx.userId,
        action: AUDIT_ACTIONS.forgeFeatureRequestStatus,
        entityType: FORGE_AUDIT_ENTITY_TYPES.featureRequest,
        entityId: nextRow.id,
        beforeJson: { status: row.status },
        afterJson: { status: nextRow.status },
      });
      await this.outbox.enqueue(tx, {
        companyId: ctx.companyId,
        aggregateType: FORGE_AUDIT_ENTITY_TYPES.featureRequest,
        aggregateId: nextRow.id,
        eventType: FORGE_EVENT_TYPES.FEATURE_REQUEST_STATUS_CHANGED,
        payloadJson: {
          featureRequestId: nextRow.id,
          from: row.status,
          to: nextRow.status,
        },
      });
      return nextRow;
    });
    return serializeFeatureRequest(updated);
  }

  private async findScoped(ctx: ForgeTenantContext, id: string) {
    const row = await this.prisma.frgFeatureRequest.findFirst({
      where: { id, companyId: ctx.companyId, deletedAt: null },
    });
    if (!row) {
      throw new ForgeException(
        FORGE_ERROR_CODES.NOT_FOUND,
        'Feature request not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return row;
  }
}

function serializeFeatureRequest(row: {
  id: string;
  companyId: string;
  title: string;
  description: string | null;
  status: FrgFeatureRequestStatus;
  priority: number;
  source: string;
  requestedByUserId: string | null;
  affectedModulesJson: unknown;
  extensionId: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}): FeatureRequestDto {
  return {
    id: row.id,
    companyId: row.companyId,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    source: row.source,
    requestedByUserId: row.requestedByUserId,
    affectedModules: Array.isArray(row.affectedModulesJson)
      ? (row.affectedModulesJson as string[])
      : [],
    extensionId: row.extensionId,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
