import { HttpStatus, Injectable } from '@nestjs/common';
import {
  FinDunningChannel,
  FinDunningSendStatus,
  FinDunningStatus,
  FinOpenItemSide,
  FinOpenItemStatus,
  FinPromiseStatus,
  Prisma,
} from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CollectionScheduleResolver,
  matchedMilestones,
} from './collection-schedule.resolver';
import {
  isDunningSmtpConfigured,
  isDunningWaConfigured,
  type DunningChannelRuntimeConfig,
} from './dunning-settings.constants';
import { DunningSettingsResolver } from './dunning-settings.resolver';
import {
  FINANCE_ERROR_CODES,
  FINANCE_EVENT_TYPES,
} from './finance.constants';
import type { PrepareDunningDto } from './finance.dto';
import { FinanceException } from './finance.exception';
import { WhatsAppCloudService } from './whatsapp-cloud.service';

export type DunningContactDto = {
  id: string;
  name: string;
  email: string | null;
  whatsapp: string | null;
  role: string | null;
};

export type DunningPreviewDto = {
  openItemId: string;
  number: string;
  customerId: string;
  customerName: string | null;
  amountOpen: string;
  currency: string;
  dueDate: string | null;
  daysPastDue: number;
  milestoneDay: number | null;
  matchedMilestones: number[];
  eligible: boolean;
  blockReason: string | null;
  hasOpenPromise: boolean;
  subject: string;
  body: string;
  contacts: DunningContactDto[];
};

export type DunningDraftDto = {
  id: string;
  companyId: string;
  number: string;
  openItemId: string;
  customerId: string;
  contactId: string;
  channel: FinDunningChannel;
  milestoneDay: number;
  daysPastDue: number;
  amountOpen: string;
  currency: string;
  subject: string;
  body: string;
  recipient: string;
  status: FinDunningStatus;
  confirmedAt: string | null;
  sendStatus: FinDunningSendStatus;
  sentAt: string | null;
  sendError: string | null;
  providerMessageId: string | null;
  channelConfigured: boolean;
  mailtoHref: string | null;
  waMeHref: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class DunningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly schedule: CollectionScheduleResolver,
    private readonly channelSettings: DunningSettingsResolver,
    private readonly mail: MailService,
    private readonly waCloud: WhatsAppCloudService,
  ) {}

  async preview(
    companyId: string,
    openItemId: string,
  ): Promise<DunningPreviewDto> {
    const ctx = await this.loadContext(companyId, openItemId);
    const subject = buildSubject(ctx);
    const body = buildBody(ctx);
    return {
      openItemId: ctx.openItem.id,
      number: ctx.openItem.number,
      customerId: ctx.openItem.customerId,
      customerName: ctx.customerName,
      amountOpen: ctx.openItem.amountOpen.toFixed(3),
      currency: ctx.openItem.currency,
      dueDate: ctx.openItem.dueDate
        ? dateOnly(ctx.openItem.dueDate)
        : null,
      daysPastDue: ctx.daysPastDue,
      milestoneDay: ctx.milestoneDay,
      matchedMilestones: ctx.matched,
      eligible: ctx.eligible,
      blockReason: ctx.blockReason,
      hasOpenPromise: ctx.hasOpenPromise,
      subject,
      body,
      contacts: ctx.contacts,
    };
  }

  async prepare(
    companyId: string,
    dto: PrepareDunningDto,
  ): Promise<DunningDraftDto> {
    const ctx = await this.loadContext(companyId, dto.openItemId);
    if (!ctx.eligible || ctx.milestoneDay == null) {
      throw new FinanceException(
        ctx.hasOpenPromise
          ? FINANCE_ERROR_CODES.DUNNING_PROMISE_OPEN
          : FINANCE_ERROR_CODES.DUNNING_NOT_ELIGIBLE,
        ctx.blockReason ?? 'Open item not eligible for dunning.',
        HttpStatus.CONFLICT,
      );
    }

    const contact = ctx.contacts.find((c) => c.id === dto.contactId);
    if (!contact) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.DUNNING_CONTACT,
        'Contact not found for this customer.',
        HttpStatus.NOT_FOUND,
      );
    }

    const channel =
      dto.channel === 'EMAIL'
        ? FinDunningChannel.EMAIL
        : FinDunningChannel.WHATSAPP;
    const recipient =
      channel === FinDunningChannel.EMAIL
        ? contact.email?.trim() || null
        : normalizeWhatsapp(contact.whatsapp);

    if (!recipient) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.DUNNING_CONTACT,
        channel === FinDunningChannel.EMAIL
          ? 'Contact has no email.'
          : 'Contact has no WhatsApp number.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const existing = await this.prisma.finDunningDraft.findFirst({
      where: {
        companyId,
        openItemId: dto.openItemId,
        milestoneDay: ctx.milestoneDay,
        channel,
        deletedAt: null,
        status: { not: FinDunningStatus.CANCELLED },
      },
    });
    if (existing) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.DUNNING_EXISTS,
        'A dunning draft already exists for this milestone and channel.',
        HttpStatus.CONFLICT,
        { draftId: existing.id },
      );
    }

    const subject = buildSubject(ctx);
    const body = buildBody(ctx);
    const number = await this.nextNumber(companyId);

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.finDunningDraft.create({
        data: {
          companyId,
          number,
          openItemId: ctx.openItem.id,
          customerId: ctx.openItem.customerId,
          contactId: contact.id,
          channel,
          milestoneDay: ctx.milestoneDay!,
          daysPastDue: ctx.daysPastDue,
          amountOpen: ctx.openItem.amountOpen,
          currency: ctx.openItem.currency,
          subject,
          body,
          recipient,
          status: FinDunningStatus.DRAFT,
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'fin_dunning_draft',
        aggregateId: created.id,
        eventType: FINANCE_EVENT_TYPES.DUNNING_PREPARED,
        payloadJson: {
          draftId: created.id,
          openItemId: created.openItemId,
          channel: created.channel,
          milestoneDay: created.milestoneDay,
          amountOpen: created.amountOpen.toFixed(3),
        },
      });
      return created;
    });

    return this.toDto(companyId, row);
  }

  async confirm(
    companyId: string,
    id: string,
  ): Promise<DunningDraftDto> {
    const row = await this.prisma.finDunningDraft.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!row) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.DUNNING_NOT_FOUND,
        'Dunning draft not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (row.status === FinDunningStatus.CANCELLED) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.INVALID_STATUS,
        'Cancelled draft cannot be confirmed.',
        HttpStatus.CONFLICT,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next =
        row.status === FinDunningStatus.CONFIRMED
          ? row
          : await tx.finDunningDraft.update({
              where: { id: row.id },
              data: {
                status: FinDunningStatus.CONFIRMED,
                confirmedAt: new Date(),
                version: { increment: 1 },
              },
            });
      if (row.status !== FinDunningStatus.CONFIRMED) {
        await this.outbox.enqueue(tx, {
          companyId,
          aggregateType: 'fin_dunning_draft',
          aggregateId: next.id,
          eventType: FINANCE_EVENT_TYPES.DUNNING_CONFIRMED,
          payloadJson: {
            draftId: next.id,
            openItemId: next.openItemId,
            channel: next.channel,
            recipient: next.recipient,
          },
        });
      }
      return next;
    });

    return this.toDto(companyId, updated);
  }

  /**
   * Explicit provider send after confirm (D194 lock 3A).
   * On failure: keep CONFIRMED, mark FAILED, mailto/wa.me remain (lock 4A).
   */
  async send(companyId: string, id: string): Promise<DunningDraftDto> {
    const row = await this.prisma.finDunningDraft.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!row) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.DUNNING_NOT_FOUND,
        'Dunning draft not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (row.status !== FinDunningStatus.CONFIRMED) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.DUNNING_NOT_CONFIRMED,
        'Confirm the draft before sending.',
        HttpStatus.CONFLICT,
      );
    }
    if (row.sendStatus === FinDunningSendStatus.SENT) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.DUNNING_ALREADY_SENT,
        'Dunning already sent via provider.',
        HttpStatus.CONFLICT,
      );
    }

    const cfg = await this.channelSettings.resolve(companyId);
    const emailOk =
      row.channel === FinDunningChannel.EMAIL &&
      isDunningSmtpConfigured(cfg.smtp);
    const waOk =
      row.channel === FinDunningChannel.WHATSAPP &&
      isDunningWaConfigured(cfg.wa);

    if (!emailOk && !waOk) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.DUNNING_CHANNEL_NOT_CONFIGURED,
        row.channel === FinDunningChannel.EMAIL
          ? 'Configure finance.dunning.smtp.* in Préférences → Relances.'
          : 'Configure finance.dunning.wa.* in Préférences → Relances.',
        HttpStatus.CONFLICT,
      );
    }

    try {
      let providerMessageId: string | null = null;
      if (row.channel === FinDunningChannel.EMAIL) {
        await this.mail.send(
          {
            to: row.recipient,
            subject: row.subject,
            text: row.body,
          },
          cfg.smtp,
        );
      } else {
        const result = await this.waCloud.sendText({
          phoneNumberId: cfg.wa.phoneNumberId,
          accessToken: cfg.wa.accessToken,
          apiVersion: cfg.wa.apiVersion,
          toDigits: row.recipient,
          body: row.body,
        });
        providerMessageId = result.messageId;
      }

      const updated = await this.prisma.$transaction(async (tx) => {
        const next = await tx.finDunningDraft.update({
          where: { id: row.id },
          data: {
            sendStatus: FinDunningSendStatus.SENT,
            sentAt: new Date(),
            sendError: null,
            providerMessageId,
            version: { increment: 1 },
          },
        });
        await this.outbox.enqueue(tx, {
          companyId,
          aggregateType: 'fin_dunning_draft',
          aggregateId: next.id,
          eventType: FINANCE_EVENT_TYPES.DUNNING_SENT,
          payloadJson: {
            draftId: next.id,
            openItemId: next.openItemId,
            channel: next.channel,
            recipient: next.recipient,
            providerMessageId,
          },
        });
        return next;
      });
      return this.toDto(companyId, updated, cfg);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Provider send failed';
      const updated = await this.prisma.$transaction(async (tx) => {
        const next = await tx.finDunningDraft.update({
          where: { id: row.id },
          data: {
            sendStatus: FinDunningSendStatus.FAILED,
            sendError: message.slice(0, 1000),
            version: { increment: 1 },
          },
        });
        await this.outbox.enqueue(tx, {
          companyId,
          aggregateType: 'fin_dunning_draft',
          aggregateId: next.id,
          eventType: FINANCE_EVENT_TYPES.DUNNING_SEND_FAILED,
          payloadJson: {
            draftId: next.id,
            openItemId: next.openItemId,
            channel: next.channel,
            recipient: next.recipient,
            error: message.slice(0, 500),
          },
        });
        return next;
      });
      return this.toDto(companyId, updated, cfg);
    }
  }

  async list(
    companyId: string,
    opts?: { status?: string; openItemId?: string; limit?: number },
  ): Promise<{ items: DunningDraftDto[] }> {
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
    const status = opts?.status?.trim().toUpperCase();
    const rows = await this.prisma.finDunningDraft.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(opts?.openItemId ? { openItemId: opts.openItemId } : {}),
        ...(status &&
        Object.values(FinDunningStatus).includes(status as FinDunningStatus)
          ? { status: status as FinDunningStatus }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    const cfg = await this.channelSettings.resolve(companyId);
    return {
      items: rows.map((r) =>
        serializeDraft(r, isChannelConfigured(r.channel, cfg)),
      ),
    };
  }

  private async toDto(
    companyId: string,
    row: Parameters<typeof serializeDraft>[0],
    cfg?: DunningChannelRuntimeConfig,
  ): Promise<DunningDraftDto> {
    const resolved = cfg ?? (await this.channelSettings.resolve(companyId));
    return serializeDraft(row, isChannelConfigured(row.channel, resolved));
  }

  private async loadContext(companyId: string, openItemId: string) {
    const openItem = await this.prisma.finOpenItem.findFirst({
      where: {
        id: openItemId,
        companyId,
        deletedAt: null,
        side: FinOpenItemSide.AR,
      },
    });
    if (!openItem) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.NOT_FOUND,
        'Open item not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    const [customer, contacts, openPromise, remindDays] = await Promise.all([
      this.prisma.cusCustomer.findFirst({
        where: {
          id: openItem.customerId,
          companyId,
          deletedAt: null,
        },
        include: { party: true },
      }),
      this.prisma.cusContact.findMany({
        where: {
          companyId,
          customerId: openItem.customerId,
          deletedAt: null,
          active: true,
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.finPromiseToPay.findFirst({
        where: {
          companyId,
          openItemId,
          deletedAt: null,
          status: FinPromiseStatus.OPEN,
        },
      }),
      this.schedule.resolveRemindDays(companyId),
    ]);

    const today = startOfUtcDay(new Date());
    const daysPastDue =
      openItem.dueDate != null
        ? Math.max(
            0,
            Math.floor(
              (today.getTime() - startOfUtcDay(openItem.dueDate).getTime()) /
                86_400_000,
            ),
          )
        : 0;
    const matched = matchedMilestones(remindDays, daysPastDue);
    const milestoneDay =
      matched.length > 0 ? matched[matched.length - 1]! : null;
    const hasOpenPromise = Boolean(openPromise);

    let eligible = true;
    let blockReason: string | null = null;
    let effectiveMilestone: number | null = milestoneDay;

    if (
      openItem.status !== FinOpenItemStatus.OPEN &&
      openItem.status !== FinOpenItemStatus.PARTIAL
    ) {
      eligible = false;
      blockReason = 'Only OPEN/PARTIAL créances can be dunned.';
    } else if (!openItem.dueDate || daysPastDue <= 0) {
      eligible = false;
      blockReason = 'Créance is not overdue (post-due milestones only).';
    } else if (hasOpenPromise) {
      eligible = false;
      blockReason = 'Open promise-to-pay suppresses dunning.';
    } else if (remindDays.length === 0) {
      // D182 empty schedule = any overdue
      effectiveMilestone = daysPastDue;
    } else if (milestoneDay == null) {
      eligible = false;
      blockReason = 'No collection milestone reached yet.';
    }

    return {
      openItem,
      customerName: customer?.party.legalName ?? null,
      contacts: contacts.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        whatsapp: c.whatsapp,
        role: c.role,
      })),
      daysPastDue,
      matched,
      milestoneDay: eligible ? effectiveMilestone : null,
      hasOpenPromise,
      eligible: eligible && effectiveMilestone != null,
      blockReason,
    };
  }

  private async nextNumber(companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `DUN-${year}-`;
    const count = await this.prisma.finDunningDraft.count({
      where: { companyId, number: { startsWith: prefix } },
    });
    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }
}

/** Hardcoded FR template — amounts as-recorded, no penalties. */
export function buildSubject(ctx: {
  openItem: { number: string; amountOpen: Prisma.Decimal; currency: string };
}): string {
  return `Relance — créance ${ctx.openItem.number} — ${ctx.openItem.amountOpen.toFixed(3)} ${ctx.openItem.currency}`;
}

export function buildBody(ctx: {
  openItem: {
    number: string;
    label: string | null;
    amountOpen: Prisma.Decimal;
    currency: string;
    dueDate: Date | null;
  };
  customerName: string | null;
  daysPastDue: number;
}): string {
  const due = ctx.openItem.dueDate
    ? dateOnly(ctx.openItem.dueDate)
    : '—';
  const label = ctx.openItem.label ? ` (${ctx.openItem.label})` : '';
  const who = ctx.customerName ? ` ${ctx.customerName}` : '';
  return [
    `Madame, Monsieur${who},`,
    '',
    `Sauf erreur de notre part, la créance ${ctx.openItem.number}${label} d’un montant de ${ctx.openItem.amountOpen.toFixed(3)} ${ctx.openItem.currency} demeure échue depuis le ${due} (J+${ctx.daysPastDue}).`,
    '',
    'Merci de bien vouloir régulariser sous les meilleurs délais.',
    '',
    'Aucun frais ni pénalité n’est ajouté automatiquement — montant tel qu’enregistré.',
    '',
    'Cordialement',
  ].join('\n');
}

export function buildMailtoHref(
  email: string,
  subject: string,
  body: string,
): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function buildWaMeHref(phone: string, body: string): string {
  const digits = normalizeWhatsapp(phone);
  if (!digits) return '';
  return `https://wa.me/${digits}?text=${encodeURIComponent(body.slice(0, 3500))}`;
}

function normalizeWhatsapp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 8 ? digits : null;
}

function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function dateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isChannelConfigured(
  channel: FinDunningChannel,
  cfg: DunningChannelRuntimeConfig,
): boolean {
  return channel === FinDunningChannel.EMAIL
    ? isDunningSmtpConfigured(cfg.smtp)
    : isDunningWaConfigured(cfg.wa);
}

function serializeDraft(
  row: {
    id: string;
    companyId: string;
    number: string;
    openItemId: string;
    customerId: string;
    contactId: string;
    channel: FinDunningChannel;
    milestoneDay: number;
    daysPastDue: number;
    amountOpen: Prisma.Decimal;
    currency: string;
    subject: string;
    body: string;
    recipient: string;
    status: FinDunningStatus;
    confirmedAt: Date | null;
    sendStatus: FinDunningSendStatus;
    sentAt: Date | null;
    sendError: string | null;
    providerMessageId: string | null;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  },
  channelConfigured: boolean,
): DunningDraftDto {
  return {
    id: row.id,
    companyId: row.companyId,
    number: row.number,
    openItemId: row.openItemId,
    customerId: row.customerId,
    contactId: row.contactId,
    channel: row.channel,
    milestoneDay: row.milestoneDay,
    daysPastDue: row.daysPastDue,
    amountOpen: row.amountOpen.toFixed(3),
    currency: row.currency,
    subject: row.subject,
    body: row.body,
    recipient: row.recipient,
    status: row.status,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    sendStatus: row.sendStatus,
    sentAt: row.sentAt?.toISOString() ?? null,
    sendError: row.sendError,
    providerMessageId: row.providerMessageId,
    channelConfigured,
    mailtoHref:
      row.channel === FinDunningChannel.EMAIL
        ? buildMailtoHref(row.recipient, row.subject, row.body)
        : null,
    waMeHref:
      row.channel === FinDunningChannel.WHATSAPP
        ? buildWaMeHref(row.recipient, row.body)
        : null,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
