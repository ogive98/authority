import {
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  BUSINESS_ROLE_CODES,
  type BusinessRoleCode,
} from './business-roles';

export { BUSINESS_ROLE_CODES, type BusinessRoleCode };

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
  @MinLength(6)
  @MaxLength(128)
  password!: string;

  @IsIn(BUSINESS_ROLE_CODES)
  roleCode!: BusinessRoleCode;
}

/** Invite without password — user sets MDP via /invite/:token (D118). */
export class InviteCompanyUserDto {
  @IsEmail({ require_tld: false })
  @MaxLength(200)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  displayName!: string;

  @IsIn(BUSINESS_ROLE_CODES)
  roleCode!: BusinessRoleCode;
}

/** Public accept invite body (D118). */
export class AcceptInviteDto {
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password!: string;
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
  @MinLength(6)
  @MaxLength(128)
  password?: string;
}

export class SetUserGrantsDto {
  /** Company-scoped USER ALLOW keys (replaces previous company USER ALLOW). */
  @IsArray()
  @IsString({ each: true })
  allowKeys!: string[];
}

