import { IsString, MinLength } from 'class-validator'

export class CreateCbtCardDto {
  @IsString()
  @MinLength(1)
  title!: string

  @IsString()
  @MinLength(1)
  explanation!: string
}
