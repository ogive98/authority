import {
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ArrayMinSize,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { HrContractType, HrEmployeeStatus } from '@prisma/client';

export class CreateEmployeeDto {
  @IsString()
  @MaxLength(32)
  matricule!: string;

  @IsString()
  @MaxLength(160)
  displayName!: string;

  @IsOptional()
  @IsUUID()
  siteId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  department?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  jobTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  cnssNo?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsDateString()
  hiredAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class PatchEmployeeDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  displayName?: string;

  @IsOptional()
  @IsUUID()
  siteId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  department?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  jobTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  cnssNo?: string | null;

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsEnum(HrEmployeeStatus)
  status?: HrEmployeeStatus;

  @IsOptional()
  @IsDateString()
  leftAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class CreateContractDto {
  @IsUUID()
  employeeId!: string;

  @IsEnum(HrContractType)
  type!: HrContractType;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  wageRef?: string;

  /** Human wage base TND for CNSS — not a contribution rate. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  wageBase?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class PatchContractDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  wageRef?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  wageBase?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class CreateCnssSnapshotDto {
  @IsUUID()
  contractId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(7)
  periodYm?: string;
}

export class CreateIrppSnapshotDto {
  @IsUUID()
  contractId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(7)
  periodYm?: string;
}

export class CreateBulletinDto {
  @IsUUID()
  contractId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(7)
  periodYm?: string;
}

export class IrppBracketRowDto {
  /** Annual ceiling in millimes; omit/null for open-ended last band. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  upToMilli?: number | null;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  rateBps!: number;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  lawRef?: string | null;
}

export class ReplaceIrppBracketsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => IrppBracketRowDto)
  brackets!: IrppBracketRowDto[];
}

export class EndContractDto {
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
