import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  AccAccountType,
  AccPeriodStatus,
} from '@prisma/client';

export class CreateAccountDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @IsEnum(AccAccountType)
  type!: AccAccountType;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateJournalDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateFiscalYearDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  code!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  /** When true, creates one OPEN period per calendar month spanning start→end. */
  @IsOptional()
  @IsBoolean()
  createMonthlyPeriods?: boolean;
}

export class CreateFiscalPeriodDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  code!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsEnum(AccPeriodStatus)
  status?: AccPeriodStatus;
}

export class UpdatePeriodStatusDto {
  @IsEnum(AccPeriodStatus)
  status!: AccPeriodStatus;
}

export class JournalLineDto {
  @IsUUID()
  accountId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  debit!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  credit!: number;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  memo?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  lineNo!: number;
}

export class CreateJournalEntryDto {
  @IsUUID()
  journalId!: string;

  @IsUUID()
  periodId!: string;

  @IsDateString()
  entryDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sourceType?: string;

  @IsOptional()
  @IsUUID()
  sourceId?: string;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines!: JournalLineDto[];
}
