import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/** AUTHORITY X → Thunder intent prepare (orchestration only · no ledger writes) */
export class IntentPrepareDto {
  @IsString()
  @MaxLength(512)
  raw!: string;

  /** Optional UI-picked entity when ambiguous */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  entityKind?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;
}
