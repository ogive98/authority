import {
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  FinDunningChannel,
  FinDunningWaDeliveryStatus,
} from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { DunningSettingsResolver } from './dunning-settings.resolver';
import { FINANCE_EVENT_TYPES } from './finance.constants';
import {
  extractWhatsAppStatuses,
  safeEqualUtf8,
  shouldAdvanceWaDelivery,
  verifyMetaSignature,
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
  ): Promise<{ received: number; updated: number }> {
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
      return { received: 0, updated: 0 };
    }
    const events = extractWhatsAppStatuses(payload);
    let updated = 0;
    for (const event of events) {
      if (await this.applyStatus(companyId, event)) updated += 1;
    }
    return { received: events.length, updated };
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
