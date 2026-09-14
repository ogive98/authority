import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { FLEET_VEHICLE_STATUSES } from './fleet.constants';

export class CreateVehicleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  plate!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  capacityKg?: number;

  @IsOptional()
  @IsBoolean()
  cold?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  odometerKm?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateVehicleDto {
  @IsInt()
  @Min(0)
  version!: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  plate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  capacityKg?: number | null;

  @IsOptional()
  @IsBoolean()
  cold?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  odometerKm?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;

  @IsOptional()
  @IsIn([...FLEET_VEHICLE_STATUSES])
  status?: (typeof FLEET_VEHICLE_STATUSES)[number];
}

export class CreateAssignmentDto {
  @IsUUID()
  roundId!: string;

  @IsUUID()
  vehicleId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  driverLabel!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  payloadKg?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
