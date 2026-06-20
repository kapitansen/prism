import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator'

export class UpdateCbtCardDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string

  @IsOptional()
  @IsString()
  @MinLength(1)
  explanation?: string

  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  conviction?: number
}
