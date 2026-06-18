import { EntityType } from '@prisma/client'
import { IsEnum, IsOptional } from 'class-validator'

// Optional ?type= filter (e.g. the "People" screen lists type=person).
export class ListEntitiesDto {
  @IsOptional()
  @IsEnum(EntityType)
  type?: EntityType
}
