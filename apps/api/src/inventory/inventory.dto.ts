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
