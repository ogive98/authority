import {
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
import {
  MNT_ASSET_STATUSES,
  MNT_ASSET_TYPES,
  MNT_WO_TYPES,
} from './maintenance.constants';

export class CreateAssetDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  label!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @IsIn([...MNT_ASSET_TYPES])
  type!: (typeof MNT_ASSET_TYPES)[number];

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @IsUUID()
  vehicleId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @IsDateString()
  nextPreventiveAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateAssetDto {
  @IsInt()
  @Min(0)
  version!: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  label?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @IsIn([...MNT_ASSET_TYPES])
  type?: (typeof MNT_ASSET_TYPES)[number];

  @IsOptional()
  @IsIn([...MNT_ASSET_STATUSES])
  status?: (typeof MNT_ASSET_STATUSES)[number];

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @IsUUID()
  vehicleId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @IsDateString()
  nextPreventiveAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}

export class CreateWoDto {
  @IsUUID()
  assetId!: string;

  @IsIn([...MNT_WO_TYPES])
  type!: (typeof MNT_WO_TYPES)[number];

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class MarkAssetStatusDto {
  @IsInt()
  @Min(0)
  version!: number;
}
