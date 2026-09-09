import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  sku!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  typeKey!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(16)
  uom!: string;

  @IsOptional()
  @IsBoolean()
  trackLot?: boolean;

  @IsOptional()
  @IsBoolean()
  perishable?: boolean;

  /** Conservation days after packaging (salubrité / DLC). Null clears. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  @Min(1)
  shelfLifeDays?: number | null;

  /** Days before pack = Date Production (0/null = same day). */
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  @Min(0)
  productionOffsetDays?: number | null;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  storageClassKey!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergenFlags?: string[];
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  typeKey?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(16)
  uom?: string;

  @IsOptional()
  @IsBoolean()
  trackLot?: boolean;

  @IsOptional()
  @IsBoolean()
  perishable?: boolean;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  @Min(1)
  shelfLifeDays?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  @Min(0)
  productionOffsetDays?: number | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  storageClassKey?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergenFlags?: string[];

  @IsInt()
  @Min(0)
  version!: number;
}
