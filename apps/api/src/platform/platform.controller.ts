import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { IamUser } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../identity/identity.decorators';
import { SessionGuard } from '../identity/session.guard';
import { CurrentTenancy } from '../organization/organization.decorators';
import type { TenancyContext } from '../organization/organization.constants';
import { TenancyGuard } from '../organization/tenancy.guard';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permission.decorators';
import { PERMISSION_KEYS } from '../permissions/permission.constants';
import { FlagGuard } from '../modules-registry/flag.guard';
import { ModuleGuard } from '../modules-registry/module.guard';
import { FLAG_KEYS } from '../modules-registry/modules.constants';
import {
  RequireFlag,
  RequireModule,
} from '../modules-registry/modules.decorators';
import { AllocateNumberDto } from './allocate-number.dto';
import {
  DEFAULT_MAX_UPLOAD_MB,
  PLATFORM_ERROR_CODES,
} from './platform.constants';
import { PlatformException } from './platform.exception';
import { FileService } from './file.service';
import { NumberingService } from './numbering.service';

const maxUploadBytes =
  Number(process.env.MAX_UPLOAD_MB ?? DEFAULT_MAX_UPLOAD_MB) * 1024 * 1024;

@Controller('api/v1/platform')
@UseGuards(SessionGuard, ModuleGuard)
@RequireModule('platform')
export class PlatformController {
  constructor(
    private readonly numberingService: NumberingService,
    private readonly fileService: FileService,
  ) {}

  @Get('search')
  @UseGuards(FlagGuard)
  @RequireFlag(FLAG_KEYS.platformSearch)
  search() {
    return { hits: [] as const };
  }

  @Post('numbering/allocate')
  @HttpCode(200)
  @UseGuards(TenancyGuard)
  async allocateNumber(
    @CurrentUser() user: IamUser,
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: AllocateNumberDto,
    @Req() req: Request,
  ) {
    const correlation =
      req.headers['x-authority-correlation-id'] ??
      req.headers['x-correlation-id'];

    return this.numberingService.allocate({
      companyId: tenancy.companyId,
      siteId: tenancy.siteId,
      docType: dto.docType,
      year: dto.year ?? new Date().getFullYear(),
      actorUserId: user.id,
      correlationId: typeof correlation === 'string' ? correlation : undefined,
    });
  }

  @Post('files')
  @HttpCode(201)
  @UseGuards(TenancyGuard, PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.platformFileWrite)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: maxUploadBytes },
    }),
  )
  async uploadFile(
    @CurrentUser() user: IamUser,
    @CurrentTenancy() tenancy: TenancyContext,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new PlatformException(
        PLATFORM_ERROR_CODES.FILE_NOT_FOUND,
        'Multipart field "file" is required.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const correlation =
      req.headers['x-authority-correlation-id'] ??
      req.headers['x-correlation-id'];

    return this.fileService.upload({
      companyId: tenancy.companyId,
      actorUserId: user.id,
      buffer: file.buffer,
      mime: file.mimetype,
      originalName: file.originalname,
      correlationId: typeof correlation === 'string' ? correlation : undefined,
    });
  }

  @Get('files/:id/url')
  @UseGuards(TenancyGuard, PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.platformFileRead)
  async fileDownloadUrl(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id') fileId: string,
  ) {
    return this.fileService.getDownloadUrl(fileId, tenancy.companyId);
  }
}
