import { HttpStatus, Injectable } from '@nestjs/common';
import { IamSessionRealm, IamUser, IamUserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IDENTITY_DEFAULTS, IDENTITY_ERROR_CODES } from './identity.constants';
import { IdentityException } from './identity.exception';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

export interface LoginResult {
  user: {
    id: string;
    email: string;
    displayName: string;
    status: IamUserStatus;
    locale: string;
    timezone: string;
    mfaEnabled: boolean;
  };
  session: { id: string; expiresAt: Date };
  token: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly sessionService: SessionService,
  ) {}

  async login(params: {
    email: string;
    password: string;
    ip?: string;
    userAgent?: string;
  }): Promise<LoginResult> {
    const user = await this.authenticatePassword(params);

    await this.prisma.iamLoginAttempt.create({
      data: {
        userId: user.id,
        email: user.email,
        ip: params.ip,
        success: true,
      },
    });

    const { session, token } = await this.sessionService.createSession({
      userId: user.id,
      ip: params.ip,
      userAgent: params.userAgent,
      realm: IamSessionRealm.BUSINESS,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        status: user.status,
        locale: user.locale,
        timezone: user.timezone,
        mfaEnabled: user.mfaEnabled,
      },
      session: { id: session.id, expiresAt: session.expiresAt },
      token,
    };
  }

  async authenticatePassword(params: {
    email: string;
    password: string;
    ip?: string;
  }): Promise<IamUser> {
    const email = params.email.trim().toLowerCase();
    const user = await this.prisma.iamUser.findUnique({ where: { email } });

    if (!user || user.deletedAt) {
      await this.recordFailedAttempt(null, email, params.ip);
      throw this.invalidCredentials();
    }

    if (user.status === IamUserStatus.LOCKED) {
      throw new IdentityException(
        IDENTITY_ERROR_CODES.LOCKED,
        'Account is locked.',
        HttpStatus.FORBIDDEN,
      );
    }

    if (
      user.status !== IamUserStatus.ACTIVE ||
      !user.passwordHash ||
      !(await this.passwordService.verify(user.passwordHash, params.password))
    ) {
      await this.recordFailedAttempt(user.id, email, params.ip);
      await this.applyLockoutIfNeeded(user.id);
      throw this.invalidCredentials();
    }

    return user;
  }

  toMeResponse(user: {
    id: string;
    email: string;
    displayName: string;
    status: IamUserStatus;
    locale: string;
    timezone: string;
    mfaEnabled: boolean;
  }) {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      status: user.status,
      locale: user.locale,
      timezone: user.timezone,
      mfaEnabled: user.mfaEnabled,
    };
  }

  private invalidCredentials(): IdentityException {
    return new IdentityException(
      IDENTITY_ERROR_CODES.INVALID_CREDENTIALS,
      'Invalid email or password.',
      HttpStatus.UNAUTHORIZED,
    );
  }

  private async recordFailedAttempt(
    userId: string | null,
    email: string,
    ip?: string,
  ): Promise<void> {
    await this.prisma.iamLoginAttempt.create({
      data: {
        userId: userId ?? undefined,
        email,
        ip,
        success: false,
      },
    });
  }

  private async applyLockoutIfNeeded(userId: string): Promise<void> {
    const since = new Date(
      Date.now() - IDENTITY_DEFAULTS.lockoutWindowMinutes * 60 * 1000,
    );

    const failures = await this.prisma.iamLoginAttempt.count({
      where: {
        userId,
        success: false,
        createdAt: { gte: since },
      },
    });

    if (failures >= IDENTITY_DEFAULTS.lockoutThreshold) {
      await this.prisma.iamUser.update({
        where: { id: userId },
        data: { status: IamUserStatus.LOCKED },
      });
    }
  }
}
