import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { PERMISSION_CATALOGUE } from './permission.constants';

export class CheckPermissionDto {
  @IsString()
  @IsIn([...PERMISSION_CATALOGUE])
  permissionKey!: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  siteId?: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}
