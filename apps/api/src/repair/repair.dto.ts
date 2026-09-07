import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class HealthScanDto {
  @IsIn(['L0', 'L1', 'L2', 'L3', 'L4'])
  depth!: 'L0' | 'L1' | 'L2' | 'L3' | 'L4';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  domains?: string[];

  @IsOptional()
  @IsUUID()
  companyId?: string;
}

export class PlanDto {
  @IsOptional()
  @IsUUID()
  findingId?: string;

  @IsOptional()
  @IsString()
  scenarioId?: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;
}

export class ExecuteDto {
  @IsUUID()
  executionId!: string;

  @IsBoolean()
  confirm!: boolean;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export class RollbackDto {
  @IsUUID()
  executionId!: string;
}

export class ResetScopeDto {
  @IsString()
  scope!: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsBoolean()
  confirm?: boolean;
}

export class SnapshotDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsString()
  label?: string;
}

export class VerifyDto {
  @IsUUID()
  executionId!: string;
}
