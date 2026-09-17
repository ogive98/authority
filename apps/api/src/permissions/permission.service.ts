import { Injectable } from '@nestjs/common';
import {
  IamGrant,
  IamGrantEffect,
  IamGrantSubject,
  IamLifecycleStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  isCataloguedPermission,
  isWildcardPermission,
} from './permission.constants';

export interface PermissionScope {
  companyId?: string;
  siteId?: string;
  warehouseId?: string;
}

@Injectable()
export class PermissionService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluate(
    userId: string,
    permissionKey: string,
    scope: PermissionScope = {},
  ): Promise<boolean> {
    if (
      isWildcardPermission(permissionKey) ||
      !isCataloguedPermission(permissionKey)
    ) {
      return false;
    }

    const userGrants = await this.prisma.iamGrant.findMany({
      where: {
        permissionKey,
        status: IamLifecycleStatus.ACTIVE,
        subjectType: IamGrantSubject.USER,
        subjectId: userId,
      },
    });

    const assignmentWhere = {
      userId,
      deletedAt: null,
      ...(scope.companyId ? { companyId: scope.companyId } : {}),
    };

    const assignments = await this.prisma.orgUserAssignment.findMany({
      where: assignmentWhere,
    });

    const roleCodes = [
      ...new Set(
        assignments
          .map((assignment) => assignment.roleCode)
          .filter((code): code is string => Boolean(code)),
      ),
    ];

    const roleGrants =
      roleCodes.length === 0
        ? []
        : await this.prisma.iamGrant.findMany({
            where: {
              permissionKey,
              status: IamLifecycleStatus.ACTIVE,
              subjectType: IamGrantSubject.ROLE,
              subjectId: { in: roleCodes },
            },
          });

    const matching = [...userGrants, ...roleGrants].filter((grant) =>
      this.scopeMatches(grant, scope),
    );

    if (matching.some((grant) => grant.effect === IamGrantEffect.DENY)) {
      return false;
    }

    return matching.some((grant) => grant.effect === IamGrantEffect.ALLOW);
  }

  /**
   * Effective ALLOW keys for the session (role + user grants, DENY wins).
   * Used by shell ⌘K / dock — client UX only; server guards remain authoritative.
   */
  async listEffectiveAllowKeys(
    userId: string,
    scope: PermissionScope = {},
  ): Promise<string[]> {
    const assignmentWhere = {
      userId,
      deletedAt: null as null,
      ...(scope.companyId ? { companyId: scope.companyId } : {}),
    };

    const assignments = await this.prisma.orgUserAssignment.findMany({
      where: assignmentWhere,
    });

    const roleCodes = [
      ...new Set(
        assignments
          .map((assignment) => assignment.roleCode)
          .filter((code): code is string => Boolean(code)),
      ),
    ];

    const grants = await this.prisma.iamGrant.findMany({
      where: {
        status: IamLifecycleStatus.ACTIVE,
        OR: [
          {
            subjectType: IamGrantSubject.USER,
            subjectId: userId,
          },
          ...(roleCodes.length > 0
            ? [
                {
                  subjectType: IamGrantSubject.ROLE,
                  subjectId: { in: roleCodes },
                },
              ]
            : []),
        ],
      },
    });

    const matching = grants.filter(
      (grant) =>
        this.scopeMatches(grant, scope) &&
        isCataloguedPermission(grant.permissionKey) &&
        !isWildcardPermission(grant.permissionKey),
    );

    const denied = new Set(
      matching
        .filter((g) => g.effect === IamGrantEffect.DENY)
        .map((g) => g.permissionKey),
    );

    const allowed = new Set<string>();
    for (const grant of matching) {
      if (grant.effect !== IamGrantEffect.ALLOW) continue;
      if (denied.has(grant.permissionKey)) continue;
      allowed.add(grant.permissionKey);
    }

    return [...allowed].sort();
  }

  private scopeMatches(grant: IamGrant, scope: PermissionScope): boolean {
    if (grant.companyId && grant.companyId !== scope.companyId) {
      return false;
    }
    if (grant.siteId && grant.siteId !== scope.siteId) {
      return false;
    }
    if (grant.warehouseId && grant.warehouseId !== scope.warehouseId) {
      return false;
    }
    return true;
  }
}
