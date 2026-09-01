import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser } from '../identity/identity.decorators';
import { SessionGuard } from '../identity/session.guard';
import { CurrentTenancy } from './organization.decorators';
import { ORG_ERROR_CODES, TENANCY_COOKIES } from './organization.constants';
import { OrganizationException } from './organization.exception';
import { SetContextDto } from './set-context.dto';
import { TenancyGuard } from './tenancy.guard';
import { TenancyService } from './tenancy.service';

@Controller('api/v1/organization')
export class OrganizationController {
  constructor(private readonly tenancyService: TenancyService) {}

  @Get('companies')
  @UseGuards(SessionGuard)
  async listCompanies(@CurrentUser() user: { id: string }) {
    const companies = await this.tenancyService.listAssignedCompanies(user.id);
    return companies.map((company) => ({
      id: company.id,
      code: company.code,
      legalName: company.legalName,
      status: company.status,
    }));
  }

  @Get('companies/:companyId')
  @UseGuards(SessionGuard)
  async getCompany(
    @CurrentUser() user: { id: string },
    @Param('companyId') companyId: string,
  ) {
    await this.tenancyService.assertCompanyAccess(user.id, companyId);
    const company = await this.tenancyService.getCompanyForUser(
      user.id,
      companyId,
    );

    return {
      id: company!.id,
      code: company!.code,
      legalName: company!.legalName,
      status: company!.status,
    };
  }

  @Get('companies/:companyId/sites')
  @UseGuards(SessionGuard, TenancyGuard)
  async listSites(
    @Param('companyId') companyId: string,
    @CurrentUser() user: { id: string },
    @CurrentTenancy() tenancy: { companyId: string },
  ) {
    if (tenancy.companyId !== companyId) {
      throw new OrganizationException(
        ORG_ERROR_CODES.CONTEXT_FORBIDDEN,
        'Company context mismatch.',
      );
    }

    const sites = await this.tenancyService.listSitesForCompany(
      user.id,
      companyId,
    );

    return sites.map((site) => ({
      id: site.id,
      code: site.code,
      type: site.type,
      status: site.status,
    }));
  }

  @Put('me/context')
  @UseGuards(SessionGuard)
  async setContext(
    @CurrentUser() user: { id: string },
    @Body() dto: SetContextDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.tenancyService.assertCompanyAccess(
      user.id,
      dto.companyId,
      dto.siteId,
    );

    res.cookie(TENANCY_COOKIES.companyId, dto.companyId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    if (dto.siteId) {
      res.cookie(TENANCY_COOKIES.siteId, dto.siteId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
    } else {
      res.clearCookie(TENANCY_COOKIES.siteId);
    }

    return {
      companyId: dto.companyId,
      siteId: dto.siteId ?? null,
    };
  }

  @Get('me/context')
  @UseGuards(SessionGuard)
  async getContext(@CurrentUser() user: { id: string }, @Req() req: Request) {
    const context = await this.tenancyService.resolveContext(
      user.id,
      req.headers,
      req.cookies as Record<string, string | undefined>,
    );

    return context ?? { companyId: null, siteId: null };
  }
}
