import { EntryType } from '@prisma/client'
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator'

// Plaintext here; the service encrypts text fields into *_enc. The day text is
// split into two parallel sides — `good` (what went well) and `hard`
// (difficulties). Both optional at the type level; the service rejects a create
// where both are empty (an entry must carry at least one side).
export class CreateEntryDto {
  @IsEnum(EntryType)
  type!: EntryType

  @IsOptional()
  @IsString()
  good?: string

  @IsOptional()
  @IsString()
  hard?: string

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
