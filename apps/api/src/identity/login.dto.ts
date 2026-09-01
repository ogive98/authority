import { IsEmail, IsString, MinLength } from 'class-validator';
import { IDENTITY_DEFAULTS } from './identity.constants';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(IDENTITY_DEFAULTS.passwordMinLength)
  password!: string;
}
