import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common'

import { AuthUser } from '../auth/auth-user.interface'
import { CurrentUser } from '../auth/current-user.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { QueryMetricValuesDto } from './dto/query-metric-values.dto'
import { RecordMetricValueDto } from './dto/record-metric-value.dto'
import { SetEnabledMetricsDto } from './dto/set-enabled-metrics.dto'
import { MetricsService } from './metrics.service'

@UseGuards(JwtAuthGuard)
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('definitions')
  listDefinitions(@CurrentUser() user: AuthUser) {
    return this.metrics.listDefinitions(user.id)
  }

  // Set the actively-tracked metric set (≤4 enabled).
  @Put('enabled')
  setEnabled(@CurrentUser() user: AuthUser, @Body() dto: SetEnabledMetricsDto) {
    return this.metrics.setEnabled(user.id, dto.keys)
  }

  @Get('values')
  listValues(@CurrentUser() user: AuthUser, @Query() q: QueryMetricValuesDto) {
    return this.metrics.listValues(user.id, q)
  }

  // PUT: recording is idempotent (upsert by metric + day).
  @Put('values')
  recordValue(
    @CurrentUser() user: AuthUser,
    @Body() dto: RecordMetricValueDto,
  ) {
    return this.metrics.recordValue(user.id, dto)
  }
}
