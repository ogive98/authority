import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ArrayMinSize,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { HrContractType, HrEmployeeStatus, HrPrintDocKind } from '@prisma/client';

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
  @IsUUID()
  jobTitleId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  cnssNo?: string;

  /** Tunisian CIN — 8 digits when set (D217). */
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && String(v).trim() !== '')
  @Matches(/^\d{8}$/)
  @MaxLength(8)
  cinNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankAgency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(34)
  bankAccount?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  /**
   * D219 — create Identity ACTIVE + role `employee` + link userId.
   * Requires email. Default false when omitted (opt-in from AUTHORITY UI).
   */
  @IsOptional()
  @IsBoolean()
  provisionLogin?: boolean;

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
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsUUID()
  siteId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  department?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsUUID()
  jobTitleId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  cnssNo?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && String(v).trim() !== '')
  @Matches(/^\d{8}$/)
  @MaxLength(8)
  cinNo?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankAgency?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(34)
  bankAccount?: string | null;

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsEnum(HrEmployeeStatus)
  status?: HrEmployeeStatus;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsDateString()
  hiredAt?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsDateString()
  leftAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsUUID()
  photoDocumentId?: string | null;

  /** Link / unlink Identity account (same company). */
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsUUID()
  userId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsBoolean()
  taxChefDeFamille?: boolean | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20)
  taxEnfantCount?: number | null;
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
  @IsEnum(HrContractType)
  type?: HrContractType;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsDateString()
  endDate?: string | null;

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

export class CreateJobTitleDto {
  @IsString()
  @MaxLength(32)
  code!: string;

  @IsString()
  @MaxLength(80)
  name!: string;
}

export class PatchJobTitleDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateDocKindDto {
  @IsString()
  @MaxLength(32)
  code!: string;

  @IsString()
  @MaxLength(80)
  name!: string;
}

export class PatchDocKindDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class PutContractPrintTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  letterhead?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  bodyHtml?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  footer?: string;
}

/** One-shot PDF body overrides — does not persist Prefs (D217 UX). */
export class GeneratePrintPdfDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  letterhead?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  bodyHtml?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  footer?: string;

  @IsOptional()
  @IsUUID()
  templateId?: string;
}

export class PutAttestationPrintTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  letterhead?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  bodyHtml?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  footer?: string;
}

export class CreatePrintTemplateDto {
  @IsEnum(HrPrintDocKind)
  kind!: HrPrintDocKind;

  @IsString()
  @MaxLength(32)
  code!: string;

  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  letterhead?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  bodyHtml?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  footer?: string;
}

export class PatchPrintTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  letterhead?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  bodyHtml?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  footer?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateTransferOrderDto {
  @IsUUID()
  bulletinId!: string;

  @IsUUID()
  bankAccountId!: string;
}
