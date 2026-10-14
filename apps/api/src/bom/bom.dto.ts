import { Type } from 'class-transformer';
import {
  IsDecimal,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateRecipeDto {
  @IsUUID()
  productId: string;

  @IsInt()
  @Min(1)
  version: number;

  @IsDecimal({ decimal_digits: '1,3' })
  @IsOptional()
  yield?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateRecipeLineDto {
  @IsUUID()
  productId: string;

  @IsDecimal({ decimal_digits: '1,3' })
  qty: string;

  @IsString()
  uom: string;

  @IsDecimal({ decimal_digits: '1,2' })
  @IsOptional()
  scrapPct?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  step?: number;
}

export class AddLinesDto {
  @Type(() => CreateRecipeLineDto)
  lines: CreateRecipeLineDto[];
}
