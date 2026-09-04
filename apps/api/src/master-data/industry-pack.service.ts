import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SuperAdminException } from '../super-admin/super-admin.exception';
import { SUPER_ADMIN_ERROR_CODES } from '../super-admin/super-admin.constants';
import { MasterDataService } from './master-data.service';

@Injectable()
export class IndustryPackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly masterData: MasterDataService,
  ) {}

  async listPacks() {
    const packs = await this.prisma.saIndustryPack.findMany({
      orderBy: { key: 'asc' },
      include: {
        _count: { select: { items: true } },
      },
    });
    return {
      packs: packs.map((p) => ({
        key: p.key,
        name: p.name,
        description: p.description,
        itemCount: p._count.items,
      })),
    };
  }

  async getPack(key: string) {
    const pack = await this.prisma.saIndustryPack.findUnique({
      where: { key },
      include: { items: { orderBy: [{ kind: 'asc' }, { sort: 'asc' }] } },
    });
    if (!pack) {
      throw new SuperAdminException(
        SUPER_ADMIN_ERROR_CODES.NOT_FOUND,
        `Industry pack not found: ${key}`,
        HttpStatus.NOT_FOUND,
      );
    }
    return {
      key: pack.key,
      name: pack.name,
      description: pack.description,
      items: pack.items.map((i) => ({
        kind: i.kind,
        code: i.code,
        label: i.label,
        sort: i.sort,
        meta: i.metaJson,
      })),
    };
  }

  async applyToCompany(packKey: string, companyId: string) {
    const company = await this.prisma.orgCompany.findFirst({
      where: { id: companyId, deletedAt: null },
    });
    if (!company) {
      throw new SuperAdminException(
        SUPER_ADMIN_ERROR_CODES.NOT_FOUND,
        'Company not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    const pack = await this.prisma.saIndustryPack.findUnique({
      where: { key: packKey },
    });
    if (!pack) {
      throw new SuperAdminException(
        SUPER_ADMIN_ERROR_CODES.NOT_FOUND,
        `Industry pack not found: ${packKey}`,
        HttpStatus.NOT_FOUND,
      );
    }
    return this.masterData.applyIndustryPack(companyId, packKey);
  }
}
