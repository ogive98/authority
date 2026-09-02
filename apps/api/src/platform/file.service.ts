import { HttpStatus, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { OUTBOX_EVENT_TYPES } from '../audit/audit.constants';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_MAX_UPLOAD_MB,
  PLATFORM_AUDIT_ACTIONS,
  PLATFORM_ENTITY_TYPES,
  PLATFORM_ERROR_CODES,
  SIGNED_URL_TTL_SECONDS,
} from './platform.constants';
import { PlatformException } from './platform.exception';
import { MinioService } from './minio.service';

export interface UploadFileInput {
  companyId: string;
  actorUserId: string;
  buffer: Buffer;
  mime: string;
  originalName?: string;
  correlationId?: string;
}

export interface UploadFileResult {
  id: string;
  bucket: string;
  key: string;
  mime: string;
  size: number;
  downloadUrl: string;
  expiresInSeconds: number;
}

export interface FileDownloadUrlResult {
  id: string;
  downloadUrl: string;
  expiresInSeconds: number;
}

@Injectable()
export class FileService {
  private readonly maxUploadBytes =
    Number(process.env.MAX_UPLOAD_MB ?? DEFAULT_MAX_UPLOAD_MB) * 1024 * 1024;

  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
  ) {}

  async upload(input: UploadFileInput): Promise<UploadFileResult> {
    if (input.buffer.length > this.maxUploadBytes) {
      throw new PlatformException(
        PLATFORM_ERROR_CODES.FILE_TOO_LARGE,
        `File exceeds max upload size (${this.maxUploadBytes} bytes).`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const fileId = randomUUID();
    const key = `companies/${input.companyId}/${fileId}`;
    const bucket = this.minio.getBucket();

    await this.minio.putObject({
      key,
      body: input.buffer,
      mime: input.mime,
    });

    const downloadUrl = await this.minio.signedDownloadUrl(key);

    const record = await this.prisma.$transaction(async (tx) => {
      const file = await tx.coreFile.create({
        data: {
          id: fileId,
          companyId: input.companyId,
          bucket,
          key,
          mime: input.mime,
          size: BigInt(input.buffer.length),
        },
      });

      const payload = {
        id: file.id,
        bucket: file.bucket,
        key: file.key,
        mime: file.mime,
        size: input.buffer.length,
        originalName: input.originalName ?? null,
      };

      await this.auditService.append(tx, {
        companyId: input.companyId,
        actorUserId: input.actorUserId,
        action: PLATFORM_AUDIT_ACTIONS.fileUploaded,
        entityType: PLATFORM_ENTITY_TYPES.coreFile,
        entityId: file.id,
        afterJson: payload,
        correlationId: input.correlationId,
      });

      await this.outboxService.enqueue(tx, {
        companyId: input.companyId,
        aggregateType: PLATFORM_ENTITY_TYPES.coreFile,
        aggregateId: file.id,
        eventType: OUTBOX_EVENT_TYPES.platformFileUploaded,
        payloadJson: {
          eventType: OUTBOX_EVENT_TYPES.platformFileUploaded,
          eventVersion: 1,
          source: 'platform',
          actorId: input.actorUserId,
          companyId: input.companyId,
          correlationId: input.correlationId ?? null,
          payload,
        },
      });

      return file;
    });

    return {
      id: record.id,
      bucket: record.bucket,
      key: record.key,
      mime: record.mime,
      size: input.buffer.length,
      downloadUrl,
      expiresInSeconds: SIGNED_URL_TTL_SECONDS,
    };
  }

  async getDownloadUrl(
    fileId: string,
    companyId: string,
  ): Promise<FileDownloadUrlResult> {
    const file = await this.prisma.coreFile.findFirst({
      where: {
        id: fileId,
        companyId,
        deletedAt: null,
      },
    });

    if (!file) {
      throw new PlatformException(
        PLATFORM_ERROR_CODES.FILE_NOT_FOUND,
        'File not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    const downloadUrl = await this.minio.signedDownloadUrl(file.key);

    return {
      id: file.id,
      downloadUrl,
      expiresInSeconds: SIGNED_URL_TTL_SECONDS,
    };
  }
}
