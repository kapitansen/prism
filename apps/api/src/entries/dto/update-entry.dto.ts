import { EntryType } from '@prisma/client'
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator'

// All optional — a PATCH may touch any subset. (Nest's PartialType from
// @nestjs/mapped-types could derive this from CreateEntryDto; kept explicit here.)
// Passing an empty string for good/hard clears that side.
export class UpdateEntryDto {
  @IsOptional()
  @IsEnum(EntryType)
  type?: EntryType

  @IsOptional()
  @IsString()
  good?: string

  @IsOptional()
  @IsString()
  hard?: string

  @IsOptional()
  @IsString()
  title?: string

  // AI-maintained recap; user-editable so you can fix the AI's wording.
  @IsOptional()
  @IsString()
  summary?: string

  @IsOptional()
  @IsDateString()
  occurredOn?: string

  @IsOptional()
  @IsDateString()
  occurredTo?: string
}
