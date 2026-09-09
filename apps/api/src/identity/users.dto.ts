import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export const BUSINESS_ROLE_CODES = ['admin', 'operator'] as const;
export type BusinessRoleCode = (typeof BUSINESS_ROLE_CODES)[number];

export const USER_STATUSES = [
  'INVITED',
  'ACTIVE',
  'LOCKED',
  'DISABLED',
] as const;

export class CreateCompanyUserDto {
  @IsEmail({ require_tld: false })
  @MaxLength(200)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  displayName!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsIn(BUSINESS_ROLE_CODES)
  roleCode!: BusinessRoleCode;
}

export class UpdateCompanyUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  displayName?: string;

  @IsOptional()
  @IsIn(USER_STATUSES)
  status?: (typeof USER_STATUSES)[number];

  @IsOptional()
  @IsIn(BUSINESS_ROLE_CODES)
  roleCode?: BusinessRoleCode;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string;
}
