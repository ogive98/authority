import { HttpStatus, Injectable } from '@nestjs/common';
import {
  IamLifecycleStatus,
  IamMfaPurpose,
  IamSessionRealm,
} from '@prisma/client';
import { AuthService, LoginResult } from '../identity/auth.service';
import { IDENTITY_ERROR_CODES } from '../identity/identity.constants';
import { IdentityException } from '../identity/identity.exception';
import { SessionService } from '../identity/session.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  decryptMfaSecret,
  signMfaChallenge,
  verifyMfaChallenge,
} from './mfa-crypto';
import {
  isSuperAdminMfaEnforced,
  SUPER_ADMIN_DEFAULTS,
  SUPER_ADMIN_ERROR_CODES,
} from './super-admin.constants';
import { SuperAdminException } from './super-admin.exception';
import { TotpService } from './totp.service';

export type SuperAdminLoginResult =
  | { mfaRequired: true; mfaToken: string }
  | ({ mfaRequired: false } & LoginResult);

@Injectable()
export class SuperAdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
    private readonly totpService: TotpService,
  ) {}

  async login(params: {
    email: string;
    password: string;
    ip?: string;
    userAgent?: string;
  }): Promise<SuperAdminLoginResult> {
    const user = await this.authService.authenticatePassword(params);
    await this.assertActiveMembership(user.id);

    if (isSuperAdminMfaEnforced()) {
      const device = await this.findActiveTotpDevice(user.id);
      if (!device) {
        throw new SuperAdminException(
          SUPER_ADMIN_ERROR_CODES.MFA_NOT_ENROLLED,
          'Super Admin MFA is not enrolled.',
          HttpStatus.FORBIDDEN,
        );
      }

      const exp =
        Date.now() + SUPER_ADMIN_DEFAULTS.mfaChallengeTtlMinutes * 60 * 1000;
      return {
        mfaRequired: true,
        mfaToken: signMfaChallenge({
          userId: user.id,
          exp,
          realm: IamSessionRealm.SUPER_ADMIN,
        }),
      };
    }

    return this.completeLogin(user.id, params.ip, params.userAgent);
  }

  async verifyMfa(params: {
    mfaToken: string;
    code: string;
    ip?: string;
    userAgent?: string;
  }): Promise<LoginResult> {
    const payload = verifyMfaChallenge(params.mfaToken);
    const userId = typeof payload?.userId === 'string' ? payload.userId : null;
    const exp = typeof payload?.exp === 'number' ? payload.exp : 0;
    const realm = payload?.realm;

    if (
      !userId ||
      !payload ||
      realm !== IamSessionRealm.SUPER_ADMIN ||
      exp < Date.now()
    ) {
      throw new SuperAdminException(
        SUPER_ADMIN_ERROR_CODES.MFA_INVALID,
        'Invalid or expired MFA challenge.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    await this.assertActiveMembership(userId);

    const device = await this.findActiveTotpDevice(userId);
    if (!device) {
      throw new SuperAdminException(
        SUPER_ADMIN_ERROR_CODES.MFA_NOT_ENROLLED,
        'Super Admin MFA is not enrolled.',
        HttpStatus.FORBIDDEN,
      );
    }

    let secret: string;
    try {
      secret = decryptMfaSecret(device.secretEnc);
    } catch {
      throw new SuperAdminException(
        SUPER_ADMIN_ERROR_CODES.MFA_INVALID,
        'Invalid MFA configuration.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!this.totpService.verify(secret, params.code)) {
      throw new SuperAdminException(
        SUPER_ADMIN_ERROR_CODES.MFA_INVALID,
        'Invalid TOTP code.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    await this.prisma.iamMfaDevice.update({
      where: { id: device.id },
      data: { lastUsedAt: new Date() },
    });

    return this.completeLogin(userId, params.ip, params.userAgent);
  }

  async hasActiveMembership(userId: string): Promise<boolean> {
    const membership = await this.prisma.iamSuperAdminMembership.findUnique({
      where: { userId },
    });
    return membership?.status === IamLifecycleStatus.ACTIVE;
  }

  private async assertActiveMembership(userId: string): Promise<void> {
    if (!(await this.hasActiveMembership(userId))) {
      throw new IdentityException(
        IDENTITY_ERROR_CODES.INVALID_CREDENTIALS,
        'Invalid email or password.',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  private async findActiveTotpDevice(userId: string) {
    return this.prisma.iamMfaDevice.findFirst({
      where: {
        userId,
        purpose: IamMfaPurpose.SUPER_ADMIN,
        status: IamLifecycleStatus.ACTIVE,
      },
    });
  }

  private async completeLogin(
    userId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<{ mfaRequired: false } & LoginResult> {
    const user = await this.prisma.iamUser.findUniqueOrThrow({
      where: { id: userId },
    });

    await this.prisma.iamLoginAttempt.create({
      data: {
        userId: user.id,
        email: user.email,
        ip,
        success: true,
      },
    });

    const { session, token } = await this.sessionService.createSession({
      userId: user.id,
      ip,
      userAgent,
      realm: IamSessionRealm.SUPER_ADMIN,
      ttlMs: SUPER_ADMIN_DEFAULTS.sessionTtlMinutes * 60 * 1000,
    });

    return {
      mfaRequired: false,
      user: this.authService.toMeResponse(user),
      session: { id: session.id, expiresAt: session.expiresAt },
      token,
    };
  }
}
