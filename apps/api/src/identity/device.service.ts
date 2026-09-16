import { createHash, randomBytes } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  IamLifecycleStatus,
  IamUser,
  IamUserStatus,
} from '@prisma/client';
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
} from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { IDENTITY_ERROR_CODES } from './identity.constants';
import { IdentityException } from './identity.exception';

export const DEVICE_KIND_AUTHORITY_X = 'AUTHORITY_X';
export const DEVICE_TOKEN_PREFIX = 'axd_';
const PAIR_TTL_MS = 10 * 60 * 1000;
const DEVICE_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const PAIR_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export type DeviceListItem = {
  id: string;
  kind: string;
  name: string | null;
  lastSeenAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  pending: boolean;
};

@Injectable()
export class DeviceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async pair(params: {
    userId: string;
    companyId: string;
    ip?: string;
  }): Promise<{ deviceId: string; code: string; expiresAt: string }> {
    await this.assertCompanyAssignment(params.userId, params.companyId);

    const code = randomPairCode();
    const pairCodeHash = hashToken(normalizePairCode(code));
    const pairExpiresAt = new Date(Date.now() + PAIR_TTL_MS);

    const device = await this.prisma.$transaction(async (tx) => {
      await tx.iamDevice.updateMany({
        where: {
          userId: params.userId,
          companyId: params.companyId,
          kind: DEVICE_KIND_AUTHORITY_X,
          tokenHash: null,
          status: IamLifecycleStatus.ACTIVE,
          deletedAt: null,
        },
        data: {
          status: IamLifecycleStatus.REVOKED,
          revokedAt: new Date(),
          pairCodeHash: null,
          pairExpiresAt: null,
        },
      });

      const row = await tx.iamDevice.create({
        data: {
          userId: params.userId,
          companyId: params.companyId,
          kind: DEVICE_KIND_AUTHORITY_X,
          name: 'AUTHORITY X (pending)',
          pairCodeHash,
          pairExpiresAt,
          status: IamLifecycleStatus.ACTIVE,
        },
      });

      await this.audit.append(tx, {
        companyId: params.companyId,
        actorUserId: params.userId,
        action: AUDIT_ACTIONS.identityDevicePair,
        entityType: AUDIT_ENTITY_TYPES.iamDevice,
        entityId: row.id,
        ip: params.ip,
        afterJson: { kind: DEVICE_KIND_AUTHORITY_X, pending: true },
      });

      return row;
    });

    return {
      deviceId: device.id,
      code: formatPairCode(code),
      expiresAt: pairExpiresAt.toISOString(),
    };
  }

  async claim(params: {
    code: string;
    name?: string;
    fingerprint?: string;
    ip?: string;
  }): Promise<{
    token: string;
    deviceId: string;
    companyId: string;
    expiresAt: string;
    displayName: string;
  }> {
    const normalized = normalizePairCode(params.code);
    if (normalized.length !== 8) {
      throw new IdentityException(
        IDENTITY_ERROR_CODES.PAIR_INVALID,
        'Invalid pairing code.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const pairCodeHash = hashToken(normalized);
    const now = new Date();

    const pending = await this.prisma.iamDevice.findFirst({
      where: {
        pairCodeHash,
        tokenHash: null,
        status: IamLifecycleStatus.ACTIVE,
        deletedAt: null,
        pairExpiresAt: { gt: now },
      },
      include: { user: true },
    });

    if (
      !pending ||
      pending.user.deletedAt ||
      pending.user.status !== IamUserStatus.ACTIVE
    ) {
      throw new IdentityException(
        IDENTITY_ERROR_CODES.PAIR_INVALID,
        'Pairing code invalid or expired.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const token = `${DEVICE_TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + DEVICE_TTL_MS);
    const name =
      params.name?.trim().slice(0, 80) || 'AUTHORITY X';

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.iamDevice.updateMany({
        where: {
          id: pending.id,
          tokenHash: null,
          status: IamLifecycleStatus.ACTIVE,
          deletedAt: null,
        },
        data: {
          tokenHash,
          pairCodeHash: null,
          pairExpiresAt: null,
          name,
          fingerprint: params.fingerprint?.trim().slice(0, 128) || null,
          lastSeenAt: now,
          expiresAt,
        },
      });

      if (updated.count !== 1) {
        throw new IdentityException(
          IDENTITY_ERROR_CODES.PAIR_INVALID,
          'Pairing code already used.',
          HttpStatus.UNAUTHORIZED,
        );
      }

      await this.audit.append(tx, {
        companyId: pending.companyId,
        actorUserId: pending.userId,
        action: AUDIT_ACTIONS.identityDeviceClaim,
        entityType: AUDIT_ENTITY_TYPES.iamDevice,
        entityId: pending.id,
        ip: params.ip,
        afterJson: { kind: DEVICE_KIND_AUTHORITY_X, claimed: true },
      });
    });

    return {
      token,
      deviceId: pending.id,
      companyId: pending.companyId,
      expiresAt: expiresAt.toISOString(),
      displayName: pending.user.displayName,
    };
  }

  async listForUser(
    userId: string,
    companyId: string,
  ): Promise<DeviceListItem[]> {
    const rows = await this.prisma.iamDevice.findMany({
      where: {
        userId,
        companyId,
        kind: DEVICE_KIND_AUTHORITY_X,
        status: IamLifecycleStatus.ACTIVE,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        kind: true,
        name: true,
        lastSeenAt: true,
        expiresAt: true,
        createdAt: true,
        tokenHash: true,
      },
    });

    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      name: r.name,
      lastSeenAt: r.lastSeenAt?.toISOString() ?? null,
      expiresAt: r.expiresAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      pending: r.tokenHash == null,
    }));
  }

  async revoke(params: {
    userId: string;
    companyId: string;
    deviceId: string;
    ip?: string;
  }): Promise<void> {
    const row = await this.prisma.iamDevice.findFirst({
      where: {
        id: params.deviceId,
        userId: params.userId,
        companyId: params.companyId,
        deletedAt: null,
      },
    });

    if (!row) {
      throw new IdentityException(
        IDENTITY_ERROR_CODES.NOT_FOUND,
        'Device not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    if (row.status === IamLifecycleStatus.REVOKED) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.iamDevice.update({
        where: { id: row.id },
        data: {
          status: IamLifecycleStatus.REVOKED,
          revokedAt: new Date(),
          tokenHash: null,
          pairCodeHash: null,
        },
      });
      await this.audit.append(tx, {
        companyId: params.companyId,
        actorUserId: params.userId,
        action: AUDIT_ACTIONS.identityDeviceRevoke,
        entityType: AUDIT_ENTITY_TYPES.iamDevice,
        entityId: row.id,
        ip: params.ip,
      });
    });
  }

  async findActiveByToken(token: string): Promise<{
    id: string;
    userId: string;
    companyId: string;
    user: IamUser;
  } | null> {
    if (!token.startsWith(DEVICE_TOKEN_PREFIX)) {
      return null;
    }

    const tokenHash = hashToken(token);
    const now = new Date();
    const row = await this.prisma.iamDevice.findFirst({
      where: {
        tokenHash,
        status: IamLifecycleStatus.ACTIVE,
        deletedAt: null,
        expiresAt: { gt: now },
      },
      include: { user: true },
    });

    if (
      !row ||
      row.user.deletedAt ||
      row.user.status !== IamUserStatus.ACTIVE
    ) {
      return null;
    }

    await this.prisma.iamDevice.update({
      where: { id: row.id },
      data: { lastSeenAt: now },
    });

    return {
      id: row.id,
      userId: row.userId,
      companyId: row.companyId,
      user: row.user,
    };
  }

  private async assertCompanyAssignment(
    userId: string,
    companyId: string,
  ): Promise<void> {
    const assignment = await this.prisma.orgUserAssignment.findFirst({
      where: { userId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!assignment) {
      throw new IdentityException(
        IDENTITY_ERROR_CODES.FORBIDDEN,
        'Company access denied.',
        HttpStatus.FORBIDDEN,
      );
    }
  }
}

export function normalizePairCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function formatPairCode(code: string): string {
  const n = normalizePairCode(code);
  return `${n.slice(0, 4)}-${n.slice(4)}`;
}

function randomPairCode(): string {
  const bytes = randomBytes(8);
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += PAIR_ALPHABET[bytes[i]! % PAIR_ALPHABET.length];
  }
  return out;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
