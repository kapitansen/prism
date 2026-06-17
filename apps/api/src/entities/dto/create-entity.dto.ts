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

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[]

  @IsOptional()
  @IsString()
  description?: string

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
