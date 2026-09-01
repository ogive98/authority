import { IsString, Length, Matches } from 'class-validator';

export class MfaVerifyDto {
  @IsString()
  mfaToken!: string;

  @IsString()
  @Length(6, 8)
  @Matches(/^\d+$/)
  code!: string;
}
