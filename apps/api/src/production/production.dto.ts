import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
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
