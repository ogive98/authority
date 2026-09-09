import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateWarehouseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
}

export class AdjustStockDto {
  @IsUUID()
  productId!: string;

  @IsUUID()
  warehouseId!: string;

  @Type(() => Number)
  @IsNumber()
  qtyDelta!: number;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;

  /** Required when product.trackLot = true (D096). */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  lotCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  dlc?: string;
}

export class CreateLotDto {
  @IsUUID()
  productId!: string;

  @IsUUID()
  warehouseId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  lotCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  dlc?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  initialQty?: number;
}

export class AdjustLotDto {
  @IsUUID()
  lotId!: string;

  @Type(() => Number)
  @IsNumber()
  qtyDelta!: number;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}

export class PatchLotStatusDto {
  @IsString()
  @MaxLength(16)
  status!: string;
}

export class ReserveStockDto {
  @IsUUID()
  productId!: string;

  @IsUUID()
  warehouseId!: string;

  @Type(() => Number)
  @IsNumber()
  qty!: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  refType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  refId?: string;
}

export class ReleaseStockDto {
  @IsUUID()
  productId!: string;

  @IsUUID()
  warehouseId!: string;

  @Type(() => Number)
  @IsNumber()
  qty!: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  refType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  refId?: string;
}

/** Consume reserved stock on delivery (on_hand and reserved decrease). */
export class IssueStockDto {
  @IsUUID()
  productId!: string;

  @IsUUID()
  warehouseId!: string;

  @Type(() => Number)
  @IsNumber()
  qty!: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  refType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  refId?: string;

  /** Sales order (or other pick source) — consume existing FEFO allocations, never pick again. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  allocationRefType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  allocationRefId?: string;

  /** When false, decrease on_hand only (no prior SKU reserve). Default true. */
  @IsOptional()
  @IsBoolean()
  consumeReserved?: boolean;
}

export class UpsertCheeseArticleDto {
  @IsUUID()
  productId!: string;

  @Type(() => Number)
  @IsNumber()
  shelfLifeDays!: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  notes?: string;
}

export class PatchCheeseArticleDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  shelfLifeDays?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  notes?: string;
}

export class PreviewDlcDto {
  @IsString()
  @MinLength(10)
  @MaxLength(10)
  packDate!: string;

  @Type(() => Number)
  @IsNumber()
  shelfLifeDays!: number;
}

export class GenerateDailyLotsDto {
  @IsOptional()
  @IsString()
  @MaxLength(10)
  packDate?: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}
