import { Injectable } from '@nestjs/common';
import { OrgCompany, OrgSite } from '@prisma/client';
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
  constructor(private readonly prisma: PrismaService) {}

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
