import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCcpDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsString()
  criticalLimit: string;

  @IsString()
  unit: string;

  @IsUUID()
  @IsOptional()
  siteId?: string;
}

export class CreateRecordDto {
  @IsUUID()
  ccpId: string;

  @IsString()
  value: string;

  @IsBoolean()
  inSpec: boolean;

  @IsUUID()
  recordedBy: string;

  @IsString()
  recordedAt: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateAuditDto {
  @IsString()
  auditDate: string;

  @IsString()
  auditor: string;

  @IsOptional()
  findings?: any;

  @IsString()
  @IsOptional()
  status?: string;
}
