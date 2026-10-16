import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  IamGrantEffect,
  IamGrantSubject,
  IamLifecycleStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../audit/audit.constants';
import {
  BUSINESS_ROLE_CATALOGUE,
} from '../identity/business-roles';
import {
  PERMISSION_CATALOGUE,
  isCataloguedPermission,
} from '../permissions/permission.constants';
import { SUPER_ADMIN_ERROR_CODES } from './super-admin.constants';
import { SuperAdminException } from './super-admin.exception';
import { SuperAdminSessionGuard } from './super-admin-session.guard';

/** Clés jamais retirables du pack global d'un rôle (login/logout). */
const PROTECTED_ROLE_KEYS = [
  'identity.self.read',
  'identity.session.revoke',
] as const;

type RoleMeta = (typeof BUSINESS_ROLE_CATALOGUE)[number];

@Controller('api/super-admin/v1/roles')
@UseGuards(SuperAdminSessionGuard)
export class SuperAdminRolesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async list() {
    const rows = await this.prisma.iamGrant.findMany({
      where: {
        subjectType: IamGrantSubject.ROLE,
        status: IamLifecycleStatus.ACTIVE,
        effect: IamGrantEffect.ALLOW,
        companyId: null,
      },
    });

    return {
      items: BUSINESS_ROLE_CATALOGUE.map((r) => ({
        ...r,
        globalAllowCount: rows.filter((row) => row.subjectId === r.code).length,
      })),
    };
  }

  @Get(':code/grants')
  async getGrants(@Param('code') code: string) {
    const meta = this.assertRoleMeta(code);

    const rows = await this.prisma.iamGrant.findMany({
      where: {
        subjectType: IamGrantSubject.ROLE,
        subjectId: meta.code,
        status: IamLifecycleStatus.ACTIVE,
        companyId: null,
      },
      orderBy: [{ permissionKey: 'asc' }],
    });

    const globalAllow = rows
      .filter((r) => r.effect === IamGrantEffect.ALLOW)
      .map((r) => r.permissionKey);
    const globalDeny = rows
      .filter((r) => r.effect === IamGrantEffect.DENY)
      .map((r) => r.permissionKey);

    return {
      roleCode: meta.code,
      label: meta.label,
      description: meta.description,
      catalog: [...PERMISSION_CATALOGUE],
      globalAllow,
      globalDeny,
      protectedKeys: PROTECTED_ROLE_KEYS,
    };
  }

  @Put(':code/grants')
  @HttpCode(200)
  async setGrants(
    @Param('code') code: string,
    @Body() dto: { allowKeys?: string[] },
  ) {
    const meta = this.assertRoleMeta(code);

    const desired = new Set<string>(
      (dto.allowKeys ?? []).filter((k) => isCataloguedPermission(k)),
    );
    for (const key of PROTECTED_ROLE_KEYS) desired.add(key);

    await this.prisma.$transaction(async (tx) => {
      await tx.iamGrant.deleteMany({
        where: {
          subjectType: IamGrantSubject.ROLE,
          subjectId: meta.code,
          companyId: null,
        },
      });

      if (desired.size > 0) {
        await tx.iamGrant.createMany({
          data: [...desired].map((permissionKey) => ({
            permissionKey,
            effect: IamGrantEffect.ALLOW,
            subjectType: IamGrantSubject.ROLE,
            subjectId: meta.code,
            status: IamLifecycleStatus.ACTIVE,
          })),
        });
      }

      await this.audit.append(tx, {
        action: AUDIT_ACTIONS.identityRoleGrantsUpdate,
        entityType: AUDIT_ENTITY_TYPES.iamGrant,
        entityId: `global:${meta.code}`,
        afterJson: {
          roleCode: meta.code,
          scope: 'global',
          allowKeys: [...desired].sort(),
        },
      });
    });

    return this.getGrants(meta.code);
  }

  private assertRoleMeta(code: string): RoleMeta {
    const meta = BUSINESS_ROLE_CATALOGUE.find((r) => r.code === code);
    if (!meta) {
      throw new SuperAdminException(
        SUPER_ADMIN_ERROR_CODES.NOT_FOUND,
        `Unknown role: ${code}`,
        HttpStatus.NOT_FOUND,
      );
    }
    return meta;
  }
}
