import { createHmac, timingSafeEqual } from 'crypto';
import { FinDunningWaDeliveryStatus } from '@prisma/client';

export type WaStatusEvent = {
  wamid: string;
  status: FinDunningWaDeliveryStatus;
  error: string | null;
};

const RANK: Record<FinDunningWaDeliveryStatus, number> = {
  NONE: 0,
  SENT: 1,
  DELIVERED: 2,
  READ: 3,
  FAILED: 100,
};

export function safeEqualUtf8(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Meta X-Hub-Signature-256 = sha256=<hex hmac of raw body>. */
export function verifyMetaSignature(
  raw: Buffer,
  header: string | undefined,
  secret: string,
): boolean {
  const token = secret.trim();
  const sig = header?.trim() ?? '';
  if (!token || !sig.startsWith('sha256=')) return false;
  const expected =
    'sha256=' + createHmac('sha256', token).update(raw).digest('hex');
  return safeEqualUtf8(sig, expected);
}

export function mapMetaWaStatus(
  raw: string | undefined,
): FinDunningWaDeliveryStatus | null {
  switch ((raw ?? '').trim().toLowerCase()) {
    case 'sent':
      return FinDunningWaDeliveryStatus.SENT;
    case 'delivered':
      return FinDunningWaDeliveryStatus.DELIVERED;
    case 'read':
      return FinDunningWaDeliveryStatus.READ;
    case 'failed':
      return FinDunningWaDeliveryStatus.FAILED;
    default:
      return null;
  }
}

/** Forward-only except FAILED which is terminal. */
export function shouldAdvanceWaDelivery(
  current: FinDunningWaDeliveryStatus,
  incoming: FinDunningWaDeliveryStatus,
): boolean {
  if (current === incoming) return false;
  if (current === FinDunningWaDeliveryStatus.FAILED) return false;
  if (incoming === FinDunningWaDeliveryStatus.FAILED) return true;
  return RANK[incoming] > RANK[current];
}

export function extractWhatsAppStatuses(payload: unknown): WaStatusEvent[] {
  if (!payload || typeof payload !== 'object') return [];
  const entry = (payload as { entry?: unknown }).entry;
  if (!Array.isArray(entry)) return [];
  const out: WaStatusEvent[] = [];
  for (const item of entry) {
    if (!item || typeof item !== 'object') continue;
    const changes = (item as { changes?: unknown }).changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      if (!change || typeof change !== 'object') continue;
      const value = (change as { value?: unknown }).value;
      if (!value || typeof value !== 'object') continue;
      const statuses = (value as { statuses?: unknown }).statuses;
      if (!Array.isArray(statuses)) continue;
      for (const row of statuses) {
        if (!row || typeof row !== 'object') continue;
        const id = (row as { id?: unknown }).id;
        if (typeof id !== 'string' || !id.trim()) continue;
        const mapped = mapMetaWaStatus(
          typeof (row as { status?: unknown }).status === 'string'
            ? ((row as { status: string }).status)
            : undefined,
        );
        if (!mapped) continue;
        const errors = (row as { errors?: unknown }).errors;
        let error: string | null = null;
        if (Array.isArray(errors) && errors[0] && typeof errors[0] === 'object') {
          const first = errors[0] as { title?: unknown; message?: unknown };
          const title = typeof first.title === 'string' ? first.title : '';
          const message =
            typeof first.message === 'string' ? first.message : '';
          error = [title, message].filter(Boolean).join(' — ').slice(0, 1000) ||
            null;
        }
        out.push({ wamid: id.trim(), status: mapped, error });
      }
    }
  }
  return out;
}
