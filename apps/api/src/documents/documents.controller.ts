import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocLinkType, DocVisibility, type IamUser } from '@prisma/client';
import { CurrentUser } from '../identity/identity.decorators';
import { SessionGuard } from '../identity/session.guard';
import { CurrentTenancy } from '../organization/organization.decorators';
import type { TenancyContext } from '../organization/organization.constants';
import { TenancyGuard } from '../organization/tenancy.guard';
import { ModuleGuard } from '../modules-registry/module.guard';
import { RequireModule } from '../modules-registry/modules.decorators';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permission.decorators';
import { PERMISSION_KEYS } from '../permissions/permission.constants';
import { DEFAULT_MAX_UPLOAD_MB } from '../platform/platform.constants';
import { CreateDocumentMetaDto } from './documents.dto';
import { DocumentsService } from './documents.service';

const maxUploadBytes =
  Number(process.env.MAX_UPLOAD_MB ?? DEFAULT_MAX_UPLOAD_MB) * 1024 * 1024;

@Controller('api/v1/documents')
@UseGuards(SessionGuard, ModuleGuard, TenancyGuard, PermissionGuard)
@RequireModule('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  @RequirePermission(PERMISSION_KEYS.documentsRead)
  list(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('q') q?: string,
    @Query('visibility') visibility?: string,
    @Query('customerId') customerId?: string,
    @Query('linkType') linkType?: string,
    @Query('linkId') linkId?: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.documents.list(tenancy.companyId, {
      q,
      visibility,
      customerId,
      linkType,
      linkId,
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor,
    });
  }

  @Get('link-targets')
  @RequirePermission(PERMISSION_KEYS.documentsRead)
  linkTargets(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('linkType') linkType?: string,
    @Query('q') q?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.documents.listLinkTargets(tenancy.companyId, {
      linkType,
      q,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
  }

  @Get(':id')
  @RequirePermission(PERMISSION_KEYS.documentsRead)
  get(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.documents.get(tenancy.companyId, id);
  }

  @Get(':id/download')
  @RequirePermission(PERMISSION_KEYS.documentsRead)
  download(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.documents.getDownloadUrl(tenancy.companyId, id);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.documentsWrite)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: maxUploadBytes } }),
  )
  create(
    @CurrentUser() user: IamUser,
    @CurrentTenancy() tenancy: TenancyContext,
    @UploadedFile()
    file: { buffer: Buffer; mimetype: string; originalname?: string },
    @Body() body: Record<string, string>,
  ) {
    const meta: CreateDocumentMetaDto = {
      title: body.title,
      visibility: body.visibility
        ? (body.visibility as DocVisibility)
        : undefined,
      linkType: body.linkType ? (body.linkType as DocLinkType) : undefined,
      linkId: body.linkId || undefined,
    };
    return this.documents.createFromUpload(
      tenancy.companyId,
      user.id,
      file,
      meta,
    );
  }
}
