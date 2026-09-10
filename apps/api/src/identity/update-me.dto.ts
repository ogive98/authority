import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(16)
  locale?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  timezone?: string;

  /** Required when setting a new password. Floor 6 = prefs min; company may be higher (D156). */
  @ValidateIf((o: UpdateMeDto) => Boolean(o.password?.trim()))
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  currentPassword?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password?: string;

  /** HTTPS avatar URL, or empty string to clear external/local URL (D158). */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatarUrl?: string;
}
