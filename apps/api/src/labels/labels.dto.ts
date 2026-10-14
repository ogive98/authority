import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsString()
  zpl: string;

  @IsInt()
  @Min(1)
  widthMm: number;

  @IsInt()
  @Min(1)
  heightMm: number;
}

export class RenderLabelDto {
  @IsUUID()
  templateId: string;

  @IsUUID()
  @IsOptional()
  lotId?: string;

  @IsOptional()
  data?: any;

  @IsString()
  @IsOptional()
  printerName?: string;
}
