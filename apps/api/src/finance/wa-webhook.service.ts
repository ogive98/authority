import {
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  FinDunningChannel,
  FinDunningWaDeliveryStatus,
  WaInboundStatus,
} from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { DunningSettingsResolver } from './dunning-settings.resolver';
import { FINANCE_EVENT_TYPES } from './finance.constants';
import {
  extractWhatsAppInboundMessages,
  extractWhatsAppStatuses,
  normalizeWhatsappDigits,
  safeEqualUtf8,
  shouldAdvanceWaDelivery,
  verifyMetaSignature,
  type WaInboundEvent,
  type WaStatusEvent,
} from './wa-webhook.util';

@Injectable()
export class WaWebhookService {
  private readonly logger = new Logger(WaWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly channelSettings: DunningSettingsResolver,
  ) {}

  async verifySubscribe(
    companyId: string,
    mode: string | undefined,
    token: string | undefined,
    challenge: string | undefined,
  ): Promise<string> {
    if (mode !== 'subscribe' || !challenge?.length) {
      throw new ForbiddenException('Invalid WhatsApp subscribe handshake.');
    }
    const cfg = await this.channelSettings.resolve(companyId);
    const expected = cfg.wa.verifyToken.trim();
    if (!expected || !token || !safeEqualUtf8(token, expected)) {
      throw new ForbiddenException('WhatsApp verify token mismatch.');
    }
    return challenge;
  }

  async ingest(
    companyId: string,
    raw: Buffer | undefined,
    signature: string | undefined,
  ): Promise<{
    received: number;
    updated: number;
    inboundReceived: number;
    inboundStored: number;
  }> {
    const body = raw ?? Buffer.alloc(0);
    const cfg = await this.channelSettings.resolve(companyId);
    const secret = cfg.wa.appSecret.trim();
    if (!secret) {
      throw new ForbiddenException(
        'Configure finance.dunning.wa.app_secret in Préférences → Relances.',
      );
    }
    if (!verifyMetaSignature(body, signature, secret)) {
      throw new ForbiddenException('Invalid WhatsApp webhook signature.');
    }
    let payload: unknown;
    try {
      payload = JSON.parse(body.toString('utf8')) as unknown;
    } catch {
      return {
        received: 0,
        updated: 0,
        inboundReceived: 0,
        inboundStored: 0,
      };
    }
    const events = extractWhatsAppStatuses(payload);
    let updated = 0;
    for (const event of events) {
      if (await this.applyStatus(companyId, event)) updated += 1;
    }

    const inbound = extractWhatsAppInboundMessages(payload);
    let inboundStored = 0;
    for (const msg of inbound) {
      if (await this.persistInbound(companyId, msg)) inboundStored += 1;
    }

    return {
      received: events.length,
      updated,
      inboundReceived: inbound.length,
      inboundStored,
    };
  }

  private async persistInbound(
    companyId: string,
    event: WaInboundEvent,
  ): Promise<boolean> {
    const existing = await this.prisma.waInboundMessage.findUnique({
      where: {
        companyId_wamid: { companyId, wamid: event.wamid },
      },
    });
    if (existing) return false;

    const match = await this.matchContact(companyId, event.fromPhone);
    await this.prisma.waInboundMessage.create({
      data: {
        companyId,
        wamid: event.wamid,
        fromPhone: event.fromPhone,
        profileName: event.profileName,
        bodyText: event.bodyText,
        messageType: event.messageType,
        contactId: match?.contactId ?? null,
        customerId: match?.customerId ?? null,
        status: match ? WaInboundStatus.MATCHED : WaInboundStatus.OPEN,
        receivedAt: event.receivedAt,
      },
    });
    this.logger.debug(
      `WA inbound stored wamid=${event.wamid} from=${event.fromPhone} match=${match?.customerId ?? 'none'}`,
    );
    return true;
  }

  private async matchContact(
    companyId: string,
    fromPhone: string,
  ): Promise<{ contactId: string; customerId: string } | null> {
    const contacts = await this.prisma.cusContact.findMany({
      where: {
        companyId,
        deletedAt: null,
        active: true,
        whatsapp: { not: null },
      },
      select: { id: true, customerId: true, whatsapp: true },
      take: 500,
    });
    const hits = contacts.filter((c) => {
      const digits = normalizeWhatsappDigits(c.whatsapp);
      if (!digits) return false;
      return (
        digits === fromPhone ||
        digits.endsWith(fromPhone) ||
        fromPhone.endsWith(digits)
      );
    });
    if (hits.length !== 1) return null;
    const hit = hits[0]!;
    return { contactId: hit.id, customerId: hit.customerId };
  }

  private async applyStatus(
    companyId: string,
    event: WaStatusEvent,
  ): Promise<boolean> {
    const row = await this.prisma.finDunningDraft.findFirst({
      where: {
        companyId,
        deletedAt: null,
        channel: FinDunningChannel.WHATSAPP,
        providerMessageId: event.wamid,
      },
    });
    if (!row) {
      this.logger.debug(`WA status ${event.status} ignored wamid=${event.wamid}`);
      return false;
    }
    if (!shouldAdvanceWaDelivery(row.waDeliveryStatus, event.status)) {
      return false;
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.finDunningDraft.update({
        where: { id: row.id },
        data: {
          waDeliveryStatus: event.status,
          waDeliveryAt: new Date(),
          waDeliveryError:
            event.status === FinDunningWaDeliveryStatus.FAILED
              ? event.error
              : null,
          version: { increment: 1 },
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'fin_dunning_draft',
        aggregateId: row.id,
        eventType: FINANCE_EVENT_TYPES.DUNNING_WA_STATUS,
        payloadJson: {
          draftId: row.id,
          openItemId: row.openItemId,
          wamid: event.wamid,
          status: event.status,
          error: event.error,
        },
      });
    });
    return true;
  }
}
