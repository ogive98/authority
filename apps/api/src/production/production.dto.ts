import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateWorkOrderDto {
  @IsUUID()
  productId!: string;

  @IsUUID()
  warehouseId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  plannedQty!: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  lotOut?: string;

  @IsOptional()
  @IsString()
  @MaxLength(480)
  notes?: string;
}

export class DeclareLineDto {
  @IsUUID()
  productId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  qty!: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  lotIn?: string;
}

export class DeclareWorkOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DeclareLineDto)
  consumptions!: DeclareLineDto[];

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  outputQty!: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  lotOut?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  scrapQty?: number;

  @IsOptional()
  @IsUUID()
  scrapProductId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  scrapReason?: string;
}

/** D292 — create digital worksheet (Prep→Weigh→Control). */
export class CreateWorksheetLineDto {
  @IsUUID()
  productId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  requestedQty!: number;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  unit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  lot?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  notes?: string;
}

export class CreateWorksheetDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateWorksheetLineDto)
  lines!: CreateWorksheetLineDto[];

  @IsOptional()
  @IsUUID()
  orderId?: string;

  @IsOptional()
  @IsUUID()
  workOrderId?: string;

  @IsOptional()
  @IsUUID()
  siteId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(480)
  notes?: string;
}

export class WorksheetLineQtyDto {
  @IsUUID()
  id!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  qty!: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  lot?: string;
}

export class PrepareWorksheetDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WorksheetLineQtyDto)
  lines!: WorksheetLineQtyDto[];
}

export class WeighWorksheetDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WorksheetLineQtyDto)
  lines!: WorksheetLineQtyDto[];
}

export class ControlWorksheetDto {
  @IsIn(['PASS', 'FAIL'])
  result!: 'PASS' | 'FAIL';

  @IsOptional()
  @IsString()
  @MaxLength(480)
  note?: string;
}
