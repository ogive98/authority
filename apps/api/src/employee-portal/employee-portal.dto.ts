import { AttAbsenceType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class PortalCreateAbsenceDto {
  @IsEnum(AttAbsenceType)
  type!: AttAbsenceType;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

/** D232 — employee may update own bank coords (RIB validated). */
export class PortalPatchBankDto {
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
}
