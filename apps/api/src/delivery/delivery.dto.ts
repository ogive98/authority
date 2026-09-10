import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateRoundDto {
  /** Calendar day of the route (ISO date). */
  @IsDateString()
  date!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  driverLabel!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CreateShipmentDto {
  @IsUUID()
  orderId!: string;

  /** Assigned driver; falls back to order preferredDriver when omitted. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  driverLabel?: string;

  /** Optional planned round to attach on create. */
  @IsOptional()
  @IsUUID()
  roundId?: string;
}

export class AttachRoundDto {
  @IsUUID()
  roundId!: string;
}

export class AssignDriverDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  driverLabel!: string;
}

export class FailShipmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class CompleteShipmentLineDto {
  @IsUUID()
  orderLineId!: string;

  /** Qty delivered for this order line (0 = not delivered). */
  @IsNumber()
  @Min(0)
  qty!: number;
}

/**
 * Omit `lines` (or omit body) → full delivery (backward compatible).
 * When `lines` is present, omitted order lines are treated as qty 0.
 */
export class CompleteShipmentDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CompleteShipmentLineDto)
  lines?: CompleteShipmentLineDto[];
}
