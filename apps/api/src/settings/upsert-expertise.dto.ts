import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Expert capture for FODEC / timbre / CNSS / IRPP / TFP.
 * Caller must supply lawRef + expertValidatedAt + valueLabel — never invent rates.
 */
export class UpsertExpertiseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  valueLabel!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(240)
  lawRef!: string;

  @IsDateString()
  expertValidatedAt!: string;

  /** Optional structured rate in basis points (100 = 1%). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  rateBps?: number;

  /** Optional fixed amount in millimes (timbre). */
  @IsOptional()
  @IsInt()
  @Min(0)
  amountMilli?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
