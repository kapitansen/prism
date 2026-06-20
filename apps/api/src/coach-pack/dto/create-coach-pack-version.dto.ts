import { IsObject, IsOptional, IsString } from 'class-validator'

// A new coach-pack version is a full snapshot of the editable layers. Each save
// creates a new row; the latest becomes active (history = rollback).
export class CreateCoachPackVersionDto {
  @IsString()
  analysisMd!: string

  @IsString()
  voiceMd!: string

  @IsOptional()
  @IsObject()
  thresholdsJson?: Record<string, unknown>

  @IsOptional()
  @IsString()
  sourceNote?: string
}
