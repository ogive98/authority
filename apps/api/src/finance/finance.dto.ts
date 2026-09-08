import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
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

export class CreateInvoiceDto {
  @IsUUID()
  customerId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  amountTotal!: number;

  @IsOptional()
  @IsUUID()
  salesOrderId?: string;

  @IsOptional()
  @IsUUID()
  shipmentId?: string;

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
