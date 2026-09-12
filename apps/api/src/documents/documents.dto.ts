import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { DocLinkType, DocVisibility } from '@prisma/client';

export class CreateDocumentMetaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsEnum(DocVisibility)
  visibility?: DocVisibility;

  @IsOptional()
  @IsEnum(DocLinkType)
  linkType?: DocLinkType;

  @IsOptional()
  @IsUUID()
  linkId?: string;

  /** Optional HR dossier kind (validated by HR before pass-through). */
  @IsOptional()
  @IsUUID()
  hrDocKindId?: string;
}
