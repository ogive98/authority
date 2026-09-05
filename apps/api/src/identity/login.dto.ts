import { IsEmail, IsString, MinLength } from 'class-validator';
import { IDENTITY_DEFAULTS } from './identity.constants';

export class LoginDto {
  /** require_tld false — demo emails use *.local */
  @IsEmail({ require_tld: false, allow_utf8_local_part: true })
  email!: string;

  @IsString()
  @MinLength(IDENTITY_DEFAULTS.passwordMinLength)
  password!: string;
}
