import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateBackupDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;

  @IsOptional()
  @IsIn(['CONFIGURATION', 'DATABASE'])
  scope?: 'CONFIGURATION' | 'DATABASE';
}

export class RequestRestoreDto {
  @IsBoolean()
  confirm!: boolean;

  /** Session password step-up (required). */
  @IsString()
  @MaxLength(200)
  password!: string;
}

export class ApproveRestoreDto {
  /** Session password step-up (required). */
  @IsString()
  @MaxLength(200)
  password!: string;
}

export class ApplyRestoreDto {
  /** Session password step-up (required). */
  @IsString()
  @MaxLength(200)
  password!: string;

  /** Must equal RESTORE */
  @IsString()
  @MaxLength(32)
  confirmPhrase!: string;
}

export class SpecificFoldersValidateDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  folders!: string[];
}

export class SpecificFoldersPreviewDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  folders!: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  includePatterns?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludePatterns?: string[];
}

export class SpecificFoldersJobDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  folders!: string[];

  @IsIn(['LOCAL_DISK', 'DOWNLOAD'])
  destinationMode!: 'LOCAL_DISK' | 'DOWNLOAD';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  includePatterns?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludePatterns?: string[];

  @IsOptional()
  @IsBoolean()
  verifyAfterBackup?: boolean;
}

/** D314 — create folder under company sandbox or LOCAL_DISK. */
export class BackupMkdirDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  path?: string;

  @IsString()
  @MaxLength(64)
  name!: string;
}
