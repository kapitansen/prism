import { EntryType } from '@prisma/client'
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator'

// `body`/`title` are plaintext here; the service encrypts them into *_enc.
export class CreateEntryDto {
  @IsEnum(EntryType)
  type!: EntryType

  @IsString()
  @MinLength(1)
  body!: string

  @IsOptional()
  @IsString()
  title?: string

  // Normally written by the AI on commit; accepted here for completeness.
  @IsOptional()
  @IsString()
  summary?: string

  @IsDateString()
  occurredOn!: string

  @IsOptional()
  @IsDateString()
  occurredTo?: string
}
