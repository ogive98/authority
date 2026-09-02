import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RedisService } from '../infrastructure/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { verifyLicensePayload } from './license-crypto';
import {
  DEFAULT_LICENSE_CACHE_TTL_SECONDS,
  LICENSE_CACHE_KEY,
  LICENSE_ERROR_CODES,
  LICENSE_STATUSES,
  type LicensePayload,
  type LicenseStatus,
} from './license.constants';
import { LicenseException } from './license.exception';

interface CachedLicense {
  payload: LicensePayload;
  signature: string;
  status: LicenseStatus;
}

export interface LicenseStatusResponse {
  status: LicenseStatus;
  plan: string;
  limits: { maxSites: number; maxUsers: number };
  usage: { sites: number; users: number };
  expiresAt: string;
  cached: boolean;
  companyId: string | null;
}

@Injectable()
export class LicenseService {
  private readonly cacheTtlSeconds = Number(
    process.env.AUTHORITY_LICENSE_CACHE_TTL_SECONDS ??
      DEFAULT_LICENSE_CACHE_TTL_SECONDS,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getStatus(companyId?: string): Promise<LicenseStatusResponse> {
    const verified = await this.loadVerifiedLicense();
    const usage = await this.getUsage(companyId);

    return {
      status: verified.status,
      plan: verified.payload.plan,
      limits: {
        maxSites: verified.payload.maxSites,
        maxUsers: verified.payload.maxUsers,
      },
      usage,
      expiresAt: verified.payload.expiresAt,
      cached: verified.fromCache,
      companyId: companyId ?? null,
    };
  }

  async activate(
    payload: LicensePayload,
    signature: string,
  ): Promise<LicenseStatusResponse> {
    if (!verifyLicensePayload(payload, signature)) {
      throw new LicenseException(
        LICENSE_ERROR_CODES.INVALID,
        'License signature is invalid.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const status = this.resolveStatus(payload);
    if (status === LICENSE_STATUSES.expired) {
      throw new LicenseException(
        LICENSE_ERROR_CODES.EXPIRED,
        'License has expired.',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.licCurrent.findFirst({
        orderBy: { createdAt: 'asc' },
      });

      if (existing) {
        await tx.licCurrent.update({
          where: { id: existing.id },
          data: {
            payloadJson: payload as unknown as Prisma.InputJsonValue,
            signature,
            cachedUntil: null,
            lastOnlineAt: new Date(),
            version: { increment: 1 },
          },
        });
      } else {
        await tx.licCurrent.create({
          data: {
            payloadJson: payload as unknown as Prisma.InputJsonValue,
            signature,
            lastOnlineAt: new Date(),
          },
        });
      }

      await tx.licHistory.create({
        data: {
          payloadJson: payload as unknown as Prisma.InputJsonValue,
          signature,
        },
      });
    });

    await this.redis.del(LICENSE_CACHE_KEY);
    return this.getStatus();
  }

  async assertCanAddSite(companyId: string): Promise<void> {
    const verified = await this.loadVerifiedLicense();
    const siteCount = await this.prisma.orgSite.count({
      where: { companyId, deletedAt: null },
    });

    if (siteCount >= verified.payload.maxSites) {
      throw new LicenseException(
        LICENSE_ERROR_CODES.LIMIT_SITES,
        `Site limit reached (${verified.payload.maxSites}).`,
      );
    }
  }

  async assertCanAddUser(): Promise<void> {
    const verified = await this.loadVerifiedLicense();
    const userCount = await this.prisma.iamUser.count({
      where: { deletedAt: null, status: { not: 'DISABLED' } },
    });

    if (userCount >= verified.payload.maxUsers) {
      throw new LicenseException(
        LICENSE_ERROR_CODES.LIMIT_USERS,
        `User limit reached (${verified.payload.maxUsers}).`,
      );
    }
  }

  private async loadVerifiedLicense(): Promise<
    CachedLicense & { fromCache: boolean }
  > {
    const cached = await this.redis.getJson<CachedLicense>(LICENSE_CACHE_KEY);
    if (cached && verifyLicensePayload(cached.payload, cached.signature)) {
      return { ...cached, fromCache: true };
    }

    const row = await this.prisma.licCurrent.findFirst({
      orderBy: { createdAt: 'asc' },
    });

    if (!row) {
      throw new LicenseException(
        LICENSE_ERROR_CODES.NOT_CONFIGURED,
        'No license is configured on this instance.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const payload = row.payloadJson as unknown as LicensePayload;
    if (!verifyLicensePayload(payload, row.signature)) {
      throw new LicenseException(
        LICENSE_ERROR_CODES.TAMPER,
        'License signature mismatch (tamper detected).',
      );
    }

    const status = this.resolveStatus(payload);
    if (status === LICENSE_STATUSES.expired) {
      throw new LicenseException(
        LICENSE_ERROR_CODES.EXPIRED,
        'License has expired.',
      );
    }

    const verified: CachedLicense = {
      payload,
      signature: row.signature,
      status,
    };
    await this.redis.setJson(LICENSE_CACHE_KEY, verified, this.cacheTtlSeconds);

    await this.prisma.licCurrent.update({
      where: { id: row.id },
      data: {
        cachedUntil: new Date(Date.now() + this.cacheTtlSeconds * 1000),
        lastOnlineAt: new Date(),
      },
    });

    return { ...verified, fromCache: false };
  }

  private resolveStatus(payload: LicensePayload): LicenseStatus {
    const expiresAt = new Date(payload.expiresAt).getTime();
    const now = Date.now();
    if (expiresAt < now) {
      return LICENSE_STATUSES.expired;
    }
    return LICENSE_STATUSES.active;
  }

  private async getUsage(companyId?: string): Promise<{
    sites: number;
    users: number;
  }> {
    const sites = companyId
      ? await this.prisma.orgSite.count({
          where: { companyId, deletedAt: null },
        })
      : await this.prisma.orgSite.count({ where: { deletedAt: null } });

    const users = await this.prisma.iamUser.count({
      where: { deletedAt: null, status: { not: 'DISABLED' } },
    });

    return { sites, users };
  }
}
