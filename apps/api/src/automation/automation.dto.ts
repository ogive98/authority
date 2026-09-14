import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  AtmActionKind,
  AtmProfileMode,
  AtmTriggerKind,
} from '@prisma/client';

export class CreateAtmProfileDto {
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsEnum(AtmProfileMode)
  mode!: AtmProfileMode;

  @IsEnum(AtmTriggerKind)
  triggerKind!: AtmTriggerKind;

  @IsEnum(AtmActionKind)
  actionKind!: AtmActionKind;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  shadowMode?: boolean;

  @IsOptional()
  @IsObject()
  configJson?: Record<string, unknown>;
}

export class UpdateAtmProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsEnum(AtmProfileMode)
  mode?: AtmProfileMode;

  @IsOptional()
  @IsEnum(AtmTriggerKind)
  triggerKind?: AtmTriggerKind;

  @IsOptional()
  @IsEnum(AtmActionKind)
  actionKind?: AtmActionKind;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  shadowMode?: boolean;

  @IsOptional()
  @IsObject()
  configJson?: Record<string, unknown>;

  @IsInt()
  @Min(0)
  version!: number;
}

export class ReviewAtmRunDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNote?: string;

  @IsInt()
  @Min(0)
  version!: number;
}

export class RunAtmProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  triggerRef?: string;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  staleDays?: number;
}
