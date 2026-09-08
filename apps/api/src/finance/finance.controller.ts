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
  AllocateOpenItemDto,
  ConfirmAllocationDto,
  CreateInvoiceDto,
  CreateOpenItemDto,
  CreatePaymentDto,
  CreatePromiseDto,
  SimulateAllocationDto,
  TransitionInstrumentDto,
} from './finance.dto';
import { FinanceService } from './finance.service';
import { InvoiceService } from './invoice.service';
import { PaymentService } from './payment.service';
import { PromiseService } from './promise.service';

@Controller('api/v1/finance')
@UseGuards(SessionGuard, ModuleGuard, TenancyGuard, PermissionGuard)
@RequireModule('finance')
export class FinanceController {
  constructor(
    private readonly financeService: FinanceService,
    private readonly invoiceService: InvoiceService,
    private readonly paymentService: PaymentService,
    private readonly promiseService: PromiseService,
  ) {}

  @Get('open-items')
  @RequirePermission(PERMISSION_KEYS.financeArRead)
  list(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('overdue') overdueRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    const overdue =
      overdueRaw === '1' ||
      overdueRaw?.toLowerCase() === 'true' ||
      overdueRaw?.toLowerCase() === 'yes';
    return this.financeService.list(tenancy.companyId, {
      q,
      status,
      customerId,
      overdue: overdue || undefined,
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor,
    });
  }

  @Get('open-items/:id')
  @RequirePermission(PERMISSION_KEYS.financeArRead)
  get(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.financeService.get(tenancy.companyId, id);
  }

  @Get('credit/:customerId')
  @RequirePermission(PERMISSION_KEYS.financeArRead)
  credit(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ) {
    return this.financeService.creditSnapshot(tenancy.companyId, customerId);
  }

  @Post('open-items')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.financeArWrite)
  create(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: CreateOpenItemDto,
  ) {
    return this.financeService.create(tenancy.companyId, dto);
  }

  @Post('open-items/:id/allocate')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.financeAllocate)
  allocate(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AllocateOpenItemDto,
  ) {
    return this.financeService.allocate(tenancy.companyId, id, dto);
  }

  @Get('invoices')
  @RequirePermission(PERMISSION_KEYS.financeArRead)
  listInvoices(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.invoiceService.list(tenancy.companyId, {
      q,
      status,
      customerId,
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor,
    });
  }

  @Get('invoices/:id')
  @RequirePermission(PERMISSION_KEYS.financeArRead)
  getInvoice(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.invoiceService.get(tenancy.companyId, id);
  }

  @Post('invoices')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.financeArWrite)
  createInvoice(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.invoiceService.create(tenancy.companyId, dto);
  }

  @Post('invoices/:id/issue')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.financeArWrite)
  issueInvoice(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.invoiceService.issue(tenancy.companyId, id);
  }

  @Get('payments')
  @RequirePermission(PERMISSION_KEYS.financeArRead)
  listPayments(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.paymentService.list(tenancy.companyId, {
      q,
      status,
      customerId,
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor,
    });
  }

  @Get('payments/:id')
  @RequirePermission(PERMISSION_KEYS.financeArRead)
  getPayment(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.paymentService.get(tenancy.companyId, id);
  }

  @Post('payments')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.financeAllocate)
  createPayment(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.paymentService.create(tenancy.companyId, dto);
  }

  @Post('payments/:id/allocate/simulate')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.financeAllocate)
  simulateAllocation(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SimulateAllocationDto,
  ) {
    return this.paymentService.simulate(tenancy.companyId, id, dto);
  }

  @Post('payments/:id/allocate/confirm')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.financeAllocate)
  confirmAllocation(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmAllocationDto,
  ) {
    return this.paymentService.confirm(tenancy.companyId, id, dto);
  }

  @Get('instruments')
  @RequirePermission(PERMISSION_KEYS.financeArRead)
  listInstruments(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('status') status?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.paymentService.listInstruments(tenancy.companyId, {
      status,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
  }

  @Patch('instruments/:id/status')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.financeAllocate)
  transitionInstrument(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionInstrumentDto,
  ) {
    return this.paymentService.transitionInstrument(
      tenancy.companyId,
      id,
      dto,
    );
  }

  @Get('promises')
  @RequirePermission(PERMISSION_KEYS.financeArRead)
  listPromises(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('openItemId') openItemId?: string,
    @Query('broken') brokenRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    const broken =
      brokenRaw === '1' ||
      brokenRaw?.toLowerCase() === 'true' ||
      brokenRaw?.toLowerCase() === 'yes';
    return this.promiseService.list(tenancy.companyId, {
      q,
      status,
      customerId,
      openItemId,
      broken: broken || undefined,
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor,
    });
  }

  @Get('promises/:id')
  @RequirePermission(PERMISSION_KEYS.financeArRead)
  getPromise(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.promiseService.get(tenancy.companyId, id);
  }

  @Post('promises')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.financeArWrite)
  createPromise(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: CreatePromiseDto,
  ) {
    return this.promiseService.create(tenancy.companyId, dto);
  }

  @Post('promises/:id/cancel')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.financeArWrite)
  cancelPromise(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.promiseService.cancel(tenancy.companyId, id);
  }
}
