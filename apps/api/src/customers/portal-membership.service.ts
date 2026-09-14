import { HttpStatus, Injectable } from '@nestjs/common';
import { IamLifecycleStatus } from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { ModuleRegistryService } from '../modules-registry/module-registry.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CUSTOMERS_ERROR_CODES,
  CUSTOMERS_EVENT_TYPES,
  PORTAL_MEMBERSHIP_ROLES,
  type PortalMembershipRole,
} from './customers.constants';
import {
  CreatePortalMembershipDto,
  UpdatePortalMembershipDto,
} from './customers.dto';
import { CustomersException } from './customers.exception';
import { CustomersService } from './customers.service';

export type PortalMembershipDto = {
  id: string;
  customerId: string;
  userId: string;
  email: string;
  displayName: string;
  userStatus: string;
  role: string;
  status: IamLifecycleStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type PortalLinkableUserDto = {
  id: string;
  email: string;
  displayName: string;
  status: string;
  membershipId: string | null;
  membershipStatus: IamLifecycleStatus | null;
};

@Injectable()
export class PortalMembershipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customers: CustomersService,
    private readonly outbox: OutboxService,
    private readonly modules: ModuleRegistryService,
  ) {}

  async list(
    companyId: string,
    customerId: string,
  ): Promise<{ items: PortalMembershipDto[] }> {
    await this.customers.get(companyId, customerId);
    const rows = await this.prisma.ptlMembership.findMany({
      where: { companyId, customerId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            status: true,
            deletedAt: true,
          },
        },
      },
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        customerId: r.customerId,
        userId: r.userId,
        email: r.user.email,
        displayName: r.user.displayName,
        userStatus: r.user.status,
        role: r.role,
        status: r.status,
        version: r.version,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    };
  }

  async listLinkableUsers(
    companyId: string,
    customerId: string,
    opts: { q?: string; limit?: number } = {},
  ): Promise<{ items: PortalLinkableUserDto[] }> {
    await this.customers.get(companyId, customerId);
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const q = opts.q?.trim();

    const assignments = await this.prisma.orgUserAssignment.findMany({
      where: {
        companyId,
        user: {
          deletedAt: null,
          ...(q
            ? {
                OR: [
                  { email: { contains: q, mode: 'insensitive' } },
                  { displayName: { contains: q, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
      },
      take: limit,
      orderBy: { user: { displayName: 'asc' } },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            status: true,
          },
        },
      },
    });

    const userIds = assignments.map((a) => a.userId);
    const memberships = userIds.length
      ? await this.prisma.ptlMembership.findMany({
          where: {
            companyId,
            customerId,
            userId: { in: userIds },
          },
          select: { id: true, userId: true, status: true },
        })
      : [];
    const byUser = new Map(memberships.map((m) => [m.userId, m]));

    return {
      items: assignments.map((a) => {
        const mem = byUser.get(a.userId);
        return {
          id: a.user.id,
          email: a.user.email,
          displayName: a.user.displayName,
          status: a.user.status,
          membershipId: mem?.id ?? null,
          membershipStatus: mem?.status ?? null,
        };
      }),
    };
  }

  async create(
    companyId: string,
    customerId: string,
    dto: CreatePortalMembershipDto,
  ): Promise<PortalMembershipDto> {
    await this.assertPortalsEnabled(companyId);
    await this.customers.get(companyId, customerId);
    const role = this.normalizeRole(dto.role ?? 'buyer');
    await this.assertCompanyUser(companyId, dto.userId);

    const existing = await this.prisma.ptlMembership.findUnique({
      where: {
        companyId_userId_customerId: {
          companyId,
          userId: dto.userId,
          customerId,
        },
      },
    });

    if (existing && existing.status === IamLifecycleStatus.ACTIVE) {
      throw new CustomersException(
        CUSTOMERS_ERROR_CODES.MEMBERSHIP_DUP,
        'User already has an active portal membership for this customer.',
        HttpStatus.CONFLICT,
      );
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const membership = existing
        ? await tx.ptlMembership.update({
            where: { id: existing.id },
            data: {
              role,
              status: IamLifecycleStatus.ACTIVE,
              version: { increment: 1 },
            },
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  displayName: true,
                  status: true,
                },
              },
            },
          })
        : await tx.ptlMembership.create({
            data: {
              companyId,
              customerId,
              userId: dto.userId,
              role,
              status: IamLifecycleStatus.ACTIVE,
            },
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  displayName: true,
                  status: true,
                },
              },
            },
          });

      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'ptl_membership',
        aggregateId: membership.id,
        eventType: CUSTOMERS_EVENT_TYPES.PORTAL_MEMBERSHIP_CHANGED,
        payloadJson: {
          membershipId: membership.id,
          customerId,
          userId: membership.userId,
          role: membership.role,
          status: membership.status,
          action: existing ? 'reactivated' : 'created',
        },
      });

      return membership;
    });

    return this.serialize(row);
  }

  async update(
    companyId: string,
    customerId: string,
    membershipId: string,
    dto: UpdatePortalMembershipDto,
  ): Promise<PortalMembershipDto> {
    await this.assertPortalsEnabled(companyId);
    await this.customers.get(companyId, customerId);

    const existing = await this.prisma.ptlMembership.findFirst({
      where: { id: membershipId, companyId, customerId },
    });
    if (!existing) {
      throw new CustomersException(
        CUSTOMERS_ERROR_CODES.MEMBERSHIP_NOT_FOUND,
        'Portal membership not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (existing.version !== dto.version) {
      throw new CustomersException(
        CUSTOMERS_ERROR_CODES.VERSION_CONFLICT,
        'Membership version conflict.',
        HttpStatus.CONFLICT,
      );
    }
    if (dto.role === undefined && dto.status === undefined) {
      throw new CustomersException(
        CUSTOMERS_ERROR_CODES.INVALID_STATUS,
        'role or status is required.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const role =
      dto.role !== undefined ? this.normalizeRole(dto.role) : undefined;
    const status =
      dto.status !== undefined
        ? (dto.status as IamLifecycleStatus)
        : undefined;

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.ptlMembership.updateMany({
        where: {
          id: membershipId,
          companyId,
          customerId,
          version: dto.version,
        },
        data: {
          ...(role !== undefined ? { role } : {}),
          ...(status !== undefined ? { status } : {}),
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new CustomersException(
          CUSTOMERS_ERROR_CODES.VERSION_CONFLICT,
          'Membership version conflict.',
          HttpStatus.CONFLICT,
        );
      }
      const membership = await tx.ptlMembership.findUniqueOrThrow({
        where: { id: membershipId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              displayName: true,
              status: true,
            },
          },
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'ptl_membership',
        aggregateId: membership.id,
        eventType: CUSTOMERS_EVENT_TYPES.PORTAL_MEMBERSHIP_CHANGED,
        payloadJson: {
          membershipId: membership.id,
          customerId,
          userId: membership.userId,
          role: membership.role,
          status: membership.status,
          action: 'updated',
        },
      });
      return membership;
    });

    return this.serialize(row);
  }

  private async assertPortalsEnabled(companyId: string): Promise<void> {
    if (!(await this.modules.isEnabled(companyId, 'portals'))) {
      throw new CustomersException(
        CUSTOMERS_ERROR_CODES.PORTALS_DISABLED,
        'Portals module is disabled for this company.',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private async assertCompanyUser(
    companyId: string,
    userId: string,
  ): Promise<void> {
    const assignment = await this.prisma.orgUserAssignment.findFirst({
      where: { companyId, userId },
      include: { user: { select: { id: true, deletedAt: true } } },
    });
    if (!assignment?.user || assignment.user.deletedAt) {
      throw new CustomersException(
        CUSTOMERS_ERROR_CODES.USER_INVALID,
        'User must be an Identity account assigned to this company.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private normalizeRole(role: string): PortalMembershipRole {
    if (
      !(PORTAL_MEMBERSHIP_ROLES as readonly string[]).includes(role)
    ) {
      throw new CustomersException(
        CUSTOMERS_ERROR_CODES.INVALID_ROLE,
        'Invalid portal role. Allowed: buyer, viewer, admin.',
        HttpStatus.BAD_REQUEST,
      );
    }
    return role as PortalMembershipRole;
  }

  private serialize(row: {
    id: string;
    customerId: string;
    userId: string;
    role: string;
    status: IamLifecycleStatus;
    version: number;
    createdAt: Date;
    updatedAt: Date;
    user: {
      email: string;
      displayName: string;
      status: string;
    };
  }): PortalMembershipDto {
    return {
      id: row.id,
      customerId: row.customerId,
      userId: row.userId,
      email: row.user.email,
      displayName: row.user.displayName,
      userStatus: row.user.status,
      role: row.role,
      status: row.status,
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
