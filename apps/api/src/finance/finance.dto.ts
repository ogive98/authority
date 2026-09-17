import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  FinAllocationPolicy,
  FinInstrumentStatus,
  FinInstrumentType,
  FinPaymentMethod,
} from '@prisma/client';

export class CreateOpenItemDto {
  @IsUUID()
  customerId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  amountTotal!: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsUUID()
  salesOrderId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;
}

export class AllocateOpenItemDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  amount!: number;

  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  note?: string;
}

export class CreateInvoiceLineDto {
  @IsString()
  @MaxLength(240)
  description!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  qty!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPriceHt!: number;

  /** Optional when productId has default VAT or stub TVA19 (D271). */
  @IsOptional()
  @IsUUID()
  taxCodeId?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;
}

export class CreateInvoiceDto {
  @IsUUID()
  customerId!: string;

  /** Legacy TTC total when lines omitted (auto AR-on-delivery). */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  amountTotal?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceLineDto)
  lines?: CreateInvoiceLineDto[];

  @IsOptional()
  @IsUUID()
  salesOrderId?: string;

  @IsOptional()
  @IsUUID()
  shipmentId?: string;

  /** Printed title only — same AR/GL document. Defaults from customer fiche. */
  @IsOptional()
  @IsIn(['DELIVERY_NOTE', 'INVOICE'])
  fulfillmentDoc?: 'DELIVERY_NOTE' | 'INVOICE';

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsBoolean()
  issue?: boolean;
}

export class CreateCreditNoteLineDto {
  @IsString()
  @MaxLength(240)
  description!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  qty!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPriceHt!: number;

  @IsUUID()
  taxCodeId!: string;

  @IsOptional()
  @IsUUID()
  productId?: string;
}

/** Credit note / avoir V0 (D192) — invoice-linked only. */
export class CreateCreditNoteDto {
  @IsUUID()
  sourceInvoiceId!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCreditNoteLineDto)
  lines?: CreateCreditNoteLineDto[];

  /** Clone all lines from the source ISSUED invoice. */
  @IsOptional()
  @IsBoolean()
  copyFull?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsBoolean()
  issue?: boolean;
}

export class CreatePaymentInstrumentDto {
  @IsEnum(FinInstrumentType)
  type!: FinInstrumentType;

  @IsString()
  @MaxLength(64)
  number!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  holder?: string;

  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsOptional()
  @IsDateString()
  receiveDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class CreatePaymentDto {
  @IsUUID()
  customerId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  amount!: number;

  @IsEnum(FinPaymentMethod)
  method!: FinPaymentMethod;

  @IsDateString()
  paymentDate!: string;

  @IsOptional()
  @IsDateString()
  accountingDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreatePaymentInstrumentDto)
  instrument?: CreatePaymentInstrumentDto;
}

export class ManualAllocationLineDto {
  @IsUUID()
  openItemId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  amount!: number;
}

export class SimulateAllocationDto {
  @IsEnum(FinAllocationPolicy)
  policy!: FinAllocationPolicy;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManualAllocationLineDto)
  lines?: ManualAllocationLineDto[];
}

export class ConfirmAllocationDto {
  @IsEnum(FinAllocationPolicy)
  policy!: FinAllocationPolicy;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManualAllocationLineDto)
  lines?: ManualAllocationLineDto[];

  @IsOptional()
  @IsString()
  @MaxLength(240)
  note?: string;
}

export class TransitionInstrumentDto {
  @IsEnum(FinInstrumentStatus)
  status!: FinInstrumentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  rejectReason?: string;
}

export class CreatePromiseDto {
  @IsUUID()
  openItemId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  amount!: number;

  @IsDateString()
  promisedDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

/** D189 — company bank account (multi-bank). */
export class CreateBankAccountDto {
  @IsString()
  @MaxLength(32)
  code!: string;

  @IsString()
  @MaxLength(160)
  label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  rib?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  iban?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  glAccountCode?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateBankAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  rib?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  iban?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  glAccountCode?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CreateBankStatementLineDto {
  @IsDateString()
  lineDate!: string;

  @Type(() => Number)
  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  counterparty?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  memo?: string;

  /** OFX FITID — optional on manual/CSV; required on OFX import. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  fitId?: string;
}

export class CreateBankStatementLinesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBankStatementLineDto)
  lines!: CreateBankStatementLineDto[];
}

export class MatchBankLineDto {
  @IsOptional()
  @IsUUID()
  paymentId?: string;

  @IsOptional()
  @IsUUID()
  instrumentId?: string;

  @IsOptional()
  @IsUUID()
  apPaymentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  note?: string;
}

/** D205 — AP disbursement (vendorName free text, no supplier master). D237 optional apBillId. */
export class CreateApPaymentDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  vendorName?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  amount!: number;

  @IsEnum(FinPaymentMethod)
  method!: FinPaymentMethod;

  @IsDateString()
  paymentDate!: string;

  @IsOptional()
  @IsDateString()
  accountingDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  /** D237 — link to POSTED FinApBill (optional). */
  @IsOptional()
  @IsUUID()
  apBillId?: string;

  /**
   * D264 — when true (default) and tax.ras Prefs VALIDATED, withhold RAS from amount.
   * Set false for exceptional gross disbursement (audit via notes recommended).
   */
  @IsOptional()
  @IsBoolean()
  applyRas?: boolean;
}

/** D236 — AP vendor bill V0. D250 optional supplierId (vendorName still display SoT). */
export class CreateApBillLineDto {
  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  amountHt!: number;

  @IsOptional()
  @IsUUID()
  taxCodeId?: string;
}

export class CreateApBillDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  vendorName?: string;

  /** AUTHORITY supplier master link (optional). Fills vendorName from legalName when omitted. */
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ValidateIf((o: CreateApBillDto) => !o.lines?.length)
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  amountTotal?: number;

  /** D276 — optional tax lines (engine). When set, amountTotal is derived TTC. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateApBillLineDto)
  lines?: CreateApBillLineDto[];

  @IsDateString()
  billDate!: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;
}

/** D191 — mark fee/orphan as IGNORED (no GL). */
export class IgnoreBankLineDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  memo?: string;
}

/** D191 — CSV body for preview/import. */
export class ImportBankCsvDto {
  @IsString()
  @MaxLength(2_000_000)
  csv!: string;
}

/** D193 — OFX body for preview/import. */
export class ImportBankOfxDto {
  @IsString()
  @MaxLength(4_000_000)
  ofx!: string;
}

/** D190 — human-gated dunning draft. */
export class PrepareDunningDto {
  @IsUUID()
  openItemId!: string;

  @IsUUID()
  contactId!: string;

  @IsEnum(['EMAIL', 'WHATSAPP'])
  channel!: 'EMAIL' | 'WHATSAPP';
}

/** D243 — ADV review of portal payment declaration (no FinPayment create). */
export class ReviewPaymentDeclarationDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNote?: string;

  @IsInt()
  @Min(0)
  version!: number;
}