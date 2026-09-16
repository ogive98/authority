import {
  IsArray,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  FrgExtensionStatus,
  FrgFeatureRequestStatus,
  FrgMetadataStatus,
  FrgMetadataType,
} from '@prisma/client';

export class RegisterExtensionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  key!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  manifestVersion!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dependencies?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  compatibleCoreVersion?: string;
}

export class TransitionExtensionDto {
  @IsEnum(FrgExtensionStatus)
  status!: FrgExtensionStatus;
}

export class CreateFeatureRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  source?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  affectedModules?: string[];

  @IsOptional()
  @IsUUID()
  extensionId?: string;
}

export class TransitionFeatureRequestDto {
  @IsEnum(FrgFeatureRequestStatus)
  status!: FrgFeatureRequestStatus;
}

export class CreateMetadataDefinitionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  key!: string;

  @IsEnum(FrgMetadataType)
  type!: FrgMetadataType;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  moduleKey!: string;

  @IsOptional()
  @IsUUID()
  extensionId?: string;

  @IsOptional()
  @IsObject()
  schemaJson?: Record<string, unknown>;
}

export class TransitionMetadataDto {
  @IsEnum(FrgMetadataStatus)
  status!: FrgMetadataStatus;
}
