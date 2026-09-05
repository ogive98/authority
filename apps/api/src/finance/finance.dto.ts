import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateOpenItemDto {
  @IsUUID()
  customerId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  amountTotal!: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsUUID()
  salesOrderId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;
}

export class AllocateOpenItemDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  amount!: number;

  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  note?: string;
}
