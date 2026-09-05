import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateContactDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  whatsapp?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  role?: string;
}

export class CreateCustomerDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  code!: string;

  /** Creates md_party when partyId omitted. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  legalName?: string;

  @IsOptional()
  @IsUUID()
  partyId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  taxId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  nickname?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  salesRep?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  paymentTerms?: string;

  @IsOptional()
  @IsNumberString()
  creditLimit?: string;

  @IsOptional()
  @IsUUID()
  zoneId?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateContactDto)
  contacts?: CreateContactDto[];
}

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  legalName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  taxId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  nickname?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  salesRep?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  paymentTerms?: string | null;

  @IsOptional()
  @IsUUID()
  zoneId?: string | null;

  @IsInt()
  @Min(0)
  version!: number;
}

export class SetCreditDto {
  @IsNumberString()
  creditLimit!: string;

  @IsInt()
  @Min(0)
  version!: number;
}

export class BlockCustomerDto {
  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;

  @IsInt()
  @Min(0)
  version!: number;
}

export class UnblockCustomerDto {
  @IsInt()
  @Min(0)
  version!: number;
}

export class CreateZoneDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
}

export class UpdateContactDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  whatsapp?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  role?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsInt()
  @Min(0)
  version!: number;
}
