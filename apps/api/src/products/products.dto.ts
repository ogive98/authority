import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
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
