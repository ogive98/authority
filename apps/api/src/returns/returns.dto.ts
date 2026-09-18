import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { RetDisposition } from '@prisma/client';

export class ReturnsRmaLineInputDto {
  @IsUUID()
  orderLineId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  qty!: number;

  @IsEnum(RetDisposition)
  disposition!: RetDisposition;
}

export class CreateReturnsRmaDto {
  @IsUUID()
  shipmentId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReturnsRmaLineInputDto)
  lines!: ReturnsRmaLineInputDto[];
}

export class UpdateReturnsRmaDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReturnsRmaLineInputDto)
  lines?: ReturnsRmaLineInputDto[];

  @IsInt()
  @Min(0)
  version!: number;
}
