import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { OrgSiteType } from '@prisma/client';

export class CreateSiteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(16)
  code!: string;

  @IsEnum(OrgSiteType)
  type!: OrgSiteType;
}
