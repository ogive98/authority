import { ForbiddenException, HttpStatus, Injectable } from '@nestjs/common';
import {
  IamLifecycleStatus,
  IamSessionRealm,
  type PtlMembership,
} from '@prisma/client';
import { AuthService, type LoginResult } from '../identity/auth.service';
import { IDENTITY_ERROR_CODES } from '../identity/identity.constants';
import { IdentityException } from '../identity/identity.exception';
import { SessionService } from '../identity/session.service';
import { ModuleRegistryService } from '../modules-registry/module-registry.service';
import { MODULE_ERROR_CODES } from '../modules-registry/modules.constants';
import { PrismaService } from '../prisma/prisma.service';
import {
  CUSTOMER_PORTAL_DEFAULTS,
  CUSTOMER_PORTAL_ERROR_CODES,
} from './customer-portal.constants';
import { CustomerPortalException } from './customer-portal.exception';

export type PortalMembershipSummary = {
  id: string;
  customerId: string;
  companyId: string;
  role: string;
  status: IamLifecycleStatus;
};

export type CustomerPortalLoginResult = LoginResult & {
  membership: PortalMembershipSummary;
};

@Injectable()
export class CustomerPortalAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
    private readonly moduleRegistry: ModuleRegistryService,
  ) {}

  async login(params: {
    email: string;
    password: string;
    ip?: string;
    userAgent?: string;
  }): Promise<CustomerPortalLoginResult> {
    const user = await this.authService.authenticatePassword(params);
    const membership = await this.requireActiveMembership(user.id);

    if (
      !(await this.moduleRegistry.isEnabled(membership.companyId, 'portals'))
    ) {
      throw new ForbiddenException({
        code: MODULE_ERROR_CODES.DISABLED,
        message: 'Module is disabled.',
      });
    }

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
      realm: IamSessionRealm.CUSTOMER_PORTAL,
      ttlMs: CUSTOMER_PORTAL_DEFAULTS.sessionTtlHours * 60 * 60 * 1000,
    });

    return {
      user: this.authService.toMeResponse(user),
      session: { id: session.id, expiresAt: session.expiresAt },
      token,
      membership: this.toMembershipSummary(membership),
    };
  }

  async findActiveMembership(userId: string): Promise<PtlMembership | null> {
    return this.prisma.ptlMembership.findFirst({
      where: {
        userId,
        status: IamLifecycleStatus.ACTIVE,
        customer: {
          deletedAt: null,
          status: 'ACTIVE',
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async requireActiveMembership(userId: string): Promise<PtlMembership> {
    const membership = await this.findActiveMembership(userId);
    if (!membership) {
      throw new IdentityException(
        IDENTITY_ERROR_CODES.INVALID_CREDENTIALS,
        'Invalid email or password.',
        HttpStatus.UNAUTHORIZED,
      );
    }
    return membership;
  }

  async getMe(userId: string) {
    const membership = await this.requireActiveMembership(userId);
    const customer = await this.prisma.cusCustomer.findFirst({
      where: {
        id: membership.customerId,
        companyId: membership.companyId,
        deletedAt: null,
      },
      include: {
        party: { select: { legalName: true } },
      },
    });

    if (!customer) {
      throw new CustomerPortalException(
        CUSTOMER_PORTAL_ERROR_CODES.NOT_FOUND,
        'Customer not found for portal membership.',
        HttpStatus.NOT_FOUND,
      );
    }

    const user = await this.prisma.iamUser.findUniqueOrThrow({
      where: { id: userId },
    });

    return {
      user: this.authService.toMeResponse(user),
      membership: this.toMembershipSummary(membership),
      customer: {
        id: customer.id,
        code: customer.code,
        legalName: customer.party.legalName,
        blocked: customer.blocked,
      },
      realm: 'customer_portal' as const,
    };
  }

  toMembershipSummary(membership: PtlMembership): PortalMembershipSummary {
    return {
      id: membership.id,
      customerId: membership.customerId,
      companyId: membership.companyId,
      role: membership.role,
      status: membership.status,
    };
  }
}
