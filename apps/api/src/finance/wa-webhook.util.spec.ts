import { createHmac } from 'crypto';
import { FinDunningWaDeliveryStatus } from '@prisma/client';
import {
  extractWhatsAppInboundMessages,
  extractWhatsAppStatuses,
  mapMetaWaStatus,
  shouldAdvanceWaDelivery,
  verifyMetaSignature,
} from './wa-webhook.util';

describe('wa-webhook.util (D206)', () => {
  const secret = 'app-secret-test';

  it('verifies Meta sha256 signature', () => {
    const raw = Buffer.from('{"object":"whatsapp_business_account"}');
    const header =
      'sha256=' + createHmac('sha256', secret).update(raw).digest('hex');
    expect(verifyMetaSignature(raw, header, secret)).toBe(true);
    expect(verifyMetaSignature(raw, header, 'other')).toBe(false);
    expect(verifyMetaSignature(raw, undefined, secret)).toBe(false);
  });

  it('maps Meta statuses and ignores unknown', () => {
    expect(mapMetaWaStatus('delivered')).toBe(
      FinDunningWaDeliveryStatus.DELIVERED,
    );
    expect(mapMetaWaStatus('READ')).toBe(FinDunningWaDeliveryStatus.READ);
    expect(mapMetaWaStatus('played')).toBeNull();
  });

  it('advances delivery forward-only; FAILED is terminal', () => {
    expect(
      shouldAdvanceWaDelivery(
        FinDunningWaDeliveryStatus.SENT,
        FinDunningWaDeliveryStatus.DELIVERED,
      ),
    ).toBe(true);
    expect(
      shouldAdvanceWaDelivery(
        FinDunningWaDeliveryStatus.READ,
        FinDunningWaDeliveryStatus.DELIVERED,
      ),
    ).toBe(false);
    expect(
      shouldAdvanceWaDelivery(
        FinDunningWaDeliveryStatus.DELIVERED,
        FinDunningWaDeliveryStatus.FAILED,
      ),
    ).toBe(true);
    expect(
      shouldAdvanceWaDelivery(
        FinDunningWaDeliveryStatus.FAILED,
        FinDunningWaDeliveryStatus.READ,
      ),
    ).toBe(false);
  });

  it('extracts statuses from Meta payload', () => {
    const events = extractWhatsAppStatuses({
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [
                  { id: 'wamid.1', status: 'sent' },
                  {
                    id: 'wamid.2',
                    status: 'failed',
                    errors: [{ title: 'Undeliverable', message: '131026' }],
                  },
                  { id: '', status: 'delivered' },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(events).toEqual([
      {
        wamid: 'wamid.1',
        status: FinDunningWaDeliveryStatus.SENT,
        error: null,
      },
      {
        wamid: 'wamid.2',
        status: FinDunningWaDeliveryStatus.FAILED,
        error: 'Undeliverable — 131026',
      },
    ]);
  });

  it('extracts inbound text messages (D251)', () => {
    const events = extractWhatsAppInboundMessages({
      entry: [
        {
          changes: [
            {
              value: {
                contacts: [{ profile: { name: 'Café Atlas' } }],
                messages: [
                  {
                    id: 'wamid.in.1',
                    from: '21620123456',
                    timestamp: '1700000000',
                    type: 'text',
                    text: { body: '2 kg mozzarella demain' },
                  },
                  {
                    id: 'wamid.in.2',
                    from: 'bad',
                    type: 'text',
                    text: { body: 'ignored' },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      wamid: 'wamid.in.1',
      fromPhone: '21620123456',
      profileName: 'Café Atlas',
      bodyText: '2 kg mozzarella demain',
      messageType: 'text',
    });
  });
});
