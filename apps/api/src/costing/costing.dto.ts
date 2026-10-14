import { IsString, IsUUID } from 'class-validator';

export class RunRollupDto {
  @IsString()
  period: string;
}

export class GetProductCostDto {
  @IsUUID()
  productId: string;
}
