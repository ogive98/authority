import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

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
