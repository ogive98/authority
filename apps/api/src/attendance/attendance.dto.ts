import { AttAbsenceStatus, AttAbsenceType, AttRhEventKind } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAbsenceDto {
  @IsUUID()
  employeeId!: string;

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

export class ListAbsencesQueryDto {
  @IsOptional()
  @IsEnum(AttAbsenceStatus)
  status?: AttAbsenceStatus;

  @IsOptional()
  @IsUUID()
  employeeId?: string;
}

export class DecideAbsenceDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class CalendarQueryDto {
  @IsUUID()
  employeeId!: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class CreateRhEventDto {
  @IsUUID()
  employeeId!: string;

  @IsOptional()
  @IsEnum(AttRhEventKind)
  kind?: AttRhEventKind;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  motif!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
