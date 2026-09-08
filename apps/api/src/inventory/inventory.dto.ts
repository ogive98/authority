import { Type } from 'class-transformer';
import {
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
}
