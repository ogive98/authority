import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
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
