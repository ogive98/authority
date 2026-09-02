import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  PLATFORM_ERROR_CODES,
  SIGNED_URL_TTL_SECONDS,
} from './platform.constants';
import { PlatformException } from './platform.exception';
import { HttpStatus } from '@nestjs/common';

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private client!: S3Client;
  private bucket!: string;
  private ready = false;

  async onModuleInit(): Promise<void> {
    const endpoint = process.env.MINIO_ENDPOINT ?? 'localhost';
    const port = process.env.MINIO_PORT ?? '9000';
    const useSsl = process.env.MINIO_USE_SSL === 'true';
    const accessKey = process.env.MINIO_ACCESS_KEY ?? 'authority';
    const secretKey = process.env.MINIO_SECRET_KEY ?? 'authoritydev';
    this.bucket = process.env.MINIO_BUCKET ?? 'authority';

    this.client = new S3Client({
      endpoint: `${useSsl ? 'https' : 'http'}://${endpoint}:${port}`,
      region: 'us-east-1',
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      forcePathStyle: true,
    });

    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.ready = true;
    } catch {
      try {
        await this.client.send(
          new CreateBucketCommand({ Bucket: this.bucket }),
        );
        this.ready = true;
        this.logger.log(`Created MinIO bucket ${this.bucket}`);
      } catch (error) {
        this.logger.warn(
          `MinIO not ready (${this.bucket}): ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  getBucket(): string {
    return this.bucket;
  }

  async putObject(params: {
    key: string;
    body: Buffer;
    mime: string;
  }): Promise<void> {
    if (!this.ready) {
      throw storageUnavailable();
    }

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.key,
        Body: params.body,
        ContentType: params.mime,
      }),
    );
  }

  async signedDownloadUrl(key: string): Promise<string> {
    if (!this.ready) {
      throw storageUnavailable();
    }

    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
      { expiresIn: SIGNED_URL_TTL_SECONDS },
    );
  }
}

function storageUnavailable(): PlatformException {
  return new PlatformException(
    PLATFORM_ERROR_CODES.STORAGE_UNAVAILABLE,
    'Object storage is not available.',
    HttpStatus.SERVICE_UNAVAILABLE,
  );
}
