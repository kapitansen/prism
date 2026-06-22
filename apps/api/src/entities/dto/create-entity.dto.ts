import { EntityStatus, EntityType } from '@prisma/client'
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator'

// name/aliases/description are plaintext here; the service encrypts them.
export class CreateEntityDto {
  @IsEnum(EntityType)
  type!: EntityType

  @IsString()
  @MinLength(1)
  name!: string

  // Optional desired @-handle; slugified + de-duplicated. Auto-generated from
  // the name when omitted.
  @IsOptional()
  @IsString()
  handle?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[]

  @IsOptional()
  @IsString()
  description?: string

  // AI-maintained summary; user-editable so you can correct the AI's conclusions.
  @IsOptional()
  @IsString()
  digest?: string

  @IsOptional()
  @IsEnum(EntityStatus)
  status?: EntityStatus

  @IsOptional()
  @IsDateString()
  periodStart?: string

  @IsOptional()
  @IsDateString()
  periodEnd?: string
}
