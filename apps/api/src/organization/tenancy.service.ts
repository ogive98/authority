import { Injectable } from '@nestjs/common';
import { OrgCompany, OrgSite, OrgSiteType } from '@prisma/client';
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  OUTBOX_EVENT_TYPES,
} from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import { OutboxService } from '../audit/outbox.service';
import { LicenseService } from '../license/license.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ORG_ERROR_CODES,
  TenancyContext,
  TENANCY_COOKIES,
  TENANCY_HEADERS,
} from './organization.constants';
import { OrganizationException } from './organization.exception';

type HeaderBag = Record<string, string | string[] | undefined>;
type CookieBag = Record<string, string | undefined>;

@Injectable()
export class TenancyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly licenseService: LicenseService,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
  ) {}

  async listAssignedCompanies(userId: string): Promise<OrgCompany[]> {
    const assignments = await this.prisma.orgUserAssignment.findMany({
      where: { userId, deletedAt: null },
      include: { company: true },
    });

    return assignments.map((assignment) => assignment.company);
  }

  async getCompanyForUser(
    userId: string,
    companyId: string,
  ): Promise<OrgCompany | null> {
    const assignment = await this.prisma.orgUserAssignment.findFirst({
      where: {
        userId,
        companyId,
        deletedAt: null,
      },
      include: { company: true },
    });

    return assignment?.company ?? null;
  }

  async listSitesForCompany(
    userId: string,
    companyId: string,
  ): Promise<OrgSite[]> {
    await this.assertCompanyAccess(userId, companyId);

    return this.prisma.orgSite.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { code: 'asc' },
    });
  }

  async createSite(params: {
    userId: string;
    companyId: string;
    input: { code: string; type: OrgSiteType };
    correlationId?: string;
    ip?: string;
    userAgent?: string;
  }): Promise<OrgSite> {
    const { userId, companyId, input, correlationId, ip, userAgent } = params;
    await this.assertCompanyAccess(userId, companyId);
    await this.licenseService.assertCanAddSite(companyId);

    const duplicate = await this.prisma.orgSite.findFirst({
      where: {
        companyId,
        code: input.code,
        deletedAt: null,
      },
    });

    if (duplicate) {
      throw new OrganizationException(
        ORG_ERROR_CODES.SITE_CODE_EXISTS,
        'Site code already exists for this company.',
        409,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const site = await tx.orgSite.create({
        data: {
          companyId,
          code: input.code,
          type: input.type,
        },
      });

      const snapshot = {
        id: site.id,
        companyId: site.companyId,
        code: site.code,
        type: site.type,
        status: site.status,
      };

      await this.auditService.append(tx, {
        companyId,
        actorUserId: userId,
        action: AUDIT_ACTIONS.organizationSiteCreate,
        entityType: AUDIT_ENTITY_TYPES.orgSite,
        entityId: site.id,
        afterJson: snapshot,
        ip,
        device: userAgent,
        correlationId,
      });

      await this.outboxService.enqueue(tx, {
        companyId,
        aggregateType: AUDIT_ENTITY_TYPES.orgSite,
        aggregateId: site.id,
        eventType: OUTBOX_EVENT_TYPES.organizationSiteCreated,
        payloadJson: {
          eventType: OUTBOX_EVENT_TYPES.organizationSiteCreated,
          eventVersion: 1,
          source: 'organization',
          actorId: userId,
          companyId,
          correlationId: correlationId ?? null,
          payload: snapshot,
        },
      });

      return site;
    });
  }

  async resolveContext(
    userId: string,
    headers: HeaderBag,
    cookies: CookieBag,
  ): Promise<TenancyContext | null> {
    const companyId = this.readId(headers, cookies, 'company');
    if (!companyId) {
      return null;
    }

    const siteId = this.readId(headers, cookies, 'site');
    await this.assertCompanyAccess(userId, companyId, siteId);
    return { companyId, siteId };
  }

  async assertCompanyAccess(
    userId: string,
    companyId: string,
    siteId?: string,
  ): Promise<void> {
    const company = await this.getCompanyForUser(userId, companyId);
    if (!company || company.deletedAt) {
      throw new OrganizationException(
        ORG_ERROR_CODES.CONTEXT_FORBIDDEN,
        'Company access denied.',
      );
    }

    if (!siteId) {
      return;
    }

    const site = await this.prisma.orgSite.findFirst({
      where: { id: siteId, companyId, deletedAt: null },
    });

    if (!site) {
      throw new OrganizationException(
        ORG_ERROR_CODES.SITE_NOT_FOUND,
        'Site not found for this company.',
        404,
      );
    }

    const assignment = await this.prisma.orgUserAssignment.findFirst({
      where: { userId, companyId, deletedAt: null },
    });

    if (assignment?.siteId && assignment.siteId !== siteId) {
      throw new OrganizationException(
        ORG_ERROR_CODES.CONTEXT_FORBIDDEN,
        'Site access denied for this user assignment.',
      );
    }
  }

  private readId(
    headers: HeaderBag,
    cookies: CookieBag,
    kind: 'company' | 'site',
  ): string | undefined {
    const headerKey =
      kind === 'company' ? TENANCY_HEADERS.companyId : TENANCY_HEADERS.siteId;
    const cookieKey =
      kind === 'company' ? TENANCY_COOKIES.companyId : TENANCY_COOKIES.siteId;

    const headerValue = headers[headerKey] ?? headers[headerKey.toLowerCase()];
    if (typeof headerValue === 'string' && headerValue.length > 0) {
      return headerValue;
    }

    const cookieValue = cookies[cookieKey];
    return cookieValue && cookieValue.length > 0 ? cookieValue : undefined;
  }
}
