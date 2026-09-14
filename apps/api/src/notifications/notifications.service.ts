import { Injectable } from '@nestjs/common';
import {
  AtmRunStatus,
  FinDunningStatus,
  FinPromiseStatus,
  PtlPaymentDeclarationStatus,
  ThuSignalStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ExpertiseResolverService } from '../settings/expertise-resolver.service';
import { THUNDER_SIGNAL_TYPES } from '../thunder-core/intel/intel.constants';
import {
  type NotificationPriority,
  type NotificationSource,
  type NotificationType,
} from './notifications.constants';

export type InAppNotificationDto = {
  id: string;
  companyId: string;
  source: string;
  sourceRefId: string | null;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  createdAt: string;
};

type UpsertCandidate = {
  source: NotificationSource;
  sourceRefId: string | null;
  dedupeKey: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  body: string;
  href: string | null;
};

/**
 * Soft Glass in-app inbox (D247/D248).
 * Sync materializes métier sources + reconciles stale unread — never invents rates; no WA/CRM.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly expertise: ExpertiseResolverService,
  ) {}

  async list(
    companyId: string,
    opts?: { unreadOnly?: boolean; limit?: number; source?: string },
  ): Promise<{ items: InAppNotificationDto[]; unreadCount: number }> {
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
    const where = {
      companyId,
      ...(opts?.unreadOnly ? { readAt: null } : {}),
      ...(opts?.source ? { source: opts.source } : {}),
    };
    const [rows, unreadCount] = await Promise.all([
      this.prisma.coreInAppNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.coreInAppNotification.count({
        where: { companyId, readAt: null },
      }),
    ]);
    return {
      items: rows.map(serialize),
      unreadCount,
    };
  }

  async markRead(
    companyId: string,
    id: string,
  ): Promise<InAppNotificationDto | null> {
    const row = await this.prisma.coreInAppNotification.findFirst({
      where: { id, companyId },
    });
    if (!row) return null;
    if (row.readAt) return serialize(row);
    const updated = await this.prisma.coreInAppNotification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    return serialize(updated);
  }

  async markAllRead(companyId: string): Promise<{ marked: number }> {
    const res = await this.prisma.coreInAppNotification.updateMany({
      where: { companyId, readAt: null },
      data: { readAt: new Date() },
    });
    return { marked: res.count };
  }

  /**
   * Materialize alerts + auto-mark-read unread rows whose source cleared (D248).
   */
  async sync(companyId: string): Promise<{
    upserted: number;
    reconciled: number;
    items: InAppNotificationDto[];
    unreadCount: number;
  }> {
    const candidates = await this.collectCandidates(companyId);
    const activeKeys = new Set(candidates.map((c) => c.dedupeKey));
    let upserted = 0;
    for (const c of candidates) {
      const existing = await this.prisma.coreInAppNotification.findUnique({
        where: {
          companyId_dedupeKey: { companyId, dedupeKey: c.dedupeKey },
        },
      });
      if (existing) {
        if (
          existing.readAt == null &&
          (existing.title !== c.title ||
            existing.body !== c.body ||
            existing.href !== c.href)
        ) {
          await this.prisma.coreInAppNotification.update({
            where: { id: existing.id },
            data: {
              title: c.title,
              body: c.body,
              href: c.href,
              type: c.type,
              priority: c.priority,
            },
          });
        }
        continue;
      }
      await this.prisma.coreInAppNotification.create({
        data: {
          companyId,
          source: c.source,
          sourceRefId: c.sourceRefId,
          dedupeKey: c.dedupeKey,
          type: c.type,
          priority: c.priority,
          title: c.title,
          body: c.body,
          href: c.href,
        },
      });
      upserted += 1;
    }

    const stale = await this.prisma.coreInAppNotification.findMany({
      where: { companyId, readAt: null },
      select: { id: true, dedupeKey: true },
    });
    const staleIds = stale
      .filter((r) => !activeKeys.has(r.dedupeKey))
      .map((r) => r.id);
    let reconciled = 0;
    if (staleIds.length > 0) {
      const res = await this.prisma.coreInAppNotification.updateMany({
        where: { id: { in: staleIds }, companyId },
        data: { readAt: new Date() },
      });
      reconciled = res.count;
    }

    const listed = await this.list(companyId, { limit: 50 });
    return { upserted, reconciled, ...listed };
  }

  private async collectCandidates(
    companyId: string,
  ): Promise<UpsertCandidate[]> {
    const out: UpsertCandidate[] = [];

    const [decls, promises, dunnings, signals, ras, tej, atmRuns] =
      await Promise.all([
        this.prisma.ptlPaymentDeclaration.findMany({
          where: {
            companyId,
            deletedAt: null,
            status: PtlPaymentDeclarationStatus.SUBMITTED,
          },
          orderBy: { createdAt: 'desc' },
          take: 30,
          select: {
            id: true,
            number: true,
            amount: true,
            currency: true,
            customerId: true,
            createdAt: true,
          },
        }),
        this.prisma.finPromiseToPay.findMany({
          where: {
            companyId,
            deletedAt: null,
            OR: [
              { status: FinPromiseStatus.BROKEN },
              {
                status: FinPromiseStatus.OPEN,
                promisedDate: { lt: utcToday() },
              },
            ],
          },
          orderBy: { promisedDate: 'asc' },
          take: 30,
          select: {
            id: true,
            number: true,
            amount: true,
            currency: true,
            promisedDate: true,
            status: true,
            customerId: true,
          },
        }),
        this.prisma.finDunningDraft.findMany({
          where: {
            companyId,
            deletedAt: null,
            status: FinDunningStatus.DRAFT,
          },
          orderBy: { createdAt: 'desc' },
          take: 30,
          select: {
            id: true,
            number: true,
            amountOpen: true,
            currency: true,
            channel: true,
            customerId: true,
          },
        }),
        this.prisma.thuSignal.findMany({
          where: {
            companyId,
            type: THUNDER_SIGNAL_TYPES.FinanceCreditPressure,
            status: ThuSignalStatus.OPEN,
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            evidenceJson: true,
            severity: true,
            createdAt: true,
          },
        }),
        this.expertise.getSlot(companyId, 'tax.ras'),
        this.expertise.getSlot(companyId, 'tax.tej'),
        this.prisma.atmRunLog.findMany({
          where: {
            companyId,
            status: {
              in: [AtmRunStatus.PENDING_APPROVAL, AtmRunStatus.SUGGESTED],
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            status: true,
            createdAt: true,
            profile: { select: { code: true, name: true } },
          },
        }),
      ]);

    const customerIds = new Set<string>();
    for (const d of decls) customerIds.add(d.customerId);
    for (const p of promises) customerIds.add(p.customerId);
    for (const d of dunnings) customerIds.add(d.customerId);
    for (const s of signals) {
      const evidence = (s.evidenceJson ?? {}) as { customerId?: string };
      if (evidence.customerId) customerIds.add(evidence.customerId);
    }

    const customers =
      customerIds.size === 0
        ? []
        : await this.prisma.cusCustomer.findMany({
            where: {
              companyId,
              id: { in: [...customerIds] },
              deletedAt: null,
            },
            select: {
              id: true,
              code: true,
              party: { select: { displayName: true } },
            },
          });
    const custLabel = new Map(
      customers.map((c) => [
        c.id,
        `${c.code}${c.party?.displayName ? ` · ${c.party.displayName}` : ''}`,
      ]),
    );

    for (const d of decls) {
      const who = custLabel.get(d.customerId) ?? d.customerId.slice(0, 8);
      out.push({
        source: 'PORTAL_PAYMENT_DECL',
        sourceRefId: d.id,
        dedupeKey: `ptl_decl:${d.id}`,
        type: 'task',
        priority: 'p1',
        title: `Déclaration portail ${d.number}`,
        body: `${who} — ${Number(d.amount).toFixed(3)} ${d.currency}. Accuser / rejeter (pas d’auto FinPayment).`,
        href: `/finance/payment-declarations/${d.id}`,
      });
    }

    for (const p of promises) {
      const who = custLabel.get(p.customerId) ?? p.customerId.slice(0, 8);
      out.push({
        source: 'PROMISE_OVERDUE',
        sourceRefId: p.id,
        dedupeKey: `promise_overdue:${p.id}`,
        type: 'warning',
        priority: 'p1',
        title: `Promesse ${p.number} échue`,
        body: `${who} — ${Number(p.amount).toFixed(3)} ${p.currency} · échéance ${p.promisedDate.toISOString().slice(0, 10)} (${p.status}).`,
        href: `/finance/promises/${p.id}`,
      });
    }

    for (const d of dunnings) {
      const who = custLabel.get(d.customerId) ?? d.customerId.slice(0, 8);
      out.push({
        source: 'DUNNING_READY',
        sourceRefId: d.id,
        dedupeKey: `dunning_draft:${d.id}`,
        type: 'task',
        priority: 'p2',
        title: `Relance prête ${d.number}`,
        body: `${who} — brouillon ${d.channel} · ${Number(d.amountOpen).toFixed(3)} ${d.currency}. Confirm humain requis.`,
        href: `/finance?dunning=${d.id}`,
      });
    }

    for (const s of signals) {
      const evidence = (s.evidenceJson ?? {}) as {
        customerId?: string;
        level?: string;
        ratio?: number;
      };
      if (evidence.level !== 'breach') continue;
      const customerId = evidence.customerId ?? s.id;
      const who = custLabel.get(customerId) ?? `${customerId.slice(0, 8)}…`;
      const pct =
        evidence.ratio != null
          ? `${Math.round(evidence.ratio * 100)} %`
          : '—';
      out.push({
        source: 'CREDIT_BREACH',
        sourceRefId: s.id,
        dedupeKey: `credit_breach:${customerId}`,
        type: 'danger',
        priority: 'p0',
        title: `Crédit breach — ${who}`,
        body: `Ratio ${pct}. Revoir limite / AR.`,
        href: evidence.customerId
          ? `/customers/${evidence.customerId}`
          : '/finance',
      });
    }

    if (ras && ras.status === 'PENDING_EXPERT') {
      out.push({
        source: 'RAS_PENDING',
        sourceRefId: null,
        dedupeKey: `ras_pending:${companyId}`,
        type: 'system',
        priority: 'p3',
        title: 'RAS Prefs en attente expert',
        body: 'Slot tax.ras PENDING — aucun taux inventé. Valider en Préférences Expertise.',
        href: '/settings#expertise',
      });
    }

    if (tej && tej.status === 'PENDING_EXPERT') {
      out.push({
        source: 'TEJ_PENDING',
        sourceRefId: null,
        dedupeKey: `tej_pending:${companyId}`,
        type: 'system',
        priority: 'p3',
        title: 'TEJ Prefs en attente expert',
        body: 'Slot tax.tej PENDING — params locaux only, pas de transmission API.',
        href: '/settings#expertise',
      });
    }

    for (const run of atmRuns) {
      const label = run.profile?.name ?? run.profile?.code ?? run.id.slice(0, 8);
      out.push({
        source: 'ATM_REVIEW',
        sourceRefId: run.id,
        dedupeKey: `atm_review:${run.id}`,
        type: 'task',
        priority: run.status === AtmRunStatus.PENDING_APPROVAL ? 'p1' : 'p2',
        title: `Automation à revoir — ${label}`,
        body: `Statut ${run.status}. ASSISTED / REQUIRES_APPROVAL — pas de FULL_AUTO.`,
        href: `/automation`,
      });
    }

    return out;
  }
}

function utcToday(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function serialize(row: {
  id: string;
  companyId: string;
  source: string;
  sourceRefId: string | null;
  type: string;
  priority: string;
  title: string;
  body: string;
  href: string | null;
  readAt: Date | null;
  createdAt: Date;
}): InAppNotificationDto {
  return {
    id: row.id,
    companyId: row.companyId,
    source: row.source,
    sourceRefId: row.sourceRefId,
    type: row.type as NotificationType,
    priority: row.priority as NotificationPriority,
    title: row.title,
    body: row.body,
    href: row.href,
    read: row.readAt != null,
    createdAt: row.createdAt.toISOString(),
  };
}
