import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentTenancy } from '../organization/organization.decorators';
import type { TenancyContext } from '../organization/organization.constants';
import { TenancyGuard } from '../organization/tenancy.guard';
import { SessionGuard } from '../identity/session.guard';
import { ModuleGuard } from '../modules-registry/module.guard';
import { RequireModule } from '../modules-registry/modules.decorators';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permission.decorators';
import { PERMISSION_KEYS } from '../permissions/permission.constants';
import {
  CreateAccountDto,
  CreateFiscalPeriodDto,
  CreateFiscalYearDto,
  CreateJournalDto,
  CreateJournalEntryDto,
  UpdatePeriodStatusDto,
} from './accounting.dto';
import { AccountingService } from './accounting.service';

@Controller('api/v1/accounting')
@UseGuards(SessionGuard, ModuleGuard, TenancyGuard, PermissionGuard)
@RequireModule('accounting')
export class AccountingController {
  constructor(private readonly accounting: AccountingService) {}

  // ─── CoA ─────────────────────────────────────────────────────────────────

  @Get('accounts')
  @RequirePermission(PERMISSION_KEYS.accountingRead)
  listAccounts(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('q') q?: string,
    @Query('type') type?: string,
    @Query('active') activeRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    const active =
      activeRaw === undefined
        ? undefined
        : activeRaw === 'true' || activeRaw === '1'
          ? true
          : activeRaw === 'false' || activeRaw === '0'
            ? false
            : undefined;
    return this.accounting.listAccounts(tenancy.companyId, {
      q,
      type,
      active,
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor,
    });
  }

  @Post('accounts')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.accountingWrite)
  createAccount(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: CreateAccountDto,
  ) {
    return this.accounting.createAccount(tenancy.companyId, dto);
  }

  // ─── Journals ────────────────────────────────────────────────────────────

  @Get('journals')
  @RequirePermission(PERMISSION_KEYS.accountingRead)
  listJournals(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('q') q?: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.accounting.listJournals(tenancy.companyId, {
      q,
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor,
    });
  }

  @Post('journals')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.accountingWrite)
  createJournal(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: CreateJournalDto,
  ) {
    return this.accounting.createJournal(tenancy.companyId, dto);
  }

  // ─── Fiscal years / periods ──────────────────────────────────────────────

  @Get('fiscal-years')
  @RequirePermission(PERMISSION_KEYS.accountingRead)
  listFiscalYears(@CurrentTenancy() tenancy: TenancyContext) {
    return this.accounting.listFiscalYears(tenancy.companyId);
  }

  @Post('fiscal-years')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.accountingWrite)
  createFiscalYear(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: CreateFiscalYearDto,
  ) {
    return this.accounting.createFiscalYear(tenancy.companyId, dto);
  }

  @Post('fiscal-years/:id/periods')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.accountingWrite)
  createPeriod(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateFiscalPeriodDto,
  ) {
    return this.accounting.createFiscalPeriod(tenancy.companyId, id, dto);
  }

  @Get('periods')
  @RequirePermission(PERMISSION_KEYS.accountingRead)
  listPeriods(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('fiscalYearId') fiscalYearId?: string,
    @Query('status') status?: string,
  ) {
    return this.accounting.listPeriods(tenancy.companyId, {
      fiscalYearId,
      status,
    });
  }

  @Patch('periods/:id/status')
  @RequirePermission(PERMISSION_KEYS.accountingWrite)
  updatePeriodStatus(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePeriodStatusDto,
  ) {
    return this.accounting.updatePeriodStatus(tenancy.companyId, id, dto);
  }

  // ─── Journal entries ─────────────────────────────────────────────────────

  @Get('entries')
  @RequirePermission(PERMISSION_KEYS.accountingRead)
  listEntries(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('journalId') journalId?: string,
    @Query('periodId') periodId?: string,
    @Query('status') status?: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.accounting.listEntries(tenancy.companyId, {
      journalId,
      periodId,
      status,
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor,
    });
  }

  @Get('entries/:id')
  @RequirePermission(PERMISSION_KEYS.accountingRead)
  getEntry(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.accounting.getEntry(tenancy.companyId, id);
  }

  @Post('entries')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.accountingWrite)
  createEntry(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: CreateJournalEntryDto,
  ) {
    return this.accounting.createEntry(tenancy.companyId, dto);
  }

  @Post('entries/:id/post')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.accountingPost)
  postEntry(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.accounting.postEntry(tenancy.companyId, id);
  }

  @Post('entries/:id/reverse')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.accountingPost)
  reverseEntry(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.accounting.reverseEntry(tenancy.companyId, id);
  }

  // ─── Trial balance ───────────────────────────────────────────────────────

  @Get('trial-balance')
  @RequirePermission(PERMISSION_KEYS.accountingRead)
  trialBalance(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('periodId') periodId?: string,
  ) {
    return this.accounting.trialBalance(tenancy.companyId, { periodId });
  }
}
