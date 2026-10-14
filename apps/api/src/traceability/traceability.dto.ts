import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateLotDto {
  @IsString()
  lotCode: string;

  @IsUUID()
  productId: string;

  @IsString()
  @IsOptional()
  productionDate?: string;

  @IsString()
  @IsOptional()
  expiryDate?: string;
}

export class LinkLotsDto {
  @IsUUID()
  parentLotId: string;

  @IsUUID()
  childLotId: string;

  @IsString()
  qty: string;
}

export class CreateRecallDto {
  @IsUUID()
  lotId: string;

  @IsString()
  reason: string;

  @IsUUID()
  initiatedBy: string;
}
