import { IsDateString, IsNumber, IsString, MinLength } from 'class-validator'

// One manual reading for a metric on a day (e.g. a "Today" chip tap).
export class RecordMetricValueDto {
  @IsString()
  @MinLength(1)
  metricKey!: string

  @IsNumber()
  value!: number

  @IsDateString()
  occurredOn!: string
}
