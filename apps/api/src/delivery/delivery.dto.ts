import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateShipmentDto {
  @IsUUID()
  orderId!: string;

  /** Assigned driver; falls back to order preferredDriver when omitted. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  driverLabel?: string;
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
