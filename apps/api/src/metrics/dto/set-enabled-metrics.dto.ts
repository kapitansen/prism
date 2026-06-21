import { ArrayMaxSize, IsArray, IsString } from 'class-validator'

// The keys of the metrics the user actively tracks. Capped at 4.
export class SetEnabledMetricsDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(4)
  keys!: string[]
}
