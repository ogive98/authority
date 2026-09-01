import { IsOptional, IsUUID } from 'class-validator';

export class SetContextDto {
  @IsUUID()
  companyId!: string;

  @IsOptional()
  @IsUUID()
  siteId?: string;
}
