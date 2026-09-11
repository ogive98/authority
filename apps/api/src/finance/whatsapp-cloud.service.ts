import { Injectable, Logger } from '@nestjs/common';

export type WhatsAppCloudCredentials = {
  phoneNumberId: string;
  accessToken: string;
  apiVersion: string;
};

export type WhatsAppCloudSendInput = WhatsAppCloudCredentials & {
  toDigits: string;
  body: string;
};

export type WhatsAppCloudTemplateSendInput = WhatsAppCloudCredentials & {
  toDigits: string;
  templateName: string;
  languageCode: string;
  /** Ordered body text parameters for {{1}}…{{n}}. */
  bodyTexts: string[];
};

export type WhatsAppCloudSendResult = {
  messageId: string | null;
};

/**
 * Meta WhatsApp Cloud API (D194 text · D201 templates).
 * Credentials from Prefs only — never invent tokens or template names.
 */
@Injectable()
export class WhatsAppCloudService {
  private readonly logger = new Logger(WhatsAppCloudService.name);

  /** Legacy free-text — not used by dunning after D201 (templates required). */
  async sendText(input: WhatsAppCloudSendInput): Promise<WhatsAppCloudSendResult> {
    const { url, to, token } = this.prepare(input);
    return this.post(url, token, to, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: {
        preview_url: false,
        body: input.body.slice(0, 4096),
      },
    });
  }

  async sendTemplate(
    input: WhatsAppCloudTemplateSendInput,
  ): Promise<WhatsAppCloudSendResult> {
    const name = input.templateName.trim();
    const language = input.languageCode.trim();
    if (!name || !language) {
      throw new Error('WhatsApp template name/language not configured');
    }
    const { url, to, token } = this.prepare(input);
    const components: {
      type: string;
      parameters: { type: string; text: string }[];
    }[] = [];
    if (input.bodyTexts.length > 0) {
      components.push({
        type: 'body',
        parameters: input.bodyTexts.map((text) => ({
          type: 'text',
          text: text.slice(0, 1024) || ' ',
        })),
      });
    }
    return this.post(url, token, to, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name,
        language: { code: language },
        ...(components.length > 0 ? { components } : {}),
      },
    });
  }

  private prepare(input: WhatsAppCloudCredentials & { toDigits: string }) {
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
    return { url, to, token };
  }

  private async post(
    url: string,
    token: string,
    to: string,
    body: Record<string, unknown>,
  ): Promise<WhatsAppCloudSendResult> {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const raw = (await res.json().catch(() => ({}))) as {
      messages?: { id?: string }[];
      error?: { message?: string; code?: number };
    };
    if (!res.ok) {
      const msg =
        raw.error?.message || `WhatsApp Cloud API HTTP ${res.status}`;
      this.logger.warn(`WA send failed: ${msg}`);
      throw new Error(msg);
    }
    const messageId = raw.messages?.[0]?.id ?? null;
    this.logger.log(`WA message sent to ${to} id=${messageId ?? 'n/a'}`);
    return { messageId };
  }
}
