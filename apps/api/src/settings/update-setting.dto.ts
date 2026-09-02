import { Allow, IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateSettingDto {
  @IsString()
  key!: string;

  @Allow()
  value!: unknown;

  @IsOptional()
  @IsIn(['USER', 'COMPANY'])
  level?: 'USER' | 'COMPANY';
}
