import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class EnqueueHelloJobDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  message?: string;
}

export class EnqueueTestJobDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  idempotencyKey!: string;
}
