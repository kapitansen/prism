import { EntryType } from '@prisma/client'
import { Type } from 'class-transformer'
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator'

// Pagination for the journal feed (newest first, load earlier on scroll).
// Query params arrive as strings — @Type coerces them to numbers.
export class ListEntriesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number

  // Filter to a single calendar day (used by the "Today" draft lookup).
  @IsOptional()
  @IsDateString()
  on?: string

  @IsOptional()
  @IsEnum(EntryType)
  type?: EntryType
}
