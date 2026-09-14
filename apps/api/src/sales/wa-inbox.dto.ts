import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { SalesOrderLineInputDto } from './sales.dto';

export class MatchWaInboxDto {
  @IsInt()
  @Min(0)
  version!: number;

  @IsUUID()
  customerId!: string;

  @IsOptional()
  @IsUUID()
  contactId?: string;
}

export class DismissWaInboxDto {
  @IsInt()
  @Min(0)
  version!: number;
}

export class CreateWaInboxDraftDto {
  @IsInt()
  @Min(0)
  version!: number;

  @IsUUID()
  warehouseId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalesOrderLineInputDto)
  lines!: SalesOrderLineInputDto[];

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  notes?: string;
}
