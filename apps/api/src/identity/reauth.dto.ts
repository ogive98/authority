import { IsString, MinLength } from 'class-validator';
import { IDENTITY_DEFAULTS } from './identity.constants';

export class ReauthDto {
  @IsString()
  @MinLength(IDENTITY_DEFAULTS.passwordMinLength)
  password!: string;
}
