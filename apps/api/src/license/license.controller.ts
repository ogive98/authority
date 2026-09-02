import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SessionGuard } from '../identity/session.guard';
import { ActivateLicenseDto } from './activate-license.dto';
import { LicenseService } from './license.service';

@Controller('api/v1/license')
@UseGuards(SessionGuard)
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  @Get('status')
  status() {
    return this.licenseService.getStatus();
  }

  @Post('activate')
  @HttpCode(200)
  activate(@Body() dto: ActivateLicenseDto) {
    return this.licenseService.activate(dto.payload, dto.signature);
  }
}
