import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class ClaimDeviceDto {
  @IsString()
  @Length(6, 12)
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  fingerprint?: string;
}
