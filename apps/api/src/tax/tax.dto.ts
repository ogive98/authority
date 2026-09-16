import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type {
  TaxCalcMethod,
  TaxDecisionSource,
  TaxKind,
} from '@prisma/client';

export class CreateTaxRateDto {
  @IsUUID()
  taxCodeId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  rateBps!: number;

  @IsDateString()
  validFrom!: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  lawRef?: string;
}

export class PatchTaxRateDto {
  @IsOptional()
  @IsDateString()
  validTo?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  lawRef?: string | null;
}

export class CalculateTaxLineDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  lineNo?: number;

  @IsOptional()
  @IsUUID()
  taxCodeId?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  qty!: number;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  unit?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPriceHt!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amountHt?: number;
}

export class CalculateTaxDto {
  @IsOptional()
  @IsDateString()
  asOf?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  operationType?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CalculateTaxLineDto)
  lines!: CalculateTaxLineDto[];
}

/** D265 — generate local TEJ XML draft (Prefs tax.tej VALIDATED required). */
export class GenerateTejLocalDto {
  @IsString()
  @MaxLength(64)
  periodLabel!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  side?: 'AP' | 'AR';
}

export class GenerateTejInvoicePackDto {
  @IsUUID()
  arInvoiceId!: string;
}

export class DetectRasDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  baseAmount!: number;

  @IsString()
  @MaxLength(200)
  vendorName!: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsUUID()
  apBillId?: string;

  @IsOptional()
  @IsUUID()
  apPaymentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  periodLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;
}

export type FiscalDecision = {
  applicable: boolean;
  /** Tax code id (same as ruleId for SYSTEM_RULE). */
  ruleId: string | null;
  ruleVersion: number | null;
  taxRateId: string | null;
  taxCode: string | null;
  taxName: string | null;
  kind: TaxKind | null;
  calcMethod: TaxCalcMethod | null;
  base: number;
  quantity: number | null;
  unit: string | null;
  rateBps: number | null;
  fixedAmountMilli: number | null;
  calculatedAmount: number;
  currency: string;
  reason: string;
  source: TaxDecisionSource;
  effectiveDate: string;
  lawRef: string | null;
  lineNo: number | null;
  productId: string | null;
};
