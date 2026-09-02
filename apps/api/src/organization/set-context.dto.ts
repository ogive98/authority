import { Transform } from 'class-transformer';
import { IsOptional, IsUUID } from 'class-validator';

function trimToUndefined(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export class SetContextDto {
  @IsUUID()
  @Transform(({ value }: { value: unknown }) => trimToUndefined(value))
  companyId!: string;

  @IsOptional()
  @IsUUID()
  @Transform(({ value }: { value: unknown }) => trimToUndefined(value))
  siteId?: string;
}
