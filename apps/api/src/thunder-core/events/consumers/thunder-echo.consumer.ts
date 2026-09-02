import { Logger } from '@nestjs/common';
import type { AuthorityEventEnvelope } from '../event-envelope';

const logger = new Logger('thunder.echo');

export function thunderEchoConsumer(
  envelope: AuthorityEventEnvelope,
): Promise<void> {
  logger.log(
    `echo ${envelope.eventType} id=${envelope.eventId} company=${envelope.companyId ?? 'n/a'}`,
  );
  return Promise.resolve();
}
