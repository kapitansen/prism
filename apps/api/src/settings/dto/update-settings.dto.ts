import { IsIn, IsOptional, IsString } from 'class-validator'

// All optional — a PATCH may change any subset of settings.
export class UpdateSettingsDto {
  @IsOptional()
  @IsIn(['ru', 'en'])
  uiLanguage?: string

  @IsOptional()
  @IsIn(['light', 'dark', 'system'])
  theme?: string

  @IsOptional()
  @IsString()
  themePreset?: string

  @IsOptional()
  @IsString()
  timezone?: string
}
