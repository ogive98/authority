import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Allow } from 'class-validator';

/** Nested change row — mirrors UpdateSettingDto for plan body. */
export class ConfigurationPlanChangeDto {
  @IsString()
  key!: string;

  @Allow()
  value!: unknown;

  @IsOptional()
  @IsIn(['USER', 'COMPANY', 'ROLE', 'SITE', 'DOCUMENT'])
  level?: 'USER' | 'COMPANY' | 'ROLE' | 'SITE' | 'DOCUMENT';

  @IsOptional()
  @IsString()
  @MaxLength(64)
  roleCode?: string;

  /** D303 — required when level=DOCUMENT (document-type code, not instance id). */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  documentType?: string;
}

export class ConfigurationPlanDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ConfigurationPlanChangeDto)
  changes!: ConfigurationPlanChangeDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  /** D298 — persist valid plan as DRAFT for approve/apply. */
  @IsOptional()
  @IsBoolean()
  persist?: boolean;
}

export class ConfigurationPlanRejectDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
