import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsUUID } from 'class-validator';
import { SuperAdminSessionGuard } from '../super-admin/super-admin-session.guard';
import { IndustryPackService } from '../master-data/industry-pack.service';

export class ApplyPackDto {
  @IsUUID()
  companyId!: string;
}

@Controller('api/super-admin/v1/industry-packs')
@UseGuards(SuperAdminSessionGuard)
export class SuperAdminIndustryPacksController {
  constructor(private readonly industryPacks: IndustryPackService) {}

  @Get()
  list() {
    return this.industryPacks.listPacks();
  }

  @Get(':key')
  get(@Param('key') key: string) {
    return this.industryPacks.getPack(key);
  }

  @Post(':key/apply')
  @HttpCode(200)
  apply(@Param('key') key: string, @Body() body: ApplyPackDto) {
    return this.industryPacks.applyToCompany(key, body.companyId);
  }
}
