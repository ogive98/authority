import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsOptional } from 'class-validator';
import type { Request } from 'express';
import { AuthenticatedRequest } from '../identity/session.guard';
import { ModuleActivationService } from '../modules-registry/module-activation.service';
import { SuperAdminSessionGuard } from './super-admin-session.guard';

class DisableModuleDto {
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

@Controller('api/super-admin/v1/companies/:companyId/modules')
@UseGuards(SuperAdminSessionGuard)
export class SuperAdminModulesController {
  constructor(private readonly activation: ModuleActivationService) {}

  @Get()
  async list(@Param('companyId') companyId: string) {
    const modules = await this.activation.listForCompany(companyId);
    return { modules };
  }

  @Post(':moduleKey/enable')
  @HttpCode(200)
  async enable(
    @Param('companyId') companyId: string,
    @Param('moduleKey') moduleKey: string,
    @Req() req: AuthenticatedRequest & Request,
  ) {
    return this.activation.enable(companyId, moduleKey, {
      userId: req.user!.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post(':moduleKey/disable')
  @HttpCode(200)
  async disable(
    @Param('companyId') companyId: string,
    @Param('moduleKey') moduleKey: string,
    @Body() body: DisableModuleDto,
    @Req() req: AuthenticatedRequest & Request,
  ) {
    return this.activation.disable(
      companyId,
      moduleKey,
      {
        userId: req.user!.id,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
      { force: body?.force === true },
    );
  }
}
