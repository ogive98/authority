import { Injectable } from '@nestjs/common';
import { ModModuleStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  TENANCY_COOKIES,
  TENANCY_HEADERS,
} from '../organization/organization.constants';

type HeaderBag = Record<string, string | string[] | undefined>;
type CookieBag = Record<string, string | undefined>;

@Injectable()
export class ModuleRegistryService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveCompanyId(
    userId: string,
    headers: HeaderBag,
    cookies: CookieBag,
  ): Promise<string | null> {
    const requested = readId(headers, cookies, 'company');
    if (requested) {
      const assignment = await this.prisma.orgUserAssignment.findFirst({
        where: { userId, companyId: requested, deletedAt: null },
      });
      return assignment ? requested : null;
    }

    const first = await this.prisma.orgUserAssignment.findFirst({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return first?.companyId ?? null;
  }

  async isEnabled(companyId: string, moduleKey: string): Promise<boolean> {
    const row = await this.prisma.modModuleState.findUnique({
      where: {
        companyId_moduleKey: { companyId, moduleKey },
      },
    });
    return row?.status === ModModuleStatus.ENABLED;
  }

  async listStates(companyId: string) {
    return this.prisma.modModuleState.findMany({
      where: { companyId },
      orderBy: { moduleKey: 'asc' },
    });
  }
}

function readId(
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
