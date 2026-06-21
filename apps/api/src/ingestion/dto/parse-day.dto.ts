import { Type } from 'class-transformer'
import {
  IsArray,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator'

// One answered clarifying question. Nothing is stored server-side between
// rounds, so the client sends all answered Q&A back each parse call.
class AnsweredQuestionDto {
  @IsString()
  @MinLength(1)
  question!: string

  @IsString()
  answer!: string
}

export class ParseDayDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnsweredQuestionDto)
  answers?: AnsweredQuestionDto[]
}
