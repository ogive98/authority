import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
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

/** D261 — product fiscal profile (classification + default VAT; no invented rates). */
export class UpsertProductFiscalProfileDto {
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsUUID()
  defaultVatTaxCodeId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  hsCode?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  fiscalCategory?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  version?: number;
}

export class UpsertProductFiscalOverrideDto {
  @IsUUID()
  taxCodeId!: string;

  @IsIn(['AUTO', 'ALWAYS', 'NEVER', 'CONFIRM'])
  mode!: 'AUTO' | 'ALWAYS' | 'NEVER' | 'CONFIRM';

  @IsOptional()
  @IsIn([
    'SYSTEM_RULE',
    'CLIENT_OVERRIDE',
    'EXEMPTION',
    'MANUAL_OVERRIDE',
  ])
  source?:
    | 'SYSTEM_RULE'
    | 'CLIENT_OVERRIDE'
    | 'EXEMPTION'
    | 'MANUAL_OVERRIDE';

  @IsOptional()
  @IsDateString()
  validFrom?: string | null;

  @IsOptional()
  @IsDateString()
  validTo?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  justification?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string | null;

  @IsOptional()
  @IsUUID()
  documentId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  version?: number;
}
