import { Injectable } from '@nestjs/common';
import type {
  EventConsumerHandler,
  RegisterConsumerOptions,
  RegisteredEventConsumer,
} from './event-envelope';
import { auditTapConsumer } from './consumers/audit-tap.consumer';
import { thunderEchoConsumer } from './consumers/thunder-echo.consumer';

@Injectable()
export class ConsumerRegistryService {
  private readonly consumers = new Map<string, RegisteredEventConsumer>();

  constructor() {
    this.register('audit.tap', auditTapConsumer, { consumes: ['*'] });
    this.register('thunder.echo', thunderEchoConsumer, { consumes: ['*'] });
  }

  register(
    consumerId: string,
    handler: EventConsumerHandler,
    options?: RegisterConsumerOptions,
  ): void {
    this.consumers.set(consumerId, {
      consumerId,
      handler,
      consumes: options?.consumes ?? ['*'],
    });
  }

  list(): RegisteredEventConsumer[] {
    return [...this.consumers.values()];
  }

  get(consumerId: string): RegisteredEventConsumer | undefined {
    return this.consumers.get(consumerId);
  }

  unregister(consumerId: string): void {
    this.consumers.delete(consumerId);
  }
}
