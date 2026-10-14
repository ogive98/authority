import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  PROCUREMENT_MESSAGE_CHANNELS,
  PROCUREMENT_SUGGESTION_REASONS,
} from './procurement.constants';

export class CreateSuggestionDto {
  @IsUUID()
  productId!: string;

  @IsOptional()
  @IsUUID()
  siteId?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  qty!: number;

  @IsIn([...PROCUREMENT_SUGGESTION_REASONS])
  reason!: (typeof PROCUREMENT_SUGGESTION_REASONS)[number];
}

export class DecideSuggestionDto {
  @IsInt()
  @Min(0)
  version!: number;
}

export class ConvertSuggestionDto {
  @IsInt()
  @Min(0)
  version!: number;

  @IsUUID()
  supplierId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  unitPrice!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  qty?: number;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsUUID()
  siteId?: string;

  @IsOptional()
  @IsDateString()
  expectedDate?: string;
}

export class CreatePoLineDto {
  @IsUUID()
  productId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  qtyOrdered!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  moq?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  pack?: number;
}

export class CreatePoDto {
  @IsUUID()
  supplierId!: string;

  @IsOptional()
  @IsUUID()
  siteId?: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsDateString()
  expectedDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePoLineDto)
  lines!: CreatePoLineDto[];
}

export class UpdatePoDto {
  @IsInt()
  @Min(0)
  version!: number;

  @IsOptional()
  @IsDateString()
  expectedDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePoLineDto)
  lines?: CreatePoLineDto[];
}

export class PoTransitionDto {
  @IsInt()
  @Min(0)
  version!: number;
}

export class SendPoDto {
  @IsInt()
  @Min(0)
  version!: number;

  @IsIn([...PROCUREMENT_MESSAGE_CHANNELS])
  channel!: (typeof PROCUREMENT_MESSAGE_CHANNELS)[number];

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  toAddress!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  templateKey?: string;
}

export class CreateReceiptLineDto {
  @IsUUID()
  poLineId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  qty!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  lotCode?: string;

  @IsOptional()
  @IsDateString()
  dlc?: string;
}

export class CreateReceiptDto {
  @IsInt()
  @Min(0)
  version!: number;

  @IsUUID()
  warehouseId!: string;

  @IsOptional()
  @IsIn(['RECEIPT', 'RETURN'])
  kind?: 'RECEIPT' | 'RETURN';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReceiptLineDto)
  lines!: CreateReceiptLineDto[];
}

export class UpdateReceiptDto {
  @IsInt()
  @Min(0)
  version!: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  qcStatus?: string;
}

export class PostReceiptDto {
  @IsInt()
  @Min(0)
  version!: number;
}

export class UpsertStockPolicyDto {
  @IsUUID()
  productId!: string;

  @IsUUID()
  siteId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minQty!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  safetyQty?: number;
}
