import { Injectable } from '@nestjs/common';
import type {
  EventConsumerHandler,
  RegisteredEventConsumer,
} from './event-envelope';
import { auditTapConsumer } from './consumers/audit-tap.consumer';
import { thunderEchoConsumer } from './consumers/thunder-echo.consumer';

@Injectable()
export class ConsumerRegistryService {
  private readonly consumers = new Map<string, RegisteredEventConsumer>();

  constructor() {
    this.register('audit.tap', auditTapConsumer);
    this.register('thunder.echo', thunderEchoConsumer);
  }

  register(consumerId: string, handler: EventConsumerHandler): void {
    this.consumers.set(consumerId, { consumerId, handler });
  }

  list(): RegisteredEventConsumer[] {
    return [...this.consumers.values()];
  }

  get(consumerId: string): RegisteredEventConsumer | undefined {
    return this.consumers.get(consumerId);
  }
}
