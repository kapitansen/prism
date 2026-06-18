import { Type } from 'class-transformer'
import { IsInt, IsOptional, Max, Min } from 'class-validator'

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
}
