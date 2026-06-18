import { Transform } from 'class-transformer'
import { IsBoolean, IsOptional } from 'class-validator'

export class ListCbtCardsDto {
  // ?favorite=true → only the review deck
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  favorite?: boolean
}
