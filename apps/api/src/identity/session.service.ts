import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  IamLifecycleStatus,
  IamSession,
  IamSessionRealm,
  IamUser,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  getAuthorityEnv,
  IDENTITY_DEFAULTS,
  IDENTITY_ERROR_CODES,
} from './identity.constants';
import { IdentityException } from './identity.exception';

export type SessionWithUser = IamSession & { user: IamUser };

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(params: {
    userId: string;
    ip?: string;
    userAgent?: string;
    realm?: IamSessionRealm;
    ttlMs?: number;
  }): Promise<{ session: IamSession; token: string }> {
    const token = randomBytes(32).toString('base64url');
    const refreshHash = this.hashToken(token);
    const ttlMs =
      params.ttlMs ?? IDENTITY_DEFAULTS.sessionTtlHours * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + ttlMs);
    const realm = params.realm ?? IamSessionRealm.BUSINESS;

    const session = await this.prisma.iamSession.create({
      data: {
        userId: params.userId,
        env: getAuthorityEnv(),
        ip: params.ip,
        userAgent: params.userAgent,
        expiresAt,
        refreshHash,
        realm,
        status: IamLifecycleStatus.ACTIVE,
      },
    });

    return { session, token };
  }

  async findActiveSession(
    token: string,
    realm: IamSessionRealm = IamSessionRealm.BUSINESS,
  ): Promise<SessionWithUser | null> {
    const refreshHash = this.hashToken(token);
    const session = await this.prisma.iamSession.findFirst({
      where: {
        refreshHash,
        realm,
        status: IamLifecycleStatus.ACTIVE,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    return session;
  }

  assertEnvMatch(session: IamSession): void {
    const hostEnv = getAuthorityEnv();
    if (session.env !== hostEnv) {
      throw new IdentityException(
        IDENTITY_ERROR_CODES.ENV_MISMATCH,
        `Session environment '${session.env}' does not match host '${hostEnv}'.`,
        401,
      );
    }
  }

  async revokeSession(sessionId: string, userId: string): Promise<void> {
    const session = await this.prisma.iamSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new IdentityException(
        IDENTITY_ERROR_CODES.SESSION_NOT_FOUND,
        'Session not found.',
        404,
      );
    }

    if (session.status === IamLifecycleStatus.REVOKED) {
      return;
    }

    await this.prisma.iamSession.update({
      where: { id: sessionId },
      data: { status: IamLifecycleStatus.REVOKED },
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
