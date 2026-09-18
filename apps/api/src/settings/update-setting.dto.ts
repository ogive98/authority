import { Allow, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSettingDto {
  @IsString()
  key!: string;

  @Allow()
  value!: unknown;

  @IsOptional()
  @IsIn(['USER', 'COMPANY', 'ROLE', 'SITE', 'DOCUMENT'])
  level?: 'USER' | 'COMPANY' | 'ROLE' | 'SITE' | 'DOCUMENT';

  /** Required when level=ROLE — business role code (e.g. admin, operator). */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  roleCode?: string;

  /**
   * D303 — required when level=DOCUMENT.
   * Stable document-type code (e.g. sales.invoice), not a document instance id.
   */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  documentType?: string;
}
