import { Logger } from '@nestjs/common';
import type { AuthorityEventEnvelope } from '../event-envelope';

const logger = new Logger('audit.tap');

export function auditTapConsumer(
  envelope: AuthorityEventEnvelope,
): Promise<void> {
  logger.log(
    `tap ${envelope.eventType} id=${envelope.eventId} correlation=${envelope.correlationId}`,
  );
  return Promise.resolve();
}
