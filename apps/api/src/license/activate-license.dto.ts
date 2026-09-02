import {
  IsInt,
  IsISO8601,
  IsObject,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class LicensePayloadDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  plan!: string;

  @IsInt()
  @Min(1)
  @Max(10000)
  maxSites!: number;

  @IsInt()
  @Min(1)
  @Max(100000)
  maxUsers!: number;

  @IsISO8601()
  expiresAt!: string;

  @IsISO8601()
  issuedAt!: string;
}

export class ActivateLicenseDto {
  @IsObject()
  @ValidateNested()
  @Type(() => LicensePayloadDto)
  payload!: LicensePayloadDto;

  @IsString()
  @MinLength(32)
  @MaxLength(128)
  signature!: string;
}
