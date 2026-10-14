import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { QuaCheckResult, QuaCheckTarget, QuaNcrSeverity } from '@prisma/client';

export class CreateCheckDto {
  @IsEnum(QuaCheckTarget)
  target: QuaCheckTarget;

  @IsUUID()
  targetId: string;

  @IsUUID()
  @IsOptional()
  lotId?: string;

  @IsEnum(QuaCheckResult)
  @IsOptional()
  result?: QuaCheckResult;

  @IsOptional()
  measures?: any;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsUUID()
  @IsOptional()
  checkedBy?: string;
}

export class CreateNcrDto {
  @IsEnum(QuaNcrSeverity)
  severity: QuaNcrSeverity;

  @IsString()
  description: string;

  @IsUUID()
  @IsOptional()
  lotId?: string;

  @IsUUID()
  @IsOptional()
  checkId?: string;

  @IsUUID()
  @IsOptional()
  openedBy?: string;
}

export class CloseNcrDto {
  @IsString()
  disposition: string;

  @IsUUID()
  closedBy: string;
}

export class HoldLotDto {
  @IsUUID()
  lotId: string;

  @IsString()
  reason: string;

  @IsUUID()
  heldBy: string;
}

export class ReleaseLotDto {
  @IsUUID()
  lotId: string;

  @IsUUID()
  releasedBy: string;
}
