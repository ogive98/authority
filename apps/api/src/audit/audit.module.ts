import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { OutboxService } from './outbox.service';
import { OutboxWorker } from './outbox.worker';

@Module({
  providers: [AuditService, OutboxService, OutboxWorker],
  exports: [AuditService, OutboxService],
})
export class AuditModule {}
