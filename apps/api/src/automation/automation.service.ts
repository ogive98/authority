import { HttpStatus, Injectable } from '@nestjs/common';
import {
  AtmActionKind,
  AtmProfileMode,
  AtmRunStatus,
  AtmTriggerKind,
  FinOpenItemSide,
  FinOpenItemStatus,
  Prisma,
  SalOrderStatus,
} from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AUTOMATION_ERROR_CODES,
  AUTOMATION_EVENT_TYPES,
} from './automation.constants';
import { AutomationException } from './automation.exception';

export type AtmProfileDto = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  mode: AtmProfileMode;
  triggerKind: AtmTriggerKind;
  actionKind: AtmActionKind;
  enabled: boolean;
  shadowMode: boolean;
  configJson: Record<string, unknown>;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type AtmRunDto = {
  id: string;
  profileId: string;
  profileCode: string | null;
  profileName: string | null;
  number: string;
  status: AtmRunStatus;
  triggerRef: string | null;
  summary: string;
  payloadJson: Record<string, unknown>;
  resultJson: Record<string, unknown>;
  version: number;
  createdAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
};

export type AtmCatalogDto = {
  modes: Array<{ id: AtmProfileMode; label: string; allowed: boolean }>;
  triggers: Array<{ id: AtmTriggerKind; label: string }>;
  actions: Array<{ id: AtmActionKind; label: string }>;
};

@Injectable()
export class AutomationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  catalog(): AtmCatalogDto {
    return {
      modes: [
        { id: AtmProfileMode.ASSISTED, label: 'Assisté', allowed: true },
        {
          id: AtmProfileMode.REQUIRES_APPROVAL,
          label: 'Approbation requise',
          allowed: true,
        },
        {
          id: AtmProfileMode.FULL_AUTO,
          label: 'Plein auto (interdit V0)',
          allowed: false,
        },
      ],
      triggers: [
        {
          id: AtmTriggerKind.FINANCE_OVERDUE_OPEN_ITEMS,
          label: 'Créances AR échues',
        },
        {
          id: AtmTriggerKind.PORTAL_PAYMENT_DECLARATION_SUBMITTED,
          label: 'Déclaration paiement portail',
        },
        {
          id: AtmTriggerKind.SALES_DRAFT_ORDER_STALE,
          label: 'Commandes brouillon anciennes',
        },
        {
          id: AtmTriggerKind.TAX_TEJ_PACK_PREPARED,
          label: 'Lot TEJ XML préparé',
        },
        {
          id: AtmTriggerKind.SALES_ORDER_CONFIRMED,
          label: 'Commande confirmée',
        },
      ],
      actions: [
        { id: AtmActionKind.NOTIFY, label: 'Notifier (suggestion)' },
        {
          id: AtmActionKind.PREPARE_DUNNING_HINT,
          label: 'Hint relance (pas de draft auto)',
        },
        {
          id: AtmActionKind.ORDER_REVIEW_HINT,
          label: 'Hint revue commande (pas de confirm)',
        },
        {
          id: AtmActionKind.TEJ_IMPORT_HINT,
          label: 'Hint import Tej (pas d’upload)',
        },
        {
          id: AtmActionKind.PRODUCTION_NEED_HINT,
          label: 'Hint besoin production (pas d’OF auto)',
        },
      ],
    };
  }

  async listProfiles(
    companyId: string,
    opts: { q?: string; enabled?: boolean } = {},
  ): Promise<{ items: AtmProfileDto[] }> {
    const q = opts.q?.trim();
    const rows = await this.prisma.atmProfile.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(opts.enabled != null ? { enabled: opts.enabled } : {}),
        ...(q
          ? {
              OR: [
                { code: { contains: q, mode: 'insensitive' } },
                { name: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: 100,
    });
    return { items: rows.map(serializeProfile) };
  }

  async getProfile(companyId: string, id: string): Promise<AtmProfileDto> {
    return serializeProfile(await this.findProfile(companyId, id));
  }

  async createProfile(
    companyId: string,
    input: {
      code: string;
      name: string;
      description?: string;
      mode: AtmProfileMode;
      triggerKind: AtmTriggerKind;
      actionKind: AtmActionKind;
      enabled?: boolean;
      shadowMode?: boolean;
      configJson?: Record<string, unknown>;
    },
  ): Promise<AtmProfileDto> {
    this.assertModeAllowed(input.mode);
    this.assertPairing(input.triggerKind, input.actionKind);
    const code = input.code.trim().toUpperCase().replace(/\s+/g, '_');
    if (!/^[A-Z0-9_]{2,40}$/.test(code)) {
      throw new AutomationException(
        AUTOMATION_ERROR_CODES.VALIDATION,
        'code must be 2–40 chars [A-Z0-9_].',
        HttpStatus.BAD_REQUEST,
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.atmProfile.create({
        data: {
          companyId,
          code,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          mode: input.mode,
          triggerKind: input.triggerKind,
          actionKind: input.actionKind,
          enabled: input.enabled ?? true,
          shadowMode: input.shadowMode ?? false,
          configJson: (input.configJson ?? {}) as Prisma.InputJsonValue,
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'atm_profile',
        aggregateId: row.id,
        eventType: AUTOMATION_EVENT_TYPES.PROFILE_CHANGED,
        payloadJson: {
          profileId: row.id,
          code: row.code,
          mode: row.mode,
          enabled: row.enabled,
          op: 'created',
        },
      });
      return row;
    });
    return serializeProfile(created);
  }

  async updateProfile(
    companyId: string,
    id: string,
    patch: {
      name?: string;
      description?: string;
      mode?: AtmProfileMode;
      triggerKind?: AtmTriggerKind;
      actionKind?: AtmActionKind;
      enabled?: boolean;
      shadowMode?: boolean;
      configJson?: Record<string, unknown>;
      version: number;
    },
  ): Promise<AtmProfileDto> {
    const existing = await this.findProfile(companyId, id);
    if (existing.version !== patch.version) {
      throw new AutomationException(
        AUTOMATION_ERROR_CODES.INVALID_STATUS,
        'Version conflict.',
        HttpStatus.CONFLICT,
      );
    }
    const mode = patch.mode ?? existing.mode;
    const triggerKind = patch.triggerKind ?? existing.triggerKind;
    const actionKind = patch.actionKind ?? existing.actionKind;
    this.assertModeAllowed(mode);
    this.assertPairing(triggerKind, actionKind);

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.atmProfile.updateMany({
        where: {
          id,
          companyId,
          version: patch.version,
          deletedAt: null,
        },
        data: {
          ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
          ...(patch.description !== undefined
            ? { description: patch.description.trim() || null }
            : {}),
          mode,
          triggerKind,
          actionKind,
          ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
          ...(patch.shadowMode !== undefined
            ? { shadowMode: patch.shadowMode }
            : {}),
          ...(patch.configJson !== undefined
            ? { configJson: patch.configJson as Prisma.InputJsonValue }
            : {}),
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) {
        throw new AutomationException(
          AUTOMATION_ERROR_CODES.INVALID_STATUS,
          'Version conflict.',
          HttpStatus.CONFLICT,
        );
      }
      const row = await tx.atmProfile.findUniqueOrThrow({ where: { id } });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'atm_profile',
        aggregateId: row.id,
        eventType: AUTOMATION_EVENT_TYPES.PROFILE_CHANGED,
        payloadJson: {
          profileId: row.id,
          code: row.code,
          mode: row.mode,
          enabled: row.enabled,
          op: 'updated',
        },
      });
      return row;
    });
    return serializeProfile(updated);
  }

  async listRuns(
    companyId: string,
    opts: { profileId?: string; status?: string; limit?: number } = {},
  ): Promise<{ items: AtmRunDto[] }> {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const status = opts.status?.trim().toUpperCase();
    const rows = await this.prisma.atmRunLog.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(opts.profileId ? { profileId: opts.profileId } : {}),
        ...(status &&
        Object.values(AtmRunStatus).includes(status as AtmRunStatus)
          ? { status: status as AtmRunStatus }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
      include: { profile: { select: { code: true, name: true } } },
    });
    return {
      items: rows.map((r) =>
        serializeRun(r, r.profile.code, r.profile.name),
      ),
    };
  }

  async getRun(companyId: string, id: string): Promise<AtmRunDto> {
    const row = await this.prisma.atmRunLog.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { profile: { select: { code: true, name: true } } },
    });
    if (!row) {
      throw new AutomationException(
        AUTOMATION_ERROR_CODES.NOT_FOUND,
        'Automation run not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return serializeRun(row, row.profile.code, row.profile.name);
  }

  async runProfile(
    companyId: string,
    profileId: string,
    userId: string | null,
    opts: {
      triggerRef?: string;
      staleDays?: number;
      eventContext?: {
        eventType: string;
        eventId: string;
        aggregateId?: string;
        payload: Record<string, unknown>;
      };
    } = {},
  ): Promise<AtmRunDto> {
    const profile = await this.findProfile(companyId, profileId);
    if (!profile.enabled) {
      throw new AutomationException(
        AUTOMATION_ERROR_CODES.INVALID_STATUS,
        'Profile is disabled.',
        HttpStatus.CONFLICT,
      );
    }

    const evidence = await this.collectEvidence(companyId, profile, opts);
    if (evidence.payload.skipSuggest === true) {
      throw new AutomationException(
        AUTOMATION_ERROR_CODES.INVALID_STATUS,
        'No suggestion for this event context.',
        HttpStatus.CONFLICT,
      );
    }
    if (profile.shadowMode) {
      return this.persistRun(companyId, profile, userId, {
        status: AtmRunStatus.SKIPPED,
        summary: `Shadow · ${evidence.summary}`,
        triggerRef: opts.triggerRef ?? null,
        payloadJson: evidence.payload,
        resultJson: {
          shadow: true,
          hint: evidence.hint,
          source: opts.eventContext ? 'event' : 'manual',
        },
      });
    }

    const status =
      profile.mode === AtmProfileMode.REQUIRES_APPROVAL
        ? AtmRunStatus.PENDING_APPROVAL
        : AtmRunStatus.SUGGESTED;

    return this.persistRun(companyId, profile, userId, {
      status,
      summary: evidence.summary,
      triggerRef: opts.triggerRef ?? null,
      payloadJson: evidence.payload,
      resultJson: {
        hint: evidence.hint,
        actionKind: profile.actionKind,
        noMutation: true,
        source: opts.eventContext ? 'event' : 'manual',
      },
    });
  }

  /**
   * D289 — Thunder outbox → ASSISTED suggest runs (idempotent per eventId+profile).
   * Never mutates domain data. Unknown event types → no-op.
   */
  async suggestFromEvent(
    companyId: string,
    input: {
      eventType: string;
      eventId: string;
      aggregateId?: string;
      payload?: Record<string, unknown>;
    },
  ): Promise<{ created: number; skipped: number; runs: AtmRunDto[] }> {
    const triggerKind = mapEventToTrigger(input.eventType);
    if (!triggerKind) {
      return { created: 0, skipped: 0, runs: [] };
    }
    const eventId = input.eventId?.trim();
    if (!eventId) {
      return { created: 0, skipped: 0, runs: [] };
    }

    const profiles = await this.prisma.atmProfile.findMany({
      where: {
        companyId,
        deletedAt: null,
        enabled: true,
        triggerKind,
      },
      take: 50,
    });
    if (profiles.length === 0) {
      return { created: 0, skipped: 0, runs: [] };
    }

    const triggerRef = `evt:${eventId}`;
    const runs: AtmRunDto[] = [];
    let created = 0;
    let skipped = 0;

    for (const profile of profiles) {
      const existing = await this.prisma.atmRunLog.findFirst({
        where: {
          companyId,
          profileId: profile.id,
          triggerRef,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (existing) {
        skipped += 1;
        continue;
      }

      try {
        const run = await this.runProfile(companyId, profile.id, null, {
          triggerRef,
          eventContext: {
            eventType: input.eventType,
            eventId,
            aggregateId: input.aggregateId,
            payload: input.payload ?? {},
          },
        });
        runs.push(run);
        created += 1;
      } catch {
        skipped += 1;
      }
    }

    return { created, skipped, runs };
  }

  async approveRun(
    companyId: string,
    id: string,
    reviewerUserId: string,
    opts: { reviewNote?: string; version: number },
  ): Promise<AtmRunDto> {
    return this.reviewRun(
      companyId,
      id,
      reviewerUserId,
      AtmRunStatus.APPROVED,
      opts,
    );
  }

  async rejectRun(
    companyId: string,
    id: string,
    reviewerUserId: string,
    opts: { reviewNote?: string; version: number },
  ): Promise<AtmRunDto> {
    return this.reviewRun(
      companyId,
      id,
      reviewerUserId,
      AtmRunStatus.REJECTED,
      opts,
    );
  }

  private async reviewRun(
    companyId: string,
    id: string,
    reviewerUserId: string,
    next: typeof AtmRunStatus.APPROVED | typeof AtmRunStatus.REJECTED,
    opts: { reviewNote?: string; version: number },
  ): Promise<AtmRunDto> {
    const existing = await this.prisma.atmRunLog.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { profile: { select: { code: true, name: true } } },
    });
    if (!existing) {
      throw new AutomationException(
        AUTOMATION_ERROR_CODES.NOT_FOUND,
        'Automation run not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (existing.version !== opts.version) {
      throw new AutomationException(
        AUTOMATION_ERROR_CODES.INVALID_STATUS,
        'Version conflict.',
        HttpStatus.CONFLICT,
      );
    }
    if (
      existing.status !== AtmRunStatus.PENDING_APPROVAL &&
      existing.status !== AtmRunStatus.SUGGESTED
    ) {
      throw new AutomationException(
        AUTOMATION_ERROR_CODES.INVALID_STATUS,
        'Only SUGGESTED or PENDING_APPROVAL runs can be reviewed.',
        HttpStatus.CONFLICT,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.atmRunLog.updateMany({
        where: {
          id,
          companyId,
          version: opts.version,
          deletedAt: null,
        },
        data: {
          status: next,
          reviewedAt: new Date(),
          reviewedByUserId: reviewerUserId,
          reviewNote: opts.reviewNote?.trim() || null,
          version: { increment: 1 },
          resultJson: {
            ...(asObject(existing.resultJson) ?? {}),
            reviewed: true,
            decision: next,
            stillNoMutation: true,
          } as Prisma.InputJsonValue,
        },
      });
      if (result.count !== 1) {
        throw new AutomationException(
          AUTOMATION_ERROR_CODES.INVALID_STATUS,
          'Version conflict.',
          HttpStatus.CONFLICT,
        );
      }
      const row = await tx.atmRunLog.findUniqueOrThrow({
        where: { id },
        include: { profile: { select: { code: true, name: true } } },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'atm_run_log',
        aggregateId: row.id,
        eventType: AUTOMATION_EVENT_TYPES.RUN_REVIEWED,
        payloadJson: {
          runId: row.id,
          number: row.number,
          status: row.status,
          profileId: row.profileId,
        },
      });
      return row;
    });
    return serializeRun(updated, updated.profile.code, updated.profile.name);
  }

  private async persistRun(
    companyId: string,
    profile: {
      id: string;
      code: string;
      name: string;
    },
    userId: string | null,
    data: {
      status: AtmRunStatus;
      summary: string;
      triggerRef: string | null;
      payloadJson: Record<string, unknown>;
      resultJson: Record<string, unknown>;
    },
  ): Promise<AtmRunDto> {
    const number = await this.nextRunNumber(companyId);
    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.atmRunLog.create({
        data: {
          companyId,
          profileId: profile.id,
          number,
          status: data.status,
          triggerRef: data.triggerRef,
          summary: data.summary,
          payloadJson: data.payloadJson as Prisma.InputJsonValue,
          resultJson: data.resultJson as Prisma.InputJsonValue,
          createdByUserId: userId,
        },
        include: { profile: { select: { code: true, name: true } } },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'atm_run_log',
        aggregateId: row.id,
        eventType: AUTOMATION_EVENT_TYPES.RUN_CREATED,
        payloadJson: {
          runId: row.id,
          number: row.number,
          status: row.status,
          profileId: profile.id,
          profileCode: profile.code,
        },
      });
      return row;
    });
    return serializeRun(created, created.profile.code, created.profile.name);
  }

  private async collectEvidence(
    companyId: string,
    profile: {
      triggerKind: AtmTriggerKind;
      actionKind: AtmActionKind;
      configJson: Prisma.JsonValue;
    },
    opts: {
      staleDays?: number;
      eventContext?: {
        eventType: string;
        eventId: string;
        aggregateId?: string;
        payload: Record<string, unknown>;
      };
    },
  ): Promise<{
    summary: string;
    hint: string;
    payload: Record<string, unknown>;
  }> {
    const cfg = asObject(profile.configJson) ?? {};
    const staleDays =
      opts.staleDays ??
      (typeof cfg.staleDays === 'number' ? cfg.staleDays : 3);
    const ctx = opts.eventContext;

    if (profile.triggerKind === AtmTriggerKind.TAX_TEJ_PACK_PREPARED) {
      const tejExportId =
        (typeof ctx?.payload.tejExportId === 'string'
          ? ctx.payload.tejExportId
          : null) ||
        ctx?.aggregateId ||
        null;
      const periodLabel =
        typeof ctx?.payload.periodLabel === 'string'
          ? ctx.payload.periodLabel
          : null;
      const withholdingCount =
        typeof ctx?.payload.withholdingCount === 'number'
          ? ctx.payload.withholdingCount
          : null;
      return {
        summary: periodLabel
          ? `Lot TEJ ${periodLabel} prêt (${withholdingCount ?? '?'} ligne(s))`
          : 'Lot TEJ XML préparé',
        hint:
          profile.actionKind === AtmActionKind.TEJ_IMPORT_HINT
            ? 'Importer le XML dans Tej puis Accusé import dans TEJ Center — pas d’upload AUTHORITY.'
            : 'Ouvrir TEJ Center — suggestion uniquement.',
        payload: {
          tejExportId,
          periodLabel,
          withholdingCount,
          eventType: ctx?.eventType ?? null,
          href: '/tax/tej-center',
        },
      };
    }

    if (profile.triggerKind === AtmTriggerKind.SALES_ORDER_CONFIRMED) {
      const orderId =
        (typeof ctx?.payload.orderId === 'string'
          ? ctx.payload.orderId
          : null) ||
        ctx?.aggregateId ||
        null;
      const orderNumber =
        typeof ctx?.payload.orderNumber === 'string'
          ? ctx.payload.orderNumber
          : null;
      return {
        summary: orderNumber
          ? `Besoin production — commande ${orderNumber}`
          : 'Besoin production — commande confirmée',
        hint:
          profile.actionKind === AtmActionKind.PRODUCTION_NEED_HINT
            ? 'Créer un OF manuellement dans Production si besoin — pas d’OF auto (D290).'
            : 'Revue ADV — suggestion uniquement.',
        payload: {
          orderId,
          orderNumber,
          eventType: ctx?.eventType ?? null,
          href: orderId ? `/sales/${orderId}` : '/production',
          productionHref: '/production',
        },
      };
    }

    if (profile.triggerKind === AtmTriggerKind.FINANCE_OVERDUE_OPEN_ITEMS) {
      const today = new Date();
      const start = new Date(
        Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth(),
          today.getUTCDate(),
        ),
      );
      if (ctx?.aggregateId) {
        const item = await this.prisma.finOpenItem.findFirst({
          where: {
            id: ctx.aggregateId,
            companyId,
            deletedAt: null,
            side: FinOpenItemSide.AR,
            status: {
              in: [FinOpenItemStatus.OPEN, FinOpenItemStatus.PARTIAL],
            },
          },
          select: { id: true, number: true, dueDate: true },
        });
        const overdue =
          item?.dueDate != null && item.dueDate.getTime() < start.getTime();
        if (!overdue) {
          return {
            summary: 'Créance AR non échue — pas de suggestion',
            hint: 'Aucune action.',
            payload: {
              openItemId: ctx.aggregateId,
              overdue: false,
              skipSuggest: true,
            },
          };
        }
        return {
          summary: `Créance AR échue ${item!.number}`,
          hint:
            profile.actionKind === AtmActionKind.PREPARE_DUNNING_HINT
              ? 'Préparer relance manuellement dans Finance (pas de draft auto).'
              : 'Notifier ADV — aucune mutation.',
          payload: {
            openItemId: item!.id,
            number: item!.number,
            dueDate: item!.dueDate?.toISOString().slice(0, 10) ?? null,
            eventType: ctx.eventType,
            href: '/finance',
          },
        };
      }
      const count = await this.prisma.finOpenItem.count({
        where: {
          companyId,
          deletedAt: null,
          side: FinOpenItemSide.AR,
          status: { in: [FinOpenItemStatus.OPEN, FinOpenItemStatus.PARTIAL] },
          dueDate: { lt: start },
        },
      });
      return {
        summary: `${count} créance(s) AR échue(s)`,
        hint:
          profile.actionKind === AtmActionKind.PREPARE_DUNNING_HINT
            ? 'Préparer relances manuellement dans Finance (pas de draft auto).'
            : 'Notifier ADV — aucune mutation.',
        payload: { overdueCount: count, asOf: start.toISOString().slice(0, 10) },
      };
    }

    if (
      profile.triggerKind ===
      AtmTriggerKind.PORTAL_PAYMENT_DECLARATION_SUBMITTED
    ) {
      if (ctx?.aggregateId) {
        return {
          summary: 'Déclaration paiement portail soumise',
          hint: 'Revue ADV sur /finance/payment-declarations — pas d’encaissement auto.',
          payload: {
            declarationId: ctx.aggregateId,
            eventType: ctx.eventType,
            href: `/finance/payment-declarations/${ctx.aggregateId}`,
          },
        };
      }
      const count = await this.prisma.ptlPaymentDeclaration.count({
        where: {
          companyId,
          deletedAt: null,
          status: 'SUBMITTED',
        },
      });
      return {
        summary: `${count} déclaration(s) portail soumise(s)`,
        hint: 'Revue ADV sur /finance/payment-declarations — pas d’encaissement auto.',
        payload: { submittedCount: count },
      };
    }

    if (
      profile.triggerKind === AtmTriggerKind.SALES_DRAFT_ORDER_STALE &&
      (ctx?.aggregateId || typeof ctx?.payload.orderId === 'string')
    ) {
      const orderId =
        (typeof ctx.payload.orderId === 'string'
          ? ctx.payload.orderId
          : null) || ctx.aggregateId!;
      return {
        summary: 'Brouillon commande à revoir (WA / portail)',
        hint: 'Revue ADV — confirmation commande reste humaine (pas de FULL_AUTO).',
        payload: {
          orderId,
          eventType: ctx.eventType,
          href: `/sales/${orderId}`,
        },
      };
    }

    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - Math.max(1, staleDays));
    const count = await this.prisma.salOrder.count({
      where: {
        companyId,
        deletedAt: null,
        status: SalOrderStatus.DRAFT,
        createdAt: { lt: cutoff },
      },
    });
    return {
      summary: `${count} commande(s) brouillon > ${staleDays}j`,
      hint: 'Revue ADV — confirmation commande reste humaine (pas de FULL_AUTO).',
      payload: { draftStaleCount: count, staleDays },
    };
  }

  private assertModeAllowed(mode: AtmProfileMode): void {
    if (mode === AtmProfileMode.FULL_AUTO) {
      throw new AutomationException(
        AUTOMATION_ERROR_CODES.FULL_AUTO_FORBIDDEN,
        'FULL_AUTO is not allowed in V0 (critical confirms stay human-gated).',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private assertPairing(
    trigger: AtmTriggerKind,
    action: AtmActionKind,
  ): void {
    if (
      action === AtmActionKind.PRODUCTION_NEED_HINT &&
      trigger !== AtmTriggerKind.SALES_ORDER_CONFIRMED
    ) {
      throw new AutomationException(
        AUTOMATION_ERROR_CODES.VALIDATION,
        'PRODUCTION_NEED_HINT requires SALES_ORDER_CONFIRMED trigger.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (
      trigger === AtmTriggerKind.SALES_ORDER_CONFIRMED &&
      (action === AtmActionKind.PREPARE_DUNNING_HINT ||
        action === AtmActionKind.TEJ_IMPORT_HINT ||
        action === AtmActionKind.ORDER_REVIEW_HINT)
    ) {
      throw new AutomationException(
        AUTOMATION_ERROR_CODES.VALIDATION,
        'SALES_ORDER_CONFIRMED pairs with PRODUCTION_NEED_HINT or NOTIFY only.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (
      action === AtmActionKind.TEJ_IMPORT_HINT &&
      trigger !== AtmTriggerKind.TAX_TEJ_PACK_PREPARED
    ) {
      throw new AutomationException(
        AUTOMATION_ERROR_CODES.VALIDATION,
        'TEJ_IMPORT_HINT requires TAX_TEJ_PACK_PREPARED trigger.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (
      trigger === AtmTriggerKind.TAX_TEJ_PACK_PREPARED &&
      action === AtmActionKind.PREPARE_DUNNING_HINT
    ) {
      throw new AutomationException(
        AUTOMATION_ERROR_CODES.VALIDATION,
        'PREPARE_DUNNING_HINT cannot pair with TAX_TEJ_PACK_PREPARED.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (
      trigger === AtmTriggerKind.TAX_TEJ_PACK_PREPARED &&
      action === AtmActionKind.ORDER_REVIEW_HINT
    ) {
      throw new AutomationException(
        AUTOMATION_ERROR_CODES.VALIDATION,
        'ORDER_REVIEW_HINT cannot pair with TAX_TEJ_PACK_PREPARED.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (
      trigger === AtmTriggerKind.FINANCE_OVERDUE_OPEN_ITEMS &&
      action === AtmActionKind.ORDER_REVIEW_HINT
    ) {
      throw new AutomationException(
        AUTOMATION_ERROR_CODES.VALIDATION,
        'ORDER_REVIEW_HINT requires SALES_DRAFT_ORDER_STALE trigger.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (
      trigger === AtmTriggerKind.SALES_DRAFT_ORDER_STALE &&
      action === AtmActionKind.PREPARE_DUNNING_HINT
    ) {
      throw new AutomationException(
        AUTOMATION_ERROR_CODES.VALIDATION,
        'PREPARE_DUNNING_HINT requires FINANCE_OVERDUE_OPEN_ITEMS trigger.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (
      (trigger === AtmTriggerKind.FINANCE_OVERDUE_OPEN_ITEMS ||
        trigger === AtmTriggerKind.PORTAL_PAYMENT_DECLARATION_SUBMITTED ||
        trigger === AtmTriggerKind.SALES_DRAFT_ORDER_STALE) &&
      action === AtmActionKind.TEJ_IMPORT_HINT
    ) {
      throw new AutomationException(
        AUTOMATION_ERROR_CODES.VALIDATION,
        'TEJ_IMPORT_HINT requires TAX_TEJ_PACK_PREPARED trigger.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async findProfile(companyId: string, id: string) {
    const row = await this.prisma.atmProfile.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!row) {
      throw new AutomationException(
        AUTOMATION_ERROR_CODES.NOT_FOUND,
        'Automation profile not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return row;
  }

  private async nextRunNumber(companyId: string): Promise<string> {
    const year = new Date().getUTCFullYear();
    const prefix = `ATM-${year}-`;
    const last = await this.prisma.atmRunLog.findFirst({
      where: { companyId, number: { startsWith: prefix } },
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    const seq = last
      ? Number(last.number.slice(prefix.length)) + 1 || 1
      : 1;
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }
}

function asObject(value: Prisma.JsonValue): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function mapEventToTrigger(eventType: string): AtmTriggerKind | null {
  switch (eventType) {
    case 'portals.payment_declaration.submitted.v1':
      return AtmTriggerKind.PORTAL_PAYMENT_DECLARATION_SUBMITTED;
    case 'finance.open_item.created.v1':
      return AtmTriggerKind.FINANCE_OVERDUE_OPEN_ITEMS;
    case 'sales.wa_inbox.draft_created.v1':
      return AtmTriggerKind.SALES_DRAFT_ORDER_STALE;
    case 'tax.tej.pack_prepared.v1':
      return AtmTriggerKind.TAX_TEJ_PACK_PREPARED;
    case 'sales.order.confirmed.v1':
      return AtmTriggerKind.SALES_ORDER_CONFIRMED;
    default:
      return null;
  }
}

function serializeProfile(row: {
  id: string;
  code: string;
  name: string;
  description: string | null;
  mode: AtmProfileMode;
  triggerKind: AtmTriggerKind;
  actionKind: AtmActionKind;
  enabled: boolean;
  shadowMode: boolean;
  configJson: Prisma.JsonValue;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}): AtmProfileDto {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    mode: row.mode,
    triggerKind: row.triggerKind,
    actionKind: row.actionKind,
    enabled: row.enabled,
    shadowMode: row.shadowMode,
    configJson: asObject(row.configJson) ?? {},
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeRun(
  row: {
    id: string;
    profileId: string;
    number: string;
    status: AtmRunStatus;
    triggerRef: string | null;
    summary: string;
    payloadJson: Prisma.JsonValue;
    resultJson: Prisma.JsonValue;
    version: number;
    createdAt: Date;
    reviewedAt: Date | null;
    reviewNote: string | null;
  },
  profileCode: string | null,
  profileName: string | null,
): AtmRunDto {
  return {
    id: row.id,
    profileId: row.profileId,
    profileCode,
    profileName,
    number: row.number,
    status: row.status,
    triggerRef: row.triggerRef,
    summary: row.summary,
    payloadJson: asObject(row.payloadJson) ?? {},
    resultJson: asObject(row.resultJson) ?? {},
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    reviewNote: row.reviewNote,
  };
}
