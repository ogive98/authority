import { Injectable, Logger } from '@nestjs/common';

export type WhatsAppCloudSendInput = {
  phoneNumberId: string;
  accessToken: string;
  apiVersion: string;
  toDigits: string;
  body: string;
};

export type WhatsAppCloudSendResult = {
  messageId: string | null;
};

/**
 * Meta WhatsApp Cloud API text send (D194).
 * Credentials from Prefs only — never invent tokens.
 */
@Injectable()
export class WhatsAppCloudService {
  private readonly logger = new Logger(WhatsAppCloudService.name);

  async sendText(input: WhatsAppCloudSendInput): Promise<WhatsAppCloudSendResult> {
    const version = input.apiVersion.replace(/^\/+|\/+$/g, '') || 'v21.0';
    const phoneId = input.phoneNumberId.trim();
    const token = input.accessToken.trim();
    const to = input.toDigits.replace(/\D/g, '');
    if (!phoneId || !token) {
      throw new Error('WhatsApp Cloud credentials not configured');
    }
    if (!to) {
      throw new Error('WhatsApp recipient invalid');
    }
    const url = `https://graph.facebook.com/${version}/${encodeURIComponent(phoneId)}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: {
          preview_url: false,
          body: input.body.slice(0, 4096),
        },
      }),
    });
    const raw = (await res.json().catch(() => ({}))) as {
      messages?: { id?: string }[];
      error?: { message?: string; code?: number };
    };
    if (!res.ok) {
      const msg =
        raw.error?.message ||
        `WhatsApp Cloud API HTTP ${res.status}`;
      this.logger.warn(`WA send failed: ${msg}`);
      throw new Error(msg);
    }
    const messageId = raw.messages?.[0]?.id ?? null;
    this.logger.log(`WA message sent to ${to} id=${messageId ?? 'n/a'}`);
    return { messageId };
  }
}
