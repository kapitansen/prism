import { IsDateString, IsOptional, IsString } from 'class-validator'

// Optional filters for reading metric values (query string).
export class QueryMetricValuesDto {
  @IsOptional()
  @IsString()
  metricKey?: string

  @IsOptional()
  @IsDateString()
  from?: string

  @IsOptional()
  @IsDateString()
  to?: string
}
