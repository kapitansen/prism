import { EntityStatus, EntityType } from '@prisma/client'
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator'

// All optional — a PATCH may touch any subset.
export class UpdateEntityDto {
  @IsOptional()
  @IsEnum(EntityType)
  type?: EntityType

  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string

  // Changing this rewrites @old → @new in the user's entry texts (links stay by id).
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
