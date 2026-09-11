import { Allow, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSettingDto {
  @IsString()
  key!: string;

  @Allow()
  value!: unknown;

  @IsOptional()
  @IsIn(['USER', 'COMPANY', 'ROLE'])
  level?: 'USER' | 'COMPANY' | 'ROLE';

  /** Required when level=ROLE — business role code (e.g. admin, operator). */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  roleCode?: string;
}
