import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SessionGuard } from '../identity/session.guard';
import { ModuleGuard } from '../modules-registry/module.guard';
import { RequireModule } from '../modules-registry/modules.decorators';
import { CurrentTenancy } from '../organization/organization.decorators';
import type { TenancyContext } from '../organization/organization.constants';
import { TenancyGuard } from '../organization/tenancy.guard';
import { PERMISSION_KEYS } from '../permissions/permission.constants';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permission.decorators';
import {
  ConvertSuggestionDto,
  CreatePoDto,
  CreateReceiptDto,
  CreateSuggestionDto,
  DecideSuggestionDto,
  PoTransitionDto,
  PostReceiptDto,
  SendPoDto,
  UpdatePoDto,
  UpdateReceiptDto,
  UpsertStockPolicyDto,
} from './procurement.dto';
import { ProcurementService } from './procurement.service';

@Controller('api/v1/procurement')
@UseGuards(SessionGuard, ModuleGuard, TenancyGuard, PermissionGuard)
@RequireModule('procurement')
export class ProcurementController {
  constructor(private readonly procurement: ProcurementService) {}

  // ------------------------------------------------------------- suggestions

  @Get('suggestions')
  @RequirePermission(PERMISSION_KEYS.procurementSuggestionRead)
  listSuggestions(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('status') status?: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.procurement.listSuggestions(tenancy.companyId, {
      status,
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor,
    });
  }

  @Post('suggestions')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.procurementSuggestionWrite)
  createSuggestion(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: CreateSuggestionDto,
  ) {
    return this.procurement.createSuggestion(tenancy.companyId, dto);
  }

  @Post('suggestions/generate')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.procurementAutoPoEnable)
  generateSuggestions(@CurrentTenancy() tenancy: TenancyContext) {
    return this.procurement.generateSuggestionsFromPolicies(tenancy.companyId);
  }

  @Post('suggestions/:id/approve')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.procurementSuggestionApprove)
  approveSuggestion(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideSuggestionDto,
  ) {
    return this.procurement.decideSuggestion(
      tenancy.companyId,
      id,
      dto.version,
      'APPROVED',
    );
  }

  @Post('suggestions/:id/reject')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.procurementSuggestionApprove)
  rejectSuggestion(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideSuggestionDto,
  ) {
    return this.procurement.decideSuggestion(
      tenancy.companyId,
      id,
      dto.version,
      'REJECTED',
    );
  }

  @Post('suggestions/:id/convert')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.procurementPoWrite)
  convertSuggestion(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConvertSuggestionDto,
  ) {
    return this.procurement.convertSuggestion(tenancy.companyId, id, dto);
  }

  // --------------------------------------------------------------- policies

  @Get('policies')
  @RequirePermission(PERMISSION_KEYS.procurementSuggestionRead)
  listPolicies(@CurrentTenancy() tenancy: TenancyContext) {
    return this.procurement.listPolicies(tenancy.companyId);
  }

  @Put('policies')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.procurementAutoPoEnable)
  upsertPolicy(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: UpsertStockPolicyDto,
  ) {
    return this.procurement.upsertPolicy(tenancy.companyId, dto);
  }

  @Delete('policies/:id')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.procurementAutoPoEnable)
  removePolicy(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.procurement.removePolicy(tenancy.companyId, id);
  }

  // --------------------------------------------------------------------- PO

  @Get('pos')
  @RequirePermission(PERMISSION_KEYS.procurementPoRead)
  listPos(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.procurement.listPos(tenancy.companyId, {
      status,
      q,
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor,
    });
  }

  @Get('pos/:id')
  @RequirePermission(PERMISSION_KEYS.procurementPoRead)
  getPo(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.procurement.getPo(tenancy.companyId, id);
  }

  @Post('pos')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.procurementPoWrite)
  createPo(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: CreatePoDto,
  ) {
    return this.procurement.createPo(tenancy.companyId, dto);
  }

  @Patch('pos/:id')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.procurementPoWrite)
  updatePo(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePoDto,
  ) {
    return this.procurement.updatePo(tenancy.companyId, id, dto);
  }

  @Post('pos/:id/submit')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.procurementPoWrite)
  submitPo(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PoTransitionDto,
  ) {
    return this.procurement.transitionPo(tenancy.companyId, id, dto.version, 'submit');
  }

  @Post('pos/:id/approve')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.procurementPoApprove)
  approvePo(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PoTransitionDto,
  ) {
    return this.procurement.transitionPo(tenancy.companyId, id, dto.version, 'approve');
  }

  @Post('pos/:id/send')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.procurementPoSend)
  sendPo(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendPoDto,
  ) {
    return this.procurement.sendPo(tenancy.companyId, id, dto);
  }

  @Post('pos/:id/confirm')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.procurementPoSend)
  confirmPo(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PoTransitionDto,
  ) {
    return this.procurement.transitionPo(tenancy.companyId, id, dto.version, 'confirm');
  }

  @Post('pos/:id/cancel')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.procurementPoWrite)
  cancelPo(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PoTransitionDto,
  ) {
    return this.procurement.transitionPo(tenancy.companyId, id, dto.version, 'cancel');
  }

  // --------------------------------------------------------------- receipts

  @Get('receipts')
  @RequirePermission(PERMISSION_KEYS.procurementReceiptRead)
  listReceipts(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('poId') poId?: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.procurement.listReceipts(tenancy.companyId, {
      poId,
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor,
    });
  }

  @Get('receipts/:id')
  @RequirePermission(PERMISSION_KEYS.procurementReceiptRead)
  getReceipt(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.procurement.getReceipt(tenancy.companyId, id);
  }

  @Post('pos/:id/receipts')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.procurementReceiptPost)
  createReceipt(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateReceiptDto,
  ) {
    return this.procurement.createReceipt(tenancy.companyId, id, dto);
  }

  @Patch('receipts/:id')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.procurementReceiptPost)
  updateReceipt(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReceiptDto,
  ) {
    return this.procurement.updateReceipt(tenancy.companyId, id, dto);
  }

  @Post('receipts/:id/post')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.procurementReceiptPost)
  postReceipt(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PostReceiptDto,
  ) {
    return this.procurement.postReceipt(tenancy.companyId, id, dto.version);
  }
}
