import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PtlClaimType } from '@prisma/client';

/** Portal create line — qty only; unitPrice resolved server-side (last customer price). */
export class PortalCreateOrderLineDto {
  @IsUUID()
  productId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  qty!: number;
}

export class PortalCreateOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PortalCreateOrderLineDto)
  lines!: PortalCreateOrderLineDto[];

  @IsOptional()
  @IsDateString()
  requestedDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  preferredDriver?: string;
}

export class PortalReorderDto {
  @IsOptional()
  @IsDateString()
  requestedDate?: string;
}

export class PortalCreateClaimDto {
  @IsEnum(PtlClaimType)
  type!: PtlClaimType;

  @IsString()
  @MaxLength(160)
  subject!: string;

  @IsString()
  @MaxLength(2000)
  description!: string;

  @IsOptional()
  @IsUUID()
  orderId?: string;

  @IsOptional()
  @IsUUID()
  shipmentId?: string;
}
