import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProcessedEventService {
  constructor(private readonly prisma: PrismaService) {}

  async markProcessed(
    consumer: string,
    eventId: string,
  ): Promise<'new' | 'duplicate'> {
    try {
      await this.prisma.coreProcessedEvent.create({
        data: { consumer, eventId },
      });
      return 'new';
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return 'duplicate';
      }
      throw error;
    }
  }
}
